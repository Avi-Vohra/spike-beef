// Host-authoritative netcode over the Transport interface (transport.js).
// Host runs sim.js at 60Hz and is the single source of truth. Guest sends its
// input bitmask with a sequence number every tick (plus its last few inputs,
// so a dropped packet doesn't lose input); host applies whichever input has
// the highest sequence number it has seen. Host broadcasts a compact snapshot
// every few ticks. This module only talks to the transport interface — it
// never knows if that's PeerTransport or LoopbackTransport.
import { step } from './sim.js';
import { stepPlayer, createPlayer, DT, SUBSTEPS } from './physics.js';

export const SNAPSHOT_EVERY_N_TICKS = 2; // 60Hz sim -> ~30Hz snapshots
export const INPUT_HISTORY = 3;
export const INTERP_DELAY_TICKS = 6; // render ball/opponent ~100ms behind
export const RECONCILE_SNAP_DISTANCE = 60; // px: beyond this, hard-snap self

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

const HISTORY_CAP = 12;

function lerp(a, b, t) { return a + (b - a) * t; }

export function createGuestNetcode(transport) {
  let seq = 0;
  const recentInputs = [];
  let lastSnapshot = null;
  let lastProcessedTick = -1;
  const eventLog = []; // [{tick, type}], each fired exactly once — dedupe
  // is guaranteed by the tick-ordering guard below: a snapshot older than or
  // equal to the last one accepted (whether late, reordered, or a true
  // resend) is dropped, so its events can never be logged twice.
  const history = []; // recent snapshots, oldest first, for interpolation
  let localTick = 0;
  let predictedSelf = createPlayer(1);

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
    history.push(lastSnapshot);
    if (history.length > HISTORY_CAP) history.shift();
    for (const type of events) eventLog.push({ tick, type });

    // Reconcile local prediction of our own avatar against the authoritative
    // position: snap only if the error is large, otherwise trust prediction
    // and let it converge naturally (avoids visible teleporting).
    const authoritative = lastSnapshot.players[1];
    const dx = authoritative.x - predictedSelf.x;
    const dy = authoritative.y - predictedSelf.y;
    if (Math.hypot(dx, dy) > RECONCILE_SNAP_DISTANCE) {
      predictedSelf.x = authoritative.x;
      predictedSelf.y = authoritative.y;
    }
  });

  function tick(localInput) {
    seq += 1;
    recentInputs.unshift(localInput);
    if (recentInputs.length > INPUT_HISTORY) recentInputs.length = INPUT_HISTORY;
    transport.send([seq, ...recentInputs]);

    localTick += 1;
    for (let s = 0; s < SUBSTEPS; s++) stepPlayer(predictedSelf, localInput, DT / SUBSTEPS);
  }

  // Ball and the opponent (host's side) are rendered ~INTERP_DELAY_TICKS
  // behind, interpolated between the two snapshots bracketing that target
  // tick — smooths over the gaps between the ~30Hz snapshot rate.
  function getRenderState() {
    if (history.length === 0) {
      return { ball: null, opponent: null, self: predictedSelf, match: null };
    }
    const targetTick = (lastSnapshot ? lastSnapshot.tick : 0) - INTERP_DELAY_TICKS;
    let a = history[0];
    let b = history[history.length - 1];
    for (let i = 0; i < history.length - 1; i++) {
      if (history[i].tick <= targetTick && history[i + 1].tick >= targetTick) {
        a = history[i];
        b = history[i + 1];
        break;
      }
    }
    const span = b.tick - a.tick;
    const t = span > 0 ? Math.min(1, Math.max(0, (targetTick - a.tick) / span)) : 1;
    return {
      ball: {
        x: lerp(a.ball.x, b.ball.x, t), y: lerp(a.ball.y, b.ball.y, t),
        vx: lerp(a.ball.vx, b.ball.vx, t), vy: lerp(a.ball.vy, b.ball.vy, t),
      },
      opponent: { x: lerp(a.players[0].x, b.players[0].x, t), y: lerp(a.players[0].y, b.players[0].y, t) },
      self: predictedSelf,
      match: lastSnapshot.match,
    };
  }

  return { tick, getSnapshot: () => lastSnapshot, getEvents: () => eventLog, getRenderState };
}
