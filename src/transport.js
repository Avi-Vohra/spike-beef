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
