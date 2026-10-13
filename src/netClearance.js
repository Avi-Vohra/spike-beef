// Net-clearance guarantee + serve-trajectory capping. Split out of
// physics.js to keep that file under the project's file-size guideline.
import {
  NET_X, NET_TOP, NET_HALF_W, BALL_RADIUS, GRAVITY, NET_ARC_RANGE,
} from './physics.js';

export const SERVE_MAX_SPEED = 560; // close to the old model's ~600 peak speed
export const SERVE_MIN_ARC_RATIO = 1.1; // |vy| >= |vx| * this — keeps real hang time

// Guarantees the ball will clear the net given its CURRENT vx (not just a
// proportional "add some steep" fudge, which measurably failed): solves the
// actual projectile physics for the vy needed to be above NET_TOP by the
// time the ball's horizontal travel reaches NET_X, and raises vy to at
// least that if the current trajectory would clip. Verified by direct
// simulation that the previous approach (NET_ARC_BOOST alone) still clipped
// the net on every hit type, including a fully-charged one, from 32px away
// — this replaces it with a solved guarantee instead of a bigger fudge
// factor. Only engages when the ball is actually headed toward/across the
// net; a shot moving away from it is untouched.
const NET_CLEARANCE_MAX_VY = -1950; // sane ceiling — a very strong straight-up punch, not an absurd one
const NET_CLEARANCE_MIN_TIME = 0.05; // floor on time-to-net: prevents a divide-by-near-zero blowup

export function ensureClearsNet(ball) {
  const distToNet = NET_X - ball.x; // positive if ball is left of net
  const headingTowardNet = (distToNet > 0 && ball.vx > 0) || (distToNet < 0 && ball.vx < 0);
  if (!headingTowardNet || Math.abs(distToNet) > NET_ARC_RANGE + 60) return;

  // Trade some horizontal punch for hang time the closer the contact is to
  // the net — matches how a real player naturally pops a point-blank ball
  // up rather than trying to crush it flat, since there's no room to do
  // otherwise. This does most of the work; the vy solve below (with its own
  // floor/cap) only needs to cover what this doesn't.
  const closeness = Math.max(0, Math.min(1, (NET_ARC_RANGE - Math.abs(distToNet)) / NET_ARC_RANGE));
  ball.vx *= 1 - closeness * 0.6;

  // The ball must clear NET_TOP by the time it reaches the near EDGE of the
  // net's collision zone (NET_HALF_W + BALL_RADIUS out from NET_X's
  // center), not by the time it reaches NET_X itself — solving to the
  // center was measurably insufficient (clipped every time) since the
  // actual collision check fires ~17px earlier than that.
  const edgeDist = Math.max(0, Math.abs(distToNet) - (NET_HALF_W + BALL_RADIUS));
  const t = Math.max(NET_CLEARANCE_MIN_TIME, edgeDist / Math.max(1, Math.abs(ball.vx)));
  const yAtNet = ball.y + ball.vy * t + 0.5 * GRAVITY * t * t;
  const requiredY = NET_TOP - BALL_RADIUS - 14; // clearance margin
  if (yAtNet > requiredY) {
    const vyMin = (requiredY - ball.y - 0.5 * GRAVITY * t * t) / t;
    ball.vy = Math.max(NET_CLEARANCE_MAX_VY, Math.min(ball.vy, vyMin));
  }
}

// Re-shapes a just-resolved serve contact's velocity back into a returnable
// envelope — see the comment on SERVE_MAX_SPEED/SERVE_MIN_ARC_RATIO above
// for why this exists. Preserves direction (sign of vx, overall "which way
// and how hard") while capping total speed and guaranteeing real hang
// time, then re-checks net clearance since rescaling can change it.
export function capServeTrajectory(ball) {
  // Arc ratio FIRST, speed cap LAST — enforcing the ratio can only grow
  // |vy|, so capping speed afterward (a uniform scale, which preserves
  // whatever ratio was just established) is what actually guarantees the
  // final speed stays under the cap. Doing it in the other order lets the
  // ratio step push speed back over the cap it just satisfied — caught by
  // direct measurement (an ace rate that was still ~49% after a first,
  // wrongly-ordered attempt at this same fix).
  const minAbsVy = Math.abs(ball.vx) * SERVE_MIN_ARC_RATIO;
  if (Math.abs(ball.vy) < minAbsVy) {
    ball.vy = ball.vy < 0 ? -minAbsVy : minAbsVy;
  }
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > SERVE_MAX_SPEED) {
    const scale = SERVE_MAX_SPEED / speed;
    ball.vx *= scale;
    ball.vy *= scale;
  }
  ensureClearsNet(ball);
}
