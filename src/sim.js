import {
  WIDTH, GROUND_Y, NET_X, DT, SUBSTEPS, TOSS_VY,
  createPlayer, stepPlayer, updateCharge, resolvePlayerHit,
} from './physics.js';
import { capServeTrajectory } from './netClearance.js';
import { createBall, stepBallGravity, resolveBallBounds, resolveGround } from './ball.js';
import { updateDive } from './dive.js';
import {
  createMatchState, registerTouch, awardPoint, startServe, AUTO_SERVE_SECONDS,
} from './rules.js';
import { stepRandom } from './rng.js';

const POINT_PAUSE_SECONDS = 1.2;
const SET_PAUSE_SECONDS = 2.5;

// Presentation-only reaction pose, held (frozen, since updateCharge doesn't
// run during the point/set pause) until the next serve resets the players —
// winner's WHOLE team gets a little victory pose, loser's whole team slumps
// (in 1v1 that's just one player each, same as before).
function setPointReaction(players, groundSide) {
  const winner = groundSide === 0 ? 1 : 0;
  for (const p of players) {
    if (p.side === winner) { p.lastEvent = 'win'; p.lastEventTimer = 999; }
    else if (p.side === groundSide) { p.lastEvent = 'lose'; p.lastEventTimer = 999; }
  }
}

// `teamSize` 1 = classic 1v1 (one player per side, unchanged from before).
// `teamSize` 2 = 2v2 (two players per side, spread apart with a small
// xOffset so they don't start stacked on the same spot — the engine has no
// player-vs-player collision, so nothing breaks if they do overlap, it
// just looks wrong). `p.slot` is each player's position in the flat
// `players` array (0..teamSize*2-1), used to index per-tick inputs
// independent of `side` (which two slots share a side, for team touches).
// `traitsBySlot` (optional) is an array of character traits (see
// roster.js) indexed by slot — a chosen character for that player; any
// slot left undefined gets the default (no-change) traits.
export function createInitialState(seed = 1, teamSize = 1, traitsBySlot = null) {
  const match = createMatchState(0);
  const players = [];
  let slot = 0;
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < teamSize; i++) {
      const xOffset = teamSize === 1 ? 0 : (i === 0 ? -50 : 50);
      const traits = traitsBySlot && traitsBySlot[slot];
      players.push(traits ? createPlayer(side, slot, xOffset, traits) : createPlayer(side, slot, xOffset));
      slot++;
    }
  }
  return {
    tick: 0,
    rngSeed: seed >>> 0,
    ball: serveBallFor(match.server),
    players,
    match,
    pauseTimer: 0,
  };
}

function serveBallFor(side) {
  const x = side === 0 ? WIDTH * 0.25 : WIDTH * 0.75;
  return createBall(x, GROUND_Y - 160);
}

function randomFloat(state) {
  const [value, nextSeed] = stepRandom(state.rngSeed);
  state.rngSeed = nextSeed;
  return value;
}

