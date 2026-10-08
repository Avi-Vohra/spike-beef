import { createInitialState, step } from '../src/sim.js';
import { HIT, JUMP, RIGHT } from '../src/physics.js';
import { isMatchWon } from '../src/rules.js';

function fail(msg) {
  console.log('FAIL: ' + msg);
  process.exit(1);
}

function runMatch(seed, maxTicks = 60 * 60 * 5) {
  let state = createInitialState(seed);
  let ticks = 0;
  while (isMatchWon(state.match.sets) === -1 && ticks < maxTicks) {
    const serverSide = state.match.server;
    const p1Input = serverSide === 0 ? HIT : (RIGHT | (ticks % 7 === 0 ? JUMP | HIT : 0));
    const p2Input = serverSide === 1 ? HIT : ((ticks % 5 === 0 ? JUMP | HIT : 0));
    const result = step(state, p1Input, p2Input);
    state = result.state;
    ticks++;
  }
  return { state, ticks };
}

// Test 1: a match completes within a reasonable number of ticks, no NaN.
{
  const { state, ticks } = runMatch(42);
  if (ticks >= 60 * 60 * 5) fail('match did not complete (seed 42)');
  if (Number.isNaN(state.ball.x) || Number.isNaN(state.ball.y)) fail('NaN in ball position');
  if (isMatchWon(state.match.sets) === -1) fail('match ended without a winner');
}

// Test 2: determinism — same seed and inputs twice gives identical final state.
{
  const a = runMatch(7);
  const b = runMatch(7);
  if (JSON.stringify(a.state) !== JSON.stringify(b.state)) fail('determinism broken for seed 7');
}

// Test 3: ball stays within the court bounds through a match.
{
  let state = createInitialState(99);
  for (let i = 0; i < 60 * 30; i++) {
    const result = step(state, HIT | RIGHT, HIT);
    state = result.state;
    if (state.ball.x < -5 || state.ball.x > 965 || state.ball.y < -5 || state.ball.y > 545) {
      fail(`ball out of bounds at tick ${state.tick}: (${state.ball.x}, ${state.ball.y})`);
    }
  }
}

console.log('PASS');
