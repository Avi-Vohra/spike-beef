// Character drawing: the limbed player figure and its emote speech bubble.
// Split out of render.js to keep that file under the project's file-size
// guideline.
import { GROUND_Y, PLAYER_RADIUS, WIDTH, SPIKE_MIN_CHARGE } from './physics.js';
import {
  PALETTE, shadedCircle, roundRect, capsule, chargeColor, lighten,
} from './art.js';

const LEG_LEN = 15;
const TORSO_LEN = 17;
const HEAD_R = 15;
const EMOTE_GLYPH = { laugh: '\u{1F602}', cry: '\u{1F62D}', sleep: '\u{1F4A4}', flex: '\u{1F4AA}' };

export function drawPlayer(ctx, p, color, colorDark, facingBall, mood = null) {
  const facing = facingBall >= 0 ? 1 : -1;
  const airborne = !(p.onGround ?? true);
  const squash = p.diving ? 0.55 : airborne ? Math.max(0.82, 1 - Math.abs(p.vy) / 4200) : 1;

  // Ground shadow — drawn in world space, unaffected by the squash scale.
  ctx.fillStyle = PALETTE.shadow;
  ctx.beginPath();
  ctx.ellipse(p.x, GROUND_Y + 2, PLAYER_RADIUS * 0.85, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(p.x, p.y);
  // A dive leans the whole figure into the lunge direction — a cheap but
  // readable "stretched-out horizontal reach" silhouette.
  if (p.diving) ctx.rotate(p.diveDir * 0.4);
  ctx.scale(2 - squash, squash);

  const runAmp = Math.min(1, Math.abs(p.vx) / 300);
  const legSwing = airborne ? 6 : Math.sin(p.runPhase) * 10 * runAmp;
  const legSwing2 = airborne ? -4 : Math.sin(p.runPhase + Math.PI) * 10 * runAmp;
  const hipY = -LEG_LEN;
  const shoulderY = hipY - TORSO_LEN;
  const headY = shoulderY - HEAD_R * 0.6;

  // Legs, with small feet at the ground end of each — a bare capsule end
  // reads as an amputated stump at this size; a tiny foot closes the
  // silhouette and gives the run cycle somewhere to visibly plant.
  capsule(ctx, -4, 0, -4 + legSwing * 0.5, hipY, 9, colorDark);
  capsule(ctx, 4, 0, 4 + legSwing2 * 0.5, hipY, 9, colorDark);
  ctx.fillStyle = PALETTE.outline;
  ctx.beginPath();
  ctx.ellipse(-4 + legSwing * 0.5 + facing * 3, 1, 7, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(4 + legSwing2 * 0.5 + facing * 3, 1, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Torso — a thin lighter highlight stripe down one side (offset toward
  // the facing direction, like light catching the near edge) gives the
  // single flat capsule fill a bit of the same "lit, not flat" read the
  // ball/head gradients add, without the cost of a true gradient on a
  // stroked shape.
  capsule(ctx, 0, hipY, 0, shoulderY, 20, color);
  capsule(ctx, -facing * 5, hipY - 2, -facing * 5, shoulderY + 2, 6, lighten(color, 0.35), 'transparent');

  // Arms — windup while charging, swing-through on a recent hit/spike/tip.
  let armBack = facing * -14;
  let armFwd = facing * 14;
  let armY = shoulderY + 6;
  let swingTrailProgress = null; // set below for the hand's motion-blur ghosts
  if (p.diving) {
    // Both arms stretched out in the dive direction, reaching for the ball.
    armBack = p.diveDir * 20;
    armFwd = p.diveDir * 20;
    armY = shoulderY - 4;
  } else if (p.charging) {
    const pull = p.charge;
    armBack = facing * (-14 - 10 * pull);
    armFwd = facing * (6 - 6 * pull);
    armY = shoulderY + 6 + 4 * pull;
  } else if (p.lastEvent && ['hit', 'spike', 'tip', 'fumble', 'block', 'save'].includes(p.lastEvent) && p.lastEventTimer > 0) {
    const progress = 1 - p.lastEventTimer / 0.35;
    const arc = Math.sin(Math.min(1, progress) * Math.PI);
    armBack = facing * (-14 + 36 * progress);
    armFwd = facing * (14 + 20 * progress);
    armY = shoulderY + 6 - arc * 14;
    // Only the real power shots get a visible trail — a tip/fumble/save
    // shouldn't look like it hit as hard as a spike.
    if (['hit', 'spike', 'block'].includes(p.lastEvent) && progress < 0.65) {
      swingTrailProgress = progress;
    }
  } else if (p.lastEvent === 'win') {
    // Little victory pose: both arms up.
    armBack = -16;
    armFwd = 16;
    armY = shoulderY - 18;
  } else if (p.lastEvent === 'lose') {
    // Slump: arms hang low, shoulders drop.
    armBack = -8;
    armFwd = 8;
    armY = shoulderY + 16;
  }
  // Swing trail: a couple of fading "ghost" hand positions a bit earlier in
  // the swing arc, same idea as the ball's own speed trail in render.js —
  // gives the hit a sense of motion instead of a single static pose.
  if (swingTrailProgress !== null) {
    for (let i = 1; i <= 2; i++) {
      const pr = Math.max(0, swingTrailProgress - i * 0.13);
      const arc2 = Math.sin(Math.min(1, pr) * Math.PI);
      const gx = facing * (14 + 20 * pr);
      const gy = shoulderY + 6 - arc2 * 14;
      ctx.globalAlpha = 0.22 / i;
      ctx.fillStyle = colorDark;
      ctx.beginPath();
      ctx.arc(gx, gy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  capsule(ctx, 0, shoulderY + 2, armBack, armY, 7, colorDark);
  capsule(ctx, 0, shoulderY + 2, armFwd, armY, 7, colorDark);
  // Hands at each arm's end — the part that actually does the hitting, so
  // this is the single most important silhouette addition for "hit
  // graphics": without it, a swing was just an armless line snapping
  // through empty space.
  ctx.fillStyle = PALETTE.outline;
  ctx.beginPath();
  ctx.arc(armBack, armY, 4.5, 0, Math.PI * 2);
  ctx.arc(armFwd, armY, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // Head — shaded sphere (gradient) instead of a flat disc, for a rounder,
  // more dimensional read, same "more 3D" cheap-win idea as the ball.
  shadedCircle(ctx, 0, headY, HEAD_R, color, colorDark);
  const isWin = p.lastEvent === 'win';
  const isLose = p.lastEvent === 'lose';
  const justImpacted = !isLose && p.lastEvent && (isWin || p.lastEventTimer > 0.22);
  const eyeR = isLose ? 3 : justImpacted ? 6 : 4.5;
  const eyeDX = facing * 3;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(eyeDX - 4, headY - 2, eyeR, 0, Math.PI * 2);
  ctx.arc(eyeDX + 5, headY - 2, eyeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.outline;
  ctx.beginPath();
  ctx.arc(eyeDX - 4 + facing * 1.5, headY - 2, eyeR * 0.45, 0, Math.PI * 2);
  ctx.arc(eyeDX + 5 + facing * 1.5, headY - 2, eyeR * 0.45, 0, Math.PI * 2);
  ctx.fill();
  // Eyebrows furrow as charge builds.
  if (p.charging) {
    ctx.strokeStyle = PALETTE.outline;
    ctx.lineWidth = 2;
    const browTilt = p.charge * 4;
    ctx.beginPath();
    ctx.moveTo(eyeDX - 9, headY - 8 - browTilt);
    ctx.lineTo(eyeDX - 1, headY - 6);
    ctx.moveTo(eyeDX, headY - 6);
    ctx.lineTo(eyeDX + 9, headY - 8 - browTilt);
    ctx.stroke();
  }

  // Mouth: smile when winning or ahead by a lot, frown when losing/behind.
  if (!p.charging) {
    const smile = isWin || mood === 'ahead';
    const frown = isLose || mood === 'behind';
    if (smile || frown) {
      ctx.strokeStyle = PALETTE.outline;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const curve = smile ? 3 : -3;
      ctx.moveTo(eyeDX - 4, headY + 6);
      ctx.quadraticCurveTo(eyeDX, headY + 6 + curve, eyeDX + 4, headY + 6);
      ctx.stroke();
    }
  }

  // A single sweat drop when meaningfully behind and not already reacting.
  if (mood === 'behind' && !isWin && !isLose && !p.charging) {
    ctx.fillStyle = '#7fd8ff';
    ctx.beginPath();
    ctx.ellipse(eyeDX + HEAD_R * facing * 0.7, headY - HEAD_R * 0.6, 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.outline;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.fillStyle = colorDark;
  roundRect(ctx, -14, headY + HEAD_R - 6, 28, 7, 3);
  ctx.fill();

  // Charge meter — a small filling pill above the head, color ramps with
  // charge so the telegraph is unmistakable from across the court. While
  // airborne, once charge crosses SPIKE_MIN_CHARGE the bar switches to a
  // distinct bright ring — "you can spike right now if you release" — the
  // direct visual payoff for the spike-threshold fix (spike used to fire
  // off almost any charge in the air; now it needs a real commitment, so
  // players need a way to feel exactly when they've crossed that line).
  if (p.charging) {
    const barW = 30;
    const bx = -barW / 2;
    const by = headY - HEAD_R - 14;
    const spikeReady = airborne && p.charge >= SPIKE_MIN_CHARGE;
    ctx.fillStyle = 'rgba(36,26,20,0.55)';
    roundRect(ctx, bx, by, barW, 7, 3);
    ctx.fill();
    ctx.fillStyle = spikeReady ? '#fff6e0' : chargeColor(p.charge);
    roundRect(ctx, bx, by, barW * Math.min(1, p.charge), 7, 3);
    ctx.fill();
    ctx.strokeStyle = spikeReady ? '#ffe066' : PALETTE.outline;
    ctx.lineWidth = spikeReady ? 2.5 : 1.5;
    roundRect(ctx, bx, by, barW, 7, 3);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawEmoteBubble(ctx, p, emote) {
  if (!emote || !emote.value || emote.timer <= 0) return;
  const isLine = emote.kind === 'line';
  const duration = isLine ? 2.2 : 1.6;
  const bubbleY = p.y - LEG_LEN - TORSO_LEN - HEAD_R * 1.6 - 22;
  const pop = Math.min(1, (duration - emote.timer) / 0.15); // quick pop-in
  const scale = 0.7 + 0.3 * Math.min(1, pop);

  ctx.font = isLine ? 'bold 12px system-ui, sans-serif' : '20px system-ui, sans-serif';
  const text = isLine ? emote.value : (EMOTE_GLYPH[emote.value] || '');
  const textW = ctx.measureText(text).width;
  const w = isLine ? Math.min(150, textW + 20) : 34;
  const h = isLine ? 26 : 30;

  // Keep the bubble on-canvas even near the side walls.
  const bx = Math.max(w / 2 + 4, Math.min(WIDTH - w / 2 - 4, p.x)) - p.x;

  ctx.save();
  ctx.translate(p.x + bx, bubbleY);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 2;
  roundRect(ctx, -w / 2, -h / 2 - 2, w, h, isLine ? 8 : 10);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-bx - 5, h / 2 + 10);
  ctx.lineTo(-bx, h / 2 + 20);
  ctx.lineTo(-bx + 7, h / 2 + 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PALETTE.outline;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, -3);
  ctx.restore();
}
