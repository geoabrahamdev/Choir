import { describe, it, expect } from "vitest";
import {
  random,
  cosineSim,
  blend,
  drift,
  normalise,
  centroid,
  makeRng
} from "../src/core/LatentState.js";

const DIM = 32;

function isUnit(v: Float32Array, tol = 1e-5): boolean {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.abs(Math.sqrt(s) - 1) < tol;
}

describe("LatentState", () => {
  it("random produces a unit vector of the right dimension", () => {
    const v = random(DIM, makeRng(42));
    expect(v.length).toBe(DIM);
    expect(isUnit(v)).toBe(true);
  });

  it("cosineSim(v, v) === 1", () => {
    const v = random(DIM, makeRng(1));
    expect(cosineSim(v, v)).toBeCloseTo(1, 6);
  });

  it("cosineSim of orthogonal unit vectors ≈ 0", () => {
    const a = new Float32Array(DIM);
    const b = new Float32Array(DIM);
    a[0] = 1;
    b[1] = 1;
    expect(cosineSim(a, b)).toBeCloseTo(0, 6);
  });

  it("cosineSim of opposite unit vectors ≈ -1", () => {
    const a = new Float32Array(DIM);
    const b = new Float32Array(DIM);
    a[0] = 1;
    b[0] = -1;
    expect(cosineSim(a, b)).toBeCloseTo(-1, 6);
  });

  it("blend(a,b,0) ≈ a (both unit)", () => {
    const a = random(DIM, makeRng(2));
    const b = random(DIM, makeRng(3));
    const out = blend(a, b, 0);
    expect(cosineSim(out, a)).toBeCloseTo(1, 5);
  });

  it("blend(a,b,1) ≈ b (both unit)", () => {
    const a = random(DIM, makeRng(4));
    const b = random(DIM, makeRng(5));
    const out = blend(a, b, 1);
    expect(cosineSim(out, b)).toBeCloseTo(1, 5);
  });

  it("blend preserves unit length for any α ∈ [0,1]", () => {
    const a = random(DIM, makeRng(6));
    const b = random(DIM, makeRng(7));
    for (const alpha of [0, 0.1, 0.3, 0.5, 0.7, 1]) {
      const out = blend(a, b, alpha);
      expect(isUnit(out)).toBe(true);
    }
  });

  it("normalise of a zero vector returns a canonical unit vector", () => {
    const z = new Float32Array(DIM);
    const out = normalise(z);
    expect(isUnit(out)).toBe(true);
  });

  it("drift is bounded: output is unit length and close to input for small noise", () => {
    const v = random(DIM, makeRng(10));
    const bias = random(DIM, makeRng(11));
    const next = drift(v, bias, 0.02, makeRng(12));
    expect(isUnit(next)).toBe(true);
    // Small noise + small bias pull: cosine sim with original stays very high.
    expect(cosineSim(v, next)).toBeGreaterThan(0.9);
  });

  it("centroid of identical vectors equals that vector", () => {
    const v = random(DIM, makeRng(20));
    const c = centroid([v, v, v, v]);
    expect(cosineSim(c, v)).toBeCloseTo(1, 5);
    expect(isUnit(c)).toBe(true);
  });

  it("centroid of random vectors is a unit vector", () => {
    const vs = Array.from({ length: 50 }, (_, i) => random(DIM, makeRng(100 + i)));
    const c = centroid(vs);
    expect(isUnit(c)).toBe(true);
  });
});
