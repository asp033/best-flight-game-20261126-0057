// Missions: the sortie is three phases — a ring run over the coast, a fuel
// stop, then a final approach to the runway. Rings are fixed in the world;
// the plane scores by flying through them, not by touching a button.
import { ROUTE, SCORE } from './config.js';
import { mulberry32, clamp } from './rng.js';
import { groundElevationAt, bearingTo } from './terrain.js';

export function createMission(route) {
  const rand = mulberry32(ROUTE.seed ^ 0x51ab);
  const rings = [];
  for (let i = 0; i < ROUTE.ringCount; i++) {
    const distNm = 2.0 + i * ROUTE.ringSpacingNm;
    const minAlt = groundElevationAt(route, distNm) + 700;
    rings.push({
      id: i + 1,
      kind: i === 2 || i === 4 ? 'fuel' : 'ring', // rings 3 and 5 are fuel stops
      distNm,
      altitudeFt: minAlt + rand() * 2600,
      lateral: (rand() - 0.5) * 0.9,
      passed: false,
      missed: false,
    });
  }
  return {
    rings,
    phase: 'rings', // 'rings' -> 'approach' -> 'done'
    ringsPassed: 0,
    ringsMissed: 0,
    score: 0,
    events: [], // one-frame notices for the HUD and the sound engine
    elapsedSec: 0,
  };
}

export function nextTarget(mission, plane) {
  const ring = mission.rings.find((r) => !r.passed && !r.missed);
  if (ring) return { distNm: ring.distNm, lateral: ring.lateral, label: `RING ${ring.id}` };
  // Final approach: aim at the far end of the runway, not its threshold,
  // so the bearing stays stable all the way down the strip.
  return { distNm: 15.8, lateral: 0, label: 'RUNWAY 09' };
}

export function bearingToTarget(mission, plane, route) {
  const t = nextTarget(mission, plane);
  return bearingTo(route, plane.distanceNm, plane.lateral, t.distNm, t.lateral);
}

// Advance the mission one frame. Returns 'landed' when the sortie is over
// (the plane module reports the touchdown itself); ring passes and misses
// are pushed into mission.events for the HUD and sounds.
export function updateMission(mission, plane, route, dt) {
  mission.elapsedSec += dt;
  mission.events.length = 0;
  const ring = mission.rings.find((r) => !r.passed && !r.missed);
  if (ring && plane.distanceNm >= ring.distNm) {
    const altErr = Math.abs(plane.altitudeFt - ring.altitudeFt);
    const latErr = Math.abs(plane.lateral - ring.lateral);
    if (altErr <= ROUTE.ringRadiusFt && latErr <= 0.28) {
      ring.passed = true;
      mission.ringsPassed++;
      const precision = Math.max(0, 1 - altErr / ROUTE.ringRadiusFt);
      const bonus = Math.round(precision * ROUTE.ringPrecisionBonus);
      const points = SCORE.ring + bonus;
      mission.score += points;
      mission.events.push({
        type: ring.kind === 'fuel' ? 'fuel-ring' : 'ring',
        text: ring.kind === 'fuel' ? `FUEL RING +${points}  ·  +${ROUTE.ringFuelBonus} FUEL` : `RING ${ring.id} +${points}`,
        points,
      });
      if (ring.kind === 'fuel') {
        plane.fuel = clamp(plane.fuel + ROUTE.ringFuelBonus, 0, 100);
        mission.score += SCORE.fuelRing;
      }
    } else {
      ring.missed = true;
      mission.ringsMissed++;
      mission.events.push({ type: 'miss', text: `RING ${ring.id} MISSED`, points: 0 });
    }
  }
  if (mission.phase === 'rings' && !ring) {
    mission.phase = 'approach';
    mission.events.push({ type: 'phase', text: 'ALL RINGS CLEAR — FINAL APPROACH, RUNWAY 09', points: 0 });
  }
  // Distance trickles in as score, so a steady cruise always pays a little.
  mission.score += Math.round(plane.speedKts * dt * 0.0014 * SCORE.distancePerNm);
  return null;
}

export function landingScore(mission, plane) {
  const fuelBonus = Math.round(plane.fuel * SCORE.fuelRemainingPerUnit);
  const timeBonus = Math.max(0, Math.round((420 - mission.elapsedSec) * 0.5));
  const total = SCORE.landing + fuelBonus + timeBonus;
  mission.score += total;
  mission.phase = 'done';
  return { landing: SCORE.landing, fuelBonus, timeBonus, total };
}
