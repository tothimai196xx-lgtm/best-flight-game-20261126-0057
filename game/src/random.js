// Seeded randomness for Golden Hour Courier: mulberry32 plus a small value-noise
// field, so every island's terrain is stable for a seed and screenshots are
// reproducible with ?seed=N.

export function createRandom(seed) {
  let a = seed >>> 0;
  function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range: (lo, hi) => lo + next() * (hi - lo),
    int: (lo, hi) => Math.floor(lo + next() * (hi - lo + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
  };
}

// 2D value noise with smooth interpolation; fbm stacks octaves.
export function makeNoise(seed) {
  const rand = createRandom(seed);
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand.next() * (i + 1));
    const t = base[i]; base[i] = base[j]; base[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];
  const grad = (h) => (h & 1) ? -1 : 1;
  function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const aa = perm[(perm[xi & 255] + yi) & 255] / 255;
    const ab = perm[(perm[xi & 255] + yi + 1) & 255] / 255;
    const ba = perm[(perm[(xi + 1) & 255] + yi) & 255] / 255;
    const bb = perm[(perm[(xi + 1) & 255] + yi + 1) & 255] / 255;
    const x1 = aa + (ba - aa) * u, x2 = ab + (bb - ab) * u;
    return (x1 + (x2 - x1) * v) * 2 - 1;
  }
  return {
    noise2,
    fbm(x, y, octaves = 4) {
      let sum = 0, amp = 1, freq = 1, norm = 0;
      for (let o = 0; o < octaves; o++) {
        sum += noise2(x * freq, y * freq) * amp;
        norm += amp; amp *= 0.5; freq *= 2.1;
      }
      return sum / norm;
    },
  };
}
