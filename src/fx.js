// Lightweight visual-only effects: screen shake + short-lived particle
// bursts. Never touches sim state — purely cosmetic, driven by game events.
const MAX_PARTICLES = 150;
let particles = [];
let shakeTime = 0;
let shakeMag = 0;

export function triggerShake(mag, duration = 0.15) {
  shakeMag = Math.max(shakeMag, mag);
  shakeTime = Math.max(shakeTime, duration);
}

function spawn(x, y, count, color, speed, life, size) {
  for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
    const angle = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.6);
    particles.push({
      x, y, vx: Math.cos(angle) * s, vy: Math.sin(angle) * s - speed * 0.3,
      life, maxLife: life, color, size: size * (0.6 + Math.random() * 0.6),
    });
  }
}

export function spawnImpact(x, y, power) {
  const intensity = Math.min(1, power / 700);
  spawn(x, y, 4 + Math.round(intensity * 8), '#fff6e0', 80 + intensity * 220, 0.28 + intensity * 0.15, 4);
  if (intensity > 0.4) triggerShake(2 + intensity * 7, 0.08 + intensity * 0.1);
}

export function spawnSandPuff(x, y) {
  spawn(x, y, 6, '#d4a95e', 60, 0.35, 5);
}

export function spawnConfetti(x, y) {
  const colors = ['#ff5d5d', '#4fc3f7', '#fff6e0', '#f4c842'];
  for (let i = 0; i < 24 && particles.length < MAX_PARTICLES; i++) {
    const c = colors[i % colors.length];
    spawn(x, y, 1, c, 140, 1.2, 5);
  }
}

export function update(dt) {
  if (shakeTime > 0) shakeTime -= dt;
  else shakeMag = 0;

  const GRAVITY_FX = 500;
  particles = particles.filter((p) => p.life > 0);
  for (const p of particles) {
    p.vy += GRAVITY_FX * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
}

export function getShakeOffset() {
  if (shakeTime <= 0 || shakeMag <= 0) return { x: 0, y: 0 };
  return { x: (Math.random() - 0.5) * shakeMag, y: (Math.random() - 0.5) * shakeMag };
}

export function draw(ctx) {
  for (const p of particles) {
    const t = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = t;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function reset() {
  particles = [];
  shakeTime = 0;
  shakeMag = 0;
}
