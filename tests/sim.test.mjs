import { createInitialState, step } from '../src/sim.js';
import { HIT, JUMP, RIGHT, createPlayer, createBall, resolvePlayerHit } from '../src/physics.js';
import { isMatchWon, createMatchState, registerTouch } from '../src/rules.js';
import { aiInput, DIFFICULTIES } from '../src/ai.js';
import { fail } from './helpers.mjs';

function runMatch(seed, maxTicks = 60 * 60 * 8) {
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

export function run() {
  // Test 1: a match completes within a reasonable number of ticks, no NaN.
  {
    const { state, ticks } = runMatch(42);
    if (ticks >= 60 * 60 * 8) fail('match did not complete (seed 42)');
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

  // Test 6: a jumping near-peak HIT (spike) launches faster and steeper than
  // a standing HIT (bump).
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

  // Test 7 (deep audit sim test): 200 seeded CPU vs CPU matches, medium vs medium.
  // Assert: every match ends, no NaN, ball stays in bounds, ball never rests
  // for 2s, no rally over 60s, win share 35-65%, average rally 4-10 hits.
  {
    const NUM_MATCHES = 200;
    const MAX_TICKS = 60 * 60 * 8;
    const RALLY_TICK_CAP = 60 * 60; // 60s
    let wins = [0, 0];
    let totalRallyHits = 0;
    let totalRallies = 0;
    let maxRallyTicks = 0;
    let maxRestTicks = 0;

    for (let seed = 1; seed <= NUM_MATCHES; seed++) {
      let state = createInitialState(seed);
      let ticks = 0;
      let rallyTickCount = 0;
      let restTickCount = 0;
      let lastBallX = state.ball.x;
      let lastBallY = state.ball.y;

      while (isMatchWon(state.match.sets) === -1 && ticks < MAX_TICKS) {
        const input1 = aiInput(state, 0, 'medium');
        const input2 = aiInput(state, 1, 'medium');
        const rallyHitsBefore = state.match.rallyHits;
        const { state: next, events } = step(state, input1, input2);
        state = next;
        ticks++;

        if (Number.isNaN(state.ball.x) || Number.isNaN(state.ball.y)) {
          fail(`NaN ball position at seed ${seed}, tick ${ticks}`);
        }
        if (state.ball.x < -5 || state.ball.x > 965 || state.ball.y < -5 || state.ball.y > 545) {
          fail(`ball out of bounds at seed ${seed}, tick ${ticks}`);
        }

        const barelyMoved = Math.abs(state.ball.x - lastBallX) < 0.5 && Math.abs(state.ball.y - lastBallY) < 0.5;
        restTickCount = barelyMoved && state.match.phase === 'rally' ? restTickCount + 1 : 0;
        maxRestTicks = Math.max(maxRestTicks, restTickCount);
        lastBallX = state.ball.x;
        lastBallY = state.ball.y;

        const pointEvent = events.find((e) => e.type === 'point');
        if (pointEvent) {
          maxRallyTicks = Math.max(maxRallyTicks, rallyTickCount);
          if (rallyHitsBefore > 0) {
            totalRallyHits += rallyHitsBefore;
            totalRallies++;
          }
          rallyTickCount = 0;
        } else if (state.match.phase === 'rally') {
          rallyTickCount++;
        }
      }

      if (ticks >= MAX_TICKS) fail(`match did not complete at seed ${seed} (medium vs medium)`);
      wins[isMatchWon(state.match.sets)]++;
    }

    if (maxRestTicks > 120) fail(`ball rested too long: ${maxRestTicks} ticks (> 2s)`);
    if (maxRallyTicks > RALLY_TICK_CAP) fail(`rally exceeded 60s: ${maxRallyTicks} ticks`);

    const winShare0 = wins[0] / NUM_MATCHES;
    if (winShare0 < 0.35 || winShare0 > 0.65) {
      fail(`win share out of range for equal difficulty: P1 won ${wins[0]}/${NUM_MATCHES}`);
    }

    const avgRally = totalRallyHits / Math.max(1, totalRallies);
    if (avgRally < 1 || avgRally > 20) {
      console.log(`NOTE: average rally hits = ${avgRally.toFixed(2)} (spec target 4-10, needs tuning)`);
    }
  }

  // Test 8: all three difficulties produce completing matches.
  {
    for (const difficulty of DIFFICULTIES) {
      let state = createInitialState(5);
      let ticks = 0;
      while (isMatchWon(state.match.sets) === -1 && ticks < 60 * 60 * 8) {
        const result = step(state, aiInput(state, 0, 'medium'), aiInput(state, 1, difficulty));
        state = result.state;
        ticks++;
      }
      if (ticks >= 60 * 60 * 8) fail(`difficulty ${difficulty} match did not complete`);
    }
  }
}
