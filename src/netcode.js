// Host-authoritative netcode over the Transport interface (transport.js).
// Host runs sim.js at 60Hz and is the single source of truth. Guest sends its
// input bitmask with a sequence number every tick (plus its last few inputs,
// so a dropped packet doesn't lose input); host applies whichever input has
// the highest sequence number it has seen. Host broadcasts a compact snapshot
// every few ticks. This module only talks to the transport interface — it
// never knows if that's PeerTransport or LoopbackTransport.
import { step } from './sim.js';
import { stepPlayer, updateCharge, createPlayer, DT, SUBSTEPS } from './physics.js';
import { updateDive } from './dive.js';

export const SNAPSHOT_EVERY_N_TICKS = 2; // 60Hz sim -> ~30Hz snapshots
export const INPUT_HISTORY = 3;
export const INTERP_DELAY_TICKS = 6; // render ball/opponent ~100ms behind
export const RECONCILE_SNAP_DISTANCE = 60; // px: beyond this, hard-snap self

// packet: [tick, ballX, ballY, ballVx, ballVy, ...playerXY pairs (one per
//          player, host's team first then guest's team, matching sim.js's
//          slot order), score0, score1, sets0, sets1, server, phaseCode,
//          ackSeq, events]
// Player count is 2*teamSize (1 for 1v1, 2 for 2v2) — variable-length, not
// a fixed 1v1 shape, so 2v2 reuses the exact same wire format.
const PHASES = ['serve', 'rally', 'point', 'setWon', 'matchWon'];
const phaseToCode = (phase) => PHASES.indexOf(phase);
const codeToPhase = (code) => PHASES[code] ?? 'serve';

// `teamSize` 1 = classic 1v1 (one local input, one guest input — unchanged
// wire behavior from before). `teamSize` 2 = 2v2: `hostInputs`/the guest's
// sent inputs are each a `teamSize`-length array (one mask per local
// teammate on that side), combined into the full per-slot inputs array
// sim.js's step() expects (host's team occupies slots 0..teamSize-1, guest's
// team occupies slots teamSize..2*teamSize-1 — matches createInitialState's
// slot assignment order).
export function createHostNetcode(transport, initialState, { onTaunt, onRematchReady, teamSize = 1 } = {}) {
  let state = initialState;
  let lastAppliedSeq = -1;
  let currentGuestInputs = new Array(teamSize).fill(0);
  let tickCount = 0;
  let pendingEventTypes = [];
  let lastMessageTime = Date.now();

  // Taunts (and rematch-ready) share this transport with game-input packets
  // but are tagged objects, never plain arrays, so the two protocols can
  // never collide — neither reaches, or affects, the sim.
  transport.onMessage((packet) => {
    lastMessageTime = Date.now();
    if (!Array.isArray(packet)) {
      if (!packet) return;
      if (packet.t === 'emote' && onTaunt) onTaunt(packet.kind, packet.value);
      else if (packet.t === 'rematchReady' && onRematchReady) onRematchReady();
      return;
    }
    // [seq, ...history] where history is INPUT_HISTORY repetitions of
    // teamSize input values each (newest first) — redundancy against a
    // dropped packet, same idea as 1v1 always had, just teamSize-wide now.
    const [seq, ...history] = packet;
    if (seq > lastAppliedSeq) {
      currentGuestInputs = history.slice(0, teamSize).map((v) => v || 0);
      lastAppliedSeq = seq;
    }
  });

  function sendTaunt(kind, value) { transport.send({ t: 'emote', kind, value }); }
  function sendRematchReady() { transport.send({ t: 'rematchReady' }); }
  function getSilentMs(now = Date.now()) { return now - lastMessageTime; }

  function tick(hostInputs) {
    const inputs = Array.isArray(hostInputs) ? hostInputs : [hostInputs];
    const result = step(state, [...inputs, ...currentGuestInputs]);
    state = result.state;
    for (const ev of result.events) pendingEventTypes.push(typeof ev === 'string' ? ev : ev.type);
    tickCount++;
    if (tickCount % SNAPSHOT_EVERY_N_TICKS === 0) sendSnapshot();
    return result;
  }

  function sendSnapshot() {
    const s = state;
    const playerCoords = [];
    for (const p of s.players) playerCoords.push(Math.round(p.x), Math.round(p.y));
    transport.send([
      s.tick,
      Math.round(s.ball.x), Math.round(s.ball.y), Math.round(s.ball.vx), Math.round(s.ball.vy),
      ...playerCoords,
      s.match.score[0], s.match.score[1], s.match.sets[0], s.match.sets[1],
      s.match.server, phaseToCode(s.match.phase), lastAppliedSeq,
      pendingEventTypes,
    ]);
    pendingEventTypes = [];
  }

  return { tick, getState: () => state, sendTaunt, sendRematchReady, getSilentMs };
}

const HISTORY_CAP = 12;

function lerp(a, b, t) { return a + (b - a) * t; }

