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

// Mirrors ball + both players left-right and swaps player order, so the
// guest's own avatar (world side1) renders first/left — "each player always
// sees themselves on the left." The sim itself is never mirrored, only this
// render-facing copy.
function mirrorState(s) {
  return {
    ball: { ...s.ball, x: WIDTH - s.ball.x },
    players: [
      { x: WIDTH - s.players[1].x, y: s.players[1].y },
      { x: WIDTH - s.players[0].x, y: s.players[0].y },
    ],
    match: s.match,
  };
}

function hostController(transport, onRemoteTaunt) {
  const net = createHostNetcode(transport, createInitialState(Date.now() & 0xffffffff), { onTaunt: onRemoteTaunt });
  return {
    isHost: true,
    tick(localInput) { return net.tick(localInput); },
    getDisplayState() { return net.getState(); },
    sendTaunt: net.sendTaunt,
  };
}

function guestController(transport, onRemoteTaunt) {
  const net = createGuestNetcode(transport, { onTaunt: onRemoteTaunt });
  return {
    isHost: false,
    tick(localInput) { net.tick(swapLeftRight(localInput)); },
    getDisplayState() {
      const r = net.getRenderState();
      if (!r.ball || !r.match) return null;
      return mirrorState({ ball: r.ball, players: [r.opponent, r.self], match: r.match });
    },
    sendTaunt: net.sendTaunt,
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
// networks just won't connect.
export function hostOnlineMatch(code, localName, { onRemoteName, onBothReady, onError, onDisconnected, onRemoteTaunt }) {
  let lobby = null;
  const peerCtrl = createPeerHost(code, {
    onReady(transport) {
      transport.onClose(() => onDisconnected && onDisconnected());
      lobby = runLobbyHandshake(transport, localName, {
        onRemoteName,
        onBothReady: () => onBothReady(hostController(transport, onRemoteTaunt)),
      });
    },
    onError,
  });
  return { close: peerCtrl.close, sendReady: () => lobby && lobby.sendReady() };
}

export function joinOnlineMatch(code, localName, { onRemoteName, onBothReady, onError, onDisconnected, onRemoteTaunt }) {
  let lobby = null;
  const peerCtrl = createPeerGuest(code, {
    onReady(transport) {
      transport.onClose(() => onDisconnected && onDisconnected());
      lobby = runLobbyHandshake(transport, localName, {
        onRemoteName,
        onBothReady: () => onBothReady(guestController(transport, onRemoteTaunt)),
      });
    },
    onError,
  });
  return { close: peerCtrl.close, sendReady: () => lobby && lobby.sendReady() };
}
