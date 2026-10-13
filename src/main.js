import { createInitialState, step } from './sim.js';
import { WIDTH, HEIGHT } from './physics.js';
import { render, renderIdle } from './render.js';
import * as fx from './fx.js';
import { createKeyboardInput, createTouchInput } from './input.js';
import {
  renderMenu, renderHowToPlay, renderMatchEnd, renderPause, hideOverlay,
  renderOnlineMenu, renderCreateWaiting, renderJoinEntry, renderConnecting,
  renderNameEntry, renderLobby, renderCountdown, renderForfeitResult,
} from './ui.js';
import { createAi } from './ai.js';
import { randomRoomCode } from './transport.js';
import { hostOnlineMatch, joinOnlineMatch } from './online.js';
import { acquireWakeLock, releaseWakeLock, getStoredName, setStoredName, shareUrl, getH2H, recordH2H } from './device.js';
import { unlockAudio, isMuted, setMuted } from './audio.js';
import { processEvents, updateBanner, bannerState, resetAnnouncer } from './gameEvents.js';
import { initTauntBar, setTauntBarVisible, update as updateTaunts, emoteState, receiveRemote } from './taunts.js';
import * as stats from './stats.js';
import { record, reset as resetReplay, hasFinalPoint, startPlayback, updatePlayback, playbackDone } from './replay.js';
import { setupCanvasScaling } from './canvasScale.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('ui-overlay');
setupCanvasScaling(canvas, ctx, 960, 540);

const keyboard = createKeyboardInput();
const touch = createTouchInput();

// Mobile hardening: block pull-to-refresh/scroll and the long-press context
// menu so touch play never fights the browser chrome.
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', (e) => e.preventDefault());

['pointerdown', 'keydown'].forEach((evt) => window.addEventListener(evt, unlockAudio, { once: true }));

initTauntBar((kind, value) => {
  if (online) online.sendTaunt(kind, value);
  stats.recordTaunt(online && !online.isHost ? 1 : 0);
});

let appScreen = 'menu';
let state = null;
let spin = 0;
let cpu = null; // non-null when P2 is CPU-controlled
let online = null; // non-null controller once an online match is connected
let onlineHandle = null; // {close()} for an in-flight/active online session

function closeOnline() {
  if (onlineHandle) onlineHandle.close();
  onlineHandle = null;
  online = null;
}

function goMenu() {
  releaseWakeLock();
  closeOnline();
  fx.reset();
  appScreen = 'menu';
  cpu = null;
  renderMenu(overlay, {
    onLocal2P: startLocal2P,
    onCpu: startVsCpu,
    onOnline: goOnlineMenu,
    onHowToPlay: () => { appScreen = 'howToPlay'; renderHowToPlay(overlay, { onBack: goMenu }); },
    muted: isMuted(),
    onToggleMute: () => { setMuted(!isMuted()); goMenu(); },
  });
}

let onlineTeamSize = 1; // 1 = Online 1v1, 2 = Online 2v2 — set by the menu choice

function goOnlineMenu(teamSize = 1) {
  onlineTeamSize = teamSize;
  const name = getStoredName();
  if (!name) {
    appScreen = 'nameEntry';
    renderNameEntry(overlay, { initial: '', onSubmit: (n) => { setStoredName(n); goOnlineMenu(teamSize); }, onBack: goMenu });
    return;
  }
  appScreen = 'onlineMenu';
  renderOnlineMenu(overlay, { onCreate: createRoom, onJoin: () => goJoinEntry(), onBack: goMenu, teamSize });
}

let lobbyState = null;

function showLobby(localName, remoteName) {
  appScreen = 'onlineLobby';
  lobbyState = { localName, remoteName, localReady: false };
  renderLobbyScreen();
}

function renderLobbyScreen() {
  renderLobby(overlay, {
    localName: lobbyState.localName,
    remoteName: lobbyState.remoteName,
    localReady: lobbyState.localReady,
    h2h: getH2H(lobbyState.remoteName),
    onReady: () => {
      lobbyState.localReady = true;
      onlineHandle.sendReady();
      renderLobbyScreen();
    },
    onCancel: () => { closeOnline(); goOnlineMenu(onlineTeamSize); },
  });
}

function startCountdownThenMatch(ctrl) {
  online = ctrl;
  appScreen = 'countdown';
  let n = 3;
  renderCountdown(overlay, n);
  const iv = setInterval(() => {
    n -= 1;
    if (n >= 0) renderCountdown(overlay, n);
    else { clearInterval(iv); startOnlineMatch(); }
  }, 700);
}

