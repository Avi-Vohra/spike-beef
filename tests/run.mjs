import { createInitialState, step } from '../src/sim.js';
import { HIT, JUMP, RIGHT, createPlayer, createBall, resolvePlayerHit } from '../src/physics.js';
import { isMatchWon, createMatchState, registerTouch } from '../src/rules.js';

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

// Test 4: a 4th consecutive touch by the same side is a fault.
{
  const match = createMatchState(0);
  registerTouch(match, 0); // serve
  const fault1 = registerTouch(match, 0);
  const fault2 = registerTouch(match, 0);
  const fault3 = registerTouch(match, 0);
  if (fault1 || fault2) fail('touches 2 and 3 should not be faults');
  if (!fault3) fail('4th consecutive touch by the same side should be a fault');
}

// Test 5: touch count resets when the other side touches the ball.
{
  const match = createMatchState(0);
  registerTouch(match, 0);
  registerTouch(match, 0);
  const faultAfterSwitch = registerTouch(match, 1);
  if (faultAfterSwitch) fail('touch count should reset for the side that just touched');
  if (match.touches[1] !== 1) fail('touch count did not reset on side switch');
}

// Test 6: a jumping near-peak HIT (spike) launches faster and steeper than a
// standing HIT (bump).
{
  function hitOutcome(onGround, vy, input) {
    const p = createPlayer(0);
    p.onGround = onGround;
    p.vy = vy;
    const ball = createBall(p.x, p.y - 36);
    resolvePlayerHit(ball, ball.x, ball.y, p, input, []);
    return ball;
  }
  const spike = hitOutcome(false, 50, HIT | JUMP);
  const bump = hitOutcome(true, 0, HIT);
  const spikeSpeed = Math.hypot(spike.vx, spike.vy);
  const bumpSpeed = Math.hypot(bump.vx, bump.vy);
  if (spikeSpeed <= bumpSpeed) fail('spike should be faster than a bump');
  if (spike.vy >= 0) fail('spike should send the ball downward');
}

console.log('PASS');
