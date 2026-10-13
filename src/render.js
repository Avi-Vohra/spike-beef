import {
  WIDTH, HEIGHT, GROUND_Y, NET_X, NET_TOP, NET_HALF_W, BALL_RADIUS,
} from './physics.js';
import { predictLandingPoint } from './ball.js';
import { PALETTE, shadedCircle } from './art.js';
import { drawPlayer, drawEmoteBubble } from './character.js';
import { drawNet } from './net.js';
import {
  drawScore, drawConnectionDot, drawServeIndicator, drawTouchPips, drawBanner,
} from './hud.js';

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

function drawBall(ctx, ball, spin, squash = null) {
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
  // Squash-and-stretch at the moment of contact: flattened perpendicular to
  // the impact direction, stretched along it, like a real ball deforming
  // under a hard hit. Done by rotating into the impact-aligned frame,
  // scaling, then rotating back — kept separate from the spin rotation
  // below so the squash direction doesn't spin with the ball.
  if (squash && squash.amount > 0.001) {
    ctx.rotate(squash.angle);
    ctx.scale(1 + squash.amount * 0.7, 1 - squash.amount * 0.5);
    ctx.rotate(-squash.angle);
  }
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

export function render(ctx, state, spin, timeSec = 0, emotes = null, banner = null, silentMs = null, netSway = 0, ballSquash = null) {
  if (!bgCanvas) buildBackground();
  ctx.drawImage(bgCanvas, 0, 0);
  drawClouds(ctx, timeSec);
  drawSeaWave(ctx, timeSec);

  drawNet(ctx, netSway);
  drawLandingMarker(ctx, state.ball, state.match.phase);

  // Loops over ALL players (2 for 1v1, 4 for 2v2) rather than destructuring
  // exactly [p1, p2] — that used to silently drop any player past index 1,
  // which in 2v2 is an entire team. Mood/color are per-player's own side,
  // not per-array-position.
  const diff = (state.match.score ? state.match.score[0] - state.match.score[1] : 0);
  for (const p of state.players) {
    const [color, colorDark] = p.side === 0 ? [PALETTE.p1, PALETTE.p1Dark] : [PALETTE.p2, PALETTE.p2Dark];
    const mood = (p.side === 0 ? diff >= 4 : diff <= -4) ? 'ahead' : (p.side === 0 ? diff <= -4 : diff >= 4) ? 'behind' : null;
    drawPlayer(ctx, p, color, colorDark, state.ball.x - p.x, mood);
  }
  if (state.match.phase === 'serve') {
    // .find(), not direct [match.server] indexing — in 2v2 `server` is a
    // SIDE (0/1), not a player-array index, since a side now holds 2
    // players. The lowest-slot teammate on that side is the one serving
    // (see sim.js) — find() with array order (ascending slot) matches that.
    const server = state.players.find((p) => p.side === state.match.server);
    drawServeIndicator(ctx, server, timeSec);
  } else if (state.match.phase === 'rally' && state.match.lastToucherSide !== null) {
    const side = state.match.lastToucherSide;
    // Touch pips show above whichever teammate most recently touched it —
    // approximated here as the first (lowest-slot) player on that side,
    // since the match state doesn't track exactly which individual
    // teammate last touched, only the team/side.
    const toucher = state.players.find((p) => p.side === side);
    drawTouchPips(ctx, toucher, state.match.touches[side]);
  }
  drawBall(ctx, state.ball, spin, ballSquash);
  if (emotes) {
    // Emotes are per-SIDE (the taunt bar is one shared UI, not per local
    // player) — shown above that side's first teammate in 2v2.
    for (let side = 0; side < 2; side++) {
      const firstTeammate = state.players.find((p) => p.side === side);
      if (firstTeammate) drawEmoteBubble(ctx, firstTeammate, emotes[side]);
    }
  }
  drawScore(ctx, state.match);
  drawBanner(ctx, banner);
  drawConnectionDot(ctx, silentMs);
}
