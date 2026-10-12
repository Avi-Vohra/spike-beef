import {
  WIDTH, GROUND_Y, NET_X, DT, SUBSTEPS,
  createPlayer, stepPlayer, updateCharge, resolvePlayerHit,
} from './physics.js';
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
// winner gets a little victory pose, loser slumps.
function setPointReaction(players, groundSide) {
  const winner = groundSide === 0 ? 1 : 0;
  players[winner].lastEvent = 'win';
  players[winner].lastEventTimer = 999;
  players[groundSide].lastEvent = 'lose';
  players[groundSide].lastEventTimer = 999;
}

export function createInitialState(seed = 1) {
  const match = createMatchState(0);
  return {
    tick: 0,
    rngSeed: seed >>> 0,
    ball: serveBallFor(match.server),
    players: [createPlayer(0), createPlayer(1)],
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

// step(state, inputP1, inputP2) -> { state: newState, events: [...] }
// Pure: never mutates the input state object; returns a new one.
export function step(state, inputP1, inputP2) {
  const next = {
    tick: state.tick + 1,
    rngSeed: state.rngSeed,
    ball: { ...state.ball },
    players: [{ ...state.players[0] }, { ...state.players[1] }],
    match: {
      ...state.match,
      score: [...state.match.score],
      sets: [...state.match.sets],
      touches: [...state.match.touches],
    },
    pauseTimer: state.pauseTimer,
  };
  const events = [];
  const inputs = [inputP1, inputP2];

  if (next.match.phase === 'point' || next.match.phase === 'setWon') {
    next.pauseTimer -= DT;
    if (next.pauseTimer <= 0) {
      const wasSetWon = next.match.phase === 'setWon';
      startServe(next.match);
      next.ball = serveBallFor(next.match.server);
      next.players[0] = createPlayer(0);
      next.players[1] = createPlayer(1);
      events.push({ type: wasSetWon ? 'nextSetReady' : 'nextServeReady' });
    }
    return { state: next, events };
  }
  if (next.match.phase === 'matchWon') {
    return { state: next, events };
  }

  for (const p of next.players) {
    updateCharge(p, inputs[p.side], DT);
    if (updateDive(p, inputs[p.side], DT, next.ball)) events.push({ type: 'dive', side: p.side });
  }
  for (let s = 0; s < SUBSTEPS; s++) {
    for (const p of next.players) stepPlayer(p, inputs[p.side], DT / SUBSTEPS);
  }

  if (next.match.phase === 'serve') {
    const server = next.players[next.match.server];
    const dir = next.match.server === 0 ? 1 : -1;
    next.ball.x = server.x + dir * 40;
    next.ball.y = server.y - 150;
    next.ball.vx = 0;
    next.ball.vy = 0;

    next.match.serveTimer += DT;
    const autoServe = next.match.serveTimer >= AUTO_SERVE_SECONDS;
    // Charged serve: hold HIT to charge like any other hit, release to serve
    // — more charge = a faster, flatter serve. Vertical speed stays fixed
    // regardless of charge (proven safe across the whole horizontal range
    // below) so clearing the net is never in question, only how hot the
    // serve comes in.
    if (server.justReleased || autoServe) {
      const charge = autoServe ? 0.5 : server.releaseCharge;
      server.justReleased = false;
      const vx = dir * (180 + charge * 140 + randomFloat(next) * 20);
      next.ball.vx = vx;
      next.ball.vy = -500;
      registerTouch(next.match, next.match.server);
      events.push({ type: 'serve', side: next.match.server, charge });
    }
    return { state: next, events };
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
        const hit = resolvePlayerHit(next.ball, prevX, prevY, p, inputs[p.side], events);
        if (hit) {
          ballTouchedThisTick = true;
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
