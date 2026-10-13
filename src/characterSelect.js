// Character-select screen: pick a roster character before a match starts.
// Split out of ui.js (already near the file-size guideline) since this is
// a self-contained screen with its own card-grid layout.
import { CHARACTERS } from './roster.js';

function statBars(traits) {
  // Small human-readable strength/weakness readout — raw multipliers
  // aren't meaningful to a player at a glance, so bucket each into
  // high/normal/low against the neutral baseline (1.0).
  const rows = [
    ['Power', traits.powerMult],
    ['Speed', traits.speedMult],
    ['Jump', traits.jumpMult],
    ['Reach/Timing', Math.max(traits.hitRadiusMult, traits.graceMult, traits.peakWindowMult)],
  ];
  return rows
    .filter(([, v]) => Math.abs(v - 1) > 0.01)
    .map(([label, v]) => `${label} ${v > 1 ? '▲' : '▼'}`)
    .join('  ');
}

export function renderCharacterSelect(root, { title, onChoose, onBack }) {
  root.innerHTML = '';
  const panel = document.createElement('div');
  panel.className = 'sb-panel sb-char-panel';
  const h = document.createElement('h2');
  h.className = 'sb-title';
  h.textContent = title;
  panel.appendChild(h);

  const grid = document.createElement('div');
  grid.className = 'sb-char-grid';
  for (const char of CHARACTERS) {
    const card = document.createElement('button');
    card.className = 'sb-char-card';
    card.style.setProperty('--accent', char.accent);
    const swatch = document.createElement('div');
    swatch.className = 'sb-char-swatch';
    const name = document.createElement('div');
    name.className = 'sb-char-name';
    name.textContent = char.name;
    const tagline = document.createElement('div');
    tagline.className = 'sb-char-tagline';
    tagline.textContent = char.tagline;
    const stats = document.createElement('div');
    stats.className = 'sb-char-stats';
    stats.textContent = statBars(char.traits) || 'Balanced';
    card.appendChild(swatch);
    card.appendChild(name);
    card.appendChild(tagline);
    card.appendChild(stats);
    card.addEventListener('click', () => onChoose(char.id));
    grid.appendChild(card);
  }
  panel.appendChild(grid);

  const back = document.createElement('button');
  back.className = 'sb-btn';
  back.textContent = 'Back';
  back.addEventListener('click', onBack);
  panel.appendChild(back);

  root.appendChild(panel);
}
