import {
  WIDTH, GROUND_Y, NET_X, DT, SUBSTEPS,
  createPlayer, createBall, stepPlayer, stepBallGravity,
  resolveBallBounds, resolveGround, resolvePlayerHit, HIT,
} from './physics.js';
import {
  createMatchState, registerTouch, awardPoint, startServe, AUTO_SERVE_SECONDS,
} from './rules.js';
import { stepRandom } from './rng.js';

const POINT_PAUSE_SECONDS = 1.2;
const SET_PAUSE_SECONDS = 2.5;

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
    const serverInput = inputs[next.match.server];
    const wantsHit = !!(serverInput & HIT);
    if (wantsHit || next.match.serveTimer >= AUTO_SERVE_SECONDS) {
      const power = wantsHit ? 520 : 460 + randomFloat(next) * 80;
      next.ball.vx = dir * power;
      next.ball.vy = -power * 0.9;
      registerTouch(next.match, next.match.server);
      events.push({ type: 'serve', side: next.match.server });
    }
    return { state: next, events };
  }

  const subDt = DT / SUBSTEPS;
  for (let s = 0; s < SUBSTEPS; s++) {
    const prevX = next.ball.x;
    const prevY = next.ball.y;
    stepBallGravity(next.ball, subDt);
    resolveBallBounds(next.ball, events);

    for (const p of next.players) {
      const hit = resolvePlayerHit(next.ball, prevX, prevY, p, inputs[p.side], events);
      if (hit) {
        const fault = registerTouch(next.match, p.side);
        if (fault) {
          const groundSide = p.side;
          awardPoint(next.match, groundSide, events);
          next.pauseTimer = next.match.phase === 'setWon' ? SET_PAUSE_SECONDS : POINT_PAUSE_SECONDS;
          return { state: next, events };
        }
      }
    }

    const touchedGround = resolveGround(next.ball);
    if (touchedGround) {
      const groundSide = next.ball.x < NET_X ? 0 : 1;
      awardPoint(next.match, groundSide, events);
      next.pauseTimer = next.match.phase === 'setWon' ? SET_PAUSE_SECONDS : POINT_PAUSE_SECONDS;
      return { state: next, events };
    }
  }

  return { state: next, events };
}
