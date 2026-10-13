// Character roster: each has a real tradeoff (a strength and a matching
// weakness), expressed as multipliers applied to the base physics
// constants — never a pure buff, since a strictly-better character would
// make the choice meaningless. `traits` default to all-1 (no change from
// base) when a player doesn't pick a character (CPU, or before this system
// existed), so nothing about the existing game changes unless you opt in.
//
// ROOKIE is the explicit "easier for people who aren't crazy good" pick:
// a bigger hit radius (contact is more forgiving — less precise positioning
// needed) and a longer release-grace window (timing a charged swing is
// more forgiving), paired with a modest power cut as the tradeoff so it's
// still a real choice, not just a free win.
export const DEFAULT_TRAITS = {
  speedMult: 1, powerMult: 1, jumpMult: 1, hitRadiusMult: 1, graceMult: 1,
  peakWindowMult: 1,
};

// Every multiplier here was tuned against measured CPU-vs-CPU win rate, not
// guessed — and the measurement surfaced a real lesson worth keeping:
// `powerMult` is wildly high-leverage (it scales literally every hit's
// speed), so even a 15% power edge went 20/20 against a neutral baseline
// over 20 matches, while a -5% power PENALTY alone (with no other change)
// lost regardless of how much bonus speed or jump height tried to
// compensate (tested up to +100% speed, still 0/20). Power deltas here are
// kept small (±4-6%); speed/hit-radius/grace deltas can be larger since
// they're much lower-leverage.
export const CHARACTERS = [
  {
    id: 'blaze',
    name: 'Blaze',
    tagline: 'Power hitter — big swings, slower feet',
    accent: '#ff5d5d',
    traits: { ...DEFAULT_TRAITS, powerMult: 1.04, speedMult: 0.94 },
  },
  {
    id: 'gazelle',
    name: 'Gazelle',
    tagline: 'Speedster — covers the court, softer hits',
    accent: '#ffd166',
    traits: { ...DEFAULT_TRAITS, speedMult: 1.08, powerMult: 0.98 },
  },
  {
    id: 'sky',
    name: 'Sky',
    tagline: 'Jumper — big vertical & forgiving aerial timing, slower feet',
    accent: '#4fc3f7',
    // NOTE: measured this one extensively — jumpMult/peakWindowMult alone
    // (zero other change) still loses badly against CPU specifically,
    // root-caused to ai.js's jump-decision timing (jumpThreshold,
    // releaseLead) not being trait-aware: a taller jump arc desyncs the
    // AI's existing spike timing, so its spike attempts fall through to
    // weak touches instead (confirmed directly: the jumper landed 24
    // spikes vs the baseline opponent's 46 in one measured match, despite
    // having the "better" jump). This is the same category of accepted
    // limitation as the AI never diving or attempting an active block —
    // a human adapts their own timing to a taller jump naturally; the
    // fixed CPU heuristic can't. Sky is built for human-vs-human/online
    // play; expect it to underperform specifically against CPU opponents.
    traits: { ...DEFAULT_TRAITS, jumpMult: 1.1, peakWindowMult: 1.2, speedMult: 0.96 },
  },
  {
    id: 'rookie',
    name: 'Rookie',
    tagline: 'Easy mode — forgiving timing & reach, lighter hits',
    accent: '#8bd17c',
    traits: { ...DEFAULT_TRAITS, hitRadiusMult: 1.12, graceMult: 1.3, powerMult: 0.96 },
  },
];

export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}
