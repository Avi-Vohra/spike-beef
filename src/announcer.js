// Tracks streaks/deficits across points to drive the announcer banner.
// Presentation-only — reads match state the sim already produces, never
// writes back to it.

let streakSide = null;
let streakCount = 0;
let maxDeficit = [0, 0]; // largest deficit each side has overcome *so far this set*

export function resetSet() {
  streakSide = null;
  streakCount = 0;
  maxDeficit = [0, 0];
}

// Call once per point, right when a 'point' event fires, with the state
// just BEFORE this point was applied (score/server) plus what the point
// changed. Returns a callout string, or null for no callout this point.
export function processPoint({ scoreBefore, winner, rallyHitsBefore, serverBefore, hadNetBounce, isSetWin, setScoreAfter }) {
  if (streakSide === winner) streakCount += 1;
  else { streakSide = winner; streakCount = 1; }

  const loser = winner === 0 ? 1 : 0;
  const deficitBefore = scoreBefore[loser] > 0 || scoreBefore[winner] > 0
    ? scoreBefore[winner] - scoreBefore[loser] : 0;
  if (deficitBefore < 0) maxDeficit[winner] = Math.max(maxDeficit[winner], -deficitBefore);

  const scoreAfterWinner = scoreBefore[winner] + 1;
  const scoreAfterLoser = scoreBefore[loser];
  const tookLeadBack = scoreAfterWinner >= scoreAfterLoser && scoreBefore[winner] < scoreBefore[loser];

  let callout = null;
  if (isSetWin && setScoreAfter[loser] === 0) callout = 'SKUNKED';
  else if (streakCount === 5) callout = 'COOKING';
  else if (streakCount === 3) callout = 'ON FIRE';
  else if (tookLeadBack && maxDeficit[winner] >= 5) callout = 'COMEBACK';
  else if (rallyHitsBefore === 0 && winner === serverBefore) callout = 'ACE';
  else if (hadNetBounce && rallyHitsBefore <= 1) callout = 'DENIED';
  else if (rallyHitsBefore >= 15) callout = 'LONG RALLY';

  if (isSetWin) resetSet();
  return callout;
}
