import { WIDTH, HEIGHT, GROUND_Y, NET_X, NET_TOP, NET_HALF_W, PLAYER_RADIUS, BALL_RADIUS } from './physics.js';
import { PALETTE, outlinedCircle, roundRect } from './art.js';

let bgCanvas = null;

function buildBackground() {
  const c = document.createElement('canvas');
  c.width = WIDTH;
  c.height = HEIGHT;
  const ctx = c.getContext('2d');

  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, PALETTE.skyTop);
  sky.addColorStop(1, PALETTE.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, GROUND_Y);

  ctx.fillStyle = PALETTE.sun;
  ctx.beginPath();
  ctx.arc(WIDTH / 2, GROUND_Y - 40, 70, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = PALETTE.seaDark;
  ctx.fillRect(0, GROUND_Y - 70, WIDTH, 70);
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(0, GROUND_Y - 60, WIDTH, 60);

  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);
  ctx.fillStyle = PALETTE.sandDark;
  for (let i = 0; i < 60; i++) {
    const sx = (i * 97) % WIDTH;
    const sy = GROUND_Y + ((i * 53) % (HEIGHT - GROUND_Y));
    ctx.fillRect(sx, sy, 3, 2);
  }

  bgCanvas = c;
}

function drawNet(ctx, sway) {
  ctx.strokeStyle = PALETTE.netPost;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(NET_X, GROUND_Y);
  ctx.lineTo(NET_X, NET_TOP - 10);
  ctx.stroke();

  ctx.fillStyle = PALETTE.net;
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 2;
  const top = NET_TOP + sway;
  ctx.beginPath();
  ctx.moveTo(NET_X - NET_HALF_W - 8, top);
  ctx.lineTo(NET_X + NET_HALF_W + 8, top - sway * 0.3);
  ctx.lineTo(NET_X + NET_HALF_W + 6, GROUND_Y);
  ctx.lineTo(NET_X - NET_HALF_W - 6, GROUND_Y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(36,26,20,0.3)';
  ctx.lineWidth = 1;
  for (let y = top + 10; y < GROUND_Y; y += 14) {
    ctx.beginPath();
    ctx.moveTo(NET_X - NET_HALF_W - 7, y);
    ctx.lineTo(NET_X + NET_HALF_W + 7, y);
    ctx.stroke();
  }
}

function drawPlayer(ctx, p, color, colorDark, facingBall) {
  const squash = p.onGround ? 1 : Math.max(0.85, 1 - Math.abs(p.vy) / 4000);
  const rx = PLAYER_RADIUS * (2 - squash);
  const ry = PLAYER_RADIUS * squash;

  ctx.fillStyle = PALETTE.shadow;
  ctx.beginPath();
  ctx.ellipse(p.x, 500 + 2, PLAYER_RADIUS * 0.9, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(p.x, p.y - ry);
  outlinedCircle(ctx, 0, 0, Math.max(rx, ry) * 0.72 + PLAYER_RADIUS * 0.4, color);

  const eyeDX = facingBall > 0 ? 3 : -3;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(eyeDX - 2, -4, 5, 0, Math.PI * 2);
  ctx.arc(eyeDX + 8, -4, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.outline;
  ctx.beginPath();
  ctx.arc(eyeDX - 2 + Math.sign(eyeDX) * 1.5, -4, 2, 0, Math.PI * 2);
  ctx.arc(eyeDX + 8 + Math.sign(eyeDX) * 1.5, -4, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colorDark;
  roundRect(ctx, -16, -24, 32, 9, 4);
  ctx.fill();
  ctx.restore();
}

function drawBall(ctx, ball, spin) {
  const height = Math.max(0, GROUND_Y - ball.y);
  const shadowScale = Math.max(0.3, 1 - height / 400);
  ctx.fillStyle = PALETTE.shadow;
  ctx.beginPath();
  ctx.ellipse(ball.x, GROUND_Y + 2, BALL_RADIUS * shadowScale, BALL_RADIUS * 0.35 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.rotate(spin);
  outlinedCircle(ctx, 0, 0, BALL_RADIUS, PALETTE.ball, PALETTE.ballLine, 2);
  ctx.strokeStyle = PALETTE.ballLine;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-BALL_RADIUS, 0);
  ctx.lineTo(BALL_RADIUS, 0);
  ctx.moveTo(0, -BALL_RADIUS);
  ctx.lineTo(0, BALL_RADIUS);
  ctx.stroke();
  ctx.restore();
}

export function drawScore(ctx, match) {
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.ui;
  ctx.fillText(`${match.score[0]}  -  ${match.score[1]}`, WIDTH / 2, 40);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(`sets ${match.sets[0]} - ${match.sets[1]}`, WIDTH / 2, 62);
}

export function render(ctx, state, spin) {
  if (!bgCanvas) buildBackground();
  ctx.drawImage(bgCanvas, 0, 0);

  const netHitRecently = false;
  drawNet(ctx, netHitRecently ? 6 : 0);

  const [p1, p2] = state.players;
  drawPlayer(ctx, p1, PALETTE.p1, PALETTE.p1Dark, state.ball.x - p1.x);
  drawPlayer(ctx, p2, PALETTE.p2, PALETTE.p2Dark, state.ball.x - p2.x);
  drawBall(ctx, state.ball, spin);
  drawScore(ctx, state.match);
}
