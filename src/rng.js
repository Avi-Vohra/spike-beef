// Deterministic seeded RNG (mulberry32), operating on a plain integer seed
// so it can live inside serializable state. Same seed -> same sequence.
export function stepRandom(seed) {
  let a = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, a];
}
