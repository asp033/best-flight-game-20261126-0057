// Rendering: the whole golden-hour scene, drawn fresh every frame on one
// 2D canvas. World-to-screen is one rule: screenY = 640 - altitudeFt*0.04,
// screenX = planeX + (distNm - planeDistNm)*55. Everything — ground,
// buildings, rings, clouds — obeys it, so the picture stays honest.
import { VIEW, COLORS, ROUTE } from './config.js';
import { clamp, degToRad } from './rng.js';
import { groundElevationAt, segmentAt } from './terrain.js';

export function screenY(altitudeFt) {
  return VIEW.groundBaseY - altitudeFt * VIEW.pxPerFoot;
}

export function screenX(distNm, planeDistNm) {
  return VIEW.planeX + (distNm - planeDistNm) * VIEW.pxPerNm;
}

function horizonY(plane) {
  return clamp(340 + plane.pitchDeg * 3, 300, 400);
}

export function drawSky(ctx, plane, timeSec) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  g.addColorStop(0, COLORS.skyTop);
  g.addColorStop(0.45, COLORS.skyMid);
  g.addColorStop(0.72, COLORS.skyHorizon);
  g.addColorStop(1, '#7a4a6e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  // Low sun, just right of centre, with a warm halo.
  const sunX = 880;
  const sunY = horizonY(plane) - 46;
  const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 150);
  glow.addColorStop(0, COLORS.sunGlow);
  glow.addColorStop(1, 'rgba(255, 170, 80, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 150, sunY - 150, 300, 300);
  ctx.fillStyle = COLORS.sunCore;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
  ctx.fill();
}

