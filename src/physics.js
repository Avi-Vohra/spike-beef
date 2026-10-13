// Pure physics: ball, players, collisions. No DOM, no window.
import { ensureClearsNet } from './netClearance.js';
import { DEFAULT_TRAITS } from './roster.js';

export const WIDTH = 960;
export const HEIGHT = 540;
export const GROUND_Y = 500;
export const NET_X = WIDTH / 2;
export const NET_HEIGHT = 140;
export const NET_TOP = GROUND_Y - NET_HEIGHT;
export const NET_HALF_W = 5;
export const PLAYER_RADIUS = 26;
export const BALL_RADIUS = 12;
export const GRAVITY = 1150; // lower than a naive first pass: longer hang time = more reaction time
export const MOVE_SPEED = 430;
// A tiny ramp instead of an instant 0->MOVE_SPEED snap — purely a feel fix,
// not a skill/positioning cost: full speed is still reached in ~4 ticks
// (~0.067s), imperceptible as "sluggish" but enough to kill the teleport-y
// robotic start/stop the original redesign complaint was partly about.
export const MOVE_ACCEL = 6500; // px/s^2 while a direction is held
export const MOVE_DECEL = 7800; // px/s^2 while no direction is held (snappier stop than start)
export const JUMP_VY = -560;
export const BALL_RESTITUTION = 0.72;
export const DT = 1 / 60;
export const SUBSTEPS = 4;

export const LEFT = 1;
export const RIGHT = 2;
export const JUMP = 4;
export const HIT = 8;

// Charge-and-release hit model (replaces the old instant-tap hit): hold HIT to
// charge a swing, steer with LEFT/RIGHT while charging, release to swing.
export const CHARGE_SECONDS = 0.6;
export const TIP_CHARGE_THRESHOLD = 0.15; // below this, release = a quick weak tip
// Minimum charge for a jump-release to count as a spike. Was 0.12 — BELOW
// TIP_CHARGE_THRESHOLD, which meant a barely-charged tap (the same charge
// that produces a weak tip on the ground) already counted as a full-power
// spike in the air: measured 3433 spikes vs 4408 regular hits across 40
// CPU-vs-CPU matches, meaning the supposedly-hardest, highest-commitment
// shot was firing almost as often as an ordinary hit. Raised so a spike
// needs a real, deliberate charge — same floor philosophy as the hit tier,
// not a near-freebie off any jump + tap.
export const SPIKE_MIN_CHARGE = 0.3;
export const NEAR_PEAK_VY = 300;
export const HIT_COOLDOWN = 0.18;
// How long after releasing HIT the swing stays "live" and able to connect.
// Without this, a release only counts if ball contact happens in the exact
// same 1/60s tick as the release edge — nearly impossible for a human (or
// an AI releasing a few ticks early to lead the ball) to hit reliably, so
// almost every real-world release was silently wasting its whole charge.
export const RELEASE_GRACE_SECONDS = 0.15;

// Toss-serve: pressing HIT during the 'serve' phase tosses the ball off the
// server's hand into the air (instead of an instant button-press serve),
// handing off to the normal charge-and-release/contact pipeline — a
// deliberate two-beat "toss, then time your hit" gesture, distinct from
// every other hit in the game (which all start from an already-live ball).
export const TOSS_VY = -620;
// A serve contact reuses the normal charge-and-release hit pipeline (for
// the timing skill), but that pipeline's hit/spike trajectories are flat
// and fast — tuned for RALLY exchanges where the receiver already has
// time to be in position. Reused unmodified for a serve, this was
// measurably unreturnable: a 200-match CPU-vs-CPU harness produced a
// literal 200/200 result, every single point a same-serve ace, because the
// served ball was both faster (up to ~620px/s horizontal, vs the old
// fixed-arc serve's ~340 max) AND flatter (less hang time) than the
// receiver could react to. See netClearance.js's `capServeTrajectory` for
// the fix (re-shapes the resulting velocity back into a returnable
// envelope), which needs NET_X/NET_TOP/etc below, so it lives in its own
// module rather than creating an import cycle with this file.

export const TIP_POWER = 300;
export const MIN_CHARGE_POWER = 360;
export const MAX_CHARGE_POWER = 620;
export const SPIKE_MIN_POWER = 520;
export const SPIKE_MAX_POWER = 780;
export const DEFAULT_POWER = 320; // passive/mistimed contact — no charge involved
export const DEFAULT_STEEP = 1.6;
export const NET_ARC_RANGE = 110; // px from the net where arc-assist starts tapering in
export const BLOCK_POWER = 480; // jumping into the ball at the net, uncharged
export const BLOCK_STEEP = 0.45; // fast and flat — punched straight down

