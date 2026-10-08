// Transport interface used by netcode.js: { send(msg), onMessage(cb), onClose(cb), close() }.
// LoopbackTransport + the fake clock are pure (importable in Node, no DOM) so
// netcode can be tested deterministically. PeerTransport (real WebRTC via
// PeerJS) is added in a later backlog item and lives in this same file.
import { stepRandom } from './rng.js';

// A manually-advanced clock: nothing fires on real timers, only when the
// test calls advance(ms). Scheduled callbacks run in time order.
export function createFakeClock() {
  let now = 0;
  const scheduled = [];
  return {
    now: () => now,
    schedule(delayMs, fn) {
      scheduled.push({ time: now + Math.max(0, delayMs), fn });
      scheduled.sort((a, b) => a.time - b.time);
    },
    advance(ms) {
      const target = now + ms;
      while (scheduled.length && scheduled[0].time <= target) {
        const ev = scheduled.shift();
        now = ev.time;
        ev.fn();
      }
      now = target;
    },
  };
}

// Two transports wired together in memory over a fake clock, with
// configurable one-way delay, jitter, and packet loss. Deterministic for a
// given seed — same seed always drops/delays the same messages the same way.
export function createLoopbackPair(clock, options = {}) {
  const { delayMs = 0, jitterMs = 0, lossRate = 0, seed = 1 } = options;
  let rngSeed = seed >>> 0;
  function nextRandom() {
    const [value, next] = stepRandom(rngSeed);
    rngSeed = next;
    return value;
  }

  function makeEndpoint(getPeer) {
    let onMessageCb = null;
    let onCloseCb = null;
    let closed = false;
    return {
      send(msg) {
        if (closed) return;
        if (nextRandom() < lossRate) return;
        const jitter = jitterMs > 0 ? (nextRandom() - 0.5) * 2 * jitterMs : 0;
        const delay = Math.max(0, delayMs + jitter);
        clock.schedule(delay, () => {
          const peer = getPeer();
          if (!closed && peer && peer.deliver) peer.deliver(msg);
        });
      },
      onMessage(cb) { onMessageCb = cb; },
      onClose(cb) { onCloseCb = cb; },
      deliver(msg) { if (onMessageCb) onMessageCb(msg); },
      close() {
        if (closed) return;
        closed = true;
        if (onCloseCb) onCloseCb();
      },
      get isClosed() { return closed; },
    };
  }

  let bRef, aRef;
  const a = makeEndpoint(() => bRef);
  const b = makeEndpoint(() => aRef);
  aRef = a;
  bRef = b;
  return [a, b];
}

// Room codes skip O, I, L — too easy to confuse with 0, 1 at a glance.
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const PEER_ID_PREFIX = 'spikebeef-';

export function randomRoomCode() {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function roomCodeToPeerId(code) {
  return PEER_ID_PREFIX + code.toUpperCase();
}

// Wraps a PeerJS DataConnection to match the Transport interface. Browser-
// only (needs the global Peer from the pinned PeerJS CDN script tag in
// index.html) — not imported by anything that runs in Node.
function wrapDataConnection(conn) {
  let onMessageCb = null;
  let onCloseCb = null;
  conn.on('data', (msg) => { if (onMessageCb) onMessageCb(msg); });
  conn.on('close', () => { if (onCloseCb) onCloseCb(); });
  conn.on('error', () => { if (onCloseCb) onCloseCb(); });
  return {
    send(msg) { if (conn.open) conn.send(msg); },
    onMessage(cb) { onMessageCb = cb; },
    onClose(cb) { onCloseCb = cb; },
    close() { conn.close(); },
  };
}

// Host side: claims "spikebeef-<CODE>" as its PeerJS id and waits for one
// guest to connect. Calls onReady(transport) once connected, onError(err)
// if the id is already taken (room code collision — vanishingly rare) or
// the signaling connection itself fails.
export function createPeerHost(code, { onReady, onError }) {
  const peer = new window.Peer(roomCodeToPeerId(code));
  let connected = false;
  peer.on('connection', (conn) => {
    if (connected) { conn.close(); return; } // room full — first guest wins
    conn.on('open', () => {
      connected = true;
      onReady(wrapDataConnection(conn));
    });
  });
  peer.on('error', (err) => onError(err));
  return { close: () => peer.destroy() };
}

// Guest side: connects to the host's "spikebeef-<CODE>" id. onError fires on
// a bad/missing room code, a full room, or any connection failure.
export function createPeerGuest(code, { onReady, onError }) {
  const peer = new window.Peer();
  peer.on('open', () => {
    const conn = peer.connect(roomCodeToPeerId(code), { reliable: true });
    conn.on('open', () => onReady(wrapDataConnection(conn)));
    conn.on('error', (err) => onError(err));
  });
  peer.on('error', (err) => onError(err));
  return { close: () => peer.destroy() };
}
