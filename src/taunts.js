// Taunt bar: 4 emote buttons (tap), each also opens an 8-line quick-lines
// menu on long-press. Shared 2s cooldown, speech bubble over your own
// character (index 0) or the opponent's (index 1) once a remote taunt
// arrives. Presentation-only — never touches sim state, matches the spec's
// "taunts never affect the sim."
import { playEvent } from './audio.js';

export const QUICK_LINES = [
  'Too easy', 'You good?', 'My grandma spikes harder', 'Lucky.',
  'Run it back', 'Respect', 'Cooked.', 'Wake up',
];

const EMOTE_DURATION = 1.6;
const LINE_DURATION = 2.2;
const COOLDOWN = 2;
const LONG_PRESS_MS = 450;

export const emoteState = [{ kind: null, value: null, timer: 0 }, { kind: null, value: null, timer: 0 }];

let cooldownTimer = 0;
let buttons = [];
let bar = null;
let linesMenu = null;

export function initTauntBar(onLocalTrigger) {
  bar = document.getElementById('taunt-bar');
  linesMenu = document.getElementById('quick-lines');
  if (!bar || !linesMenu) return;
  buttons = Array.from(bar.querySelectorAll('.taunt-btn'));

  for (const line of QUICK_LINES) {
    const b = document.createElement('button');
    b.className = 'quick-line-btn';
    b.textContent = line;
    b.addEventListener('click', () => {
      hideLinesMenu();
      if (cooldownTimer > 0) return;
      triggerLocal('line', line);
      onLocalTrigger('line', line);
    });
    linesMenu.appendChild(b);
  }

  for (const b of buttons) {
    let pressTimer = null;
    let longPressed = false;
    const start = () => {
      longPressed = false;
      pressTimer = setTimeout(() => { longPressed = true; showLinesMenu(); }, LONG_PRESS_MS);
    };
    const end = () => {
      clearTimeout(pressTimer);
      if (longPressed) return;
      if (cooldownTimer > 0) return;
      const id = b.dataset.emote;
      triggerLocal('emoji', id);
      onLocalTrigger('emoji', id);
    };
    b.addEventListener('pointerdown', start);
    b.addEventListener('pointerup', end);
    b.addEventListener('pointerleave', () => clearTimeout(pressTimer));
  }

  document.addEventListener('pointerdown', (e) => {
    if (linesMenu.classList.contains('visible') && !linesMenu.contains(e.target) && !bar.contains(e.target)) {
      hideLinesMenu();
    }
  });
}

function showLinesMenu() { linesMenu.classList.add('visible'); }
function hideLinesMenu() { linesMenu.classList.remove('visible'); }

export function setTauntBarVisible(visible) {
  if (bar) bar.classList.toggle('visible', visible);
  if (!visible) hideLinesMenu();
}

export function triggerLocal(kind, value) {
  emoteState[0] = { kind, value, timer: kind === 'line' ? LINE_DURATION : EMOTE_DURATION };
  cooldownTimer = COOLDOWN;
  playEvent('emote');
}

export function receiveRemote(kind, value) {
  emoteState[1] = { kind, value, timer: kind === 'line' ? LINE_DURATION : EMOTE_DURATION };
  playEvent('emote');
}

export function update(dt) {
  cooldownTimer = Math.max(0, cooldownTimer - dt);
  for (const b of buttons) b.disabled = cooldownTimer > 0;
  for (const e of emoteState) if (e.timer > 0) e.timer = Math.max(0, e.timer - dt);
}
