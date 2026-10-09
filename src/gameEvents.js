// Dispatches sim/netcode events to their presentation side-effects: sound,
// particles/shake, and vibration. Kept separate from main.js's render loop
// so that file stays under the project's file-size guideline.
import * as fx from './fx.js';
import { vibrate } from './device.js';
import { playEvent } from './audio.js';
import * as announcer from './announcer.js';
import * as stats from './stats.js';

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
export function processEvents(events, ball, matchBefore = null) {
  let hitStop = 0;
  const hadNetBounce = events.some((ev) => (typeof ev === 'string' ? ev : ev.type) === 'netBounce');
  for (const ev of events) {
    const type = typeof ev === 'string' ? ev : ev.type;
    playEvent(type);
    if (type === 'tip') { fx.spawnImpact(ball.x, ball.y, 300); vibrate(10); }
    else if (type === 'hit') { fx.spawnImpact(ball.x, ball.y, 480); vibrate(15); hitStop = Math.max(hitStop, 0.03); }
    else if (type === 'spike') {
      fx.spawnImpact(ball.x, ball.y, 750); vibrate(25); hitStop = Math.max(hitStop, 0.07);
      stats.recordHitEvent(type, ev.side);
    } else if (type === 'fumble') { fx.spawnImpact(ball.x, ball.y, 150); }
    else if (type === 'netBounce') { fx.spawnImpact(ball.x, ball.y, 200); }
    else if (type === 'point') {
      fx.spawnSandPuff(ball.x, ball.y);
      vibrate(30);
      if (matchBefore) {
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
