// DOM overlay screens (menu, how-to-play, match-end, pause). The match itself
// is drawn on canvas by render.js; this module only owns the HTML overlay.

function button(label, enabled = true) {
  const b = document.createElement('button');
  b.className = 'sb-btn' + (enabled ? '' : ' sb-btn-disabled');
  b.textContent = label;
  b.disabled = !enabled;
  return b;
}

function clear(root) {
  root.innerHTML = '';
}

export function renderMenu(root, { onLocal2P, onHowToPlay, onCpu, onOnline, muted, onToggleMute }) {
  clear(root);
  const panel = document.createElement('div');
  panel.className = 'sb-panel';
  const title = document.createElement('h1');
  title.className = 'sb-title';
  title.textContent = 'Spike Beef';
  panel.appendChild(title);

  const online = button('Online 1v1', true);
  const cpuEasy = button('vs CPU: Easy', true);
  const cpuMedium = button('vs CPU: Medium', true);
  const cpuHard = button('vs CPU: Hard', true);
  const local = button('Local 2P (same keyboard)', true);
  const howTo = button('How to Play', true);
  const mute = button(muted ? 'Sound: Off' : 'Sound: On', true);
  online.addEventListener('click', onOnline);
  cpuEasy.addEventListener('click', () => onCpu('easy'));
  cpuMedium.addEventListener('click', () => onCpu('medium'));
  cpuHard.addEventListener('click', () => onCpu('hard'));
  local.addEventListener('click', onLocal2P);
  howTo.addEventListener('click', onHowToPlay);
  mute.addEventListener('click', onToggleMute);
  [online, cpuEasy, cpuMedium, cpuHard, local, howTo, mute].forEach((b) => panel.appendChild(b));
  root.appendChild(panel);
}

export function renderOnlineMenu(root, { onCreate, onJoin, onBack }) {
  clear(root);
  const panel = document.createElement('div');
  panel.className = 'sb-panel';
  const title = document.createElement('h2');
  title.className = 'sb-title';
  title.textContent = 'Online 1v1';
  const create = button('Create Room');
  const join = button('Join Room');
  const back = button('Back');
  create.addEventListener('click', onCreate);
  join.addEventListener('click', onJoin);
  back.addEventListener('click', onBack);
  [title, create, join, back].forEach((el) => panel.appendChild(el));
  root.appendChild(panel);
}

export function renderCreateWaiting(root, code, { onShare, onCancel }) {
  clear(root);
  const panel = document.createElement('div');
  panel.className = 'sb-panel';
  const title = document.createElement('h2');
  title.className = 'sb-title';
  title.textContent = code;
  const status = document.createElement('p');
  status.className = 'sb-text';
  status.textContent = 'Waiting for opponent to join...';
  const share = button('Share Link');
  const cancel = button('Cancel');
  share.addEventListener('click', onShare);
  cancel.addEventListener('click', onCancel);
  [title, status, share, cancel].forEach((el) => panel.appendChild(el));
  root.appendChild(panel);
}

export function renderJoinEntry(root, { onSubmit, onBack, error, prefillCode }) {
  clear(root);
  const panel = document.createElement('div');
  panel.className = 'sb-panel';
  const title = document.createElement('h2');
  title.className = 'sb-title';
  title.textContent = 'Join Room';
  const input = document.createElement('input');
  input.className = 'sb-input';
  input.maxLength = 4;
  input.placeholder = 'CODE';
  input.value = prefillCode || '';
  input.autocapitalize = 'characters';
  const submit = button('Join');
  const back = button('Back');
  if (error) {
    const err = document.createElement('p');
    err.className = 'sb-text sb-error';
    err.textContent = error;
    panel.appendChild(title);
    panel.appendChild(err);
  } else {
    panel.appendChild(title);
  }
  panel.appendChild(input);
  submit.addEventListener('click', () => onSubmit(input.value.trim().toUpperCase()));
  back.addEventListener('click', onBack);
  panel.appendChild(submit);
  panel.appendChild(back);
  root.appendChild(panel);
}

export function renderNameEntry(root, { initial, onSubmit, onBack }) {
  clear(root);
  const panel = document.createElement('div');
  panel.className = 'sb-panel';
  const title = document.createElement('h2');
  title.className = 'sb-title';
  title.textContent = 'Your Name';
  const input = document.createElement('input');
  input.className = 'sb-input';
  input.maxLength = 10;
  input.placeholder = 'Name';
  input.value = initial || '';
  const submit = button('Continue');
  submit.addEventListener('click', () => {
    const name = input.value.trim().slice(0, 10) || 'Player';
    onSubmit(name);
  });
  panel.appendChild(title);
  panel.appendChild(input);
  panel.appendChild(submit);
  if (onBack) {
    const back = button('Back');
    back.addEventListener('click', onBack);
    panel.appendChild(back);
  }
  root.appendChild(panel);
}

export function renderLobby(root, { localName, remoteName, localReady, remoteReady, onReady, onCancel, h2h }) {
  clear(root);
  const panel = document.createElement('div');
  panel.className = 'sb-panel';
  const title = document.createElement('h2');
  title.className = 'sb-title';
  title.textContent = 'Lobby';
  const names = document.createElement('p');
  names.className = 'sb-text';
  names.textContent = `${localName} ${localReady ? '(ready)' : ''}  vs  ${remoteName || '...'} ${remoteName && remoteReady ? '(ready)' : ''}`;
  panel.appendChild(title);
  panel.appendChild(names);
  if (remoteName && h2h) {
    const record = document.createElement('p');
    record.className = 'sb-text';
    record.textContent = `You ${h2h.wins} - ${h2h.losses} vs ${remoteName}`;
    panel.appendChild(record);
  }
  const ready = button(localReady ? 'Waiting for opponent...' : 'Ready', !localReady);
  const cancel = button('Cancel');
  if (!localReady) ready.addEventListener('click', onReady);
  cancel.addEventListener('click', onCancel);
  panel.appendChild(ready);
  panel.appendChild(cancel);
  root.appendChild(panel);
}

