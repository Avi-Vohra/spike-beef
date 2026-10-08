import { createInitialState, step } from './sim.js';
import { render } from './render.js';
import { createKeyboardInput } from './input.js';
import { renderMenu, renderHowToPlay, renderMatchEnd, renderPause, hideOverlay } from './ui.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('ui-overlay');
const LOGICAL_W = 960;
const LOGICAL_H = 540;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scale = Math.min(window.innerWidth / LOGICAL_W, window.innerHeight / LOGICAL_H);
  canvas.style.width = `${LOGICAL_W * scale}px`;
  canvas.style.height = `${LOGICAL_H * scale}px`;
  canvas.width = LOGICAL_W * dpr;
  canvas.height = LOGICAL_H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const keyboard = createKeyboardInput();

let appScreen = 'menu'; // 'menu' | 'howToPlay' | 'match' | 'paused'
let state = null;
let spin = 0;

function goMenu() {
  appScreen = 'menu';
  renderMenu(overlay, { onLocal2P: startLocal2P, onHowToPlay: () => { appScreen = 'howToPlay'; renderHowToPlay(overlay, { onBack: goMenu }); } });
}

function startLocal2P() {
  state = createInitialState(Date.now() & 0xffffffff);
  appScreen = 'match';
  hideOverlay(overlay);
}

function onMatchEnd() {
  renderMatchEnd(overlay, state.match, {
    onRematch: startLocal2P,
    onMenu: goMenu,
  });
}

function togglePause() {
  if (appScreen === 'match') {
    appScreen = 'paused';
    renderPause(overlay, {
      onResume: () => { appScreen = 'match'; hideOverlay(overlay); },
      onQuit: goMenu,
    });
  } else if (appScreen === 'paused') {
    appScreen = 'match';
    hideOverlay(overlay);
  }
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && (appScreen === 'match' || appScreen === 'paused')) togglePause();
});

goMenu();

const DT = 1 / 60;
let acc = 0;
let last = performance.now();

function frame(now) {
  const elapsed = Math.min((now - last) / 1000, 0.25);
  last = now;

  if (appScreen === 'match' && state) {
    acc += elapsed;
    while (acc >= DT) {
      const input1 = keyboard.getP1();
      const input2 = keyboard.getP2();
      const result = step(state, input1, input2);
      state = result.state;
      spin += (Math.abs(state.ball.vx) + Math.abs(state.ball.vy)) * 0.0006;
      acc -= DT;
      if (state.match.phase === 'matchWon') {
        appScreen = 'matchEnded';
        onMatchEnd();
        break;
      }
    }
  }

  if (state && (appScreen === 'match' || appScreen === 'paused' || appScreen === 'matchEnded')) {
    render(ctx, state, spin);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
