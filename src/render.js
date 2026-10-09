import {
  WIDTH, HEIGHT, GROUND_Y, NET_X, NET_TOP, NET_HALF_W, BALL_RADIUS,
  predictLandingPoint,
} from './physics.js';
import { PALETTE, outlinedCircle } from './art.js';
import { drawPlayer, drawEmoteBubble } from './character.js';

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

  // Sand drawn with a very slight trapezoid (wider at the bottom) for a
  // cheap forced-perspective read — still a flat 2D sim, just a visual tilt.
  ctx.fillStyle = PALETTE.sand;
  ctx.beginPath();
  ctx.moveTo(18, GROUND_Y);
  ctx.lineTo(WIDTH - 18, GROUND_Y);
  ctx.lineTo(WIDTH, HEIGHT);
  ctx.lineTo(0, HEIGHT);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.sandDark;
  for (let i = 0; i < 70; i++) {
    const sx = (i * 97) % WIDTH;
    const sy = GROUND_Y + ((i * 53) % (HEIGHT - GROUND_Y));
    ctx.fillRect(sx, sy, 3, 2);
  }

  bgCanvas = c;
}

// Clouds drift slowly left; this is the only moving background layer, kept
// subtle so it reads as depth rather than competing with the ball.
const CLOUDS = [
  { x: 120, y: 70, scale: 1, speed: 6 },
  { x: 420, y: 45, scale: 0.7, speed: 4 },
  { x: 700, y: 90, scale: 1.2, speed: 8 },
  { x: 860, y: 50, scale: 0.6, speed: 5 },
];

function drawClouds(ctx, timeSec) {
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const c of CLOUDS) {
    const x = ((c.x - timeSec * c.speed) % (WIDTH + 200) + (WIDTH + 200)) % (WIDTH + 200) - 100;
    ctx.beginPath();
    ctx.ellipse(x, c.y, 34 * c.scale, 14 * c.scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 22 * c.scale, c.y + 5, 24 * c.scale, 11 * c.scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 22 * c.scale, c.y + 6, 20 * c.scale, 10 * c.scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }
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

function drawLandingMarker(ctx, ball, phase) {
  if (phase !== 'rally' || ball.vy <= 0) return;
  const { x, t } = predictLandingPoint(ball);
  if (t <= 0 || x < 0 || x > WIDTH || t > 2.5) return;
  const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.01);
  ctx.strokeStyle = PALETTE.landingMarker;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, GROUND_Y + 1, 14 * pulse, 5 * pulse, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawBall(ctx, ball, spin) {
  const height = Math.max(0, GROUND_Y - ball.y);
  const shadowScale = Math.max(0.28, 1 - height / 360);
  ctx.fillStyle = PALETTE.shadow;
  ctx.beginPath();
  ctx.ellipse(ball.x, GROUND_Y + 2, BALL_RADIUS * shadowScale, BALL_RADIUS * 0.35 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Speed-line motion trail, scaled by velocity — only shows up on genuinely
  // fast shots so it reads as "powerful" rather than a constant smear.
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > 420) {
    const trailLen = Math.min(46, (speed - 420) * 0.07);
    const nx = -ball.vx / speed;
    const ny = -ball.vy / speed;
    const grad = ctx.createLinearGradient(ball.x, ball.y, ball.x + nx * trailLen, ball.y + ny * trailLen);
    grad.addColorStop(0, 'rgba(255,246,224,0.55)');
    grad.addColorStop(1, 'rgba(255,246,224,0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = BALL_RADIUS * 1.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ball.x, ball.y);
    ctx.lineTo(ball.x + nx * trailLen, ball.y + ny * trailLen);
    ctx.stroke();
  }

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

function drawBanner(ctx, text) {
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

export function render(ctx, state, spin, timeSec = 0, emotes = null, banner = null) {
  if (!bgCanvas) buildBackground();
  ctx.drawImage(bgCanvas, 0, 0);
  drawClouds(ctx, timeSec);

  drawNet(ctx, 0);
  drawLandingMarker(ctx, state.ball, state.match.phase);

  const [p1, p2] = state.players;
  drawPlayer(ctx, p1, PALETTE.p1, PALETTE.p1Dark, state.ball.x - p1.x);
  drawPlayer(ctx, p2, PALETTE.p2, PALETTE.p2Dark, state.ball.x - p2.x);
  drawBall(ctx, state.ball, spin);
  if (emotes) {
    drawEmoteBubble(ctx, p1, emotes[0]);
    drawEmoteBubble(ctx, p2, emotes[1]);
  }
  drawScore(ctx, state.match);
  drawBanner(ctx, banner);
}
