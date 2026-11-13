/** Pure bingo rules. No I/O. */
import { randomInt } from '../util/crypto.js';

export const ALL_NUMBERS = Array.from({ length: 75 }, (_, i) => i + 1);
export const LETTERS = ['B', 'I', 'N', 'G', 'O'];

export function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 5x5 grid: column c holds 5 unique numbers from 15c+1..15c+15; the center is FREE (null). */
export function generateGrid() {
  const columns = Array.from({ length: 5 }, (_, c) =>
    shuffle(Array.from({ length: 15 }, (_, i) => c * 15 + i + 1)).slice(0, 5),
  );
  const grid = Array.from({ length: 5 }, (_, r) => columns.map((col) => col[r]));
  grid[2][2] = null;
  return grid;
}

const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newCardCode() {
  let id = 'BG-';
  for (let i = 0; i < 6; i++) id += ID_CHARS[randomInt(ID_CHARS.length)];
  return id;
}

export function isValidGrid(grid) {
  if (!Array.isArray(grid) || grid.length !== 5) return false;
  const seen = new Set();
  for (let r = 0; r < 5; r++) {
    const row = grid[r];
    if (!Array.isArray(row) || row.length !== 5) return false;
    for (let c = 0; c < 5; c++) {
      const v = row[c];
      if (r === 2 && c === 2) {
        if (v !== null) return false;
        continue;
      }
      if (!Number.isInteger(v) || v < c * 15 + 1 || v > c * 15 + 15 || seen.has(v)) return false;
      seen.add(v);
    }
  }
  return true;
}

export const LINES = (() => {
  const out = [];
  for (let i = 0; i < 5; i++) {
    out.push(Array.from({ length: 5 }, (_, c) => [i, c]));
    out.push(Array.from({ length: 5 }, (_, r) => [r, i]));
  }
  out.push(Array.from({ length: 5 }, (_, i) => [i, i]));
  out.push(Array.from({ length: 5 }, (_, i) => [i, 4 - i]));
  return out;
})();

/** First complete line (FREE or called cells only), or null. */
export function findWinningLine(grid, called) {
  for (const line of LINES) {
    if (line.every(([r, c]) => grid[r][c] === null || called.has(grid[r][c]))) return line;
  }
  return null;
}
