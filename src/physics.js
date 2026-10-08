// Pure physics: ball, players, collisions. No DOM, no window.

export const WIDTH = 960;
export const HEIGHT = 540;
export const GROUND_Y = 500;
export const NET_X = WIDTH / 2;
export const NET_HEIGHT = 140;
export const NET_TOP = GROUND_Y - NET_HEIGHT;
export const NET_HALF_W = 5;
export const PLAYER_RADIUS = 26;
export const BALL_RADIUS = 12;
export const GRAVITY = 1500;
export const MOVE_SPEED = 300;
export const JUMP_VY = -620;
export const BALL_RESTITUTION = 0.72;
export const DT = 1 / 60;
export const SUBSTEPS = 4;

export const LEFT = 1;
export const RIGHT = 2;
export const JUMP = 4;
export const HIT = 8;

export function createPlayer(side) {
  const x = side === 0 ? WIDTH * 0.25 : WIDTH * 0.75;
  return { side, x, y: GROUND_Y, vx: 0, vy: 0, onGround: true, hitCooldown: 0 };
}

export function createBall(x, y) {
  return { x, y, vx: 0, vy: 0 };
}

function playerBounds(side) {
  if (side === 0) return [PLAYER_RADIUS, NET_X - NET_HALF_W - PLAYER_RADIUS];
  return [NET_X + NET_HALF_W + PLAYER_RADIUS, WIDTH - PLAYER_RADIUS];
}

export function stepPlayer(p, input, dt) {
  const [lo, hi] = playerBounds(p.side);
  let vx = 0;
  if (input & LEFT) vx -= MOVE_SPEED;
  if (input & RIGHT) vx += MOVE_SPEED;
  p.vx = vx;
  p.x += p.vx * dt;
  if (p.x < lo) p.x = lo;
  if (p.x > hi) p.x = hi;

  if (p.onGround && (input & JUMP)) {
    p.vy = JUMP_VY;
    p.onGround = false;
  }

  p.vy += GRAVITY * dt;
  p.y += p.vy * dt;
  if (p.y >= GROUND_Y) {
    p.y = GROUND_Y;
    p.vy = 0;
    p.onGround = true;
  }

  if (p.hitCooldown > 0) p.hitCooldown -= dt;
}

export function stepBallGravity(ball, dt) {
  ball.vy += GRAVITY * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
}

// Walls, ceiling, net. Returns list of event names ('wallBounce','netBounce').
export function resolveBallBounds(ball, events) {
  if (ball.x - BALL_RADIUS < 0) {
    ball.x = BALL_RADIUS;
    ball.vx = Math.abs(ball.vx) * BALL_RESTITUTION;
    events.push('wallBounce');
  }
  if (ball.x + BALL_RADIUS > WIDTH) {
    ball.x = WIDTH - BALL_RADIUS;
    ball.vx = -Math.abs(ball.vx) * BALL_RESTITUTION;
    events.push('wallBounce');
  }
  if (ball.y - BALL_RADIUS < 0) {
    ball.y = BALL_RADIUS;
    ball.vy = Math.abs(ball.vy) * BALL_RESTITUTION;
    events.push('wallBounce');
  }

  // Net: a thin vertical post from NET_TOP to GROUND_Y at NET_X.
  const withinNetHeight = ball.y + BALL_RADIUS > NET_TOP;
  const nearNetX = Math.abs(ball.x - NET_X) < NET_HALF_W + BALL_RADIUS;
  if (withinNetHeight && nearNetX) {
    if (ball.x < NET_X) {
      ball.x = NET_X - NET_HALF_W - BALL_RADIUS;
      ball.vx = -Math.abs(ball.vx) * BALL_RESTITUTION - 20;
    } else {
      ball.x = NET_X + NET_HALF_W + BALL_RADIUS;
      ball.vx = Math.abs(ball.vx) * BALL_RESTITUTION + 20;
    }
    events.push('netBounce');
  }

  // Net top: ball landing on top of the net from above.
  if (nearNetX && ball.y + BALL_RADIUS >= NET_TOP && ball.y - BALL_RADIUS < NET_TOP && ball.vy > 0) {
    ball.y = NET_TOP - BALL_RADIUS;
    ball.vy = -Math.abs(ball.vy) * BALL_RESTITUTION - 40;
    events.push('netBounce');
  }
}

// Ball vs ground. Returns true if the ball touched the ground this step
// (caller uses this to award the point to the other side).
export function resolveGround(ball) {
  if (ball.y + BALL_RADIUS >= GROUND_Y) {
    ball.y = GROUND_Y - BALL_RADIUS;
    ball.vy = -Math.abs(ball.vy) * BALL_RESTITUTION;
    if (Math.abs(ball.vy) < 40) ball.vy = 0;
    return true;
  }
  return false;
}

// Swept circle-circle collision between ball and player over this substep.
// Returns true and mutates ball velocity if a collision happened.
export function resolvePlayerHit(ball, prevX, prevY, p, input, events) {
  const dx = ball.x - p.x;
  const dy = ball.y - p.y;
  const dist = Math.hypot(dx, dy);
  const minDist = BALL_RADIUS + PLAYER_RADIUS;
  if (dist >= minDist) return false;

  const nx = dist === 0 ? 0 : dx / dist;
  const ny = dist === 0 ? -1 : dy / dist;
  ball.x = p.x + nx * minDist;
  ball.y = p.y + ny * minDist;

  const wantsHit = !!(input & HIT) && p.hitCooldown <= 0;
  const jumping = !p.onGround;
  const nearPeak = jumping && Math.abs(p.vy) < 260;

  let power, steep;
  if (wantsHit && jumping && nearPeak) {
    power = 920;
    steep = 0.55; // spike: fast and steep downward
    events.push('spike');
  } else if (wantsHit) {
    power = 560;
    steep = 1.3; // bump: higher, softer
    events.push('hit');
  } else {
    power = 420;
    steep = 1.1;
  }

  const dirX = p.side === 0 ? 1 : -1;
  const inputDirX = (input & RIGHT ? 1 : 0) - (input & LEFT ? 1 : 0);
  const aimX = inputDirX !== 0 ? inputDirX : dirX;
  ball.vx = aimX * power;
  ball.vy = -power * steep * 0.6;

  if (wantsHit) p.hitCooldown = 0.18;
  return true;
}
