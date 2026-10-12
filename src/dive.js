// Dive detection: double-tap LEFT or RIGHT while grounded triggers a fast
// defensive lunge (physics.js's stepPlayer reads p.diving/p.diveDir to
// override normal movement). Kept separate from physics.js's charge logic
// since it's an independent state machine over the same input bits.
import { LEFT, RIGHT, DIVE_DURATION, DIVE_COOLDOWN, DOUBLE_TAP_WINDOW } from './physics.js';

// Returns true if a dive started this call (caller pushes a 'dive' event).
export function updateDive(p, input, dt) {
  if (p.diveCooldownTimer > 0) p.diveCooldownTimer -= dt;
  if (p.leftTapWindow > 0) p.leftTapWindow -= dt;
  if (p.rightTapWindow > 0) p.rightTapWindow -= dt;

  const leftHeld = !!(input & LEFT);
  const rightHeld = !!(input & RIGHT);
  const leftPressed = leftHeld && !p.prevLeftHeld;
  const rightPressed = rightHeld && !p.prevRightHeld;

  const canDive = p.onGround && !p.diving && !p.charging && p.diveCooldownTimer <= 0;
  let started = false;

  if (leftPressed) {
    if (canDive && p.leftTapWindow > 0) { startDive(p, -1); started = true; }
    else p.leftTapWindow = DOUBLE_TAP_WINDOW;
  }
  if (rightPressed) {
    if (canDive && p.rightTapWindow > 0) { startDive(p, 1); started = true; }
    else p.rightTapWindow = DOUBLE_TAP_WINDOW;
  }

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
  p.leftTapWindow = 0;
  p.rightTapWindow = 0;
}