const rematchState = { local: false, remote: false };
function tryStartRematch() {
  if (!rematchState.local || !rematchState.remote) return;
  rematchState.local = rematchState.remote = false;
  online.rematch();
  startCountdownThenMatch(online);
}

function createRoom() {
  const code = randomRoomCode();
  const localName = getStoredName() || 'Player';
  appScreen = 'onlineWaiting';
  renderCreateWaiting(overlay, code, {
    onShare: () => shareRoomLink(code),
    onCancel: () => { closeOnline(); goOnlineMenu(onlineTeamSize); },
  });
  onlineHandle = hostOnlineMatch(code, localName, {
    onRemoteName: (remoteName) => showLobby(localName, remoteName),
    onBothReady: startCountdownThenMatch,
    onError: () => { closeOnline(); goOnlineMenu(onlineTeamSize); },
    onDisconnected: () => { closeOnline(); goMenu(); },
    onRemoteTaunt: (kind, value) => { receiveRemote(kind, value); stats.recordTaunt(1); },
    onRematchReady: () => { rematchState.remote = true; tryStartRematch(); },
    teamSize: onlineTeamSize,
  });
}

function shareRoomLink(code) {
  shareUrl('Spike Beef', `${location.origin}${location.pathname}?room=${code}`);
}

function goJoinEntry(prefillCode = '', error = '') {
  appScreen = 'onlineJoin';
  renderJoinEntry(overlay, { onSubmit: joinRoom, onBack: goMenu, error, prefillCode });
}

function joinRoom(code) {
  if (!code || code.length !== 4) { goJoinEntry(code, 'Enter the 4-letter room code.'); return; }
  const localName = getStoredName() || 'Player';
  appScreen = 'onlineConnecting';
  renderConnecting(overlay, 'Connecting...', { onCancel: () => { closeOnline(); goOnlineMenu(onlineTeamSize); } });
  onlineHandle = joinOnlineMatch(code, localName, {
    onRemoteName: (remoteName) => showLobby(localName, remoteName),
    onBothReady: startCountdownThenMatch,
    onError: () => { closeOnline(); goJoinEntry(code, 'Room not found, full, or connection failed.'); },
    onDisconnected: () => { closeOnline(); goMenu(); },
    onRemoteTaunt: (kind, value) => { receiveRemote(kind, value); stats.recordTaunt(0); },
    onRematchReady: () => { rematchState.remote = true; tryStartRematch(); },
    teamSize: onlineTeamSize,
  });
}

function enterMatch() {
  appScreen = 'match';
  hideOverlay(overlay);
  acquireWakeLock();
  resetAnnouncer();
  resetReplay();
}

function enterReplay() {
  if (hasFinalPoint()) { startPlayback(); appScreen = 'replay'; }
  else { appScreen = 'matchEnded'; onMatchEnd(); }
}

function startOnlineMatch() { cpu = null; enterMatch(); }

function startLocal2P() {
  cpu = null;
  state = createInitialState(Date.now() & 0xffffffff);
  enterMatch();
}

function startVsCpu(difficulty) {
  cpu = createAi(1, difficulty);
  state = createInitialState(Date.now() & 0xffffffff);
  enterMatch();
}

function onMatchEnd() {
  releaseWakeLock();
  const rematchDifficulty = cpu ? cpu.difficulty : null;
  const wasOnline = !!online;
  const winnerSide = state.match.sets[0] > state.match.sets[1] ? 0 : 1;
  const titles = [0, 1].map((s) => stats.pickTitle(s === winnerSide, s));
  if (wasOnline && lobbyState) recordH2H(lobbyState.remoteName, winnerSide === (online.isHost ? 0 : 1));
  renderMatchEnd(overlay, state.match, {
    stats: stats.get(),
    titles,
    teamSize: wasOnline ? onlineTeamSize : 1,
    onRematch: () => {
      if (wasOnline) {
        rematchState.local = true;
        online.sendRematchReady();
        renderConnecting(overlay, 'Waiting for opponent to rematch...', { onCancel: () => { closeOnline(); goMenu(); } });
        tryStartRematch();
      } else if (rematchDifficulty) startVsCpu(rematchDifficulty);
      else startLocal2P();
    },
    onMenu: () => { closeOnline(); goMenu(); },
  });
}

