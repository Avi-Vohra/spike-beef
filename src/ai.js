// Pure CPU opponent: given sim state + side + difficulty, returns an input
// bitmask. No randomness, no DOM — deterministic function of state.
import { LEFT, RIGHT, JUMP, HIT, PLAYER_RADIUS, BALL_RADIUS } from './physics.js';
import { predictLandingPoint } from './ball.js';
import { stepRandom } from './rng.js';

// Pure, stateless jitter: a hash of (seed, tick-bucket, side) in [0,1). Same
// state always gives the same value, but different seeds/buckets/sides vary
// it, so CPU vs CPU matches aren't bit-for-bit identical across seeds.
//
// Bucketed by JITTER_HOLD_TICKS rather than by the raw tick: a fresh random
// value every single tick made the AI's target position chatter at up to
// 60Hz, which — combined with the deadzone comparison below — made its
// LEFT/RIGHT decision flip direction almost every tick near the boundary.
// Measured directly: this alone caused ~0.5-0.7 ACCIDENTAL dive triggers
// per point (dive.js double-tap detector firing on pure AI noise, not any
// intended double-tap) and made the AI's own movement look twitchy. Holding
// the jitter steady for a short stretch — matching how a real player's
// judgment doesn't re-evaluate from scratch every 16ms either — fixes both.
// Held long enough (~0.6s) to sit clearly outside a human double-tap's
// natural timing window (dive.js's DOUBLE_TAP_MIN/MAX_GAP, ~0.07-0.3s) —
// a shorter hold (originally 10 ticks/0.167s) aliased almost exactly into
// that window, so every jitter-bucket transition was itself an accidental
// "double tap" at the boundary, which is why that first attempt barely
// reduced the accidental dive rate.
const JITTER_HOLD_TICKS = 36;
function jitterFor(state, side) {
  const bucket = Math.floor(state.tick / JITTER_HOLD_TICKS);
  const mixed = (state.rngSeed ^ Math.imul(bucket, 2654435761) ^ Math.imul(side + 1, 40503)) >>> 0;
  return stepRandom(mixed)[0];
}

export const DIFFICULTIES = ['easy', 'medium', 'hard'];

// `releaseLead`: how far out (in px, beyond actual contact distance) the AI
// lets go of HIT before the ball arrives. A bigger lead means it releases
// earlier, cutting its own charge time short — difficulty here is expressed
// as timing precision, not an arbitrary "power" number, so a weak CPU looks
// like it's mistiming its swing rather than just hitting a soft-coded cap.
const PROFILES = {
  easy: { deadzone: 60, predictiveness: 0.35, jumpThreshold: 70, wantsSpike: false, releaseLead: 55, serveCharge: 0.25 },
  medium: { deadzone: 25, predictiveness: 0.7, jumpThreshold: 45, wantsSpike: true, releaseLead: 26, serveCharge: 0.5 },
  hard: { deadzone: 8, predictiveness: 0.95, jumpThreshold: 30, wantsSpike: true, releaseLead: 12, serveCharge: 0.85 },
};

const CONTACT_RADIUS = PLAYER_RADIUS + BALL_RADIUS;
const PRECHARGE_RADIUS = 240; // start holding HIT this far out so there's real charge time

export function aiInput(state, side, difficulty = 'medium') {
  const profile = PROFILES[difficulty] || PROFILES.medium;
  const p = state.players[side];
  const ball = state.ball;

  // Serve: hold HIT to charge up to this difficulty's target, then release
  // — matches the charged-serve model instead of waiting for auto-serve.
  if (state.match.phase === 'serve' && state.match.server === side) {
    return p.charge < profile.serveCharge ? HIT : 0;
  }

  let mask = 0;
  const jitter = jitterFor(state, side); // 0..1, deterministic per state
  const effectiveDeadzone = profile.deadzone * (0.6 + jitter * 0.8);
  const predicted = predictLandingPoint(ball).x;
  const naive = ball.x;
  const blended = naive + (predicted - naive) * profile.predictiveness;
  const targetX = blended + (jitter - 0.5) * profile.deadzone * 2;
  const dx = targetX - p.x;
  if (dx > effectiveDeadzone) mask |= RIGHT;
  else if (dx < -effectiveDeadzone) mask |= LEFT;

  const dist = Math.hypot(ball.x - p.x, ball.y - p.y);
  const releaseLead = profile.releaseLead * (0.7 + jitter * 0.6);
  // If charge has maxed out and the ball still isn't close enough, the chase
  // has failed — give up (release without contact) instead of holding HIT
  // forever waiting for a contact that may never come.
  const stuck = p.charge >= 1 && dist > CONTACT_RADIUS + releaseLead;
  if (!stuck && dist < PRECHARGE_RADIUS && dist > CONTACT_RADIUS + releaseLead) {
    mask |= HIT; // charging — released below once contact is imminent
  }

  if (dist < PRECHARGE_RADIUS) {
    const ballIsHigh = (p.y - ball.y) > profile.jumpThreshold;
    if (p.onGround && ballIsHigh && profile.wantsSpike) mask |= JUMP;
  }

  return mask;
}

export function createAi(side, difficulty = 'medium') {
  return { side, difficulty, getInput: (state) => aiInput(state, side, difficulty) };
}
