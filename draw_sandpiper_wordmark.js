// draw_sandpiper_wordmark.js — 50×9 canvas
// Chunky block-letter "SANDPIPER" with drop shadow depth effect.
// Shadow drawn first (offset +1x, +1y), main letters on top.

const cells = [];
const MAIN   = "#FF8844";   // warm orange (matches bird beak/legs)
const SHADOW = "#773311";   // dark brown shadow

// Letter bitmaps — 5 rows each, '1' = filled cell
const letters = {
  S: ['1111','1000','1111','0001','1111'],
  A: ['0110','1001','1111','1001','1001'],
  N: ['1001','1101','1011','1001','1001'],
  D: ['1110','1001','1001','1001','1110'],
  P: ['1111','1001','1111','1000','1000'],
  I: ['111','010','010','010','111'],
  E: ['1111','1000','1110','1000','1111'],
  R: ['1111','1001','1111','1010','1001'],
};

const word = 'SANDPIPER';
let cx = 1; // starting x position

for (const ch of word) {
  const bmp = letters[ch];
  const w = bmp[0].length;

  // Shadow layer (offset +1x, +1y) — drawn first so main layer covers overlap
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < w; c++) {
      if (bmp[r][c] === '1') {
        cells.push({ x: cx + c + 1, y: r + 2, char: '█', color: SHADOW });
      }
    }
  }

  // Main letter layer
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < w; c++) {
      if (bmp[r][c] === '1') {
        cells.push({ x: cx + c, y: r + 1, char: '█', color: MAIN });
      }
    }
  }

  cx += w + 1; // advance by letter width + 1 gap
}

console.log(cells.map(c => JSON.stringify(c)).join(","));