// Dive: double-tap LEFT or RIGHT while grounded for a fast defensive lunge,
// reaching balls otherwise out of range. No new input bit — reuses the
// existing movement keys, so no network/touch-UI changes needed. See dive.js.
export const DIVE_SPEED = 820;
export const DIVE_DURATION = 0.22;
export const DIVE_COOLDOWN = 0.6;
// A real double-tap needs a genuine pause between release and re-press, not
// just "within a window" — see dive.js for why the naive max-only check
// fired constantly from ordinary bang-bang movement correction.
export const DOUBLE_TAP_MIN_GAP = 0.08;
export const DOUBLE_TAP_MAX_GAP = 0.22;
// Diving only makes sense as a reach for a ball you could plausibly get to
// — gating on proximity also rules out nearly all accidental triggers from
// ordinary repositioning noise, which happens mostly while the ball is
// still far away.
export const DIVE_MAX_BALL_DIST = 260;

function lerp(a, b, t) { return a + (b - a) * t; }

// `slot` is this player's position in the full `state.players` array — used
// to index the per-tick inputs array (`inputs[p.slot]`), kept separate from
// `side` (which team/court-half they're on) because 2v2 puts two players on
// the same side with different slots. Defaults to `slot = side`, exactly
// matching 1v1's existing 2-player indexing — zero behavior change there.
// `xOffset` spreads 2v2 teammates apart so they don't start stacked on the
// exact same spot (the engine has no player-vs-player collision, so nothing
// breaks if they overlap, but it looks wrong).
// `traits` (see roster.js) is a character choice's stat multipliers —
// defaults to all-1 (no change from base), so a player with no character
// chosen (CPU, or any existing caller that doesn't pass this) behaves
// exactly as before this system existed.
export function createPlayer(side, slot = side, xOffset = 0, traits = DEFAULT_TRAITS) {
  const x = (side === 0 ? WIDTH * 0.25 : WIDTH * 0.75) + xOffset;
  return {
    side, slot, xOffset, traits, x, y: GROUND_Y, vx: 0, vy: 0, onGround: true, hitCooldown: 0,
    charging: false, charge: 0, justReleased: false, releaseCharge: 0,
    releaseGraceTimer: 0,
    diving: false, diveTimer: 0, diveCooldownTimer: 0, diveDir: 0,
    prevLeftHeld: false, prevRightHeld: false, leftReleaseAge: null, rightReleaseAge: null,
    lastEvent: null, lastEventTimer: 0, runPhase: 0,
  };
}

function playerBounds(side) {
  if (side === 0) return [PLAYER_RADIUS, NET_X - NET_HALF_W - PLAYER_RADIUS];
  return [NET_X + NET_HALF_W + PLAYER_RADIUS, WIDTH - PLAYER_RADIUS];
}

// Charge/release state machine — runs once per full tick (not per sub-step):
// holding HIT ramps charge (movement stays free throughout — see
// resolvePlayerHit's `placement` bias for how the movement keys still matter
// at the moment of contact); releasing HIT (detected via the `charging` flag
// itself going true->false) opens a short
// RELEASE_GRACE_SECONDS window (releaseGraceTimer) during which ball contact
// still resolves as the charged swing — see resolvePlayerHit below. Without
// this window the swing only connects if contact happens in the exact same
// tick as the release edge, which is unrealistic for both human timing and
// an AI that releases a few ticks early to lead a moving ball.
export function updateCharge(p, input, dt) {
  p.justReleased = false;
  const hitHeld = !!(input & HIT);
  if (hitHeld) {
    p.charging = true;
    p.charge = Math.min(1, p.charge + dt / CHARGE_SECONDS);
  } else if (p.charging) {
    p.justReleased = true;
    p.releaseCharge = p.charge;
    p.releaseGraceTimer = RELEASE_GRACE_SECONDS * p.traits.graceMult;
    p.charging = false;
    p.charge = 0;
  }
  if (p.releaseGraceTimer > 0) p.releaseGraceTimer -= dt;
  if (p.lastEventTimer > 0) p.lastEventTimer -= dt;
  else p.lastEvent = null;
}