function drawCloud(ctx, x, y, scale, alpha) {
  ctx.fillStyle = `rgba(255, 214, 180, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, 64 * scale, 15 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 34 * scale, y + 5 * scale, 38 * scale, 11 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 36 * scale, y + 4 * scale, 42 * scale, 12 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawClouds(ctx, route, plane) {
  for (const c of route.clouds) {
    const dx = c.distNm - plane.distanceNm;
    if (dx < -2 || dx > 22) continue;
    const x = screenX(c.distNm, plane.distanceNm);
    const y = screenY(c.altitudeFt);
    drawCloud(ctx, x, y, c.scale, 0.5);
  }
}

// A jagged ridge silhouette: peaks from the seeded noise, scrolling slowly.
function drawRidge(ctx, route, plane, parallax, baseY, amp, color, seedOffset) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, VIEW.height);
  const step = 26;
  for (let x = 0; x <= VIEW.width; x += step) {
    const worldX = (x + plane.distanceNm * VIEW.pxPerNm * parallax) / 90 + seedOffset;
    const peak = route.noise(worldX) * amp + route.noise(worldX * 2.7) * amp * 0.4;
    ctx.lineTo(x, baseY - peak);
  }
  ctx.lineTo(VIEW.width, VIEW.height);
  ctx.closePath();
  ctx.fill();
}

export function drawFarTerrain(ctx, route, plane) {
  const h = horizonY(plane);
  drawRidge(ctx, route, plane, 0.12, h + 26, 120, COLORS.mountainFar, 3.1);
  drawRidge(ctx, route, plane, 0.3, h + 74, 74, COLORS.mountainNear, 7.7);
  drawRidge(ctx, route, plane, 0.55, h + 118, 44, COLORS.hill, 11.3);
}

// The near ground: one vertical strip per screen column, coloured by the
// segment below it, with buildings, sea sparkle and the runway painted on.
export function drawGround(ctx, route, plane, timeSec) {
  const step = 10;
  for (let x = 0; x < VIEW.width; x += step) {
    const distNm = plane.distanceNm + (x - VIEW.planeX) / VIEW.pxPerNm;
    if (distNm < -0.5) continue;
    const seg = segmentAt(route, distNm);
    const elev = groundElevationAt(route, distNm);
    const topY = screenY(elev);
    let color = COLORS.ground;
    if (seg.kind === 'sea') color = COLORS.sea;
    if (seg.kind === 'farmland') color = '#4a3f55';
    if (seg.kind === 'hills') color = '#33304e';
    if (seg.kind === 'mountains') color = '#2b2a4c';
    if (seg.kind === 'runway') color = '#2e3240';
    ctx.fillStyle = color;
    ctx.fillRect(x, topY, step + 1, VIEW.height - topY);
    // Sea sparkle: a few glints riding the swell.
    if (seg.kind === 'sea') {
      const glint = Math.sin(distNm * 13.7 + timeSec * 1.4) > 0.86;
      if (glint) {
        ctx.fillStyle = COLORS.seaLight;
        ctx.fillRect(x, topY + 8 + ((distNm * 37) % 40), step, 2);
      }
    }
  }

  // City blocks: dark slabs with lit windows, standing on the ground.
  for (const b of route.buildings) {
    const x0 = screenX(b.startNm, plane.distanceNm);
    const x1 = screenX(b.startNm + b.widthNm, plane.distanceNm);
    if (x1 < -20 || x0 > VIEW.width + 20) continue;
    const elev = groundElevationAt(route, b.startNm);
    const baseY = screenY(elev);
    const h = b.heightFt * VIEW.pxPerFoot;
    ctx.fillStyle = COLORS.cityRoof;
    ctx.fillRect(x0, baseY - h, x1 - x0, h);
    if (b.lit) {
      ctx.fillStyle = COLORS.windowLit;
      const rows = Math.max(1, Math.floor(h / 14));
      for (let r = 0; r < rows; r++) {
        const wy = baseY - h + 6 + r * 14;
        for (let wx = x0 + 4; wx < x1 - 4; wx += 10) {
          if (((wx * 7 + r * 13) % 5) < 3) ctx.fillRect(wx, wy, 3, 4);
        }
      }
    }
  }

  // The runway: grey strip, threshold bars, centreline dashes, edge lights.
  const rw = route.segments.find((s) => s.kind === 'runway');
  if (rw) {
    const x0 = screenX(rw.startNm, plane.distanceNm);
    const x1 = screenX(rw.endNm, plane.distanceNm);
    if (x1 > 0 && x0 < VIEW.width) {
      const topY = screenY(80);
      ctx.fillStyle = COLORS.runway;
      ctx.fillRect(Math.max(0, x0), topY, Math.min(VIEW.width, x1) - Math.max(0, x0), VIEW.height - topY);
      ctx.fillStyle = COLORS.runwayMark;
      for (let d = rw.startNm + 0.15; d < rw.endNm - 0.1; d += 0.28) {
        const cx = screenX(d, plane.distanceNm);
        if (cx > 0 && cx < VIEW.width) ctx.fillRect(cx, topY + 26, 26, 5);
      }
      // Edge lights, alternating amber and white, blinking gently.
      const blink = 0.55 + 0.45 * Math.sin(timeSec * 3);
      for (let d = rw.startNm; d <= rw.endNm; d += 0.22) {
        const cx = screenX(d, plane.distanceNm);
        if (cx < 0 || cx > VIEW.width) continue;
        ctx.fillStyle = `rgba(255, 176, 46, ${blink})`;
        ctx.beginPath();
        ctx.arc(cx, topY + 4, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      // Runway number, big and readable from the air.
      ctx.fillStyle = COLORS.runwayMark;
      ctx.font = 'bold 44px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      const numX = clamp(screenX(rw.startNm + 0.45, plane.distanceNm), 60, VIEW.width - 60);
      ctx.fillText('09', numX, topY + 84);
    }
  }
}

export function drawRings(ctx, mission, plane) {
  for (const ring of mission.rings) {
    if (ring.passed || ring.missed) continue;
    const dDist = ring.distNm - plane.distanceNm;
    if (dDist < -0.4 || dDist > 16) continue;
    const x = screenX(ring.distNm, plane.distanceNm) + (ring.lateral - plane.lateral) * 230;
    const y = screenY(ring.altitudeFt);
    const scale = clamp(1 - dDist / 34, 0.45, 1);
    const rx = 46 * scale;
    const ry = 40 * scale;
    const color = ring.kind === 'fuel' ? COLORS.ringGreen : COLORS.ringAmber;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.12);
    ctx.shadowColor = color;
    ctx.shadowBlur = 18 * scale;
    ctx.strokeStyle = color;
    ctx.lineWidth = 6 * scale;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx - 6 * scale, ry - 6 * scale, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Chevrons point the way through.
    ctx.fillStyle = color;
    ctx.font = `bold ${Math.round(20 * scale)}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(ring.kind === 'fuel' ? 'FUEL' : `RING ${ring.id}`, 0, -ry - 10);
    ctx.restore();
  }
}

