/* coi-serviceworker — vendored. Adds COOP/COEP headers to all responses it
 * intercepts, so the page becomes cross-origin isolated and SharedArrayBuffer
 * is available. Enabled only when the page explicitly registers it.
 * Original: https://github.com/gzuidhof/coi-serviceworker (MIT).
 * Trimmed for this project's needs. */
/* eslint-disable */
(() => {
  if (typeof window !== "undefined") {
    if (!window.crossOriginIsolated && !window.sessionStorage.getItem("coiReloaded")) {
      window.sessionStorage.setItem("coiReloaded", "1");
      // Register the SW and reload once headers can apply.
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register(window.document.currentScript.src).then((reg) => {
          reg.addEventListener("updatefound", () => {
            const w = reg.installing;
            if (!w) return;
            w.addEventListener("statechange", () => {
              if (w.state === "activated") window.location.reload();
            });
          });
          if (reg.active && !navigator.serviceWorker.controller) window.location.reload();
        });
      }
    } else if (window.crossOriginIsolated) {
      window.sessionStorage.removeItem("coiReloaded");
    }
    return;
  }

  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
  self.addEventListener("message", (ev) => {
    if (ev.data && ev.data.type === "deregister") {
      self.registration.unregister().then(() => self.clients.matchAll()).then((cs) =>
        cs.forEach((c) => c.navigate(c.url))
      );
    }
  });
  self.addEventListener("fetch", (ev) => {
    const req = ev.request;
    if (req.cache === "only-if-cached" && req.mode !== "same-origin") return;
    ev.respondWith(
      fetch(req).then((res) => {
        if (res.status === 0) return res;
        const headers = new Headers(res.headers);
        headers.set("Cross-Origin-Embedder-Policy", "require-corp");
        headers.set("Cross-Origin-Opener-Policy", "same-origin");
        return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
      }).catch((e) => console.error(e))
    );
  });
})();
