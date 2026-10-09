// Small browser-device helpers with no game-state dependencies: wake lock,
// vibration, and the locally-stored player name. Split out of main.js to
// keep that file under the project's file-size guideline.
let wakeLock = null;

export async function acquireWakeLock() {
  try {
    if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
  } catch {
    // Wake Lock isn't available everywhere — fine to silently skip.
  }
}

export function releaseWakeLock() {
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}

export function vibrate(ms) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

const NAME_KEY = 'spikebeef.name';

export function getStoredName() {
  try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
}

export function setStoredName(name) {
  try { localStorage.setItem(NAME_KEY, name); } catch { /* unavailable — just won't persist */ }
}

export function shareUrl(title, url) {
  if (navigator.share) {
    navigator.share({ title, url }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(url).catch(() => {});
  }
}
