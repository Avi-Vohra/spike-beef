import { createInitialState, step } from './sim.js';
import { render } from './render.js';
import { createKeyboardInput } from './input.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
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

let state = createInitialState(Date.now() & 0xffffffff);
const DT = 1 / 60;
let acc = 0;
let last = performance.now();
let spin = 0;

function frame(now) {
  const elapsed = Math.min((now - last) / 1000, 0.25);
  last = now;
  acc += elapsed;
  while (acc >= DT) {
    const input1 = keyboard.getP1();
    const input2 = keyboard.getP2();
    const result = step(state, input1, input2);
    state = result.state;
    spin += (Math.abs(state.ball.vx) + Math.abs(state.ball.vy)) * 0.0006;
    acc -= DT;
  }
  render(ctx, state, spin);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
