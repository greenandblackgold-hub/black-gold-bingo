/**
 * src/lib/bingo.ts
 *
 * Pure bingo helpers: random numbers, card generation, line detection.
 */
import type { Pos } from '@/types/game';

export const LETTERS = ['B', 'I', 'N', 'G', 'O'] as const;
export const ALL_NUMBERS: number[] = Array.from({ length: 75 }, (_, i) => i + 1);

export const letterFor = (n: number) => LETTERS[Math.min(4, Math.floor((n - 1) / 15))];

/** Unbiased random integer in [0, max) using the Web Crypto API. */
export function randomInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 5x5 grid: column c holds 5 unique numbers from 15c+1..15c+15; center is FREE (null). */
export function generateGrid(): (number | null)[][] {
  const columns = Array.from({ length: 5 }, (_, c) =>
    shuffle(Array.from({ length: 15 }, (_, i) => c * 15 + i + 1)).slice(0, 5),
  );
  const grid: (number | null)[][] = Array.from({ length: 5 }, (_, r) => columns.map((col) => col[r]));
  grid[2][2] = null;
  return grid;
}

const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newCardId(): string {
  let id = 'BG-';
  for (let i = 0; i < 6; i++) id += ID_CHARS[randomInt(ID_CHARS.length)];
  return id;
}

export const BINGO_LINES: Pos[][] = (() => {
  const out: Pos[][] = [];
  for (let i = 0; i < 5; i++) {
    out.push(Array.from({ length: 5 }, (_, c) => [i, c] as Pos));
    out.push(Array.from({ length: 5 }, (_, r) => [r, i] as Pos));
  }
  out.push(Array.from({ length: 5 }, (_, i) => [i, i] as Pos));
  out.push(Array.from({ length: 5 }, (_, i) => [i, 4 - i] as Pos));
  return out;
})();

/** First line whose cells are all FREE or called, or null. */
export function findWinningLine(grid: (number | null)[][], called: Set<number>): Pos[] | null {
  for (const line of BINGO_LINES) {
    const complete = line.every(([r, c]) => {
      const v = grid[r][c];
      return v === null || called.has(v);
    });
    if (complete) return line;
  }
  return null;
}

/** Structural check for a grid received from another device (never trust it blindly). */
export function isValidGrid(grid: unknown): grid is (number | null)[][] {
  if (!Array.isArray(grid) || grid.length !== 5) return false;
  const seen = new Set<number>();
  for (let r = 0; r < 5; r++) {
    const row: unknown = grid[r];
    if (!Array.isArray(row) || row.length !== 5) return false;
    for (let c = 0; c < 5; c++) {
      const v: unknown = row[c];
      if (r === 2 && c === 2) {
        if (v !== null) return false;
        continue;
      }
      if (typeof v !== 'number' || !Number.isInteger(v) || v < c * 15 + 1 || v > c * 15 + 15 || seen.has(v)) return false;
      seen.add(v);
    }
  }
  return true;
}
