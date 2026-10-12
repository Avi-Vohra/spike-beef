import {
  WIDTH, HEIGHT, GROUND_Y, NET_X, NET_TOP, NET_HALF_W, BALL_RADIUS,
} from './physics.js';
import { predictLandingPoint } from './ball.js';
import { PALETTE, shadedCircle } from './art.js';
import { drawPlayer, drawEmoteBubble } from './character.js';
import { drawNet } from './net.js';

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

  // Solid full-width base first — the trapezoid below is an overlay shading
  // effect, not the only thing covering this band: without this base, its
  // inset top corners (the "forced perspective" tilt) left the canvas's
  // raw black showing through at the corners, confirmed visually via a
  // real screenshot, not assumed.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);

  // Slight trapezoid tint (wider at the bottom) for a cheap forced-
  // perspective read — still a flat 2D sim, just a visual tilt.
  ctx.fillStyle = PALETTE.sandDark;
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(18, GROUND_Y);
  ctx.lineTo(0, HEIGHT);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(WIDTH, GROUND_Y);
  ctx.lineTo(WIDTH - 18, GROUND_Y);
  ctx.lineTo(WIDTH, HEIGHT);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
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

// A moving wave line along the sea's near edge — the only part of the sea
// that animates; everything else stays in the pre-rendered static bgCanvas
// for performance.
function drawSeaWave(ctx, timeSec) {
  const waveY = GROUND_Y - 62;
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= WIDTH; x += 12) {
    const y = waveY + Math.sin(x * 0.04 + timeSec * 1.6) * 3;
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
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
  shadedCircle(ctx, 0, 0, BALL_RADIUS, PALETTE.ball, PALETTE.ballDark, PALETTE.ballLine, 2);
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

// Small connection-health dot, top-left — green/yellow/red by how long
// it's been since anything was heard from the other side. Only drawn when
// `silentMs` is non-null (i.e. an online match is active).
function drawConnectionDot(ctx, silentMs) {
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
function drawServeIndicator(ctx, player, timeSec) {
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

// A static-ish backdrop (background + net, no players/ball/HUD) for screens
// with no active match state — menus, lobby, etc. Without this the canvas
// was simply raw black behind every pre-match screen, which looked
// unfinished and wasted the court art entirely until the first match
// started.
export function renderIdle(ctx, timeSec = 0) {
  if (!bgCanvas) buildBackground();
  ctx.drawImage(bgCanvas, 0, 0);
  drawClouds(ctx, timeSec);
  drawSeaWave(ctx, timeSec);
  drawNet(ctx, 0);
}

export function render(ctx, state, spin, timeSec = 0, emotes = null, banner = null, silentMs = null, netSway = 0) {
  if (!bgCanvas) buildBackground();
  ctx.drawImage(bgCanvas, 0, 0);
  drawClouds(ctx, timeSec);
  drawSeaWave(ctx, timeSec);

  drawNet(ctx, netSway);
  drawLandingMarker(ctx, state.ball, state.match.phase);

  const [p1, p2] = state.players;
  const diff = (state.match.score ? state.match.score[0] - state.match.score[1] : 0);
  const mood1 = diff >= 4 ? 'ahead' : diff <= -4 ? 'behind' : null;
  const mood2 = diff <= -4 ? 'ahead' : diff >= 4 ? 'behind' : null;
  drawPlayer(ctx, p1, PALETTE.p1, PALETTE.p1Dark, state.ball.x - p1.x, mood1);
  drawPlayer(ctx, p2, PALETTE.p2, PALETTE.p2Dark, state.ball.x - p2.x, mood2);
  if (state.match.phase === 'serve') {
    drawServeIndicator(ctx, state.players[state.match.server], timeSec);
  }
  drawBall(ctx, state.ball, spin);
  if (emotes) {
    drawEmoteBubble(ctx, p1, emotes[0]);
    drawEmoteBubble(ctx, p2, emotes[1]);
  }
  drawScore(ctx, state.match);
  drawBanner(ctx, banner);
  drawConnectionDot(ctx, silentMs);
}
