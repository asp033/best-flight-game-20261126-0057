// The coastline route: a fixed chain of terrain segments the courier flies
// over — open sea, the city skyline, farmland, a mountain ridge, and the
// coastal runway where the sortie ends. Pure data: no drawing here.
import { ROUTE } from './config.js';
import { mulberry32, makeNoise1D, clamp, lerp } from './rng.js';

// Ground elevation (feet) for each kind of ground.
const ELEVATION = {
  sea: 0,
  city: 120,
  farmland: 320,
  hills: 1250,
  mountains: 3400,
  runway: 80,
};

// Build the route once from the seed: segment kinds, a smooth elevation
// profile, and the fixed positions of the city blocks and runway lights.
export function buildRoute(seed = ROUTE.seed) {
  const rand = mulberry32(seed);
  const noise = makeNoise1D(seed ^ 0x9e3779b9);
  const kinds = ['sea', 'sea', 'city', 'farmland', 'hills', 'mountains', 'hills', 'city', 'runway'];
  const segmentLengthNm = ROUTE.totalLengthNm / kinds.length;
  const segments = kinds.map((kind, i) => ({
    kind,
    startNm: i * segmentLengthNm,
    endNm: (i + 1) * segmentLengthNm,
    baseElevationFt: ELEVATION[kind],
  }));

  // City buildings: deterministic blocks inside the city segments.
  const buildings = [];
  for (const seg of segments) {
    if (seg.kind !== 'city') continue;
    let x = seg.startNm + 0.1;
    while (x < seg.endNm - 0.15) {
      const w = 0.12 + rand() * 0.22;
      buildings.push({
        startNm: x,
        widthNm: w,
        heightFt: 260 + rand() * 900,
        lit: rand() < 0.75,
      });
      x += w + 0.05 + rand() * 0.12;
    }
  }

  // Drifting clouds, placed over the whole route.
  const clouds = [];
  for (let i = 0; i < 26; i++) {
    clouds.push({
      distNm: rand() * ROUTE.totalLengthNm,
      altitudeFt: 6500 + rand() * 4500,
      scale: 0.6 + rand() * 1.4,
      speed: 0.02 + rand() * 0.05,
    });
  }

  return { segments, segmentLengthNm, buildings, clouds, noise, seed };
}

export function segmentAt(route, distNm) {
  const d = clamp(distNm, 0, ROUTE.totalLengthNm - 0.001);
  for (const seg of route.segments) {
    if (d >= seg.startNm && d < seg.endNm) return seg;
  }
  return route.segments[route.segments.length - 1];
}

// Smooth ground elevation at a distance along the route, in feet.
export function groundElevationAt(route, distNm) {
  const seg = segmentAt(route, distNm);
  const local = (distNm - seg.startNm) / (seg.endNm - seg.startNm);
  const wobble = (route.noise(distNm * 0.9) - 0.5) * 2;
  if (seg.kind === 'mountains') {
    const ridge = Math.sin(local * Math.PI * 3.2) * 0.5 + 0.5;
    return seg.baseElevationFt * (0.55 + 0.45 * ridge) + wobble * 260;
  }
  if (seg.kind === 'hills') {
    return seg.baseElevationFt * (0.6 + 0.4 * route.noise(distNm * 1.7)) + wobble * 120;
  }
  if (seg.kind === 'sea') return 0;
  return seg.baseElevationFt + wobble * 40;
}

export function isRunwayBelow(route, distNm) {
  return segmentAt(route, distNm).kind === 'runway';
}

// Height above ground, in feet — the number that decides a crash.
export function heightAboveGround(route, distNm, altitudeFt) {
  return altitudeFt - groundElevationAt(route, distNm);
}

// The runway centreline runs east (090). Bearing from the plane to a point,
// in heading degrees where 090 is east along the route.
export function bearingTo(route, fromDistNm, fromLat, toDistNm, toLat) {
  const dDist = toDistNm - fromDistNm;
  const dLat = toLat - fromLat;
  // 1 unit of lateral offset is worth about 6 nm of along-track distance.
  // atan2 measures from east; headings measure from north, so add 90.
  return 90 + (Math.atan2(dLat * 6, dDist) * 180) / Math.PI;
}

export { lerp };