// step(state, inputP1, inputP2) -> { state: newState, events: [...] } for
// 1v1 (unchanged calling convention), OR step(state, inputsArray) for 2v2
// (and 1v1 too, if you'd rather) where inputsArray[p.slot] is each
// player's mask. Pure: never mutates the input state object, returns a new
// one.
export function step(state, inputP1OrArray, inputP2) {
  const inputs = Array.isArray(inputP1OrArray) ? inputP1OrArray : [inputP1OrArray, inputP2];
  const next = {
    tick: state.tick + 1,
    rngSeed: state.rngSeed,
    ball: { ...state.ball },
    players: state.players.map((p) => ({ ...p })),
    match: {
      ...state.match,
      score: [...state.match.score],
      sets: [...state.match.sets],
      touches: [...state.match.touches],
    },
    pauseTimer: state.pauseTimer,
  };
  const events = [];

  if (next.match.phase === 'point' || next.match.phase === 'setWon') {
    next.pauseTimer -= DT;
    if (next.pauseTimer <= 0) {
      const wasSetWon = next.match.phase === 'setWon';
      startServe(next.match);
      next.ball = serveBallFor(next.match.server);
      // .traits must be carried forward — without it, a chosen character
      // would silently reset to default stats at the start of every new
      // point (createPlayer defaults traits when not passed).
      next.players = next.players.map((p) => createPlayer(p.side, p.slot, p.xOffset, p.traits));
      events.push({ type: wasSetWon ? 'nextSetReady' : 'nextServeReady' });
    }
    return { state: next, events };
  }
  if (next.match.phase === 'matchWon') {
    return { state: next, events };
  }

  for (const p of next.players) {
    updateCharge(p, inputs[p.slot], DT);
    if (updateDive(p, inputs[p.slot], DT, next.ball)) events.push({ type: 'dive', side: p.side, slot: p.slot });
  }
  for (let s = 0; s < SUBSTEPS; s++) {
    for (const p of next.players) stepPlayer(p, inputs[p.slot], DT / SUBSTEPS);
  }

  if (next.match.phase === 'serve' && !next.match.serveTossed) {
    // In 2v2 the lowest-slot teammate on the serving side always serves —
    // a deliberate simplification (no rotation between teammates), not an
    // oversight. Real volleyball rotation is a bigger scope than this pass
    // covers.
    const server = next.players.find((p) => p.side === next.match.server);
    const dir = next.match.server === 0 ? 1 : -1;
    next.match.serveTimer += DT;
    const autoServe = next.match.serveTimer >= AUTO_SERVE_SECONDS;

    if (autoServe) {
      // No human engagement within the window — fall back to the old
      // instant default serve so a match can never stall on input that
      // isn't coming (and so a disconnected/idle CPU can't softlock it).
      next.ball.x = server.x + dir * 40;
      next.ball.y = server.y - 150;
      next.ball.vx = dir * (180 + 0.5 * 140 + randomFloat(next) * 20);
      next.ball.vy = -500;
      registerTouch(next.match, next.match.server);
      events.push({ type: 'serve', side: next.match.server, charge: 0.5 });
      return { state: next, events };
    }

    if (server.charging) {
      // TOSS-SERVE: the moment HIT is pressed, the ball leaves the
      // server's hand and becomes a normal free-falling ball — NOTE this
      // deliberately does NOT change match.phase yet (stays 'serve' until
      // actual contact resolves below), so registerTouch's existing
      // phase==='serve' first-contact special case still applies (doesn't
      // count toward rallyHits, so ace detection — "point ended with 0
      // rally hits" — still works correctly for a well-placed serve).
      // Charging keeps building while it's in the air; releasing resolves
      // the actual contact via the normal charged-hit pipeline below
      // (tip/hit/spike by charge level, exactly like a rally touch) —
      // timing the release against the falling toss IS the skill, not a
      // single button press.
      // dir*18 (not the old glued-serve's dir*40 — that offset was only
      // ever a visual "ball floats beside your body" position, never
      // collision-relevant, since the old model resolved contact instantly
      // on button press). Now the ball has to physically fall back into
      // PLAYER_RADIUS+BALL_RADIUS=38px of the server: at the lowest point
      // it can reach before faulting (12px above ground — any lower and
      // resolveGround fires first), a 40px horizontal offset put it at
      // ~41.8px away, JUST outside reach — confirmed by tracing a held
      // toss landing untouched by only 3.8px. 18px leaves real margin
      // (~21px at that same lowest point).
      next.ball.x = server.x + dir * 18;
      next.ball.y = server.y - 150;
      // Straight up, no horizontal drift: even a small sideways nudge here
      // compounds over the ~1s flight and carries the ball out of a
      // stationary server's reach entirely (the player's collision circle
      // is centered at their feet, so it only reaches a narrow x range) —
      // confirmed directly by tracing a continuously-held toss landing
      // untouched 70px away from the server who never moved. A real toss
      // comes straight back down to where you tossed it from.
      next.ball.vx = 0;
      next.ball.vy = TOSS_VY;
      next.match.serveTossed = true;
      events.push({ type: 'toss', side: next.match.server });
    } else {
      // Still waiting for the toss — ball stays glued to the server.
      next.ball.x = server.x + dir * 40;
      next.ball.y = server.y - 150;
      next.ball.vx = 0;
      next.ball.vy = 0;
      return { state: next, events };
    }
  }

  // Only one player can actually touch the ball first in a given tick.
  // Without this guard, two players both pressed up against the net (their
  // collision radii geometrically overlap there: PLAYER_RADIUS=26 vs a
  // minimum gap of only 62px at the net boundary) could BOTH register a hit
  // on the same ball within the same 1/60s tick — not even in the same
  // substep necessarily, since each player's own HIT_COOLDOWN only blocks
  // THAT player from re-hitting, not the other side from hitting in a later
  // substep of the same tick. Confirmed directly: without this, the second
  // contact immediately reversed what the first just did (vx flipped sign)
  // and fired two 'touch' events for one physical contact. Real scenario in
  // human-vs-human play (two players both rushing the net for a 50-50
  // ball), not just a contrived test.
  let ballTouchedThisTick = false;
  const subDt = DT / SUBSTEPS;
  for (let s = 0; s < SUBSTEPS; s++) {
    const prevX = next.ball.x;
    const prevY = next.ball.y;
    stepBallGravity(next.ball, subDt);
    next.rngSeed = resolveBallBounds(next.ball, events, next.rngSeed, stepRandom);

    if (!ballTouchedThisTick) {
      for (const p of next.players) {
        const hit = resolvePlayerHit(next.ball, prevX, prevY, p, inputs[p.slot], events);
        if (hit) {
          ballTouchedThisTick = true;
          // This is the server's own contact on their toss (phase is still
          // 'serve' — see the toss-serve comment above) — re-shape the
          // resulting velocity into a returnable serve envelope before
          // committing it. Must happen BEFORE registerTouch, which flips
          // phase to 'rally' the moment it sees 'serve'.
          if (next.match.phase === 'serve') capServeTrajectory(next.ball);
          const fault = registerTouch(next.match, p.side);
          if (fault) {
            const groundSide = p.side;
            awardPoint(next.match, groundSide, events);
            setPointReaction(next.players, groundSide);
            next.pauseTimer = next.match.phase === 'setWon' ? SET_PAUSE_SECONDS : POINT_PAUSE_SECONDS;
            return { state: next, events };
          }
          break;
        }
      }
    }

    const touchedGround = resolveGround(next.ball);
    if (touchedGround) {
      const groundSide = next.ball.x < NET_X ? 0 : 1;
      awardPoint(next.match, groundSide, events);
      setPointReaction(next.players, groundSide);
      next.pauseTimer = next.match.phase === 'setWon' ? SET_PAUSE_SECONDS : POINT_PAUSE_SECONDS;
      return { state: next, events };
    }
  }

  return { state: next, events };
}
