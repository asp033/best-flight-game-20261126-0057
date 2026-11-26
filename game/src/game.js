// Skyline Courier — the game itself: modes, the frame loop, autopilot for
// the title screen, and the wiring between physics, missions, sound and HUD.
import { VIEW, ROUTE } from './config.js';
import { clamp, wrapAngleDeg } from './rng.js';
import { buildRoute, groundElevationAt } from './terrain.js';
import { createPlane, updatePlane } from './plane.js';
import { createMission, updateMission, nextTarget, bearingToTarget, landingScore } from './missions.js';
import { createInput, attachInput, pollInput, consumePress, endFrameInput } from './input.js';
import { createAudio, ensureAudio, updateEngineSound, playRingChime, playFuelChime, playMissed, playWarning, playTouchdown, playCrash, toggleMute } from './audio.js';
import { drawSky, drawClouds, drawFarTerrain, drawGround, drawRings, drawPlane, drawSpeedLines, screenY } from './render.js';
import { drawHud, drawTitle, drawEnd } from './hud.js';

export function createGame(canvas) {
  const ctx = canvas.getContext('2d');
  const route = buildRoute();
  const input = createInput();
  attachInput(input, canvas);
  const audio = createAudio();
  return {
    canvas,
    ctx,
    route,
    input,
    audio,
    mode: 'title', // 'title' | 'flying' | 'paused' | 'over'
    plane: createPlane(),
    mission: createMission(route),
    toasts: [],
    timeSec: 0,
    lastTs: 0,
    nextTarget: nextTarget(createMission(route), createPlane()),
    endReason: null,
    endDetail: '',
    scoreBreakdown: [],
    warningTimer: 0,
  };
}

function resetSortie(state) {
  state.plane = createPlane();
  state.mission = createMission(state.route);
  state.toasts = [];
  state.endReason = null;
  state.endDetail = '';
  state.scoreBreakdown = [];
  state.mode = 'flying';
}

function addToast(state, text, color) {
  state.toasts.push({ text, color, life: 2.6 });
  if (state.toasts.length > 3) state.toasts.shift();
}

// Gentle autopilot for the title screen: chase the next ring, keep the
// throttle in the middle, so the backdrop is a living flight. It steers by
// heading error — bank toward the bearing, ease off as it lines up.
function autopilotInput(state) {
  const plane = state.plane;
  const target = nextTarget(state.mission, plane);
  const ring = state.mission.rings.find((r) => !r.passed && !r.missed);
  const wantAlt = ring ? ring.altitudeFt : 900;
  const altErr = wantAlt - plane.altitudeFt;
  const bearing = bearingToTarget(state.mission, plane, state.route);
  const headingErr = wrapAngleDeg(bearing - plane.headingDeg);
  return {
    pitch: clamp(altErr / 900, -1, 1) * 0.7,
    bank: clamp(headingErr / 25, -1, 1) * 0.8,
    throttleDelta: plane.throttle < 0.55 ? 0.4 : plane.throttle > 0.65 ? -0.4 : 0,
  };
}

function endSortie(state, reason) {
  state.mode = 'over';
  state.endReason = reason;
  const m = state.mission;
  const p = state.plane;
  if (reason === 'landed') {
    const s = landingScore(m, p);
    state.endDetail = `Runway 09, ${Math.round(p.speedKts)} kt at touchdown · ${m.ringsPassed} of ${m.rings.length} rings`;
    state.scoreBreakdown = [
      `Landing +${s.landing} · fuel bonus +${s.fuelBonus} · time bonus +${s.timeBonus}`,
      `Rings ${m.ringsPassed}/${m.rings.length} · distance ${p.distanceFlownNm.toFixed(1)} nm flown`,
    ];
    playTouchdown(state.audio);
  } else if (reason === 'crashed') {
    state.endDetail = 'The courier went down over the coast. The rings are still out there.';
    state.scoreBreakdown = [
      `Rings ${m.ringsPassed}/${m.rings.length} · distance ${p.distanceFlownNm.toFixed(1)} nm flown`,
      `Fuel left ${Math.round(p.fuel)}% · damage ${Math.round(p.damage)}%`,
    ];
    playCrash(state.audio);
  } else {
    state.endDetail = 'Out of fuel over the coast — glide practice, next time.';
    state.scoreBreakdown = [
      `Rings ${m.ringsPassed}/${m.rings.length} · distance ${p.distanceFlownNm.toFixed(1)} nm flown`,
    ];
    playCrash(state.audio);
  }
}