// The courier jet, seen from behind and slightly to the side: fuselage,
// swept wings, tail fin, lit cockpit and blinking nav lights. It banks
// with the stick and its exhaust glows with the throttle.
export function drawPlane(ctx, plane, groundElevFt, timeSec) {
  const x = VIEW.planeX;
  const y = screenY(plane.altitudeFt);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(degToRad(plane.bankDeg * 0.28) - degToRad(plane.pitchDeg * 0.4));

  // Exhaust glow.
  const glowLen = 26 + plane.throttle * 46;
  const eg = ctx.createLinearGradient(-58, 0, -58 - glowLen, 0);
  eg.addColorStop(0, 'rgba(255, 190, 90, 0.85)');
  eg.addColorStop(1, 'rgba(255, 120, 40, 0)');
  ctx.fillStyle = eg;
  ctx.beginPath();
  ctx.moveTo(-56, -4);
  ctx.lineTo(-58 - glowLen, 0);
  ctx.lineTo(-56, 4);
  ctx.closePath();
  ctx.fill();

  // Main wing (near, swept back) and far wing.
  ctx.fillStyle = '#c8d4e8';
  ctx.beginPath();
  ctx.moveTo(-6, 2);
  ctx.lineTo(-34, 26);
  ctx.lineTo(-22, 30);
  ctx.lineTo(14, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8fa3c4';
  ctx.beginPath();
  ctx.moveTo(-2, -2);
  ctx.lineTo(-26, -22);
  ctx.lineTo(-16, -26);
  ctx.lineTo(16, -4);
  ctx.closePath();
  ctx.fill();

  // Fuselage: a rounded dart, nose to the right.
  const body = ctx.createLinearGradient(-58, -12, 52, 12);
  body.addColorStop(0, '#7d92b8');
  body.addColorStop(0.5, '#e8eef8');
  body.addColorStop(1, '#9fb2d0');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-58, -3);
  ctx.quadraticCurveTo(-30, -13, 8, -11);
  ctx.quadraticCurveTo(40, -9, 52, 0);
  ctx.quadraticCurveTo(40, 9, 8, 11);
  ctx.quadraticCurveTo(-30, 13, -58, 3);
  ctx.closePath();
  ctx.fill();

  // Tail fin with the courier's amber stripe.
  ctx.fillStyle = '#2c3a5e';
  ctx.beginPath();
  ctx.moveTo(-52, -4);
  ctx.lineTo(-62, -30);
  ctx.lineTo(-48, -28);
  ctx.lineTo(-38, -6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.ringAmber;
  ctx.fillRect(-56, -24, 10, 4);

  // Lit cockpit windows.
  ctx.fillStyle = '#bfe9ff';
  ctx.beginPath();
  ctx.moveTo(18, -8);
  ctx.lineTo(38, -5);
  ctx.lineTo(38, 1);
  ctx.lineTo(18, -2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(120, 200, 255, 0.5)';
  ctx.fillRect(10, -7, 6, 5);

  // Registration on the tail, and nav lights.
  ctx.fillStyle = '#2c3a5e';
  ctx.font = 'bold 8px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SK-26', -46, -12);
  const blink = Math.sin(timeSec * 6) > 0;
  if (blink) {
    ctx.fillStyle = '#ff5a5a';
    ctx.beginPath();
    ctx.arc(-30, 28, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3ddc84';
    ctx.beginPath();
    ctx.arc(-20, -24, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Shadow on the ground below, shrinking as the plane climbs.
  const agl = plane.altitudeFt - groundElevFt;
  const shadowAlpha = clamp(0.34 - agl / 9000, 0.05, 0.34);
  const groundY = screenY(groundElevFt);
  const shadowW = clamp(120 - agl * 0.008, 26, 120);
  ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
  ctx.beginPath();
  ctx.ellipse(x, groundY + 4, shadowW, 7, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawSpeedLines(ctx, plane, timeSec) {
  if (plane.speedKts < 290) return;
  const alpha = clamp((plane.speedKts - 290) / 130, 0, 0.5);
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    const seed = i * 137.5 + Math.floor(timeSec * 14) * 61;
    const y = (seed * 7919) % 640 + 40;
    const x = VIEW.width - ((seed * 104729 + timeSec * 900) % (VIEW.width + 300));
    const len = 40 + (plane.speedKts - 290) * 0.35;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }
}
