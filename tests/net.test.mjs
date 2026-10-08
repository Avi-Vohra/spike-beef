import { createInitialState } from '../src/sim.js';
import { isMatchWon } from '../src/rules.js';
import { aiInput } from '../src/ai.js';
import { createFakeClock, createLoopbackPair } from '../src/transport.js';
import { createHostNetcode, createGuestNetcode, SNAPSHOT_EVERY_N_TICKS, INTERP_DELAY_TICKS } from '../src/netcode.js';
import { fail } from './helpers.mjs';

const DT_MS = 1000 / 60;

// Runs a full CPU-driven match with host+guest over LoopbackTransport under
// the given network conditions, tracking score agreement, event-count
// parity, and the guest's reconstructed-ball-position error vs what the
// host's ball actually was at that same historical tick.
function runNetMatch(netConditions, seed) {
  const clock = createFakeClock();
  const [hostTransport, guestTransport] = createLoopbackPair(clock, { ...netConditions, seed });
  const hostNet = createHostNetcode(hostTransport, createInitialState(seed));
  const guestNet = createGuestNetcode(guestTransport);

  let safety = 0;
  let hostEventCount = 0;
  const errorSamples = [];
  const hostBallHistory = new Map(); // tick -> {x,y}
  while (isMatchWon(hostNet.getState().match.sets) === -1 && safety < 60 * 60 * 8) {
    const hostState = hostNet.getState();
    const hostInput = aiInput(hostState, 0, 'medium');

    const snap = guestNet.getSnapshot();
    const guestAiState = snap
      ? { players: snap.players, ball: snap.ball, match: snap.match, tick: snap.tick, rngSeed: 0 }
      : { players: hostState.players, ball: hostState.ball, match: hostState.match, tick: 0, rngSeed: 0 };
    const guestInput = aiInput(guestAiState, 1, 'medium');

    const result = hostNet.tick(hostInput);
    hostEventCount += result.events.length;
    hostBallHistory.set(result.state.tick, { x: result.state.ball.x, y: result.state.ball.y });
    guestNet.tick(guestInput);
    clock.advance(DT_MS);
    safety++;

    const render = guestNet.getRenderState();
    if (render.ball && snap) {
      const targetTick = snap.tick - INTERP_DELAY_TICKS;
      const actual = hostBallHistory.get(targetTick);
      if (actual) errorSamples.push(Math.hypot(render.ball.x - actual.x, render.ball.y - actual.y));
    }
  }
  if (safety >= 60 * 60 * 8) fail('net match did not complete');

  // Drain: force a few more snapshot sends (sim.js no-ops once matchWon) and
  // let the clock run long enough for the final snapshot to actually arrive.
  for (let i = 0; i < SNAPSHOT_EVERY_N_TICKS + 1; i++) {
    hostEventCount += hostNet.tick(0).events.length;
    clock.advance(DT_MS);
  }
  clock.advance(1000);

  const avgError = errorSamples.reduce((a, b) => a + b, 0) / Math.max(1, errorSamples.length);
  return {
    hostSets: hostNet.getState().match.sets,
    guestSets: guestNet.getSnapshot().match.sets,
    hostEventCount,
    guestEventCount: guestNet.getEvents().length,
    avgError,
  };
}

export function run() {
  // Test 9: fake clock delivers a scheduled message at the right simulated time.
  {
    const clock = createFakeClock();
    let firedAt = -1;
    clock.schedule(100, () => { firedAt = clock.now(); });
    clock.advance(50);
    if (firedAt !== -1) fail('fake clock fired before its scheduled time');
    clock.advance(50);
    if (firedAt !== 100) fail(`fake clock fired at wrong time: ${firedAt}`);
  }

  // Test 10: loopback transport delivers after the configured delay, in order.
  {
    const clock = createFakeClock();
    const [a, b] = createLoopbackPair(clock, { delayMs: 50, seed: 1 });
    const received = [];
    b.onMessage((msg) => received.push(msg));
    a.send('hello');
    a.send('world');
    clock.advance(49);
    if (received.length !== 0) fail('loopback delivered before the configured delay');
    clock.advance(1);
    if (received.length !== 2 || received[0] !== 'hello' || received[1] !== 'world') {
      fail(`loopback delivery wrong: ${JSON.stringify(received)}`);
    }
  }

  // Test 11: 100% loss rate means nothing is ever delivered.
  {
    const clock = createFakeClock();
    const [a, b] = createLoopbackPair(clock, { delayMs: 10, lossRate: 1, seed: 2 });
    let got = false;
    b.onMessage(() => (got = true));
    for (let i = 0; i < 20; i++) a.send(`msg${i}`);
    clock.advance(1000);
    if (got) fail('100% loss rate still delivered a message');
  }

  // Test 12: same seed/options gives identical delivery timing (determinism).
  {
    function runOnce(seed) {
      const clock = createFakeClock();
      const [a, b] = createLoopbackPair(clock, { delayMs: 50, jitterMs: 20, lossRate: 0.3, seed });
      const log = [];
      b.onMessage((msg) => log.push({ t: clock.now(), msg }));
      for (let i = 0; i < 10; i++) { a.send(`m${i}`); clock.advance(10); }
      clock.advance(200);
      return log;
    }
    const r1 = runOnce(42);
    const r2 = runOnce(42);
    if (JSON.stringify(r1) !== JSON.stringify(r2)) fail('loopback timing not deterministic for the same seed');
    if (r1.length === 0) fail('loopback with 30% loss delivered nothing across 10 sends (unlucky or broken)');
  }

  // Test 13 (net test a): 40ms delay / 0% loss. Match should complete with
  // identical final scores and no dropped/duplicated events.
  {
    const r = runNetMatch({ delayMs: 40, lossRate: 0 }, 11);
    if (JSON.stringify(r.hostSets) !== JSON.stringify(r.guestSets)) {
      fail(`net test (a): final sets differ — host ${r.hostSets} vs guest ${r.guestSets}`);
    }
    if (r.guestEventCount !== r.hostEventCount) {
      fail(`net test (a): host generated ${r.hostEventCount} events, guest received ${r.guestEventCount}`);
    }
  }

  // Test 14 (net test b): 150ms delay, 20ms jitter, 5% loss.
  {
    const r = runNetMatch({ delayMs: 150, jitterMs: 20, lossRate: 0.05 }, 21);
    if (JSON.stringify(r.hostSets) !== JSON.stringify(r.guestSets)) {
      fail(`net test (b): final sets differ — host ${r.hostSets} vs guest ${r.guestSets}`);
    }
    if (r.guestEventCount > r.hostEventCount) {
      fail(`net test (b): guest saw more events (${r.guestEventCount}) than host generated (${r.hostEventCount})`);
    }
    if (r.avgError > 80) fail(`net test (b): average guest ball position error too high: ${r.avgError.toFixed(1)}px`);
  }

  // Test 15 (net test c): 300ms delay, 10% loss.
  {
    const r = runNetMatch({ delayMs: 300, jitterMs: 0, lossRate: 0.1 }, 22);
    if (JSON.stringify(r.hostSets) !== JSON.stringify(r.guestSets)) {
      fail(`net test (c): final sets differ — host ${r.hostSets} vs guest ${r.guestSets}`);
    }
    if (r.guestEventCount > r.hostEventCount) {
      fail(`net test (c): guest saw more events (${r.guestEventCount}) than host generated (${r.hostEventCount})`);
    }
    if (r.avgError > 120) fail(`net test (c): average guest ball position error too high: ${r.avgError.toFixed(1)}px`);
  }
}
