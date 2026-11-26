// Input: keyboard and mouse, read once per frame into a small stick state.
// Arrow keys / WASD pitch and bank, Shift/Ctrl or +/- throttle, G gear,
// P pause, R restart, M mute. The mouse steers toward the pointer when it
// moves, and the wheel trims the throttle.
import { clamp } from './rng.js';

export function createInput() {
  return {
    keys: new Set(),
    pitch: 0, // -1 (dive) .. +1 (climb)
    bank: 0, // -1 (left) .. +1 (right)
    throttleDelta: 0, // per second, applied while held
    mouseX: null,
    mouseY: null,
    mouseActive: false,
    pressed: new Set(), // keys pressed since last frame (edge-triggered)
  };
}

const KEYMAP = {
  ArrowUp: 'pitchUp',
  KeyW: 'pitchUp',
  ArrowDown: 'pitchDown',
  KeyS: 'pitchDown',
  ArrowLeft: 'bankLeft',
  KeyA: 'bankLeft',
  ArrowRight: 'bankRight',
  KeyD: 'bankRight',
  ShiftLeft: 'throttleUp',
  ShiftRight: 'throttleUp',
  ControlLeft: 'throttleDown',
  ControlRight: 'throttleDown',
  Equal: 'throttleUp',
  Minus: 'throttleDown',
};

export function attachInput(input, element) {
  window.addEventListener('keydown', (e) => {
    if (KEYMAP[e.code] || ['KeyG', 'KeyP', 'KeyR', 'KeyM', 'Enter', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) input.pressed.add(e.code);
    input.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => input.keys.clear());
  element.addEventListener('mousemove', (e) => {
    const rect = element.getBoundingClientRect();
    input.mouseX = (e.clientX - rect.left) / rect.width;
    input.mouseY = (e.clientY - rect.top) / rect.height;
    input.mouseActive = true;
  });
  element.addEventListener('wheel', (e) => {
    e.preventDefault();
    input.throttleDelta = clamp(input.throttleDelta + (e.deltaY < 0 ? 0.12 : -0.12), -1, 1);
  }, { passive: false });
  element.addEventListener('mousedown', () => input.pressed.add('MouseClick'));
}

// Resolve the held keys into stick positions for this frame.
export function pollInput(input, planeX, planeY) {
  const k = input.keys;
  let pitch = 0;
  let bank = 0;
  if (k.has('ArrowUp') || k.has('KeyW')) pitch += 1;
  if (k.has('ArrowDown') || k.has('KeyS')) pitch -= 1;
  if (k.has('ArrowLeft') || k.has('KeyA')) bank -= 1;
  if (k.has('ArrowRight') || k.has('KeyD')) bank += 1;

  // Mouse steering: the pointer pulls the nose toward it, gently.
  if (input.mouseActive && input.mouseX !== null && pitch === 0 && bank === 0) {
    const dx = input.mouseX * 1280 - planeX;
    const dy = input.mouseY * 720 - planeY;
    bank = clamp(dx / 260, -1, 1);
    pitch = clamp(-dy / 260, -1, 1);
  }

  let throttleDelta = 0;
  if (k.has('ShiftLeft') || k.has('ShiftRight') || k.has('Equal')) throttleDelta += 0.55;
  if (k.has('ControlLeft') || k.has('ControlRight') || k.has('Minus')) throttleDelta -= 0.55;
  throttleDelta += input.throttleDelta;
  input.throttleDelta *= 0.85; // wheel nudges decay

  input.pitch = pitch;
  input.bank = bank;
  input.throttleDelta = throttleDelta;
  return input;
}

// Edge-triggered keys: true once per press, then consumed.
export function consumePress(input, code) {
  if (input.pressed.has(code)) {
    input.pressed.delete(code);
    return true;
  }
  return false;
}

export function endFrameInput(input) {
  input.pressed.clear();
}
