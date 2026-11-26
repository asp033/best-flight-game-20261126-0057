// The HUD: every number a pilot needs, lit like a real panel — altitude,
// speed and heading across the top, throttle, fuel and damage gauges, an
// artificial horizon, the mission banner and the warnings that matter.
import { VIEW, COLORS } from './config.js';
import { clamp, formatFeet, formatKnots, compassPoint } from './rng.js';
import { heightAboveGround } from './terrain.js';

const FONT_NUMBER = '700 30px "SF Mono", Consolas, "Roboto Mono", monospace';
const FONT_LABEL = '600 11px "Segoe UI", system-ui, sans-serif';
const FONT_BIG = '800 44px "Segoe UI", system-ui, sans-serif';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = COLORS.panel;
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
}

function label(ctx, text, x, y, color = COLORS.hudDim) {
  ctx.fillStyle = color;
  ctx.font = FONT_LABEL;
  ctx.textAlign = 'left';
  ctx.fillText(text, x, y);
}

function gaugeBar(ctx, x, y, w, h, frac, color, bg = 'rgba(255,255,255,0.12)') {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

export function drawHud(ctx, state) {
  const { plane, mission, route } = state;
  const agl = heightAboveGround(route, plane.distanceNm, plane.altitudeFt);

  // --- top-left: altitude ----------------------------------------------
  panel(ctx, 16, 14, 210, 86);
  label(ctx, 'ALTITUDE', 28, 32);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = FONT_NUMBER;
  ctx.textAlign = 'left';
  ctx.fillText(formatFeet(plane.altitudeFt), 28, 64);
  label(ctx, `AGL ${formatFeet(Math.max(0, agl))}  ·  V/S ${plane.verticalSpeedFpm >= 0 ? '+' : ''}${Math.round(plane.verticalSpeedFpm)} fpm`, 28, 86);

  // --- top-centre: compass tape -----------------------------------------
  panel(ctx, 440, 14, 400, 86);
  label(ctx, 'HEADING', 452, 32);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = FONT_NUMBER;
  ctx.textAlign = 'left';
  const hdg = Math.round(((plane.headingDeg % 360) + 360) % 360);
  ctx.fillText(`${String(hdg).padStart(3, '0')}° ${compassPoint(plane.headingDeg)}`, 452, 64);
  // Tape: ticks every 15°, labels every 45°.
  ctx.save();
  ctx.beginPath();
  ctx.rect(452, 70, 376, 22);
  ctx.clip();
  for (let d = -90; d <= 90; d += 15) {
    const deg = Math.round(plane.headingDeg + d);
    const x = 640 + d * 2.1;
    const norm = ((deg % 360) + 360) % 360;
    const major = norm % 45 === 0;
    ctx.strokeStyle = major ? COLORS.hudText : COLORS.hudDim;
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, 74);
    ctx.lineTo(x, major ? 88 : 82);
    ctx.stroke();
    if (major) {
      ctx.fillStyle = COLORS.hudText;
      ctx.font = '600 10px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(compassPoint(norm), x, 96);
    }
  }
  ctx.restore();
  ctx.fillStyle = COLORS.hudAmber;
  ctx.beginPath();
  ctx.moveTo(640, 70);
  ctx.lineTo(634, 60);
  ctx.lineTo(646, 60);
  ctx.closePath();
  ctx.fill();

  // --- top-right: speed, throttle, score --------------------------------
  panel(ctx, 1054, 14, 210, 86);
  label(ctx, 'AIRSPEED', 1066, 32);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = FONT_NUMBER;
  ctx.fillText(formatKnots(plane.speedKts), 1066, 64);
  label(ctx, 'THROTTLE', 1066, 86);
  gaugeBar(ctx, 1140, 76, 108, 9, plane.throttle, COLORS.hudAmber);
  panel(ctx, 1054, 108, 210, 52);
  label(ctx, 'SCORE', 1066, 126);
  ctx.fillStyle = COLORS.hudAmber;
  ctx.font = FONT_NUMBER;
  ctx.fillText(String(mission.score).padStart(5, '0'), 1066, 152);

  // --- bottom-left: artificial horizon -----------------------------------
  const cx = 96;
  const cy = 620;
  const r = 62;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-(plane.bankDeg * Math.PI) / 180);
  ctx.translate(0, plane.pitchDeg * 1.6);
  ctx.fillStyle = '#3f6fb5';
  ctx.fillRect(-r, -r * 2, r * 2, r * 2);
  ctx.fillStyle = '#8a6a3f';
  ctx.fillRect(-r, 0, r * 2, r * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = COLORS.hudText;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  // Fixed wings of the symbol.
  ctx.fillStyle = COLORS.hudAmber;
  ctx.fillRect(cx - 34, cy - 2, 24, 4);
  ctx.fillRect(cx + 10, cy - 2, 24, 4);
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  label(ctx, 'ATTITUDE', cx - 30, cy + r + 16);
  label(ctx, plane.gearDown ? 'GEAR DOWN' : 'GEAR UP', cx - 30, cy + r + 30, plane.gearDown ? COLORS.hudGreen : COLORS.hudDim);

  // --- bottom-right: fuel and damage --------------------------------------
  panel(ctx, 1054, 560, 210, 122);
  label(ctx, 'FUEL', 1066, 580);
  const fuelFrac = plane.fuel / 100;
  gaugeBar(ctx, 1066, 588, 186, 14, fuelFrac, fuelFrac > 0.25 ? COLORS.hudGreen : COLORS.hudRed);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '700 16px "SF Mono", Consolas, monospace';
  ctx.fillText(`${Math.round(plane.fuel)}%`, 1066, 622);
  label(ctx, 'DAMAGE', 1066, 644);
  gaugeBar(ctx, 1066, 650, 186, 14, plane.damage / 100, plane.damage > 60 ? COLORS.hudRed : COLORS.hudAmber);
  ctx.fillStyle = COLORS.hudText;
  ctx.fillText(`${Math.round(plane.damage)}%`, 1066, 674);

  // --- mission banner ------------------------------------------------------
  const target = state.nextTarget;
  const distLeft = Math.max(0, target.distNm - plane.distanceNm);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.panel;
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.beginPath();
  ctx.roundRect(440, 108, 400, 40, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '700 17px "Segoe UI", system-ui, sans-serif';
  const phaseText = mission.phase === 'approach'
    ? `FINAL APPROACH — RUNWAY 09  ·  ${distLeft.toFixed(1)} nm`
    : `${target.label}  ·  ${distLeft.toFixed(1)} nm  ·  RINGS ${mission.ringsPassed}/${mission.rings.length}`;
  ctx.fillText(phaseText, 640, 134);

  // --- centre reticle -------------------------------------------------------
  ctx.strokeStyle = 'rgba(234, 246, 255, 0.75)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(VIEW.planeX, 360, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(VIEW.planeX - 20, 360);
  ctx.lineTo(VIEW.planeX - 8, 360);
  ctx.moveTo(VIEW.planeX + 8, 360);
  ctx.lineTo(VIEW.planeX + 20, 360);
  ctx.moveTo(VIEW.planeX, 340);
  ctx.lineTo(VIEW.planeX, 352);
  ctx.moveTo(VIEW.planeX, 368);
  ctx.lineTo(VIEW.planeX, 380);
  ctx.stroke();

  // --- steering cue: which way to the next ring ----------------------------
  const latErr = target.lateral - plane.lateral;
  if (Math.abs(latErr) > 0.12 && mission.phase === 'rings') {
    ctx.fillStyle = COLORS.hudAmber;
    ctx.font = '700 20px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(latErr > 0 ? 'STEER RIGHT  ▶' : '◀  STEER LEFT', 640, 200);
  }

  // --- toasts ----------------------------------------------------------------
  let ty = 240;
  ctx.textAlign = 'center';
  for (const toast of state.toasts) {
    ctx.globalAlpha = clamp(toast.life, 0, 1);
    ctx.fillStyle = toast.color;
    ctx.font = '800 26px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(toast.text, 640, ty);
    ty += 34;
  }
  ctx.globalAlpha = 1;

  drawWarnings(ctx, state, timeNow(state));
}

function timeNow(state) {
  return state.timeSec;
}

function drawWarnings(ctx, state, timeSec) {
  const { plane, mission } = state;
  const warnings = [];
  if (plane.engineOut || plane.fuel <= 0) warnings.push({ text: 'ENGINE OUT — GLIDE TO THE RUNWAY', color: COLORS.hudRed });
  else if (plane.fuel < 25) warnings.push({ text: 'LOW FUEL', color: COLORS.hudRed });
  if (plane.stalled) warnings.push({ text: 'STALL — NOSE DOWN, ADD POWER', color: COLORS.hudRed });
  if (plane.damage > 60) warnings.push({ text: 'AIRFRAME DAMAGE — EASE OFF THE BANK', color: COLORS.hudAmber });
  const agl = heightAboveGround(state.route, plane.distanceNm, plane.altitudeFt);
  if (agl < 400 && plane.verticalSpeedFpm < -300 && mission.phase !== 'done') {
    warnings.push({ text: 'TERRAIN — PULL UP', color: COLORS.hudRed });
  }
  if (warnings.length === 0) return;
  const blink = Math.sin(timeSec * 8) > -0.2;
  if (!blink) return;
  ctx.textAlign = 'center';
  ctx.font = '800 24px "Segoe UI", system-ui, sans-serif';
  warnings.forEach((w, i) => {
    ctx.fillStyle = w.color;
    ctx.fillText(w.text, 640, 440 + i * 30);
  });
}

// --- title screen -----------------------------------------------------------
export function drawTitle(ctx, state) {
  ctx.fillStyle = 'rgba(6, 10, 28, 0.55)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd27a';
  ctx.font = '600 20px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('GOLDEN HOUR · COASTAL COURIER RUN', 640, 168);
  ctx.fillStyle = '#f4f8ff';
  ctx.font = '800 84px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('SKYLINE COURIER', 640, 258);
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '400 22px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Fly the rings, mind the fuel, and put her down on Runway 09.', 640, 302);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '600 19px "Segoe UI", system-ui, sans-serif';
  const lines = [
    '↑ / ↓  or  W / S — climb and dive      ← / →  or  A / D — bank and turn',
    'SHIFT / CTRL — throttle up and down      G — landing gear      P — pause',
    'Amber rings score · green rings refuel · land on the runway to finish',
  ];
  lines.forEach((line, i) => ctx.fillText(line, 640, 380 + i * 34));
  const pulse = 0.6 + 0.4 * Math.sin(state.timeSec * 3);
  ctx.fillStyle = `rgba(255, 176, 46, ${pulse})`;
  ctx.font = '800 26px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('PRESS ENTER OR CLICK TO FLY', 640, 520);
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '400 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Mouse steers too — move the pointer to guide the jet, scroll to trim throttle.', 640, 556);
}

// --- end screen ---------------------------------------------------------------
export function drawEnd(ctx, state) {
  ctx.fillStyle = 'rgba(6, 10, 28, 0.68)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  const landed = state.endReason === 'landed';
  ctx.fillStyle = landed ? COLORS.hudGreen : COLORS.hudRed;
  ctx.font = '800 64px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(landed ? 'WHEELS DOWN — DELIVERED' : state.endReason === 'crashed' ? 'CRASHED' : 'SORTIE OVER', 640, 210);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '400 22px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(state.endDetail, 640, 252);
  ctx.fillStyle = COLORS.hudAmber;
  ctx.font = '800 56px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`SCORE  ${state.mission.score}`, 640, 340);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '600 19px "Segoe UI", system-ui, sans-serif';
  const b = state.scoreBreakdown || [];
  b.forEach((line, i) => ctx.fillText(line, 640, 396 + i * 30));
  const pulse = 0.6 + 0.4 * Math.sin(state.timeSec * 3);
  ctx.fillStyle = `rgba(255, 176, 46, ${pulse})`;
  ctx.font = '800 24px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('PRESS R TO FLY AGAIN', 640, 560);
}
