// Sound, synthesized live with WebAudio: no audio files, no network.
// Engine hum follows the throttle, rings chime, warnings beep, the runway
// thuds and a crash is noise. Everything starts on the first user gesture,
// so the browser's autoplay rules are never fought.
export function createAudio() {
  return {
    ctx: null,
    master: null,
    engineOsc1: null,
    engineOsc2: null,
    engineGain: null,
    muted: false,
    warnedLowFuel: false,
  };
}

export function ensureAudio(audio) {
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);

  // Engine: two detuned saws through a low-pass, gain tied to throttle.
  const osc1 = ctx.createOscillator();
  osc1.type = 'sawtooth';
  osc1.frequency.value = 55;
  const osc2 = ctx.createOscillator();
  osc2.type = 'sawtooth';
  osc2.frequency.value = 82;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  const gain = ctx.createGain();
  gain.gain.value = 0.0;
  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  osc1.start();
  osc2.start();

  audio.ctx = ctx;
  audio.master = master;
  audio.engineOsc1 = osc1;
  audio.engineOsc2 = osc2;
  audio.engineGain = gain;
}

export function updateEngineSound(audio, throttle, speedKts, engineOut) {
  if (!audio.ctx || audio.muted) return;
  const t = audio.ctx.currentTime;
  const target = engineOut ? 0.0 : 0.045 + throttle * 0.075 + speedKts * 0.00008;
  audio.engineGain.gain.setTargetAtTime(target, t, 0.15);
  audio.engineOsc1.frequency.setTargetAtTime(48 + throttle * 65, t, 0.2);
  audio.engineOsc2.frequency.setTargetAtTime(72 + throttle * 95, t, 0.2);
}

function blip(audio, freq, dur, type = 'sine', vol = 0.22, when = 0) {
  if (!audio.ctx || audio.muted) return;
  const ctx = audio.ctx;
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export function playRingChime(audio) {
  blip(audio, 880, 0.35);
  blip(audio, 1318, 0.5, 'sine', 0.2, 0.09);
}

export function playFuelChime(audio) {
  blip(audio, 659, 0.3);
  blip(audio, 988, 0.45, 'sine', 0.2, 0.08);
}

export function playMissed(audio) {
  blip(audio, 220, 0.3, 'triangle', 0.18);
}

export function playWarning(audio) {
  blip(audio, 1046, 0.12, 'square', 0.1);
  blip(audio, 1046, 0.12, 'square', 0.1, 0.18);
}

export function playTouchdown(audio) {
  blip(audio, 120, 0.25, 'sine', 0.4);
  blip(audio, 90, 0.35, 'sine', 0.3, 0.05);
}

export function playCrash(audio) {
  if (!audio.ctx || audio.muted) return;
  const ctx = audio.ctx;
  const dur = 0.7;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = 0.5;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audio.master);
  src.start();
}

export function toggleMute(audio) {
  audio.muted = !audio.muted;
  if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
  return audio.muted;
}
