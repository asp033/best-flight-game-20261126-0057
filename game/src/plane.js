// The aircraft: state, physics and the limits that make flying a decision.
// Pure logic — no canvas, no DOM — so the flight model can be reasoned about
// on its own. Speeds in knots, altitudes in feet, distances in nautical miles.
import { PLANE, VIEW } from './config.js';
import { clamp, degToRad } from './rng.js';
import { groundElevationAt, heightAboveGround } from './terrain.js';

export function createPlane() {
  return {
    altitudeFt: 2600,
    speedKts: 210,
    headingDeg: 90, // east, along the route
    pitchDeg: 0,
    bankDeg: 0,
    throttle: 0.55,
    distanceNm: 0,
    lateral: 0, // -1 (far left) .. +1 (far right) of the route centreline
    fuel: PLANE.fuelCapacity,
    damage: 0,
    gearDown: false,
    verticalSpeedFpm: 0,
    stalled: false,
    engineOut: false,
    distanceFlownNm: 0,
  };
}

// One physics step. `input` carries -1..1 pitch/bank sticks and a throttle
// delta. The route runs east (090): heading differs from 090 and the plane
// drifts sideways across the route and slows its along-track progress.
export function updatePlane(plane, input, dt, route) {
  // --- throttle and speed -----------------------------------------------
  if (!plane.engineOut) {
    plane.throttle = clamp(plane.throttle + input.throttleDelta * dt, 0, 1);
  } else {
    plane.throttle = Math.max(0, plane.throttle - dt * 0.5);
  }
  let targetSpeed = PLANE.minSpeedKts + plane.throttle * (PLANE.maxSpeedKts - PLANE.minSpeedKts);
  if (plane.gearDown) targetSpeed -= PLANE.gearDragKts;
  const speedRate = plane.speedKts < targetSpeed ? 26 : 34;
  plane.speedKts += clamp(targetSpeed - plane.speedKts, -speedRate * dt, speedRate * dt);

  // --- pitch: climb and dive trade speed for altitude --------------------
  const pitchTarget = input.pitch * PLANE.maxPitchDeg;
  plane.pitchDeg += clamp(pitchTarget - plane.pitchDeg, -55 * dt, 55 * dt);
  const climbFpm = plane.speedKts * Math.sin(degToRad(plane.pitchDeg)) * 101.27 * PLANE.climbFactor;
  plane.verticalSpeedFpm = climbFpm;
  plane.altitudeFt = clamp(plane.altitudeFt + (climbFpm / 60) * dt, 0, VIEW.maxAltitudeFt);

  // --- bank and heading ---------------------------------------------------
  const bankTarget = input.bank * PLANE.maxBankDeg;
  plane.bankDeg += clamp(bankTarget - plane.bankDeg, -90 * dt, 90 * dt);
  const turnRate = (plane.bankDeg / PLANE.maxBankDeg) * PLANE.turnRateDegPerSec;
  plane.headingDeg = (plane.headingDeg + turnRate * dt + 360) % 360;

  // --- along-track and lateral motion -------------------------------------
  // Velocity splits into along-route and across-route parts by heading:
  // heading 090 flies straight down the route, any other heading drifts
  // sideways and covers less ground along it.
  const nmPerSec = plane.speedKts / 3600;
  const offRoute = degToRad(plane.headingDeg - 90);
  plane.distanceNm += Math.cos(offRoute) * nmPerSec * dt;
  plane.distanceFlownNm += nmPerSec * dt;
  plane.lateral = clamp(plane.lateral + Math.sin(offRoute) * nmPerSec * dt * 6, -1, 1);

  // --- fuel ---------------------------------------------------------------
  const burn = PLANE.fuelBurnIdle + plane.throttle * PLANE.fuelBurnFull;
  plane.fuel = Math.max(0, plane.fuel - burn * dt);
  if (plane.fuel <= 0 && !plane.engineOut) {
    plane.engineOut = true;
  }

  // --- stall: below flying speed the nose drops and altitude is lost -----
  plane.stalled = plane.speedKts < PLANE.stallSpeedKts && plane.altitudeFt > 50;
  if (plane.stalled) {
    plane.altitudeFt = Math.max(0, plane.altitudeFt - 260 * dt);
    plane.pitchDeg += (0 - plane.pitchDeg) * dt * 0.8;
  }

  // --- overstress: hard banking at high speed bends the airframe ---------
  if (Math.abs(plane.bankDeg) > 48 && plane.speedKts > 330) {
    plane.damage = Math.min(100, plane.damage + 4.5 * dt);
  }
  if (plane.damage >= 100) return 'structural';

  // --- terrain -------------------------------------------------------------
  const agl = heightAboveGround(route, plane.distanceNm, plane.altitudeFt);
  if (agl <= 0) {
    const rw = route.segments.find((s) => s.kind === 'runway');
    const onRunway = rw !== undefined && plane.distanceNm >= rw.startNm && plane.distanceNm <= rw.endNm;
    const gentle = plane.verticalSpeedFpm > -PLANE.landingMaxSinkFpm;
    if (onRunway && plane.gearDown && plane.speedKts <= PLANE.landingMaxSpeedKts && gentle) {
      plane.altitudeFt = groundElevationAt(route, plane.distanceNm);
      return 'landed';
    }
    return 'crashed';
  }
  return null;
}

export function addFuel(plane, amount) {
  plane.fuel = clamp(plane.fuel + amount, 0, PLANE.fuelCapacity);
}

export function addDamage(plane, amount) {
  plane.damage = clamp(plane.damage + amount, 0, 100);
  return plane.damage >= 100;
}
