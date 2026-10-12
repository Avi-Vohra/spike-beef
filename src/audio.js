// Tiny WebAudio synth — every sound is generated, no audio files. Unlocked
// on the first user gesture (required by mobile browser autoplay policies).
const MUTE_KEY = 'spikebeef.muted';
let ctx = null;
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* unavailable */ }

function ensureContext() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

export function unlockAudio() {
  const c = ensureContext();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

export function isMuted() { return muted; }

export function setMuted(value) {
  muted = value;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* unavailable */ }
}

function tone(freq, duration, { type = 'sine', gain = 0.2, slideTo = null, delay = 0 } = {}) {
  if (muted) return;
  const c = ensureContext();
  if (!c || c.state === 'suspended') return;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + delay);
  if (slideTo) osc.frequency.linearRampToValueAtTime(slideTo, c.currentTime + delay + duration);
  amp.gain.setValueAtTime(gain, c.currentTime + delay);
  amp.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
  osc.connect(amp);
  amp.connect(c.destination);
  osc.start(c.currentTime + delay);
  osc.stop(c.currentTime + delay + duration + 0.02);
}

function noiseBurst(duration, gain = 0.15) {
  if (muted) return;
  const c = ensureContext();
  if (!c || c.state === 'suspended') return;
  const bufferSize = Math.floor(c.sampleRate * duration);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const amp = c.createGain();
  amp.gain.value = gain;
  src.connect(amp);
  amp.connect(c.destination);
  src.start();
}

const SOUND_EVENTS = {
  tip: () => tone(680, 0.08, { type: 'triangle', gain: 0.15 }),
  hit: () => tone(320, 0.12, { type: 'square', gain: 0.18, slideTo: 220 }),
  spike: () => { tone(200, 0.16, { type: 'sawtooth', gain: 0.25, slideTo: 90 }); noiseBurst(0.08, 0.12); },
  fumble: () => tone(150, 0.1, { type: 'triangle', gain: 0.12, slideTo: 100 }),
  block: () => { tone(260, 0.1, { type: 'square', gain: 0.2, slideTo: 140 }); noiseBurst(0.05, 0.1); },
  netBounce: () => tone(500, 0.06, { type: 'sine', gain: 0.1 }),
  wallBounce: () => tone(450, 0.05, { type: 'sine', gain: 0.08 }),
  serve: () => tone(440, 0.1, { type: 'sine', gain: 0.15, slideTo: 560 }),
  point: () => { tone(523, 0.1, { type: 'square', gain: 0.15 }); tone(659, 0.12, { type: 'square', gain: 0.15, delay: 0.1 }); },
  setWon: () => { tone(523, 0.12, { gain: 0.2 }); tone(659, 0.12, { gain: 0.2, delay: 0.12 }); tone(784, 0.2, { gain: 0.2, delay: 0.24 }); },
  matchWon: () => { tone(523, 0.14, { gain: 0.22 }); tone(659, 0.14, { gain: 0.22, delay: 0.14 }); tone(784, 0.14, { gain: 0.22, delay: 0.28 }); tone(1047, 0.3, { gain: 0.22, delay: 0.42 }); },
  emote: () => { tone(880, 0.05, { type: 'triangle', gain: 0.12 }); tone(1100, 0.06, { type: 'triangle', gain: 0.12, delay: 0.05 }); },
};

export function playEvent(type) {
  const fn = SOUND_EVENTS[type];
  if (fn) fn();
}
