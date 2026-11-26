// Input for Golden Hour Courier: keyboard, mouse (drag to steer, wheel throttle)
// and on-screen touch buttons. Exposes a single polled state plus one-shot actions.

export const ACTION_CONFIRM = 1 << 0;
export const ACTION_PAUSE = 1 << 1;
export const ACTION_CAMERA = 1 << 2;
export const ACTION_MUTE = 1 << 3;
export const ACTION_GEAR = 1 << 4;
export const ACTION_FLAPS = 1 << 5;
export const ACTION_BOOST = 1 << 6;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseDown = false;
  let mouseDX = 0, mouseDY = 0;
  let wheelDelta = 0;
  const touch = { left: false, right: false, up: false, down: false, throttleUp: false, throttleDown: false };

  function keyName(e) { return e.key.length === 1 ? e.key.toLowerCase() : e.key; }

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    if (e.repeat) return;
    keys.add(k);
    if (k === ' ' || k === 'Enter') actions |= ACTION_CONFIRM;
    if (k === 'p' || k === 'Escape') actions |= ACTION_PAUSE;
    if (k === 'c') actions |= ACTION_CAMERA;
    if (k === 'm') actions |= ACTION_MUTE;
    if (k === 'g') actions |= ACTION_GEAR;
    if (k === 'f') actions |= ACTION_FLAPS;
  });
  window.addEventListener('keyup', (e) => keys.delete(keyName(e)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (e) => { mouseDown = true; mouseDX = 0; mouseDY = 0; });
  window.addEventListener('mouseup', () => { mouseDown = false; });
  window.addEventListener('mousemove', (e) => {
    if (!mouseDown) return;
    mouseDX += e.movementX || 0;
    mouseDY += e.movementY || 0;
  });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); wheelDelta += e.deltaY; }, { passive: false });
  canvas.addEventListener('click', () => { actions |= ACTION_CONFIRM; });

  // Touch buttons (data-k attributes in index.html).
  document.querySelectorAll('#touch .tbtn').forEach((btn) => {
    const k = btn.dataset.k;
    const on = (e) => { e.preventDefault(); touch[k] = true; };
    const off = (e) => { e.preventDefault(); touch[k] = false; };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointerleave', off);
    btn.addEventListener('pointercancel', off);
  });
  if ('ontouchstart' in window) {
    const el = document.getElementById('touch');
    if (el) el.style.display = 'flex';
  }

  function axis() {
    let roll = 0, pitch = 0;
    if (keys.has('ArrowLeft') || keys.has('a') || touch.left) roll -= 1;
    if (keys.has('ArrowRight') || keys.has('d') || touch.right) roll += 1;
    if (keys.has('ArrowUp') || touch.up) pitch -= 1; // ArrowUp: pull back, nose up
    if (keys.has('ArrowDown') || touch.down) pitch += 1; // ArrowDown: push, nose down
    // Mouse drag steers: horizontal drag banks, vertical drag pitches.
    if (mouseDown) {
      roll += Math.max(-1, Math.min(1, mouseDX / 90));
      pitch += Math.max(-1, Math.min(1, mouseDY / 90));
      mouseDX *= 0.86; mouseDY *= 0.86;
    }
    return { roll: Math.max(-1, Math.min(1, roll)), pitch: Math.max(-1, Math.min(1, pitch)) };
  }

  return {
    takeActions() { const a = actions; actions = 0; return a; },
    axis,
    throttleDelta() {
      let d = 0;
      if (keys.has('w')) d += 1; // W also raises throttle while held (arcade-friendly)
      if (keys.has('s')) d -= 1;
      if (touch.throttleUp) d += 1;
      if (touch.throttleDown) d -= 1;
      if (wheelDelta !== 0) { d -= Math.sign(wheelDelta) * 0.5; wheelDelta = 0; }
      return d;
    },
    boost() { return keys.has('Shift'); },
    anyKey() { return keys.size > 0; },
  };
}
