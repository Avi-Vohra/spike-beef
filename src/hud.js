// HUD overlay drawing: score, connection status, serve/touch indicators,
// banner text. Split out of render.js to keep that file under the
// project's file-size guideline.
import { WIDTH, HEIGHT } from './physics.js';
import { MAX_TOUCHES } from './rules.js';
import { PALETTE } from './art.js';

export function drawScore(ctx, match) {
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.ui;
  ctx.fillText(`${match.score[0]}  -  ${match.score[1]}`, WIDTH / 2, 40);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(`sets ${match.sets[0]} - ${match.sets[1]}`, WIDTH / 2, 62);
}

// Small connection-health dot, top-left — green/yellow/red by how long
// it's been since anything was heard from the other side. Only drawn when
// `silentMs` is non-null (i.e. an online match is active).
export function drawConnectionDot(ctx, silentMs) {
  if (silentMs == null) return;
  const color = silentMs < 400 ? '#5fd16a' : silentMs < 1500 ? '#f4c842' : '#ff5d5d';
  ctx.fillStyle = color;
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(16, 16, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (silentMs > 3000) {
    const secsLeft = Math.max(0, Math.ceil((15000 - silentMs) / 1000));
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = PALETTE.outline;
    ctx.lineWidth = 4;
    const msg = `Reconnecting... (${secsLeft}s)`;
    ctx.strokeText(msg, WIDTH / 2, HEIGHT / 2);
    ctx.fillText(msg, WIDTH / 2, HEIGHT / 2);
  }
}

// A small bouncing chevron over whoever's about to serve — there was
// previously NO visual cue for this at all, which matters a lot more in
// human-vs-human play (CPU opponents don't need to be told, but two people
// sharing a keyboard or playing online absolutely do: "wait, whose serve is
// this?" is exactly the kind of ambiguity this whole redesign has been
// fighting since the original ball-position-only cue is easy to miss).
export function drawServeIndicator(ctx, player, timeSec) {
  const bounce = Math.abs(Math.sin(timeSec * 4)) * 6;
  const x = player.x;
  const y = player.y - 86 - bounce;
  ctx.fillStyle = PALETTE.chargeMid;
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 9, y);
  ctx.lineTo(x + 9, y);
  ctx.lineTo(x, y + 11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// Small filled/hollow pips above whichever side currently has the ball,
// showing how many of the MAX_TOUCHES(3) touches they've used — the "you're
// about to fault on the next touch" information was previously only
// available by mentally counting hit sounds, which is genuinely hard to
// track live, especially in human-vs-human play where both players need to
// agree on the count without a referee.
export function drawTouchPips(ctx, player, touchCount) {
  const n = Math.min(touchCount, MAX_TOUCHES);
  const spacing = 10;
  const startX = player.x - ((MAX_TOUCHES - 1) * spacing) / 2;
  const y = player.y - 100;
  for (let i = 0; i < MAX_TOUCHES; i++) {
    ctx.beginPath();
    ctx.arc(startX + i * spacing, y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = i < n ? PALETTE.chargeMid : 'rgba(244,241,232,0.3)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = PALETTE.outline;
    ctx.stroke();
  }
}

export function drawBanner(ctx, text) {
  if (!text) return;
  ctx.save();
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 5;
  ctx.strokeText(text, WIDTH / 2, 110);
  ctx.fillStyle = PALETTE.chargeMid;
  ctx.fillText(text, WIDTH / 2, 110);
  ctx.restore();
}
