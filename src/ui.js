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

export function renderMenu(root, { onLocal2P, onHowToPlay }) {
  clear(root);
  const panel = document.createElement('div');
  panel.className = 'sb-panel';
  const title = document.createElement('h1');
  title.className = 'sb-title';
  title.textContent = 'Spike Beef';
  panel.appendChild(title);

  const online = button('Online 1v1 (coming soon)', false);
  const cpu = button('vs CPU (coming soon)', false);
  const local = button('Local 2P (same keyboard)', true);
  const howTo = button('How to Play', true);
  local.addEventListener('click', onLocal2P);
  howTo.addEventListener('click', onHowToPlay);
  [online, cpu, local, howTo].forEach((b) => panel.appendChild(b));
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
