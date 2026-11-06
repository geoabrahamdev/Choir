/**
 * RTCTransport — real WebRTC transport via peerjs. §9.M3.2.
 *
 * Signaling strategy (§11, pragmatic alternative):
 *   On boot, each tab gets a random PeerJS id of the form
 *   `choir-<8 hex chars>`. It reads a static `/bootstrap-peers.json`
 *   from GitHub Pages (merged with recently-seen peer ids it cached
 *   in localStorage) and dials those. Every established peer is
 *   remembered in localStorage so the next boot has fresh seeds even
 *   if the static file is stale. If after SIGNALING_TIMEOUT_MS the
 *   PeerJS broker hasn't opened our own id, we surface a failure so
 *   the app can fall back to Local mode (§9.M3.5).
 *
 * Message framing: gossip messages are serialised as compact little-
 * endian binary: 1-byte version, 1-byte id-length, id bytes,
 * 4-byte version, LATENT_DIM × float32. For a 32-dim vector this is
 * ~140 bytes incl. a short id.
 *
 * This file is the ONLY one that knows the signaling endpoint —
 * swap PeerJS for a Cloudflare Worker running peerjs-server by
 * editing the Peer config below (§17 trap #4).
 */

import Peer, { type DataConnection } from "peerjs";
import { CONFIG } from "../app/config.js";
import type { LatentState } from "../core/LatentState.js";
import type {
  GossipMessage,
  MessageHandler,
  PeerTransport
} from "./PeerTransport.js";

const SIGNALING_TIMEOUT_MS = 10_000;
const MAX_CONNECTIONS = 12;
const BOOTSTRAP_URL = "bootstrap-peers.json"; // resolved against BASE_URL
const LS_SEEN_PEERS = "choir.seenPeers";
const ID_PREFIX = "choir-";
const WIRE_VERSION = 1;

interface BootstrapFile {
  peers: string[];
}

function randomHex(n: number): string {
  const bytes = new Uint8Array(Math.ceil(n / 2));
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out.slice(0, n);
}

function readSeenPeers(): string[] {
  try {
    const raw = localStorage.getItem(LS_SEEN_PEERS);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (Array.isArray(arr))
      return arr.filter((x): x is string => typeof x === "string").slice(0, 32);
    return [];
  } catch {
    return [];
  }
}

function pushSeenPeer(id: string): void {
  try {
    const seen = readSeenPeers().filter((p) => p !== id);
    seen.unshift(id);
    localStorage.setItem(LS_SEEN_PEERS, JSON.stringify(seen.slice(0, 32)));
  } catch {
    /* localStorage unavailable; ignore */
  }
}

/** Encode a GossipMessage as a compact ArrayBuffer. */
function encode(msg: GossipMessage): ArrayBuffer {
  const idBytes = new TextEncoder().encode(msg.fromId);
  if (idBytes.length > 255) throw new Error("fromId too long");
  const totalBytes = 1 + 1 + idBytes.length + 4 + msg.latent.length * 4;
  const buf = new ArrayBuffer(totalBytes);
  const view = new DataView(buf);
  let off = 0;
  view.setUint8(off++, WIRE_VERSION);
  view.setUint8(off++, idBytes.length);
  new Uint8Array(buf, off, idBytes.length).set(idBytes);
  off += idBytes.length;
  view.setUint32(off, msg.version, true);
  off += 4;
  for (let i = 0; i < msg.latent.length; i++) {
    view.setFloat32(off, msg.latent[i], true);
    off += 4;
  }
  return buf;
}

function decode(data: ArrayBuffer | Uint8Array): GossipMessage | null {
  const buf = data instanceof Uint8Array ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data;
  const view = new DataView(buf);
  if (view.byteLength < 6) return null;
  let off = 0;
  const ver = view.getUint8(off++);
  if (ver !== WIRE_VERSION) return null;
  const idLen = view.getUint8(off++);
  if (view.byteLength < 2 + idLen + 4) return null;
  const idBytes = new Uint8Array(buf, off, idLen);
  const fromId = new TextDecoder().decode(idBytes);
  if (!/^choir-[0-9a-f]{8}$/i.test(fromId)) return null;
  off += idLen;
  const version = view.getUint32(off, true);
  off += 4;
  const latentBytes = view.byteLength - off;
  const dim = latentBytes / 4;
  if (!Number.isInteger(dim) || dim !== CONFIG.LATENT_DIM) return null;
  const latent: LatentState = new Float32Array(dim);
  for (let i = 0; i < dim; i++) {
    latent[i] = view.getFloat32(off, true);
    if (!Number.isFinite(latent[i])) return null;
    off += 4;
  }
  return { fromId, version, latent };
}

export interface RTCTransportOptions {
  /** Resolved absolute URL of bootstrap-peers.json. */
  bootstrapUrl?: string;
  /** Called when the transport finishes initial signaling (own id is open). */
  onReady?: (localId: string) => void;
  /** Called with the current peer count whenever it changes. */
  onPeerCountChanged?: (n: number) => void;
}

export class RTCTransport implements PeerTransport {
  private peer: Peer;
  private readyPromise: Promise<void>;
  private connections = new Map<string, DataConnection>();
  private messageHandlers = new Set<MessageHandler>();
  private peerLeaveHandlers = new Set<(peerId: string) => void>();
  private localIdStr: string;
  private readyResolve!: () => void;
  private readyReject!: (err: Error) => void;
  private opts: Required<RTCTransportOptions>;
  private timeoutHandle: number;
  private readySettled = false;
  private closed = false;

