// Ring buffer of recent rally frames, so the match-end screen can replay the
// final point once in slow motion. Presentation-only — never read by the sim.
const CAP = 240; // ~4s at 60Hz, comfortably covers "the final point"
const DT = 1 / 60;
const SLOWDOWN = 5; // each buffered frame shown for 5x as long

let buffer = [];

export function record(state) {
  if (state.match.phase !== 'rally') return;
  buffer.push({
    ball: { ...state.ball },
    // .map(), not a fixed [players[0], players[1]] pair — that silently
    // dropped any player past index 1, which in 2v2 is an entire team
    // (same bug class fixed in render.js earlier: a replay of a 2v2 final
    // point would have shown only 2 of the 4 players).
    players: state.players.map((p) => ({ ...p })),
    match: { score: [...state.match.score], sets: [...state.match.sets], phase: state.match.phase },
  });
  if (buffer.length > CAP) buffer.shift();
}

export function reset() {
  buffer = [];
}

// Small playback controller: startPlayback() snapshots the current buffer
// tail; updatePlayback(elapsed) advances it in slow motion and returns the
// frame to render. Call playbackDone() to know when to move on.
let frames = [];
let index = 0;
let timer = 0;

export function hasFinalPoint() {
  return buffer.length > 0;
}

export function startPlayback(maxSeconds = 2.5) {
  const frameCount = Math.round(maxSeconds * 60);
  frames = buffer.slice(-frameCount);
  index = 0;
  timer = 0;
}

export function updatePlayback(elapsed) {
  if (index >= frames.length) return null;
  timer += elapsed;
  const frameDur = DT * SLOWDOWN;
  while (timer >= frameDur && index < frames.length) {
    timer -= frameDur;
    index += 1;
  }
  return frames[Math.min(index, frames.length - 1)] || null;
}

export function playbackDone() {
  return index >= frames.length;
}