function step(state, dt) {
  const plane = state.plane;
  const mission = state.mission;
  const input = state.input;

  // Edge-triggered keys.
  if (consumePress(input, 'KeyM')) toggleMute(state.audio);
  if (state.mode === 'flying' && consumePress(input, 'KeyP')) {
    state.mode = 'paused';
    return;
  }
  if (state.mode === 'flying' && consumePress(input, 'KeyG')) {
    plane.gearDown = !plane.gearDown;
    addToast(state, plane.gearDown ? 'GEAR DOWN' : 'GEAR UP', '#9fb8cc');
  }

  let stick;
  if (state.mode === 'title') {
    stick = autopilotInput(state);
  } else {
    pollInput(input, VIEW.planeX, screenY(plane.altitudeFt));
    stick = { pitch: input.pitch, bank: input.bank, throttleDelta: input.throttleDelta };
  }

  const outcome = updatePlane(plane, stick, dt, state.route);
  updateMission(mission, plane, state.route, dt);
  state.nextTarget = nextTarget(mission, plane);

  // Attract mode loops the ring run forever: once the demo reaches the
  // approach, or anything ends the flight, start a fresh sortie silently.
  if (state.mode === 'title') {
    if (mission.phase === 'approach' || outcome !== null) {
      state.plane = createPlane();
      state.mission = createMission(state.route);
      state.toasts = [];
      state.nextTarget = nextTarget(state.mission, state.plane);
    }
    return;
  }

  for (const ev of mission.events) {
    if (ev.type === 'ring') {
      addToast(state, ev.text, '#ffb02e');
      playRingChime(state.audio);
    } else if (ev.type === 'fuel-ring') {
      addToast(state, ev.text, '#3ddc84');
      playFuelChime(state.audio);
    } else if (ev.type === 'miss') {
      addToast(state, ev.text, '#ff5a5a');
      playMissed(state.audio);
    } else if (ev.type === 'phase') {
      addToast(state, ev.text, '#eaf6ff');
    }
  }

  // Warnings, at most one beep a second.
  state.warningTimer -= dt;
  if (state.mode === 'flying' && state.warningTimer <= 0) {
    if (plane.fuel < 25 || plane.stalled || plane.damage > 60) {
      playWarning(state.audio);
      state.warningTimer = 1.0;
    }
  }

  updateEngineSound(state.audio, plane.throttle, plane.speedKts, plane.engineOut);

  // Toast lifetimes.
  for (const t of state.toasts) t.life -= dt;
  state.toasts = state.toasts.filter((t) => t.life > 0);

  if (state.mode === 'flying') {
    if (outcome === 'landed') endSortie(state, 'landed');
    else if (outcome === 'crashed') endSortie(state, 'crashed');
    else if (outcome === 'structural') endSortie(state, 'crashed');
    else if (plane.engineOut && plane.altitudeFt <= 5) endSortie(state, 'fuel');
    // Flying past the runway without landing ends the sortie on the far side.
    if (plane.distanceNm > ROUTE.totalLengthNm + 0.5 && state.mode === 'flying') {
      endSortie(state, 'crashed');
      state.endDetail = 'Overshot the runway and ran out of coast. Turn back sooner next time.';
    }
  }
}

function render(state) {
  const { ctx, plane, mission, route } = state;
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  drawSky(ctx, plane, state.timeSec);
  drawClouds(ctx, route, plane);
  drawFarTerrain(ctx, route, plane);
  drawGround(ctx, route, plane, state.timeSec);
  drawRings(ctx, mission, plane);
  drawSpeedLines(ctx, plane, state.timeSec);
  drawPlane(ctx, plane, groundElevationAt(route, plane.distanceNm), state.timeSec);

  if (state.mode === 'title') {
    drawHud(ctx, state);
    drawTitle(ctx, state);
  } else if (state.mode === 'paused') {
    drawHud(ctx, state);
    ctx.fillStyle = 'rgba(6, 10, 28, 0.6)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#eaf6ff';
    ctx.font = '800 56px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('PAUSED', 640, 360);
    ctx.fillStyle = '#9fb8cc';
    ctx.font = '600 20px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Press P to keep flying', 640, 400);
  } else if (state.mode === 'over') {
    drawHud(ctx, state);
    drawEnd(ctx, state);
  } else {
    drawHud(ctx, state);
  }
}

export function startGameLoop(state) {
  const frame = (ts) => {
    const dt = clamp((ts - state.lastTs) / 1000, 0, 0.05);
    state.lastTs = ts;
    state.timeSec += dt;

    const input = state.input;
    if (state.mode === 'title' && (consumePress(input, 'Enter') || consumePress(input, 'Space') || consumePress(input, 'MouseClick'))) {
      ensureAudio(state.audio);
      resetSortie(state);
    } else if (state.mode === 'over' && consumePress(input, 'KeyR')) {
      resetSortie(state);
    } else if (state.mode === 'paused' && consumePress(input, 'KeyP')) {
      state.mode = 'flying';
    }
    if (state.mode === 'title' || state.mode === 'flying') {
      step(state, dt);
    }
    render(state);
    endFrameInput(input);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame((ts) => {
    state.lastTs = ts;
    frame(ts);
  });
}