export function stepPlayer(p, input, dt) {
  const [lo, hi] = playerBounds(p.side);
  // Charging no longer costs movement speed at all — an earlier version
  // slowed/froze movement while charging (matching the arcade precedent this
  // is modeled on), but in practice it produced un-correctable whiffs and
  // AI chases that could never quite close the last few pixels. Charge is
  // purely a timing/commitment skill now: hold longer for more power,
  // released at the right moment, with no positioning cost.
  if (p.diving) {
    p.vx = p.diveDir * DIVE_SPEED;
  } else {
    const dirX = (input & RIGHT ? 1 : 0) - (input & LEFT ? 1 : 0);
    const target = dirX * MOVE_SPEED * p.traits.speedMult;
    const accel = (dirX !== 0 ? MOVE_ACCEL : MOVE_DECEL) * p.traits.speedMult;
    const maxStep = accel * dt;
    const delta = target - p.vx;
    p.vx += Math.max(-maxStep, Math.min(maxStep, delta));
  }
  p.x += p.vx * dt;
  if (p.x < lo) p.x = lo;
  if (p.x > hi) p.x = hi;
  p.runPhase += Math.abs(p.vx) * dt * 0.02;

  if (p.onGround && !p.diving && (input & JUMP)) {
    p.vy = JUMP_VY * p.traits.jumpMult;
    p.onGround = false;
  }

  p.vy += GRAVITY * dt;
  p.y += p.vy * dt;
  if (p.y >= GROUND_Y) {
    const wasAirborne = !p.onGround;
    p.y = GROUND_Y;
    p.vy = 0;
    p.onGround = true;
    if (wasAirborne) { p.lastEvent = 'land'; p.lastEventTimer = 0.2; }
  }

  if (p.hitCooldown > 0) p.hitCooldown -= dt;
}

