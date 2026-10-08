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

export function renderMenu(root, { onLocal2P, onHowToPlay, onCpu, onOnline }) {
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
  online.addEventListener('click', onOnline);
  cpuEasy.addEventListener('click', () => onCpu('easy'));
  cpuMedium.addEventListener('click', () => onCpu('medium'));
  cpuHard.addEventListener('click', () => onCpu('hard'));
  local.addEventListener('click', onLocal2P);
  howTo.addEventListener('click', onHowToPlay);
  [online, cpuEasy, cpuMedium, cpuHard, local, howTo].forEach((b) => panel.appendChild(b));
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
    'P1: A/D move, W jump, S hit.',
    'P2: Arrow keys move, Up jump, Down hit.',
    'Jump + hit near the top of your jump = spike.',
    'Hit while standing = bump.',
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

export function renderMatchEnd(root, match, { onRematch, onMenu }) {
  clear(root);
  const panel = document.createElement('div');
  panel.className = 'sb-panel';
  const winner = match.sets[0] > match.sets[1] ? 'P1' : 'P2';
  const title = document.createElement('h2');
  title.className = 'sb-title';
  title.textContent = `${winner} wins the match!`;
  const sets = document.createElement('p');
  sets.className = 'sb-text';
  sets.textContent = `Sets: ${match.sets[0]} - ${match.sets[1]}`;
  const rematch = button('Run it back');
  const menu = button('Menu');
  rematch.addEventListener('click', onRematch);
  menu.addEventListener('click', onMenu);
  panel.appendChild(title);
  panel.appendChild(sets);
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

export function hideOverlay(root) {
  clear(root);
}
