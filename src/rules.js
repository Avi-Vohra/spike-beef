// Pure scoring/serve/match rules. No DOM, no window.

export const POINTS_TO_WIN = 11;
export const WIN_BY = 2;
export const POINT_CAP = 15;
export const SETS_TO_WIN = 2;
export const MAX_TOUCHES = 3;
export const AUTO_SERVE_SECONDS = 5;

export function createMatchState(firstServer) {
  return {
    score: [0, 0],
    sets: [0, 0],
    server: firstServer,
    phase: 'serve', // 'serve' | 'rally' | 'point' | 'setWon' | 'matchWon'
    touches: [0, 0], // touches used by the side currently receiving the ball
    lastToucherSide: null,
    serveTimer: 0,
    rallyHits: 0,
    serveTossed: false, // toss-serve mechanic — see sim.js's 'serve' phase handling
  };
}

export function isSetWon(score) {
  const [a, b] = score;
  const lead = Math.abs(a - b);
  const hi = Math.max(a, b);
  if (hi >= POINT_CAP) return hi === a ? 0 : 1;
  if (hi >= POINTS_TO_WIN && lead >= WIN_BY) return a > b ? 0 : 1;
  return -1;
}

export function isMatchWon(sets) {
  if (sets[0] >= SETS_TO_WIN) return 0;
  if (sets[1] >= SETS_TO_WIN) return 1;
  return -1;
}

// Called when the ball touches the ground on `groundSide` (0 or 1).
// Returns events describing what happened.
export function awardPoint(match, groundSide, events) {
  const winner = groundSide === 0 ? 1 : 0;
  match.score[winner] += 1;
  events.push({ type: 'point', winner });

  const setWinner = isSetWon(match.score);
  if (setWinner !== -1) {
    match.sets[setWinner] += 1;
    events.push({ type: 'setWon', winner: setWinner });
    const matchWinner = isMatchWon(match.sets);
    if (matchWinner !== -1) {
      events.push({ type: 'matchWon', winner: matchWinner });
      match.phase = 'matchWon';
    } else {
      match.score = [0, 0];
      match.phase = 'setWon';
    }
  } else {
    match.phase = 'point';
  }

  match.server = winner;
  match.touches = [0, 0];
  match.lastToucherSide = null;
  match.serveTimer = 0;
  match.rallyHits = 0;
}

// Called after a point/set celebration delay to go back to serving.
export function startServe(match) {
  match.phase = 'serve';
  match.touches = [0, 0];
  match.lastToucherSide = null;
  match.serveTimer = 0;
  match.rallyHits = 0;
  match.serveTossed = false;
}

// Called whenever a player touches the ball during a rally.
// If the same side exceeds MAX_TOUCHES before sending it over, the other
// side scores. Returns true if a fault happened (caller awards the point).
export function registerTouch(match, side) {
  if (match.phase === 'serve') {
    match.phase = 'rally';
    match.lastToucherSide = side;
    match.touches[side] = 1;
    return false;
  }
  match.rallyHits += 1;
  if (match.lastToucherSide === side) {
    match.touches[side] += 1;
  } else {
    match.lastToucherSide = side;
    match.touches[side] = 1;
  }
  return match.touches[side] > MAX_TOUCHES;
}
