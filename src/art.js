// Shared palette and small drawing helpers. All art is code, no image files.

export const PALETTE = {
  skyTop: '#ff8c5a',
  skyBottom: '#ffd37a',
  sun: '#fff1b8',
  sea: '#2f8f9e',
  seaDark: '#246f7b',
  sand: '#e8c07d',
  sandDark: '#d4a95e',
  net: '#f4f1e8',
  netPost: '#5a4632',
  outline: '#241a14',
  p1: '#ff5d5d',
  p1Dark: '#c23e3e',
  p2: '#4fc3f7',
  p2Dark: '#2f8cb0',
  ball: '#fff6e0',
  ballLine: '#241a14',
  shadow: 'rgba(20,10,0,0.25)',
  ui: '#241a14',
  limb: '#2a2018',
  chargeLow: '#5fd16a',
  chargeMid: '#f4c842',
  chargeHigh: '#ff5d5d',
  landingMarker: 'rgba(244,241,232,0.55)',
};

// A rounded-cap line segment — used for limbs so they read as solid, chunky
// shapes rather than thin strokes.
export function capsule(ctx, x1, y1, x2, y2, width, fill, outline = PALETTE.outline) {
  ctx.lineCap = 'round';
  ctx.lineWidth = width + 3;
  ctx.strokeStyle = outline;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.lineWidth = width;
  ctx.strokeStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function chargeColor(t) {
  if (t < 0.5) return PALETTE.chargeLow;
  if (t < 0.85) return PALETTE.chargeMid;
  return PALETTE.chargeHigh;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function outlinedCircle(ctx, x, y, r, fill, outline = PALETTE.outline, lineWidth = 3) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = outline;
  ctx.stroke();
}
