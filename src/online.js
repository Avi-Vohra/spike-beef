// Orchestrates an online 1v1 match: wires PeerTransport to netcode.js and
// exposes one uniform controller shape to main.js regardless of whether we
// ended up as host or guest. Browser-only (depends on transport.js's
// PeerJS-backed functions).
import { createPeerHost, createPeerGuest } from './transport.js';
import { createHostNetcode, createGuestNetcode } from './netcode.js';
import { createInitialState } from './sim.js';

function hostController(transport) {
  const net = createHostNetcode(transport, createInitialState(Date.now() & 0xffffffff));
  return {
    isHost: true,
    tick(localInput) { return net.tick(localInput); },
    getDisplayState() { return net.getState(); },
  };
}

function guestController(transport) {
  const net = createGuestNetcode(transport);
  return {
    isHost: false,
    tick(localInput) { net.tick(localInput); },
    getDisplayState() {
      const r = net.getRenderState();
      if (!r.ball || !r.match) return null;
      return { ball: r.ball, players: [r.opponent, r.self], match: r.match };
    },
  };
}

// code: 4-letter room code. Calls onConnected(controller) once the data
// channel is open, onError(err) on failure (bad code, room full, broker
// unreachable — see PROMPT.md's KNOWN RISKS: no TURN server means some
// phone-to-phone pairs across different networks just won't connect).
export function hostOnlineMatch(code, { onConnected, onError, onDisconnected }) {
  const peerCtrl = createPeerHost(code, {
    onReady(transport) {
      transport.onClose(() => onDisconnected && onDisconnected());
      onConnected(hostController(transport));
    },
    onError,
  });
  return { close: peerCtrl.close };
}

export function joinOnlineMatch(code, { onConnected, onError, onDisconnected }) {
  const peerCtrl = createPeerGuest(code, {
    onReady(transport) {
      transport.onClose(() => onDisconnected && onDisconnected());
      onConnected(guestController(transport));
    },
    onError,
  });
  return { close: peerCtrl.close };
}