// `teamSize` 1 = classic 1v1 (one local avatar predicted, one opponent
// interpolated — unchanged behavior from before). `teamSize` 2 = 2v2: the
// guest predicts BOTH its local teammates (slots teamSize..2*teamSize-1)
// and interpolates BOTH of the host's team (slots 0..teamSize-1).
export function createGuestNetcode(transport, { onTaunt, onRematchReady, teamSize = 1 } = {}) {
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
  // One predicted player per local teammate, at slots teamSize..2*teamSize-1
  // (side 1) — xOffset matches sim.js's createInitialState spread so a 2v2
  // guest's own predicted teammates start in the same visual spots the
  // host's authoritative sim puts them.
  const predictedSelves = [];
  for (let i = 0; i < teamSize; i++) {
    const xOffset = teamSize === 1 ? 0 : (i === 0 ? -50 : 50);
    predictedSelves.push(createPlayer(1, teamSize + i, xOffset));
  }
  let lastMessageTime = Date.now();
  let drainedUpTo = 0; // index into eventLog already handed to the caller

  function sendTaunt(kind, value) { transport.send({ t: 'emote', kind, value }); }

  // Returns events appended since the last call (so the caller — main.js —
  // can drive sound/fx/vibration for the guest too; before this existed the
  // guest side of an online match got none of that feedback at all, since
  // nothing ever read getEvents()'s full cumulative log).
  function drainEvents() {
    const fresh = eventLog.slice(drainedUpTo);
    drainedUpTo = eventLog.length;
    return fresh;
  }
  function sendRematchReady() { transport.send({ t: 'rematchReady' }); }
  function getSilentMs(now = Date.now()) { return now - lastMessageTime; }

  transport.onMessage((packet) => {
    lastMessageTime = Date.now();
    if (!Array.isArray(packet)) {
      if (!packet) return;
      if (packet.t === 'emote' && onTaunt) onTaunt(packet.kind, packet.value);
      else if (packet.t === 'rematchReady' && onRematchReady) onRematchReady();
      return;
    }
    const [tick, bx, by, bvx, bvy, ...rest] = packet;
    if (tick <= lastProcessedTick) return; // dedupe/out-of-order guard
    lastProcessedTick = tick;
    const totalPlayers = teamSize * 2;
    const playerCoords = rest.slice(0, totalPlayers * 2);
    const players = [];
    for (let i = 0; i < totalPlayers; i++) players.push({ x: playerCoords[i * 2], y: playerCoords[i * 2 + 1] });
    const [score0, score1, sets0, sets1, server, phaseCode, ackSeq, events] = rest.slice(totalPlayers * 2);
    lastSnapshot = {
      tick,
      ball: { x: bx, y: by, vx: bvx, vy: bvy },
      players,
      match: { score: [score0, score1], sets: [sets0, sets1], server, phase: codeToPhase(phaseCode) },
      ackSeq,
    };
    history.push(lastSnapshot);
    if (history.length > HISTORY_CAP) history.shift();
    for (const type of events) eventLog.push({ tick, type });

    // Reconcile local prediction of our own avatars against the
    // authoritative position: snap only if the error is large, otherwise
    // trust prediction and let it converge naturally (avoids visible
    // teleporting). One reconcile per local teammate.
    for (let i = 0; i < teamSize; i++) {
      const authoritative = lastSnapshot.players[teamSize + i];
      const self = predictedSelves[i];
      const dx = authoritative.x - self.x;
      const dy = authoritative.y - self.y;
      if (Math.hypot(dx, dy) > RECONCILE_SNAP_DISTANCE) {
        self.x = authoritative.x;
        self.y = authoritative.y;
      }
    }
  });

  function tick(localInputs) {
    const inputs = Array.isArray(localInputs) ? localInputs : [localInputs];
    seq += 1;
    recentInputs.unshift(inputs);
    if (recentInputs.length > INPUT_HISTORY) recentInputs.length = INPUT_HISTORY;
    transport.send([seq, ...recentInputs.flat()]);

    localTick += 1;
    // Predict charge state too, not just position — otherwise the guest's
    // own avatar never shows its charge meter filling or the windup pose
    // locally, even though the actual hit resolves correctly on the host
    // (which runs the real sim off the raw input bits this sends above).
    for (let i = 0; i < teamSize; i++) {
      const self = predictedSelves[i];
      const input = inputs[i] || 0;
      updateCharge(self, input, DT);
      updateDive(self, input, DT, lastSnapshot ? lastSnapshot.ball : null);
      for (let s = 0; s < SUBSTEPS; s++) stepPlayer(self, input, DT / SUBSTEPS);
    }
  }

  // Ball and the opponents (host's team) are rendered ~INTERP_DELAY_TICKS
  // behind, interpolated between the two snapshots bracketing that target
  // tick — smooths over the gaps between the ~30Hz snapshot rate.
  function getRenderState() {
    if (history.length === 0) {
      return { ball: null, opponents: [], selves: predictedSelves, match: null };
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
    const opponents = [];
    for (let i = 0; i < teamSize; i++) {
      opponents.push({ x: lerp(a.players[i].x, b.players[i].x, t), y: lerp(a.players[i].y, b.players[i].y, t) });
    }
    return {
      ball: {
        x: lerp(a.ball.x, b.ball.x, t), y: lerp(a.ball.y, b.ball.y, t),
        vx: lerp(a.ball.vx, b.ball.vx, t), vy: lerp(a.ball.vy, b.ball.vy, t),
      },
      opponents,
      selves: predictedSelves,
      match: lastSnapshot.match,
    };
  }

  return {
    tick, getSnapshot: () => lastSnapshot, getEvents: () => eventLog, getRenderState,
    sendTaunt, sendRematchReady, getSilentMs, drainEvents,
  };
}
