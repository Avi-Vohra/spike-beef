// Dive detection: double-tap LEFT or RIGHT while grounded triggers a fast
// defensive lunge (physics.js's stepPlayer reads p.diving/p.diveDir to
// override normal movement). Kept separate from physics.js's charge logic
// since it's an independent state machine over the same input bits.
//
// A real double-tap has a human-reaction-time GAP between the release and
// the second press. Bang-bang direction-correction (AI tracking a moving
// target, or a human's own small positioning adjustments) can satisfy a
// naive "pressed again within window" check on almost every oscillation —
// measured directly: with only a max-gap check, CPU-vs-CPU play produced
// over 45 accidental dives per match from completely ordinary movement,
// hijacking normal tracking. Requiring a minimum gap too (so the release
// has to be a genuine pause, not a same-tick or next-tick flicker) rejects
// that while still accepting any real human double-tap.
import {
  LEFT, RIGHT, DIVE_DURATION, DIVE_COOLDOWN, DOUBLE_TAP_MIN_GAP, DOUBLE_TAP_MAX_GAP,
  DIVE_MAX_BALL_DIST,
} from './physics.js';

// Returns true if a dive started this call (caller pushes a 'dive' event).
// `ball`, if provided, gates diving on the ball actually being close —
// diving is a reach for a ball you can plausibly get to, not a general-
// purpose movement burst, which also incidentally rules out almost all of
// the AI's accidental triggers (its directional noise happens mostly while
// repositioning for a ball that's still far away, not during an actual
// defensive scramble).
export function updateDive(p, input, dt, ball) {
  if (p.diveCooldownTimer > 0) p.diveCooldownTimer -= dt;
  if (p.leftReleaseAge !== null) {
    p.leftReleaseAge += dt;
    if (p.leftReleaseAge > DOUBLE_TAP_MAX_GAP) p.leftReleaseAge = null;
  }
  if (p.rightReleaseAge !== null) {
    p.rightReleaseAge += dt;
    if (p.rightReleaseAge > DOUBLE_TAP_MAX_GAP) p.rightReleaseAge = null;
  }

  const leftHeld = !!(input & LEFT);
  const rightHeld = !!(input & RIGHT);
  const leftPressed = leftHeld && !p.prevLeftHeld;
  const rightPressed = rightHeld && !p.prevRightHeld;
  const leftReleased = !leftHeld && p.prevLeftHeld;
  const rightReleased = !rightHeld && p.prevRightHeld;

  const ballClose = !ball || Math.hypot(ball.x - p.x, ball.y - p.y) < DIVE_MAX_BALL_DIST;
  const canDive = p.onGround && !p.diving && !p.charging && p.diveCooldownTimer <= 0 && ballClose;
  let started = false;

  if (leftPressed) {
    const age = p.leftReleaseAge;
    if (canDive && age !== null && age >= DOUBLE_TAP_MIN_GAP) { startDive(p, -1); started = true; }
    p.leftReleaseAge = null;
  }
  if (rightPressed) {
    const age = p.rightReleaseAge;
    if (canDive && age !== null && age >= DOUBLE_TAP_MIN_GAP) { startDive(p, 1); started = true; }
    p.rightReleaseAge = null;
  }
  if (leftReleased) p.leftReleaseAge = 0;
  if (rightReleased) p.rightReleaseAge = 0;

  if (p.diving) {
    p.diveTimer -= dt;
    if (p.diveTimer <= 0) p.diving = false;
  }

  p.prevLeftHeld = leftHeld;
  p.prevRightHeld = rightHeld;
  return started;
}

function startDive(p, dir) {
  p.diving = true;
  p.diveDir = dir;
  p.diveTimer = DIVE_DURATION;
  p.diveCooldownTimer = DIVE_COOLDOWN;
  p.leftReleaseAge = null;
  p.rightReleaseAge = null;
}
