// Orchestrates an online 1v1 match: wires PeerTransport to netcode.js and
// exposes one uniform controller shape to main.js regardless of whether we
// ended up as host or guest. Browser-only (depends on transport.js's
// PeerJS-backed functions).
import { createPeerHost, createPeerGuest } from './transport.js';
import { createHostNetcode, createGuestNetcode } from './netcode.js';
import { createInitialState } from './sim.js';
import { LEFT, RIGHT, WIDTH } from './physics.js';

function swapLeftRight(mask) {
  const left = !!(mask & LEFT);
  const right = !!(mask & RIGHT);
  let m = mask & ~(LEFT | RIGHT);
  if (left) m |= RIGHT;
  if (right) m |= LEFT;
  return m;
}

// Mirrors ball + all players left-right and swaps TEAM order, so the
// guest's own team (world side 1) renders first/left — "each player always
// sees themselves on the left." The sim itself is never mirrored, only this
// render-facing copy. `opponents`/`selves` are each `teamSize`-length
// arrays; output keeps within-team (slot) order, swaps which team comes
// first, and explicitly sets `.side` to the NEW visual role (0 = guest's
// own team, drawn in P1's color; 1 = opponent team, P2's color) since the
// host's team snapshot entries don't carry their original side (only x/y —
// same reduced fidelity the opponent's render has always had, since a full
// animation-state sync was already a scope cut documented earlier this
// session: "guest's own avatar won't show post-swing follow-through").
function mirrorTeamsForDisplay(ball, opponents, selves, match) {
  const mirrorX = (p, side) => ({ ...p, x: WIDTH - p.x, side });
  return {
    ball: { ...ball, x: WIDTH - ball.x },
    players: [...selves.map((p) => mirrorX(p, 0)), ...opponents.map((p) => mirrorX(p, 1))],
    match,
  };
}

// `callbacks` ({onTaunt, onRematchReady}) are wired in at construction and
// stay wired across a rematch() — the same raw transport is reused (same
// room, no re-connecting), just with a fresh netcode instance underneath.
// Exported (alongside the Peer-wrapped hostOnlineMatch/joinOnlineMatch
// below) so tests can exercise the actual display-state logic directly
// over a LoopbackTransport, without needing window.Peer — this is exactly
// the layer that had a real bug this session (getRenderState()'s field
// names changed from singular opponent/self to plural opponents/selves for
// 2v2, and this file's old mirrorState() call site wasn't updated to
// match, so an online GUEST's screen would have crashed on the very next
// render — caught only by reading the code after the rename, not by the
// existing test suite, since net.test.mjs only ever checked
// getRenderState().ball, never .opponent/.self specifically).
export function hostController(transport, callbacks, teamSize = 1) {
  let net = createHostNetcode(transport, createInitialState(Date.now() & 0xffffffff, teamSize), { ...callbacks, teamSize });
  return {
    isHost: true,
    tick(localInputs) { return net.tick(localInputs); },
    getDisplayState() { return net.getState(); },
    sendTaunt: (...a) => net.sendTaunt(...a),
    sendRematchReady: (...a) => net.sendRematchReady(...a),
    getSilentMs: (...a) => net.getSilentMs(...a),
    rematch() { net = createHostNetcode(transport, createInitialState(Date.now() & 0xffffffff, teamSize), { ...callbacks, teamSize }); },
  };
}

export function guestController(transport, callbacks, teamSize = 1) {
  let net = createGuestNetcode(transport, { ...callbacks, teamSize });
  return {
    isHost: false,
    tick(localInputs) {
      const swapped = Array.isArray(localInputs) ? localInputs.map(swapLeftRight) : swapLeftRight(localInputs);
      net.tick(swapped);
      return { events: net.drainEvents() };
    },
    getDisplayState() {
      const r = net.getRenderState();
      if (!r.ball || !r.match) return null;
      return mirrorTeamsForDisplay(r.ball, r.opponents, r.selves, r.match);
    },
    sendTaunt: (...a) => net.sendTaunt(...a),
    sendRematchReady: (...a) => net.sendRematchReady(...a),
    getSilentMs: (...a) => net.getSilentMs(...a),
    rematch() { net = createGuestNetcode(transport, { ...callbacks, teamSize }); },
  };
}

// Lightweight pre-match handshake over the raw transport: exchange names,
// then wait for both sides to tap Ready. Hands off to netcode (which takes
// over transport.onMessage) only once both are ready — the two protocols
// never run on the channel at the same time.
function runLobbyHandshake(transport, localName, { onRemoteName, onBothReady }) {
  let remoteReady = false;
  let localReady = false;
  transport.onMessage((msg) => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'hello') onRemoteName(msg.name);
    else if (msg.t === 'ready') {
      remoteReady = true;
      if (localReady) onBothReady();
    }
  });
  transport.send({ t: 'hello', name: localName });
  return {
    sendReady() {
      localReady = true;
      transport.send({ t: 'ready' });
      if (remoteReady) onBothReady();
    },
  };
}

// code: 4-letter room code. onRemoteName fires once the other side's name
// arrives (lobby can render both names); onBothReady fires once both sides
// have tapped ready, with the match controller ready to drive. onError
// covers bad code, room full, or broker unreachable — see PROMPT.md's KNOWN
// RISKS: no TURN server means some phone-to-phone pairs across different
// networks just won't connect. onRematchReady fires whenever the OTHER side
// signals "run it back" — including after the match has ended, since the
// controller (and its transport.onMessage handler) is still alive then.
// `teamSize` 1 = Online 1v1 (unchanged), 2 = Online 2v2 — the host decides
// (it's the one creating the room/match state); the guest just needs to
// agree on the same value, which the mode selection on both sides already
// guarantees (both players pick "Online 2v2" from the same menu entry).
export function hostOnlineMatch(code, localName, { onRemoteName, onBothReady, onError, onDisconnected, onRemoteTaunt, onRematchReady, teamSize = 1 }) {
  let lobby = null;
  const callbacks = { onTaunt: onRemoteTaunt, onRematchReady };
  const peerCtrl = createPeerHost(code, {
    onReady(transport) {
      transport.onClose(() => onDisconnected && onDisconnected());
      lobby = runLobbyHandshake(transport, localName, {
        onRemoteName,
        onBothReady: () => onBothReady(hostController(transport, callbacks, teamSize)),
      });
    },
    onError,
  });
  return { close: peerCtrl.close, sendReady: () => lobby && lobby.sendReady() };
}

export function joinOnlineMatch(code, localName, { onRemoteName, onBothReady, onError, onDisconnected, onRemoteTaunt, onRematchReady, teamSize = 1 }) {
  let lobby = null;
  const callbacks = { onTaunt: onRemoteTaunt, onRematchReady };
  const peerCtrl = createPeerGuest(code, {
    onReady(transport) {
      transport.onClose(() => onDisconnected && onDisconnected());
      lobby = runLobbyHandshake(transport, localName, {
        onRemoteName,
        onBothReady: () => onBothReady(guestController(transport, callbacks, teamSize)),
      });
    },
    onError,
  });
  return { close: peerCtrl.close, sendReady: () => lobby && lobby.sendReady() };
}
