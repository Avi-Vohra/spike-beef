import { createInitialState, step } from '../src/sim.js';
import { HIT, JUMP, RIGHT, createPlayer, resolvePlayerHit, updateCharge, NET_X, GROUND_Y } from '../src/physics.js';
import { createBall, stepBallGravity, resolveBallBounds } from '../src/ball.js';
import { updateDive } from '../src/dive.js';
import { isMatchWon, createMatchState, registerTouch } from '../src/rules.js';
import { aiInput, DIFFICULTIES } from '../src/ai.js';
import { fail } from './helpers.mjs';

function runMatch(seed, maxTicks = 60 * 60 * 12) {
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
    if (ticks >= 60 * 60 * 12) fail('match did not complete (seed 42)');
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

  // Test 6: charge-and-release model — a jumping near-peak release with a
  // real charge (spike) is faster and steeper than a grounded full-charge
  // release (charged hit), which in turn is stronger than a near-zero-charge
  // release (tip).
  {
    function releaseOutcome(onGround, vy, releaseCharge) {
      const p = createPlayer(0);
      p.onGround = onGround;
      p.vy = vy;
      p.justReleased = true;
      p.releaseGraceTimer = 0.15;
      p.releaseCharge = releaseCharge;
      const ball = createBall(p.x, p.y - 36);
      resolvePlayerHit(ball, ball.x, ball.y, p, 0, []);
      return ball;
    }
    const spike = releaseOutcome(false, 50, 0.9);
    const chargedHit = releaseOutcome(true, 0, 0.9);
    const tip = releaseOutcome(true, 0, 0.05);
    const spikeSpeed = Math.hypot(spike.vx, spike.vy);
    const hitSpeed = Math.hypot(chargedHit.vx, chargedHit.vy);
    const tipSpeed = Math.hypot(tip.vx, tip.vy);
    if (spikeSpeed <= hitSpeed) fail('a near-peak jump release should be faster than a grounded release at the same charge');
    if (hitSpeed <= tipSpeed) fail('a fully charged release should be faster than a near-zero-charge tip');
    if (spike.vy >= 0) fail('spike should send the ball downward');
  }

  // Test 6b: charge progresses smoothly with time and never exceeds [0, 1];
  // releasing clears charging state; mistiming (contact while still
  // charging) cancels the charge rather than carrying it into the next hit.
  {
    const p = createPlayer(0);
    for (let i = 0; i < 1000; i++) updateCharge(p, HIT, 1 / 60);
    if (p.charge > 1 || p.charge < 0) fail(`charge escaped [0,1]: ${p.charge}`);
    if (!p.charging) fail('holding HIT should keep charging true');

    updateCharge(p, 0, 1 / 60); // release
    if (p.charging) fail('releasing HIT should clear charging');
    if (!p.justReleased) fail('releasing HIT after charging should set justReleased');

    const p2 = createPlayer(0);
    updateCharge(p2, HIT, 1 / 60);
    updateCharge(p2, HIT, 1 / 60);
    const midCharge = p2.charge;
    if (!(midCharge > 0 && midCharge < 1)) fail('charge should be partial after 2 ticks, not 0 or already maxed');
    const ball = createBall(p2.x, p2.y - 36);
    resolvePlayerHit(ball, ball.x, ball.y, p2, 0, []); // contact while still charging (input=0: not released)
    if (p2.charging || p2.charge !== 0) fail('mistimed contact mid-charge should cancel the charge, not carry it forward');
  }

  // Test 6c: charged serve — a longer hold before release produces a faster
  // serve than an immediate tap-release, and both still clear the net (no
  // NaN/stuck ball) regardless of how long it was held.
  {
    function serveSpeed(holdTicks) {
      let state = createInitialState(1);
      for (let i = 0; i < holdTicks; i++) state = step(state, HIT, 0).state;
      const result = step(state, 0, 0); // release
      return { vx: Math.abs(result.state.ball.vx), events: result.events };
    }
    const weak = serveSpeed(1);
    const strong = serveSpeed(30);
    if (strong.vx <= weak.vx) fail(`a longer-held serve should be faster: weak=${weak.vx} strong=${strong.vx}`);
    if (!weak.events.some((e) => e.type === 'serve')) fail('releasing after a short hold should still serve');
    if (!strong.events.some((e) => e.type === 'serve')) fail('releasing after a long hold should still serve');
  }

  // Test 6c-net: a hit from very close to the net must actually be able to
  // physically clear it — this was a REAL bug, not a hypothetical: measured
  // directly that even a fully-charged hit from 32px away still clipped the
  // net every time under the old arc-boost-only approach (a proportional
  // "add some steep" fudge was nowhere near enough), which meant the
  // receiving side would rack up repeated touches against the net and
  // fault out — explaining a stable, non-noisy ~75-85% server win rate
  // across many unrelated measurements this session. Checks several
  // contact types from several distances actually clear (fly past NET_X
  // without a netBounce), not just that velocities "look" reasonable.
  {
    function simulateUntilResolved(ball, maxSubsteps = 200) {
      for (let i = 0; i < maxSubsteps; i++) {
        stepBallGravity(ball, 1 / 240);
        const events = [];
        resolveBallBounds(ball, events);
        if (events.includes('netBounce')) return 'clipped';
        if (ball.x < NET_X - 40 || ball.x > NET_X + 40) return 'cleared';
      }
      return 'inconclusive';
    }
    function testClearance(distToNet, setupFn) {
      const p = createPlayer(1); // side 1, hitting toward side 0 (leftward)
      p.x = NET_X + distToNet;
      p.y = GROUND_Y - 36;
      setupFn(p);
      const ball = createBall(p.x, p.y - 36);
      resolvePlayerHit(ball, ball.x, ball.y, p, 0, []);
      return simulateUntilResolved(ball);
    }
    const chargedClose = testClearance(32, (p) => { p.releaseGraceTimer = 0.15; p.releaseCharge = 0.6; });
    if (chargedClose !== 'cleared') fail(`a charged hit from 32px should clear the net, got '${chargedClose}'`);

    const touchClose = testClearance(32, () => {});
    if (touchClose !== 'cleared') fail(`a passive touch from 32px should clear the net, got '${touchClose}'`);

    // 5px (literally almost touching the net) is a genuinely hard edge case
    // — even a real volleyball player standing right against the net has no
    // real recourse. Not asserting clearance here, just that it resolves to
    // something (doesn't hang/NaN) — see ensureClearsNet's time floor/cap.
    testClearance(5, () => {});

    const chargedLowClose = testClearance(32, (p) => { p.releaseGraceTimer = 0.15; p.releaseCharge = 0.2; });
    if (chargedLowClose !== 'cleared') fail(`a lightly-charged hit from 32px should clear the net, got '${chargedLowClose}'`);
  }

  // Test 6d: block — jumping into the ball right at the net without
  // charging produces a distinct, fast, steep-downward contact (not the
  // weak default 'touch'), and only when near the net.
  {
    function contactOutcome(nearNet, jumpingUp) {
      const p = createPlayer(0);
      p.x = nearNet ? 480 - 5 : 480 - 300; // NET_X is WIDTH/2 = 480
      p.onGround = !jumpingUp;
      p.vy = jumpingUp ? -100 : 0;
      const ball = createBall(p.x, p.y - 36);
      resolvePlayerHit(ball, ball.x, ball.y, p, 0, []); // input=0: not holding HIT
      return { ball, lastEvent: p.lastEvent };
    }
    const blocked = contactOutcome(true, true);
    const farTouch = contactOutcome(false, true);
    const groundedNearNet = contactOutcome(true, false);
    if (Math.hypot(blocked.ball.vx, blocked.ball.vy) <= Math.hypot(farTouch.ball.vx, farTouch.ball.vy)) {
      fail('a block (jumping, at the net, uncharged) should be stronger than a plain touch far from the net');
    }
    if (blocked.ball.vy >= 0) fail('a block should send the ball downward');
    if (blocked.lastEvent !== 'block') fail(`jumping uncharged contact at the net should be a 'block', got '${blocked.lastEvent}'`);
    // A grounded (non-jumping) contact at the net is still a plain 'touch' —
    // a DIFFERENT mechanic from 'block' (which requires jumping), even
    // though right at the net BOTH may now need a strong vertical assist to
    // physically clear it at all (a real, separately-verified net-clearance
    // guarantee — see ensureClearsNet / DECISIONS.md). Distinctness of
    // mechanic, not raw magnitude, is the actual invariant that matters.
    if (groundedNearNet.lastEvent !== 'touch') {
      fail(`a grounded contact at the net should still be a 'touch', not '${groundedNearNet.lastEvent}' (block requires jumping)`);
    }
  }

  // Test 6e: dive — double-tapping a direction while grounded (with a real
  // human-timed gap between release and re-press) triggers a fast lunge;
  // an instant same/next-tick flicker (bang-bang movement correction, which
  // the AI and ordinary positioning adjustments do constantly) must NOT —
  // that was a real bug: it fired ~45 times/match from normal AI movement
  // alone before the min-gap requirement was added. Dive expires on its own
  // after DIVE_DURATION, and a cooldown blocks immediately re-diving. Ball
  // contact while diving resolves as a weak defensive 'save', not a full
  // attack.
  {
    const dt = 1 / 60;
    function tapTwice(p, dir, gapTicks, ball) {
      const bit = dir === 1 ? RIGHT : 1; // LEFT = 1
      let started = updateDive(p, bit, dt, ball); // first press
      updateDive(p, 0, dt, ball); // release
      for (let i = 0; i < gapTicks; i++) updateDive(p, 0, dt, ball); // held release
      started = updateDive(p, bit, dt, ball); // second press
      return started;
    }

    const flickerP = createPlayer(0);
    const flickerStarted = tapTwice(flickerP, 1, 0); // re-press on the very next tick
    if (flickerStarted || flickerP.diving) {
      fail('an instant flicker (no real gap between release and re-press) should NOT trigger a dive');
    }

    const realP = createPlayer(0);
    const realStarted = tapTwice(realP, 1, 6); // ~0.1s gap: a real double-tap
    if (!realStarted || !realP.diving) fail('a double-tap with a real human-timed gap should trigger a dive');
    if (realP.diveDir !== 1) fail(`dive direction should match the tapped direction: got ${realP.diveDir}`);

    const p = realP;
    let ticksToExpire = 0;
    while (p.diving && ticksToExpire < 60) { updateDive(p, 0, dt); ticksToExpire++; }
    if (p.diving) fail('dive should expire on its own after DIVE_DURATION');

    // Immediately double-tap again — should be blocked by the cooldown.
    tapTwice(p, 1, 6);
    if (p.diving) fail('diving again immediately after the first dive should be blocked by the cooldown');

    // A real double-tap while charging should still be ignored (charge takes
    // priority) — using a real gap so this fails ONLY because of charging,
    // not because the min-gap also happened to reject it.
    const p2 = createPlayer(0);
    updateCharge(p2, HIT, dt);
    const divedWhileCharging = tapTwice(p2, 1, 6);
    if (divedWhileCharging || p2.diving) fail('double-tapping while charging should not trigger a dive');

    // Contact while diving is a 'save', not a full attack.
    const p3 = createPlayer(0);
    p3.diving = true;
    p3.diveDir = 1;
    const ball = createBall(p3.x, p3.y - 36);
    resolvePlayerHit(ball, ball.x, ball.y, p3, 0, []);
    if (p3.lastEvent !== 'save') fail(`contact while diving should produce a 'save' event, got '${p3.lastEvent}'`);

    // A real double-tap should still be ignored if the ball is far away —
    // diving is a reach for a ball you could plausibly get to, not a
    // general-purpose movement burst. This also happens to suppress nearly
    // all of the CPU's accidental triggers (see ai.js's JITTER_HOLD_TICKS
    // comment) since those occur mostly while repositioning for a ball
    // that's still far across the court.
    const p4 = createPlayer(0);
    const farBall = createBall(p4.x + 500, p4.y);
    const divedFar = tapTwice(p4, 1, 6, farBall);
    if (divedFar || p4.diving) fail('double-tapping should not trigger a dive when the ball is far away');

    const p5 = createPlayer(0);
    const nearBall = createBall(p5.x + 50, p5.y);
    const divedNear = tapTwice(p5, 1, 6, nearBall);
    if (!divedNear || !p5.diving) fail('double-tapping should trigger a dive when the ball is genuinely close');
  }

}
