// Taunt bar: 4 emote buttons, shared 2s cooldown, speech bubble over your
// own character (index 0) or the opponent's (index 1) once a remote taunt
// arrives. Presentation-only — never touches sim state, matches the spec's
// "taunts never affect the sim."
import { playEvent } from './audio.js';

const EMOTE_DURATION = 1.6;
const COOLDOWN = 2;
export const emoteState = [{ id: null, timer: 0 }, { id: null, timer: 0 }];

let cooldownTimer = 0;
let buttons = [];
let bar = null;

export function initTauntBar(onLocalTrigger) {
  bar = document.getElementById('taunt-bar');
  if (!bar) return;
  buttons = Array.from(bar.querySelectorAll('.taunt-btn'));
  for (const b of buttons) {
    b.addEventListener('click', () => {
      if (cooldownTimer > 0) return;
      const id = b.dataset.emote;
      triggerLocal(id);
      onLocalTrigger(id);
    });
  }
}

export function setTauntBarVisible(visible) {
  if (bar) bar.classList.toggle('visible', visible);
}

export function triggerLocal(id) {
  emoteState[0] = { id, timer: EMOTE_DURATION };
  cooldownTimer = COOLDOWN;
  playEvent('emote');
}

export function receiveRemote(id) {
  emoteState[1] = { id, timer: EMOTE_DURATION };
  playEvent('emote');
}

export function update(dt) {
  cooldownTimer = Math.max(0, cooldownTimer - dt);
  for (const b of buttons) b.disabled = cooldownTimer > 0;
  for (const e of emoteState) if (e.timer > 0) e.timer = Math.max(0, e.timer - dt);
}
