// Dispatches sim/netcode events to their presentation side-effects: sound,
// particles/shake, and vibration. Kept separate from main.js's render loop
// so that file stays under the project's file-size guideline.
import * as fx from './fx.js';
import { vibrate } from './device.js';
import { playEvent } from './audio.js';
import * as announcer from './announcer.js';
import * as stats from './stats.js';
import { GROUND_Y } from './physics.js';

export const bannerState = { text: null, timer: 0 };
export function updateBanner(dt) {
  if (bannerState.timer > 0) {
    bannerState.timer -= dt;
    if (bannerState.timer <= 0) bannerState.text = null;
  }
}
export function resetAnnouncer() {
  announcer.resetSet();
  stats.reset();
  bannerState.text = null;
  bannerState.timer = 0;
}

// Returns the hit-stop duration (seconds) this batch of events calls for —
// the caller decides whether to actually apply it (only safe for offline
// modes, where freezing the local tick loop doesn't desync an authoritative
// host from a remote guest).
//
// `matchBefore` (optional — only available when the caller ran the real sim,
// i.e. offline or the online host, not a guest working from a snapshot) lets
// this also drive the announcer banner (ACE/streaks/comeback/etc), since
// those need the score/server/rallyHits as they were *before* this batch.
export function processEvents(events, ball, matchBefore = null, players = null) {
  let hitStop = 0;
  const hadNetBounce = events.some((ev) => (typeof ev === 'string' ? ev : ev.type) === 'netBounce');
  for (const ev of events) {
    const type = typeof ev === 'string' ? ev : ev.type;
    playEvent(type);
    // Particle bursts aim along the ball's OUTGOING direction (its velocity
    // right after this hit resolved) instead of a generic all-directions
    // splash — reads as "flung that way" rather than a firework.
    const outAngle = Math.atan2(ball.vy, ball.vx);
    if (type === 'tip') { fx.spawnImpact(ball.x, ball.y, 300, outAngle); vibrate(10); }
    else if (type === 'hit') { fx.spawnImpact(ball.x, ball.y, 480, outAngle); vibrate(15); hitStop = Math.max(hitStop, 0.03); }
    else if (type === 'spike') {
      fx.spawnImpact(ball.x, ball.y, 750, outAngle); vibrate(25); hitStop = Math.max(hitStop, 0.07);
      fx.triggerPunch(0.05);
      stats.recordHitEvent(type, ev.side);
    } else if (type === 'fumble') { fx.spawnImpact(ball.x, ball.y, 150); }
    else if (type === 'block') { fx.spawnImpact(ball.x, ball.y, 550, outAngle); vibrate(20); hitStop = Math.max(hitStop, 0.05); fx.triggerPunch(0.03); }
    else if (type === 'save') { fx.spawnImpact(ball.x, ball.y, 250, outAngle); vibrate(10); }
    else if (type === 'dive') {
      vibrate(8);
      // .find() by slot, not players[ev.side] — `side` is a TEAM value
      // (0/1), not a safe array index once a side holds more than one
      // player (2v2): players[1] would grab team0's SECOND player instead
      // of team1's diver, putting the sand-puff fx in the wrong spot
      // entirely. ev.slot uniquely identifies which exact player dove.
      const diver = players && players.find((p) => p.slot === ev.slot);
      if (diver) fx.spawnSandPuff(diver.x, GROUND_Y);
    }
    else if (type === 'netBounce') { fx.spawnImpact(ball.x, ball.y, 200); fx.triggerNetSway(ball.vx > 0 ? 6 : -6); }
    else if (type === 'point') {
      fx.spawnSandPuff(ball.x, ball.y);
      vibrate(30);
      // ev.winner is only present on events that still carry their full
      // shape (offline sim, or the online host's own authoritative events).
      // The online guest's events arrive via the host's snapshot, which only
      // serializes bare type strings (no side/winner/charge) — skip the
      // stats/announcer update rather than feed them `undefined` as if it
      // were a real side, which would silently corrupt streak/comeback
      // tracking with a wrong-but-plausible-looking banner.
      if (matchBefore && typeof ev.winner === 'number') {
        stats.recordRallyLength(matchBefore.rallyHits || 0);
        if (matchBefore.rallyHits === 0 && ev.winner === matchBefore.server) stats.recordAce(ev.winner);
        const isSetWin = events.some((e) => e.type === 'setWon');
        const callout = announcer.processPoint({
          scoreBefore: matchBefore.score,
          winner: ev.winner,
          rallyHitsBefore: matchBefore.rallyHits,
          serverBefore: matchBefore.server,
          hadNetBounce,
          isSetWin,
          setScoreAfter: matchBefore.setsAfter,
        });
        if (callout) { bannerState.text = callout; bannerState.timer = 1.8; }
      }
    } else if (type === 'setWon') { fx.spawnConfetti(ball.x, Math.min(ball.y, 200)); }
  }
  return hitStop;
}
