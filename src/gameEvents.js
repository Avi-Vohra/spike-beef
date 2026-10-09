// Dispatches sim/netcode events to their presentation side-effects: sound,
// particles/shake, and vibration. Kept separate from main.js's render loop
// so that file stays under the project's file-size guideline.
import * as fx from './fx.js';
import { vibrate } from './device.js';
import { playEvent } from './audio.js';

export function processEvents(events, ball) {
  for (const ev of events) {
    const type = typeof ev === 'string' ? ev : ev.type;
    playEvent(type);
    if (type === 'tip') { fx.spawnImpact(ball.x, ball.y, 300); vibrate(10); }
    else if (type === 'hit') { fx.spawnImpact(ball.x, ball.y, 480); vibrate(15); }
    else if (type === 'spike') { fx.spawnImpact(ball.x, ball.y, 750); vibrate(25); }
    else if (type === 'fumble') { fx.spawnImpact(ball.x, ball.y, 150); }
    else if (type === 'netBounce') { fx.spawnImpact(ball.x, ball.y, 200); }
    else if (type === 'point') { fx.spawnSandPuff(ball.x, ball.y); vibrate(30); }
    else if (type === 'setWon') { fx.spawnConfetti(ball.x, Math.min(ball.y, 200)); }
  }
}
