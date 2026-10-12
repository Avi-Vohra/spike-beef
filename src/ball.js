// Pure ball physics: creation, gravity, landing prediction, and collisions
// with court bounds/net/ground. Split out of physics.js (which keeps player
// movement/charge/hit-resolution) to stay under the file-size guideline.
import {
  WIDTH, GROUND_Y, NET_X, NET_TOP, NET_HALF_W, BALL_RADIUS, GRAVITY, BALL_RESTITUTION,
} from './physics.js';

export function createBall(x, y) {
  return { x, y, vx: 0, vy: 0 };
}

export function stepBallGravity(ball, dt) {
  ball.vy += GRAVITY * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
}

// Where the ball will hit the ground, given current position/velocity under
// gravity. Shared by the AI's targeting and the landing-marker render hint —
// one function, two consumers, so they never disagree.
export function predictLandingPoint(ball) {
  const a = 0.5 * GRAVITY;
  const b = ball.vy;
  const c = ball.y - GROUND_Y;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return { x: ball.x, t: 0 };
  const t = (-b + Math.sqrt(disc)) / (2 * a);
  if (!(t > 0) || !Number.isFinite(t)) return { x: ball.x, t: 0 };
  return { x: ball.x + ball.vx * t, t };
}

// Walls, ceiling, net. `nextRandomFn`/`rngSeed`, if provided, apply a small
// seeded jitter to net/wall bounces only — a little physical "luck" that
// never touches direct player hits, so skill stays precise but the odd
// bounce can go either way. Returns the (possibly advanced) rng seed.
export function resolveBallBounds(ball, events, rngSeed, nextRandomFn) {
  let seed = rngSeed;
  const jitter = () => {
    if (!nextRandomFn) return 1;
    const [v, next] = nextRandomFn(seed);
    seed = next;
    return 0.94 + v * 0.12; // +/-6%
  };

  if (ball.x - BALL_RADIUS < 0) {
    ball.x = BALL_RADIUS;
    ball.vx = Math.abs(ball.vx) * BALL_RESTITUTION * jitter();
    events.push('wallBounce');
  }
  if (ball.x + BALL_RADIUS > WIDTH) {
    ball.x = WIDTH - BALL_RADIUS;
    ball.vx = -Math.abs(ball.vx) * BALL_RESTITUTION * jitter();
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
      ball.vx = (-Math.abs(ball.vx) * BALL_RESTITUTION - 20) * jitter();
    } else {
      ball.x = NET_X + NET_HALF_W + BALL_RADIUS;
      ball.vx = (Math.abs(ball.vx) * BALL_RESTITUTION + 20) * jitter();
    }
    events.push('netBounce');
  }

  // Net top: ball landing on top of the net from above.
  if (nearNetX && ball.y + BALL_RADIUS >= NET_TOP && ball.y - BALL_RADIUS < NET_TOP && ball.vy > 0) {
    ball.y = NET_TOP - BALL_RADIUS;
    ball.vy = (-Math.abs(ball.vy) * BALL_RESTITUTION - 40) * jitter();
    events.push('netBounce');
  }

  return seed;
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
