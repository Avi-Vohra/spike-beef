import { LEFT, RIGHT, JUMP, HIT } from './physics.js';

// Keyboard -> bitmask, same format touch/CPU/network use.
const P1_KEYS = { ArrowLeft: null, KeyA: LEFT, KeyD: RIGHT, KeyW: JUMP, KeyS: HIT };
const P2_KEYS = { ArrowLeft: LEFT, ArrowRight: RIGHT, ArrowUp: JUMP, ArrowDown: HIT };

export function createKeyboardInput() {
  const held = new Set();
  const onDown = (e) => held.add(e.code);
  const onUp = (e) => held.delete(e.code);
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);

  function maskFrom(map) {
    let mask = 0;
    for (const code of held) {
      const bit = map[code];
      if (bit) mask |= bit;
    }
    return mask;
  }

  return {
    getP1: () => maskFrom(P1_KEYS),
    getP2: () => maskFrom(P2_KEYS),
    destroy() {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    },
  };
}

export function createTouchInput() {
  const state = { left: false, right: false, jump: false, hit: false };
  function bind(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    const set = (v) => (state[key] = v);
    el.addEventListener('touchstart', (e) => { e.preventDefault(); set(true); }, { passive: false });
    el.addEventListener('touchend', (e) => { e.preventDefault(); set(false); }, { passive: false });
    el.addEventListener('touchcancel', (e) => { e.preventDefault(); set(false); }, { passive: false });
    el.addEventListener('mousedown', () => set(true));
    el.addEventListener('mouseup', () => set(false));
  }
  bind('btn-left', 'left');
  bind('btn-right', 'right');
  bind('btn-jump', 'jump');
  bind('btn-hit', 'hit');

  return {
    getMask: () => (state.left ? LEFT : 0) | (state.right ? RIGHT : 0) | (state.jump ? JUMP : 0) | (state.hit ? HIT : 0),
  };
}
