// draw_sandpiper_small.js — 40×15 canvas
// Canonical drawing script for the Sandpiper TUI mascot.
// Beach scene: sun, clouds, bird singing, water.
// Full unicode block range (U+2580–U+259F).

const cells = [];
const BW = '#FFFFFF';
const GR = '#AAAAAA';
const EYE = '#111111';
const GOLD = '#CCAA33';
const BEAK = '#FF8844';
const LEG = '#FF8844';
const NOTE = '#FF8844';
const WATER = '#5599CC';
const SUN = '#DDAA33';
const CLOUD = '#667788';

function px(x, y, char, color, bgColor) {
  if (x < 0 || x >= 40 || y < 0 || y >= 15) return;
  const cell = { x, y, char, color };
  if (bgColor !== undefined) cell.bgColor = bgColor;
  cells.push(cell);
}
function row(y, x1, x2, char, color, bgColor) {
  for (let x = x1; x <= x2; x++) px(x, y, char, color, bgColor);
}

// ── SUN (upper-left, y=0-5) ────────────────────────────────────────────────────
// 6 wide × 6 tall, ░ edges + ▒ core for ghostly glow
row(0, 3, 6, '░', SUN);
px(2, 1, '░', SUN);
row(1, 3, 6, '▒', SUN);
px(7, 1, '░', SUN);
px(1, 2, '░', SUN);
row(2, 2, 8, '▒', SUN);
px(9, 2, '░', SUN);
px(1, 3, '░', SUN);
row(3, 2, 8, '▒', SUN);
px(9, 3, '░', SUN);
px(2, 4, '░', SUN);
row(4, 3, 6, '▒', SUN);
px(7, 4, '░', SUN);
row(5, 3, 6, '░', SUN);

// ── CLOUD 1: big puffy, upper-center (y=1-3) ──────────────────────────────────
px(20, 1, '░', CLOUD);
px(21, 1, '░', CLOUD);
px(24, 1, '░', CLOUD);
px(25, 1, '░', CLOUD);
row(2, 19, 26, '░', CLOUD);
row(3, 19, 26, '░', CLOUD);

// ── CLOUD 2: small, mid-left (y=5-6) ──────────────────────────────────────────
px(13, 5, '░', CLOUD);
px(14, 5, '░', CLOUD);
px(16, 5, '░', CLOUD);
row(6, 12, 17, '░', CLOUD);

// ── CLOUD 3: long thin with peaks, mid-right (y=5-7) ──────────────────────────
px(23, 6, '░', CLOUD);
px(24, 6, '░', CLOUD);
px(28, 6, '░', CLOUD);
px(29, 6, '░', CLOUD);
px(30, 6, '░', CLOUD);
px(29, 5, '░', CLOUD);
row(7, 22, 31, '░', CLOUD);

// ── MUSIC NOTES ────────────────────────────────────────────────────────────────
px(31, 9, '♫', NOTE);
px(33, 8, '♪', NOTE);

// ── BIRD (y=10-14) ─────────────────────────────────────────────────────────────

// Crown
px(33, 10, '▄', BW);
px(34, 10, '▄', BW);
px(35, 10, '▄', BW);

// y=11: beak + head + eye
px(30, 11, '▂', BEAK);
px(31, 11, '▄', BEAK);
px(32, 11, '▟', BW, 'transparent');
row(11, 33, 35, '█', BW);
px(36, 11, '▙', BW, 'transparent');
px(33, 11, '▍', EYE, GOLD);

// y=12: upper body + wing
row(12, 32, 35, '█', BW);
row(12, 36, 39, '█', GR);

// y=13: belly + wing taper
row(13, 33, 35, '█', BW);
px(36, 13, '█', GR);
px(37, 13, '█', GR);

// y=14: legs + water (full width)
px(33, 14, '▗', LEG);
px(34, 14, '▌', LEG);
px(35, 14, '▗', LEG);
px(36, 14, '▌', LEG);

// ── WATER RIPPLES (y=14, full canvas width, skipping legs) ─────────────────────
for (let x = 0; x <= 39; x++) {
  if (x >= 33 && x <= 36) continue;
  px(x, 14, '~', WATER);
}

console.log(cells.map((c) => JSON.stringify(c)).join(','));