  constructor(opts: RTCTransportOptions = {}) {
    this.opts = {
      bootstrapUrl: opts.bootstrapUrl ?? BOOTSTRAP_URL,
      onReady: opts.onReady ?? (() => {}),
      onPeerCountChanged: opts.onPeerCountChanged ?? (() => {})
    };
    this.localIdStr = ID_PREFIX + randomHex(8);
    this.peer = new Peer(this.localIdStr, {
      host: CONFIG.WEB_RTC_SIGNALING_HOST,
      port: CONFIG.WEB_RTC_SIGNALING_PORT,
      path: CONFIG.WEB_RTC_SIGNALING_PATH,
      secure: CONFIG.WEB_RTC_SIGNALING_PORT === 443,
      debug: 0
    });

    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });

    this.timeoutHandle = window.setTimeout(() => {
      this.rejectReady(new Error("RTCTransport: signaling timeout"));
    }, SIGNALING_TIMEOUT_MS);

    this.peer.on("open", (id) => {
      window.clearTimeout(this.timeoutHandle);
      if (this.closed) return;
      this.localIdStr = id;
      this.opts.onReady(id);
      this.resolveReady();
      this.dialBootstrap().catch((err) => {
        console.warn("[choir] bootstrap dial failed:", err);
      });
    });

    this.peer.on("error", (err) => {
      console.warn("[choir] peerjs error:", err);
      // Some errors are non-fatal (e.g., "could not connect to peer"); only
      // reject readyPromise if we never opened.
      if (!this.ready()) this.rejectReady(err as Error);
    });

    this.peer.on("connection", (conn) => this.wireConnection(conn, true));
  }

  waitReady(): Promise<void> {
    return this.readyPromise;
  }

  private ready(): boolean {
    return (this.peer as unknown as { open?: boolean }).open === true;
  }

  send(toId: string, msg: GossipMessage): void {
    const conn = this.connections.get(toId);
    if (!conn || !conn.open) return;
    try {
      conn.send(encode(msg));
    } catch {
      /* drop on error */
    }
  }

  onMessage(cb: MessageHandler): () => void {
    this.messageHandlers.add(cb);
    return () => this.messageHandlers.delete(cb);
  }

  onPeerLeave(cb: (peerId: string) => void): () => void {
    this.peerLeaveHandlers.add(cb);
    return () => this.peerLeaveHandlers.delete(cb);
  }

  peers(): string[] {
    const out: string[] = [];
    for (const [id, c] of this.connections) if (c.open) out.push(id);
    return out;
  }

  localId(): string {
    return this.localIdStr;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    window.clearTimeout(this.timeoutHandle);
    this.rejectReady(new Error("RTCTransport: closed"));
    for (const conn of this.connections.values()) conn.close();
    this.connections.clear();
    this.messageHandlers.clear();
    this.peerLeaveHandlers.clear();
    this.peer.destroy();
  }

  private resolveReady(): void {
    if (this.readySettled) return;
    this.readySettled = true;
    this.readyResolve();
  }

  private rejectReady(err: Error): void {
    if (this.readySettled) return;
    this.readySettled = true;
    this.readyReject(err);
  }

  private async dialBootstrap(): Promise<void> {
    let bootstrap: string[] = readSeenPeers();
    try {
      const res = await fetch(this.opts.bootstrapUrl, { cache: "no-store" });
      if (res.ok) {
        const file = (await res.json()) as BootstrapFile;
        if (Array.isArray(file.peers)) {
          bootstrap = Array.from(new Set([...file.peers, ...bootstrap]));
        }
      }
    } catch {
      /* fall through — localStorage seeds only */
    }
    const toDial = bootstrap
      .filter((id) => id && id !== this.localIdStr)
      .slice(0, MAX_CONNECTIONS);
    for (const id of toDial) this.dial(id);
  }

  private dial(id: string): void {
    if (this.closed || this.connections.has(id) || this.connections.size >= MAX_CONNECTIONS) return;
    try {
      const conn = this.peer.connect(id, { reliable: false });
      this.wireConnection(conn, false);
    } catch (err) {
      console.warn("[choir] dial failed:", id, err);
    }
  }

  private wireConnection(conn: DataConnection, inbound: boolean): void {
    if (this.closed) {
      conn.close();
      return;
    }
    const id = conn.peer;
    if (!/^choir-[0-9a-f]{8}$/i.test(id)) {
      conn.close();
      return;
    }
    if (!this.connections.has(id) && this.connections.size >= MAX_CONNECTIONS) {
      conn.close();
      return;
    }
    // Replace a stale entry if one exists.
    const prev = this.connections.get(id);
    if (prev && prev !== conn) prev.close();
    this.connections.set(id, conn);

    const bumpPeers = () => this.opts.onPeerCountChanged(this.peers().length);

    conn.on("open", () => {
      pushSeenPeer(id);
      bumpPeers();
    });
    conn.on("close", () => {
      if (this.connections.get(id) === conn) {
        this.connections.delete(id);
        for (const h of this.peerLeaveHandlers) h(id);
        bumpPeers();
      }
    });
    conn.on("error", () => {
      if (this.connections.get(id) === conn) {
        this.connections.delete(id);
        for (const h of this.peerLeaveHandlers) h(id);
        bumpPeers();
      }
    });
    conn.on("data", (data) => {
      let msg: GossipMessage | null = null;
      if (data instanceof ArrayBuffer) msg = decode(data);
      else if (data instanceof Uint8Array) msg = decode(data);
      else if (ArrayBuffer.isView(data as ArrayBufferView)) {
        const view = data as ArrayBufferView;
        msg = decode(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
      }
      // One browser owns one live identity. Do not allow a connection to
      // manufacture arbitrary remote agents through the payload.
      if (msg && msg.fromId !== id) msg = null;
      if (msg) {
        for (const h of this.messageHandlers) h(msg, id);
      }
    });
    void inbound;
  }
}
