// Deterministic random numbers: the route, clouds and city blocks are built
// from one seed, so every player flies the same coastline.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rand, list) {
  return list[Math.floor(rand() * list.length)];
}

// Smooth 1-D value noise from a seeded table, for hills and coastlines.
export function makeNoise1D(seed, size = 256) {
  const rand = mulberry32(seed);
  const table = new Float32Array(size);
  for (let i = 0; i < size; i++) table[i] = rand();
  const at = (x) => {
    const xi = Math.floor(x);
    const xf = x - xi;
    const a = table[((xi % size) + size) % size];
    const b = table[(((xi + 1) % size) + size) % size];
    const u = xf * xf * (3 - 2 * xf);
    return a + (b - a) * u;
  };
  return at;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

export function wrapAngleDeg(deg) {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export function formatFeet(ft) {
  return `${Math.round(ft).toLocaleString('en-US')} ft`;
}

export function formatKnots(kts) {
  return `${Math.round(kts)} kt`;
}

export function compassPoint(headingDeg) {
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.round((((headingDeg % 360) + 360) % 360) / 22.5) % 16;
  return points[idx];
}
