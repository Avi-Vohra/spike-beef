// Pure CPU opponent: given sim state + side + difficulty, returns an input
// bitmask. No randomness, no DOM — deterministic function of state.
import { LEFT, RIGHT, JUMP, HIT, PLAYER_RADIUS, BALL_RADIUS, GRAVITY, GROUND_Y } from './physics.js';
import { stepRandom } from './rng.js';

// Project where the ball will be at ground height, given current position and
// velocity under gravity. Solves 0.5*g*t^2 + vy*t + (y - GROUND_Y) = 0 for the
// next positive root, then returns the x position at that time.
function predictLandingX(ball) {
  const a = 0.5 * GRAVITY;
  const b = ball.vy;
  const c = ball.y - GROUND_Y;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return ball.x;
  const t = (-b + Math.sqrt(disc)) / (2 * a);
  if (!(t > 0) || !Number.isFinite(t)) return ball.x;
  return ball.x + ball.vx * t;
}

// Pure, stateless jitter: a hash of (seed, tick, side) in [0,1). Same state
// always gives the same value, but different seeds/ticks/sides vary it, so
// CPU vs CPU matches aren't bit-for-bit identical across seeds.
function jitterFor(state, side) {
  const mixed = (state.rngSeed ^ Math.imul(state.tick, 2654435761) ^ Math.imul(side + 1, 40503)) >>> 0;
  return stepRandom(mixed)[0];
}

export const DIFFICULTIES = ['easy', 'medium', 'hard'];

const PROFILES = {
  easy: { deadzone: 60, predictiveness: 0.35, jumpThreshold: 70, wantsSpike: false },
  medium: { deadzone: 25, predictiveness: 0.7, jumpThreshold: 45, wantsSpike: true },
  hard: { deadzone: 8, predictiveness: 0.95, jumpThreshold: 30, wantsSpike: true },
};

const HIT_RANGE = PLAYER_RADIUS + BALL_RADIUS + 14;

export function aiInput(state, side, difficulty = 'medium') {
  const profile = PROFILES[difficulty] || PROFILES.medium;
  const p = state.players[side];
  const ball = state.ball;

  // Serve immediately on our own turn instead of waiting for auto-serve.
  if (state.match.phase === 'serve' && state.match.server === side) {
    return HIT;
  }

  let mask = 0;
  const jitter = jitterFor(state, side); // 0..1, deterministic per state
  const effectiveDeadzone = profile.deadzone * (0.6 + jitter * 0.8);
  const predicted = predictLandingX(ball);
  const naive = ball.x;
  const blended = naive + (predicted - naive) * profile.predictiveness;
  const targetX = blended + (jitter - 0.5) * profile.deadzone * 2;
  const dx = targetX - p.x;
  if (dx > effectiveDeadzone) mask |= RIGHT;
  else if (dx < -effectiveDeadzone) mask |= LEFT;

  const dist = Math.hypot(ball.x - p.x, ball.y - p.y);
  if (dist < HIT_RANGE) {
    mask |= HIT;
    const ballIsHigh = (p.y - ball.y) > profile.jumpThreshold;
    if (p.onGround && ballIsHigh && profile.wantsSpike) mask |= JUMP;
  } else if (p.onGround && (p.y - ball.y) < 160 && Math.abs(dx) < profile.deadzone * 2 && dist < HIT_RANGE + 40) {
    mask |= JUMP;
  }

  return mask;
}

export function createAi(side, difficulty = 'medium') {
  return { side, difficulty, getInput: (state) => aiInput(state, side, difficulty) };
}