export function renderCountdown(root, n) {
  clear(root);
  const panel = document.createElement('div');
  panel.className = 'sb-panel';
  const big = document.createElement('div');
  big.className = 'sb-title';
  big.style.fontSize = '64px';
  big.textContent = n > 0 ? String(n) : 'GO!';
  panel.appendChild(big);
  root.appendChild(panel);
}

export function renderConnecting(root, message, { onCancel } = {}) {
  clear(root);
  const panel = document.createElement('div');
  panel.className = 'sb-panel';
  const text = document.createElement('p');
  text.className = 'sb-text';
  text.textContent = message || 'Connecting...';
  panel.appendChild(text);
  if (onCancel) {
    const cancel = button('Cancel');
    cancel.addEventListener('click', onCancel);
    panel.appendChild(cancel);
  }
  root.appendChild(panel);
}

export function renderHowToPlay(root, { onBack }) {
  clear(root);
  const panel = document.createElement('div');
  panel.className = 'sb-panel';
  const title = document.createElement('h2');
  title.className = 'sb-title';
  title.textContent = 'How to Play';
  const text = document.createElement('p');
  text.className = 'sb-text';
  text.innerHTML = [
    'P1: A/D move, W jump, S hit. P2: Arrow keys move, Up jump, Down hit.',
    '<b>Hold HIT to charge, release to swing</b> — more charge = more power.',
    'Quick tap (barely any charge) = a soft tip.',
    'Jump + release a real charge near the top of your jump = a spike.',
    'Hold toward the net as you release = flatter, harder, riskier. Hold away = more arc, safer.',
    'Jump into the ball right at the net without charging = a block.',
    'Double-tap a direction on the ground = a dive for a last-second save.',
    '3 touches max per side. Ball on your sand = they score.',
    'First to 11, win by 2, cap 15. Best of 3 sets.',
  ].join('<br/>');
  const back = button('Back');
  back.addEventListener('click', onBack);
  panel.appendChild(title);
  panel.appendChild(text);
  panel.appendChild(back);
  root.appendChild(panel);
}

export function renderMatchEnd(root, match, { onRematch, onMenu, stats, titles }) {
  clear(root);
  const panel = document.createElement('div');
  panel.className = 'sb-panel';
  const winnerSide = match.sets[0] > match.sets[1] ? 0 : 1;
  const winnerLabel = winnerSide === 0 ? 'P1' : 'P2';
  const title = document.createElement('h2');
  title.className = 'sb-title';
  title.textContent = `${winnerLabel} wins the match!`;
  const sets = document.createElement('p');
  sets.className = 'sb-text';
  sets.textContent = `Sets: ${match.sets[0]} - ${match.sets[1]}`;
  panel.appendChild(title);
  panel.appendChild(sets);

  if (titles) {
    const cards = document.createElement('p');
    cards.className = 'sb-text';
    cards.innerHTML = `<b>P1</b>: "${titles[0]}" &nbsp; <b>P2</b>: "${titles[1]}"`;
    panel.appendChild(cards);
  }
  if (stats) {
    const statsText = document.createElement('p');
    statsText.className = 'sb-text';
    statsText.style.fontSize = '12px';
    statsText.innerHTML = [
      `Spikes: ${stats.spikes[0]} - ${stats.spikes[1]}`,
      `Aces: ${stats.aces[0]} - ${stats.aces[1]}`,
      `Longest rally: ${stats.longestRally} hits`,
      `Taunts sent: ${stats.tauntsSent[0]} - ${stats.tauntsSent[1]}`,
    ].join('<br/>');
    panel.appendChild(statsText);
  }

  const rematch = button('Run it back');
  const menu = button('Menu');
  rematch.addEventListener('click', onRematch);
  menu.addEventListener('click', onMenu);
  panel.appendChild(rematch);
  panel.appendChild(menu);
  root.appendChild(panel);
}

export function renderPause(root, { onResume, onQuit }) {
  clear(root);
  const panel = document.createElement('div');
  panel.className = 'sb-panel';
  const title = document.createElement('h2');
  title.className = 'sb-title';
  title.textContent = 'Paused';
  const resume = button('Resume');
  const quit = button('Quit to Menu');
  resume.addEventListener('click', onResume);
  quit.addEventListener('click', onQuit);
  panel.appendChild(title);
  panel.appendChild(resume);
  panel.appendChild(quit);
  root.appendChild(panel);
}

export function renderForfeitResult(root, { won, reason, onMenu }) {
  clear(root);
  const panel = document.createElement('div');
  panel.className = 'sb-panel';
  const title = document.createElement('h2');
  title.className = 'sb-title';
  title.textContent = won ? 'You win by forfeit!' : 'You forfeited.';
  const text = document.createElement('p');
  text.className = 'sb-text';
  text.textContent = reason || (won ? 'Your opponent disconnected.' : 'You left the match.');
  const menu = button('Menu');
  menu.addEventListener('click', onMenu);
  panel.appendChild(title);
  panel.appendChild(text);
  panel.appendChild(menu);
  root.appendChild(panel);
}

export function hideOverlay(root) {
  clear(root);
}