// Swept circle-circle collision between ball and player over this substep.
// Returns true and mutates ball velocity if a collision happened.
export function resolvePlayerHit(ball, prevX, prevY, p, input, events) {
  // A cooldown gates ALL contact, not just HIT presses: without this, a single
  // physical touch that spans multiple sub-steps (the ball lingering inside
  // the collision radius for a few frames) would register as several separate
  // touches and fault whoever is just standing near the ball.
  if (p.hitCooldown > 0) return false;

  const dx = ball.x - p.x;
  const dy = ball.y - p.y;
  const dist = Math.hypot(dx, dy);
  // hitRadiusMult (Rookie's forgiving-reach trait) only widens the ball's
  // own radius for this check, not PLAYER_RADIUS itself — keeps the
  // player's drawn silhouette and movement bounds unaffected, only how
  // generous contact detection is.
  const minDist = BALL_RADIUS * p.traits.hitRadiusMult + PLAYER_RADIUS;
  if (dist >= minDist) return false;

  const nx = dist === 0 ? 0 : dx / dist;
  const ny = dist === 0 ? -1 : dy / dist;
  // Clamp against the court walls/ceiling: a player standing right up against
  // a side boundary can otherwise reposition the ball to p.x +/- minDist,
  // which lands outside the court entirely.
  ball.x = Math.min(WIDTH - BALL_RADIUS, Math.max(BALL_RADIUS, p.x + nx * minDist));
  ball.y = Math.max(BALL_RADIUS, p.y + ny * minDist);

  const jumping = !p.onGround;
  // peakWindowMult widens how forgiving "near the top of your jump" is for
  // spike/block timing (Sky's trait) — a raw jump-HEIGHT change alone was
  // measured to make CPU-vs-CPU win rate collapse to 0/30 regardless of
  // magnitude: ai.js's jump-decision timing (jumpThreshold, releaseLead)
  // isn't trait-aware, so a taller jump arc just desyncs the AI's existing
  // spike timing rather than helping it. A wider timing window is both a
  // cleaner "jumper" skill identity (easier aerial timing, not just more
  // height) and doesn't fight the AI's fixed heuristics the same way.
  const nearPeak = jumping && Math.abs(p.vy) < NEAR_PEAK_VY * p.traits.peakWindowMult;
  const dirX = p.side === 0 ? 1 : -1;
  let power, steep, eventType;

  const nearNet = Math.abs(p.x - NET_X) < NET_ARC_RANGE;

  if (jumping && nearNet && p.charging) {
    // ACTIVE BLOCK: a deliberate gesture now (was a free automatic block
    // before — any jump near the net while not charging triggered it, no
    // skill required). Now you have to hold HIT as you jump at the net,
    // like a real block stance, and the TIMING of that jump — being near
    // its peak (same window the spike uses) at the moment of contact — is
    // what separates a real block from a whiff. No release needed (unlike
    // a charged hit): holding through the peak is itself the action.
    if (nearPeak) {
      eventType = 'block';
      power = BLOCK_POWER * p.traits.powerMult;
      ball.vx = dirX * power;
      ball.vy = -power * BLOCK_STEEP * 0.6;
    } else {
      // Mistimed block attempt — jumped at the net and held HIT, but not
      // at the right moment in the jump arc. Costs the charge, same weak
      // unaimed deflect as any other mistimed contact.
      eventType = 'fumble';
      const inputDirX = (input & RIGHT ? 1 : 0) - (input & LEFT ? 1 : 0);
      const aimX = inputDirX !== 0 ? inputDirX : dirX;
      power = DEFAULT_POWER * p.traits.powerMult;
      ball.vx = aimX * power;
      ball.vy = -power * DEFAULT_STEEP * 0.6;
      ensureClearsNet(ball);
    }
    p.charging = false;
    p.charge = 0;
  } else if (p.releaseGraceTimer > 0) {
    const charge = p.releaseCharge;
    const aimX = dirX;
    // Shot placement: whichever movement key is held AT CONTACT (the same
    // bits already used for free movement all game — no new input, no
    // movement cost during the charge itself) leans the shot. Toward-net =
    // flatter/harder (closer, riskier kill); away-from-net = more arc
    // (safer, lands deeper). Real tactical choice using the 1D court axis
    // this sim actually has, rather than the earlier cut lateral-aim idea
    // which didn't map onto a side-view court at all.
    const towardBit = dirX > 0 ? RIGHT : LEFT;
    const awayBit = dirX > 0 ? LEFT : RIGHT;
    const placement = (input & towardBit) ? 1 : (input & awayBit) ? -1 : 0;
    if (charge >= SPIKE_MIN_CHARGE && jumping && nearPeak) {
      power = lerp(SPIKE_MIN_POWER, SPIKE_MAX_POWER, charge) * p.traits.powerMult;
      steep = 0.5;
      eventType = 'spike';
    } else if (charge < TIP_CHARGE_THRESHOLD) {
      power = TIP_POWER * p.traits.powerMult;
      steep = 2.2 * (1 - placement * 0.18);
      eventType = 'tip';
    } else {
      power = lerp(MIN_CHARGE_POWER, MAX_CHARGE_POWER, charge) * (1 + placement * 0.08) * p.traits.powerMult;
      steep = lerp(2.0, 1.2, charge) * (1 - placement * 0.18);
      eventType = 'hit';
    }
    ball.vx = aimX * power;
    ball.vy = -power * steep * 0.6;
    p.justReleased = false;
    p.releaseGraceTimer = 0;
    ensureClearsNet(ball);
  } else if (p.charging) {
    // Mistimed — the ball arrived mid-charge. Costs you the charge, and
    // produces a gentle, unaimed deflect rather than the swing you wanted.
    p.charging = false;
    p.charge = 0;
    eventType = 'fumble';
    const inputDirX = (input & RIGHT ? 1 : 0) - (input & LEFT ? 1 : 0);
    const aimX = inputDirX !== 0 ? inputDirX : dirX;
    power = DEFAULT_POWER * p.traits.powerMult;
    ball.vx = aimX * power;
    ball.vy = -power * DEFAULT_STEEP * 0.6;
    ensureClearsNet(ball);
  } else if (p.diving) {
    // Save: reached the ball via a dive — gets it back over, but only a
    // weak defensive poke, not an attack (matches the real-volleyball feel
    // of a dive being about staying in the rally, not scoring off it).
    eventType = 'save';
    const inputDirX = (input & RIGHT ? 1 : 0) - (input & LEFT ? 1 : 0);
    const aimX = inputDirX !== 0 ? inputDirX : dirX;
    power = DEFAULT_POWER * p.traits.powerMult;
    ball.vx = aimX * power;
    ball.vy = -power * DEFAULT_STEEP * 0.6;
    ensureClearsNet(ball);
  } else {
    // Passive contact — never charging, not blocking, not diving. A gentle,
    // unaimed touch.
    eventType = 'touch';
    const inputDirX = (input & RIGHT ? 1 : 0) - (input & LEFT ? 1 : 0);
    const aimX = inputDirX !== 0 ? inputDirX : dirX;
    power = DEFAULT_POWER * p.traits.powerMult;
    ball.vx = aimX * power;
    ball.vy = -power * DEFAULT_STEEP * 0.6;
    ensureClearsNet(ball);
  }

  events.push({ type: eventType, side: p.side });
  p.lastEvent = eventType;
  p.lastEventTimer = 0.35;
  p.hitCooldown = HIT_COOLDOWN;
  return true;
}
