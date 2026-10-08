// Host-authoritative netcode over the Transport interface (transport.js).
// Host runs sim.js at 60Hz and is the single source of truth. Guest sends its
// input bitmask with a sequence number every tick (plus its last few inputs,
// so a dropped packet doesn't lose input); host applies whichever input has
// the highest sequence number it has seen. Host broadcasts a compact snapshot
// every few ticks. This module only talks to the transport interface — it
// never knows if that's PeerTransport or LoopbackTransport.
import { step } from './sim.js';

export const SNAPSHOT_EVERY_N_TICKS = 2; // 60Hz sim -> ~30Hz snapshots
export const INPUT_HISTORY = 3;

// packet: [tick, ballX, ballY, ballVx, ballVy, p0x, p0y, p1x, p1y,
//          score0, score1, sets0, sets1, server, phaseCode, ackSeq, events]
const PHASES = ['serve', 'rally', 'point', 'setWon', 'matchWon'];
const phaseToCode = (phase) => PHASES.indexOf(phase);
const codeToPhase = (code) => PHASES[code] ?? 'serve';

export function createHostNetcode(transport, initialState) {
  let state = initialState;
  let lastAppliedSeq = -1;
  let currentGuestInput = 0;
  let tickCount = 0;
  let pendingEventTypes = [];

  transport.onMessage((packet) => {
    const [seq, ...inputs] = packet;
    if (seq > lastAppliedSeq) {
      currentGuestInput = inputs[0] || 0;
      lastAppliedSeq = seq;
    }
  });

  function tick(hostInput) {
    const result = step(state, hostInput, currentGuestInput);
    state = result.state;
    for (const ev of result.events) pendingEventTypes.push(typeof ev === 'string' ? ev : ev.type);
    tickCount++;
    if (tickCount % SNAPSHOT_EVERY_N_TICKS === 0) sendSnapshot();
    return result;
  }

  function sendSnapshot() {
    const s = state;
    transport.send([
      s.tick,
      Math.round(s.ball.x), Math.round(s.ball.y), Math.round(s.ball.vx), Math.round(s.ball.vy),
      Math.round(s.players[0].x), Math.round(s.players[0].y),
      Math.round(s.players[1].x), Math.round(s.players[1].y),
      s.match.score[0], s.match.score[1], s.match.sets[0], s.match.sets[1],
      s.match.server, phaseToCode(s.match.phase), lastAppliedSeq,
      pendingEventTypes,
    ]);
    pendingEventTypes = [];
  }

  return { tick, getState: () => state };
}

export function createGuestNetcode(transport) {
  let seq = 0;
  const recentInputs = [];
  let lastSnapshot = null;
  let lastProcessedTick = -1;
  const eventLog = []; // [{tick, type}], each fired exactly once

  transport.onMessage((packet) => {
    const [tick, bx, by, bvx, bvy, p0x, p0y, p1x, p1y, score0, score1, sets0, sets1, server, phaseCode, ackSeq, events] = packet;
    if (tick <= lastProcessedTick) return; // dedupe/out-of-order guard
    lastProcessedTick = tick;
    lastSnapshot = {
      tick,
      ball: { x: bx, y: by, vx: bvx, vy: bvy },
      players: [{ x: p0x, y: p0y }, { x: p1x, y: p1y }],
      match: { score: [score0, score1], sets: [sets0, sets1], server, phase: codeToPhase(phaseCode) },
      ackSeq,
    };
    for (const type of events) eventLog.push({ tick, type });
  });

  function tick(localInput) {
    seq += 1;
    recentInputs.unshift(localInput);
    if (recentInputs.length > INPUT_HISTORY) recentInputs.length = INPUT_HISTORY;
    transport.send([seq, ...recentInputs]);
  }

  return { tick, getSnapshot: () => lastSnapshot, getEvents: () => eventLog };
}
