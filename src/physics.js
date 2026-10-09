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
export const GRAVITY = 1150; // lower than a naive first pass: longer hang time = more reaction time
export const MOVE_SPEED = 430;
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
export const SPIKE_MIN_CHARGE = 0.12; // minimum charge for a jump-release to count as a spike
export const NEAR_PEAK_VY = 300;
export const HIT_COOLDOWN = 0.18;

export const TIP_POWER = 300;
export const MIN_CHARGE_POWER = 360;
export const MAX_CHARGE_POWER = 620;
export const SPIKE_MIN_POWER = 520;
export const SPIKE_MAX_POWER = 780;
export const DEFAULT_POWER = 320; // passive/mistimed contact — no charge involved
export const DEFAULT_STEEP = 1.6;
export const NET_ARC_RANGE = 110; // px from the net where arc-assist starts tapering in
export const NET_ARC_BOOST = 1.1; // max extra steep when hitting right on the net

function lerp(a, b, t) { return a + (b - a) * t; }

export function createPlayer(side) {
  const x = side === 0 ? WIDTH * 0.25 : WIDTH * 0.75;
  return {
    side, x, y: GROUND_Y, vx: 0, vy: 0, onGround: true, hitCooldown: 0,
    charging: false, charge: 0, aimDir: 0, justReleased: false, releaseCharge: 0,
    lastEvent: null, lastEventTimer: 0, runPhase: 0,
  };
}

export function createBall(x, y) {
  return { x, y, vx: 0, vy: 0 };
}

function playerBounds(side) {
  if (side === 0) return [PLAYER_RADIUS, NET_X - NET_HALF_W - PLAYER_RADIUS];
  return [NET_X + NET_HALF_W + PLAYER_RADIUS, WIDTH - PLAYER_RADIUS];
}

// Charge/release state machine — runs once per full tick (not per sub-step):
// holding HIT ramps charge and steers aimDir from LEFT/RIGHT; releasing HIT
// (detected via the `charging` flag itself going true->false) sets
// justReleased for exactly this tick, consumed by resolvePlayerHit below.
export function updateCharge(p, input, dt) {
  p.justReleased = false;
  const hitHeld = !!(input & HIT);
  if (hitHeld) {
    p.charging = true;
    p.charge = Math.min(1, p.charge + dt / CHARGE_SECONDS);
  } else if (p.charging) {
    p.justReleased = true;
    p.releaseCharge = p.charge;
    p.charging = false;
    p.charge = 0;
  }
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
  let vx = 0;
  if (input & LEFT) vx -= MOVE_SPEED;
  if (input & RIGHT) vx += MOVE_SPEED;
  p.vx = vx;
  p.x += p.vx * dt;
  if (p.x < lo) p.x = lo;
  if (p.x > hi) p.x = hi;
  p.runPhase += Math.abs(p.vx) * dt * 0.02;

  if (p.onGround && (input & JUMP)) {
    p.vy = JUMP_VY;
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
  const minDist = BALL_RADIUS + PLAYER_RADIUS;
  if (dist >= minDist) return false;

  const nx = dist === 0 ? 0 : dx / dist;
  const ny = dist === 0 ? -1 : dy / dist;
  // Clamp against the court walls/ceiling: a player standing right up against
  // a side boundary can otherwise reposition the ball to p.x +/- minDist,
  // which lands outside the court entirely.
  ball.x = Math.min(WIDTH - BALL_RADIUS, Math.max(BALL_RADIUS, p.x + nx * minDist));
  ball.y = Math.max(BALL_RADIUS, p.y + ny * minDist);

  const jumping = !p.onGround;
  const nearPeak = jumping && Math.abs(p.vy) < NEAR_PEAK_VY;
  const dirX = p.side === 0 ? 1 : -1;
  let power, steep, eventType;

  if (p.justReleased) {
    const charge = p.releaseCharge;
    const aimX = p.aimDir !== 0 ? p.aimDir : dirX;
    if (charge >= SPIKE_MIN_CHARGE && jumping && nearPeak) {
      power = lerp(SPIKE_MIN_POWER, SPIKE_MAX_POWER, charge);
      steep = 0.5;
      eventType = 'spike';
    } else if (charge < TIP_CHARGE_THRESHOLD) {
      power = TIP_POWER;
      steep = 2.2;
      eventType = 'tip';
    } else {
      power = lerp(MIN_CHARGE_POWER, MAX_CHARGE_POWER, charge);
      steep = lerp(2.0, 1.2, charge);
      eventType = 'hit';
    }
    // Hitting right on top of the net leaves no vertical margin to clear it
    // at a flat/fast trajectory — add arc the closer the contact point is to
    // the net, same way a real player has to pop the ball up more when
    // they're right on it. Tapers to 0 beyond NET_ARC_RANGE.
    const distToNet = Math.abs(p.x - NET_X);
    steep += Math.max(0, (NET_ARC_RANGE - distToNet) / NET_ARC_RANGE) * NET_ARC_BOOST;
    ball.vx = aimX * power;
    ball.vy = -power * steep * 0.6;
    p.justReleased = false;
    p.aimDir = 0;
  } else {
    // Mistimed (ball arrived mid-charge) or passive (never charging) contact
    // — a gentle, unaimed-by-charge deflect. Mistiming costs you the charge.
    if (p.charging) {
      p.charging = false;
      p.charge = 0;
      eventType = 'fumble';
    } else {
      eventType = 'touch';
    }
    const inputDirX = (input & RIGHT ? 1 : 0) - (input & LEFT ? 1 : 0);
    const aimX = inputDirX !== 0 ? inputDirX : dirX;
    power = DEFAULT_POWER;
    ball.vx = aimX * power;
    ball.vy = -power * DEFAULT_STEEP * 0.6;
  }

  events.push({ type: eventType, side: p.side });
  p.lastEvent = eventType;
  p.lastEventTimer = 0.35;
  p.hitCooldown = HIT_COOLDOWN;
  return true;
}
