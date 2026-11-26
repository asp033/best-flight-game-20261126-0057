// Skyline Courier — tuning constants for the whole game.
// One place for every number a designer would want to change.
export const VIEW = {
  width: 1280,
  height: 720,
  planeX: 320,
  groundBaseY: 640,
  pxPerFoot: 0.04, // vertical screen scale: 1 ft of altitude = 0.04 px
  pxPerNm: 55, // horizontal screen scale: 1 nautical mile ahead = 55 px
  maxAltitudeFt: 12000,
};

export const PLANE = {
  minSpeedKts: 70,
  maxSpeedKts: 420,
  cruiseSpeedKts: 240,
  maxPitchDeg: 22,
  maxBankDeg: 60,
  turnRateDegPerSec: 26, // heading change at full bank
  climbFactor: 0.9, // vertical speed per knot of speed at full pitch
  fuelCapacity: 100,
  fuelBurnIdle: 0.10, // units per second at throttle 0
  fuelBurnFull: 0.55, // extra units per second at throttle 1
  stallSpeedKts: 95,
  landingMaxSpeedKts: 195,
  landingMaxSinkFpm: 900,
  gearDragKts: 25,
};

export const ROUTE = {
  seed: 20261126,
  ringSpacingNm: 2.0,
  ringCount: 6,
  runwayAtNm: 14.5,
  totalLengthNm: 16,
  ringRadiusFt: 420,
  ringFuelBonus: 30,
  ringScore: 100,
  ringPrecisionBonus: 50,
  landingScore: 500,
};

export const SCORE = {
  ring: 100,
  fuelRing: 50,
  landing: 500,
  fuelRemainingPerUnit: 2,
  distancePerNm: 5,
};

export const COLORS = {
  skyTop: '#1b2a5e',
  skyMid: '#4a5fa8',
  skyHorizon: '#ff9a52',
  sunCore: '#ffd97a',
  sunGlow: 'rgba(255, 170, 80, 0.45)',
  mountainFar: '#3a3f6e',
  mountainNear: '#2c3157',
  hill: '#232a4a',
  sea: '#1d4e6e',
  seaLight: '#2e7ba6',
  ground: '#3d3350',
  cityRoof: '#241f38',
  windowLit: '#ffd27a',
  runway: '#3a3f4a',
  runwayMark: '#f2f2e8',
  ringAmber: '#ffb02e',
  ringGreen: '#3ddc84',
  hudText: '#eaf6ff',
  hudDim: '#9fb8cc',
  hudAmber: '#ffb02e',
  hudRed: '#ff5a5a',
  hudGreen: '#3ddc84',
  panel: 'rgba(8, 18, 38, 0.72)',
  panelEdge: 'rgba(140, 190, 255, 0.35)',
};
