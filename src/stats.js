// Match stats for the end-card screen: spikes/aces/taunts per side (world
// side 0/1, matching sim.js's convention), plus the longest rally this
// match. Presentation-only, reset at the start of every match.
let spikes = [0, 0];
let aces = [0, 0];
let tauntsSent = [0, 0];
let longestRally = 0;

export function reset() {
  spikes = [0, 0];
  aces = [0, 0];
  tauntsSent = [0, 0];
  longestRally = 0;
}

export function recordHitEvent(type, side) {
  if (type === 'spike' && (side === 0 || side === 1)) spikes[side] += 1;
}

export function recordAce(side) {
  if (side === 0 || side === 1) aces[side] += 1;
}

export function recordRallyLength(hits) {
  longestRally = Math.max(longestRally, hits);
}

export function recordTaunt(side) {
  if (side === 0 || side === 1) tauntsSent[side] += 1;
}

export function get() {
  return { spikes: [...spikes], aces: [...aces], tauntsSent: [...tauntsSent], longestRally };
}

// Title cards picked from the stats above — flavor text for the end screen.
export function pickTitle(isWinner, side) {
  const s = get();
  if (isWinner) {
    if (s.spikes[side] >= 5) return 'Certified Menace';
    if (s.aces[side] >= 3) return 'Serve Villain';
    if (s.tauntsSent[side] >= 3) return 'All Talk, All Game';
    return 'Match Winner';
  }
  if (s.longestRally >= 12) return 'Went Down Swinging';
  if (s.spikes[side] === 0) return 'Got Cooked';
  return 'Better Luck Next Time';
}