function togglePause() {
  if (online) return; // no pause online, per spec
  if (appScreen === 'match') {
    appScreen = 'paused';
    renderPause(overlay, {
      onResume: () => { appScreen = 'match'; hideOverlay(overlay); },
      onQuit: goMenu,
    });
  } else if (appScreen === 'paused') {
    appScreen = 'match';
    hideOverlay(overlay);
  }
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && (appScreen === 'match' || appScreen === 'paused')) togglePause();
});

const roomFromLink = new URLSearchParams(location.search).get('room');
if (roomFromLink && /^[A-Za-z]{4}$/.test(roomFromLink)) {
  const code = roomFromLink.toUpperCase();
  if (getStoredName()) joinRoom(code);
  else {
    appScreen = 'nameEntry';
    renderNameEntry(overlay, { initial: '', onSubmit: (n) => { setStoredName(n); joinRoom(code); }, onBack: goMenu });
  }
} else {
  goMenu();
}

const DT = 1 / 60;
let acc = 0;
let last = performance.now();
let hitStopTimer = 0; // offline-only: freezing an authoritative online host would desync the guest

function frame(now) {
  const elapsed = Math.min((now - last) / 1000, 0.25);
  last = now;

  if (hitStopTimer > 0) {
    hitStopTimer -= elapsed;
  } else if (appScreen === 'match' && online) {
    acc += elapsed;
    while (acc >= DT) {
      const matchBefore = state && state.match
        ? { score: [...state.match.score], server: state.match.server, rallyHits: state.match.rallyHits }
        : null;
      // 2v2: this computer's whole local team is P1 (A/D/W/S) + P2 (Arrow
      // keys), same split as Local 2P — sent as a [teammateA, teammateB]
      // array. 1v1 stays a single mask (touch controls only ever apply to
      // the single local player there).
      const localInput = onlineTeamSize === 2
        ? [keyboard.getP1() | touch.getMask(), keyboard.getP2()]
        : keyboard.getP1() | touch.getMask();
      const result = online.tick(localInput);
      acc -= DT;
      const display = online.getDisplayState();
      if (display) {
        state = display;
        record(state);
        spin += (Math.abs(state.ball.vx) + Math.abs(state.ball.vy)) * 0.0006;
        if (result && matchBefore) {
          matchBefore.setsAfter = state.match.sets;
          processEvents(result.events, state.ball, matchBefore, state.players);
        }
        if (state.match.phase === 'matchWon') { enterReplay(); break; }
      }
    }
    if (appScreen === 'match' && online.getSilentMs() >= 15000) {
      releaseWakeLock();
      closeOnline();
      appScreen = 'forfeitResult';
      renderForfeitResult(overlay, { won: true, onMenu: goMenu });
    }
  } else if (appScreen === 'match' && state) {
    acc += elapsed;
    while (acc >= DT) {
      const matchBefore = { score: [...state.match.score], server: state.match.server, rallyHits: state.match.rallyHits };
      const input1 = keyboard.getP1() | touch.getMask();
      const input2 = cpu ? cpu.getInput(state) : keyboard.getP2();
      const result = step(state, input1, input2);
      state = result.state;
      record(state);
      spin += (Math.abs(state.ball.vx) + Math.abs(state.ball.vy)) * 0.0006;
      acc -= DT;
      matchBefore.setsAfter = state.match.sets;
      hitStopTimer = Math.max(hitStopTimer, processEvents(result.events, state.ball, matchBefore, state.players));
      if (state.match.phase === 'matchWon') { enterReplay(); break; }
    }
  } else if (appScreen === 'replay') {
    const replayFrame = updatePlayback(elapsed);
    if (replayFrame) state = replayFrame;
    if (playbackDone()) { appScreen = 'matchEnded'; onMatchEnd(); }
  }

  fx.update(elapsed);
  updateTaunts(elapsed);
  updateBanner(elapsed);
  setTauntBarVisible(appScreen === 'match');
  if (state && (appScreen === 'match' || appScreen === 'paused' || appScreen === 'matchEnded' || appScreen === 'replay' || appScreen === 'forfeitResult')) {
    const shake = fx.getShakeOffset();
    const punchScale = fx.getPunchScale();
    ctx.save();
    ctx.translate(WIDTH / 2 + shake.x, HEIGHT / 2 + shake.y);
    ctx.scale(punchScale, punchScale);
    ctx.translate(-WIDTH / 2, -HEIGHT / 2);
    render(ctx, state, spin, now / 1000, emoteState, bannerState.text, online ? online.getSilentMs() : null, fx.getNetSway(), fx.getBallSquash());
    fx.draw(ctx);
    ctx.restore();
  } else {
    renderIdle(ctx, now / 1000);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
