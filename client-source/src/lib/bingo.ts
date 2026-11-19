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


export type WinPattern = import('@/types/game').WinPattern;
const p=(r:number,c:number):Pos=>[r,c];
const ROWS=Array.from({length:5},(_,r)=>Array.from({length:5},(_,c)=>p(r,c)));
const COLS=Array.from({length:5},(_,c)=>Array.from({length:5},(_,r)=>p(r,c)));
const D1=Array.from({length:5},(_,i)=>p(i,i)), D2=Array.from({length:5},(_,i)=>p(i,4-i));
const ALL_LINES=[...ROWS,...COLS,D1,D2];
const unique=(groups:Pos[][]):Pos[]=>groups.flat().filter(([r,c],i,a)=>a.findIndex(([x,y])=>x===r&&y===c)===i);
const combinations=(items:Pos[][],n:number):Pos[][][]=>{
 const out:Pos[][][]=[];
 const choose=(start:number,picked:Pos[][])=>{
  if(picked.length===n){out.push(picked);return;}
  for(let i=start;i<=items.length-(n-picked.length);i++)choose(i+1,[...picked,items[i]]);
 };
 choose(0,[]);return out;
};
const BLOCKS:Pos[][]=[];
for(let r=0;r<4;r++)for(let c=0;c<4;c++)BLOCKS.push([p(r,c),p(r,c+1),p(r+1,c),p(r+1,c+1)]);
const SIX:Pos[][]=[];
const NINE:Pos[][]=[];
for(let r=0;r<3;r++)for(let c=0;c<3;c++)NINE.push(Array.from({length:3},(_,dr)=>Array.from({length:3},(_,dc)=>p(r+dr,c+dc))).flat());
for(let r=0;r<4;r++)for(let c=0;c<3;c++)SIX.push(Array.from({length:2},(_,dr)=>Array.from({length:3},(_,dc)=>p(r+dr,c+dc))).flat());
for(let r=0;r<3;r++)for(let c=0;c<4;c++)SIX.push(Array.from({length:3},(_,dr)=>Array.from({length:2},(_,dc)=>p(r+dr,c+dc))).flat());
const NON_FREE=Array.from({length:25},(_,i)=>p(Math.floor(i/5),i%5)).filter(([r,c])=>r!==2||c!==2);
const CENTER_LINES=[ROWS[2],COLS[2],D1,D2];
const NO_FREE_LINES=[...ROWS.filter((_,i)=>i!==2),...COLS.filter((_,i)=>i!==2)];
const POSTAGE=[[p(0,0),p(0,1),p(1,0),p(1,1)],[p(0,3),p(0,4),p(1,3),p(1,4)],[p(3,0),p(3,1),p(4,0),p(4,1)],[p(3,3),p(3,4),p(4,3),p(4,4)]];
const RECTANGLE_PAIRS=combinations(BLOCKS,2).filter(([a,b])=>!a.some(([r,c])=>b.some(([rr,cc])=>r===rr&&c===cc)));
const edgeAdjacent=(a:Pos[],b:Pos[])=>a.some(([r,c])=>b.some(([rr,cc])=>Math.abs(r-rr)+Math.abs(c-cc)===1));
const TOUCHING_RECTANGLES=RECTANGLE_PAIRS.filter(([a,b])=>edgeAdjacent(a,b));
const SEPARATE_RECTANGLES=RECTANGLE_PAIRS.filter(([a,b])=>!edgeAdjacent(a,b));
const INNER_FRAME=Array.from({length:9},(_,i)=>p(Math.floor(i/3)+1,i%3+1)).filter(([r,c])=>r===1||r===3||c===1||c===3);
const INNER_SQUARE=Array.from({length:9},(_,i)=>p(Math.floor(i/3)+1,i%3+1));
export function patternMasks(pattern:WinPattern='any_line'):Pos[][] {
 switch(pattern){
  case 'horizontal_line':return ROWS;
  case 'vertical_line':return COLS;
  case 'diagonal':return [D1,D2];
  case 'two_lines':return combinations(ALL_LINES,2).map(unique);
  case 'two_horizontal_lines':return combinations(ROWS,2).map(unique);
  case 'three_lines':return combinations(ALL_LINES,3).map(unique);
  case 'four_lines':return combinations(ALL_LINES,4).map(unique);
  case 'top_bottom':return [unique([ROWS[0],ROWS[4]])];
  case 'left_right':return [unique([COLS[0],COLS[4]])];
  case 'checkerboard':return [Array.from({length:25},(_,i)=>p(Math.floor(i/5),i%5)).filter(([r,c])=>(r+c)%2===0)];
  case 'center_cross':return [unique([ROWS[2],COLS[2]])];
  case 'four_corners':return [[p(0,0),p(0,4),p(4,0),p(4,4)]];
  case 'rectangle':return BLOCKS;
  case 'postage_stamp':return [[p(0,0),p(0,1),p(1,0),p(1,1)],[p(0,3),p(0,4),p(1,3),p(1,4)],[p(3,0),p(3,1),p(4,0),p(4,1)],[p(3,3),p(3,4),p(4,3),p(4,4)]];
  case 'two_rectangles':return combinations(BLOCKS,2).map(unique);
  case 'full_house':case 'coverall':return [NON_FREE];
  case 'x':return [unique([D1,D2])];
  case 't':return [unique([ROWS[0],COLS[2]])];
  case 'l':return [unique([COLS[0],ROWS[4]])];
  case 'plus':return [unique([ROWS[2],COLS[2]])];
  case 'diamond':return [[p(0,2),p(1,1),p(1,3),p(2,0),p(2,4),p(3,1),p(3,3),p(4,2)]];
  case 'picture_frame':return [Array.from({length:25},(_,i)=>p(Math.floor(i/5),i%5)).filter(([r,c])=>r===0||r===4||c===0||c===4)];
  case 'six_pack':return SIX;
  case 'half_house':return [NON_FREE.slice(0,12)];
  case 'line_through_free':return CENTER_LINES;
  case 'line_avoiding_free':return NO_FREE_LINES;
  case 'two_lines_through_free':return combinations(CENTER_LINES,2).map(unique);
  case 'two_lines_avoiding_free':return combinations(NO_FREE_LINES,2).map(unique);
  case 'two_rectangles_touching':return TOUCHING_RECTANGLES.map(unique);
  case 'two_rectangles_separate':return SEPARATE_RECTANGLES.map(unique);
  case 'inner_frame':return [INNER_FRAME];
  case 'inner_square':return [INNER_SQUARE];
  case 'four_postage_stamps':return [unique(POSTAGE)];
  case 'z':return [unique([ROWS[0],D2,ROWS[4]])];
  case 'u':return [unique([COLS[0],COLS[4],ROWS[4]])];
  case 's':return [[...ROWS[0].slice(0,4),p(1,0),...ROWS[2].slice(0,4),p(3,3),...ROWS[4].slice(0,4)]];
  case 'arrow_up':return [[p(0,2),p(1,1),p(1,2),p(1,3),p(2,2),p(3,2),p(4,2)]];
  case 'arrow_down':return [[p(0,2),p(1,2),p(2,2),p(3,1),p(3,2),p(3,3),p(4,2)]];
  case 'star':return [[p(0,2),p(1,1),p(1,3),p(2,0),p(2,2),p(2,4),p(3,1),p(3,3),p(4,2)]];
  case 'cross_and_corners':return [unique([ROWS[2],COLS[2],[p(0,0),p(0,4),p(4,0),p(4,4)]])];
  case 'frame_and_center':return [unique([Array.from({length:25},(_,i)=>p(Math.floor(i/5),i%5)).filter(([r,c])=>r===0||r===4||c===0||c===4),[p(2,2)]])];
  case 'double_cross':return [unique([ROWS[2],COLS[2],D1,D2])];
  case 'nine_pack':return NINE;
  case 'filled_diamond':return [[p(0,2),p(1,1),p(1,2),p(1,3),p(2,0),p(2,1),p(2,2),p(2,3),p(2,4),p(3,1),p(3,2),p(3,3),p(4,2)]];
  case 'window_pane':return [unique([Array.from({length:25},(_,i)=>p(Math.floor(i/5),i%5)).filter(([r,c])=>r===0||r===4||c===0||c===4),ROWS[2],COLS[2]])];
  case 'staircase':return [[p(0,0),p(1,0),p(1,1),p(2,1),p(2,2),p(3,2),p(3,3),p(4,3),p(4,4)]];
  case 'hourglass':return [unique([ROWS[0],ROWS[4],D1,D2])];
  case 'bow_tie':return [[p(0,0),p(0,4),p(1,1),p(1,3),...ROWS[2],p(3,1),p(3,3),p(4,0),p(4,4)]];
  case 'ladder':return [unique([COLS[0],COLS[4],ROWS[1],ROWS[3]])];
  case 'railroad_tracks':return [unique([COLS[1],COLS[3],ROWS[0],ROWS[2],ROWS[4]])];
  case 'lucky_seven':return [unique([ROWS[0],D2])];
  case 'letter_h':return [unique([COLS[0],COLS[4],ROWS[2]])];
  case 'letter_e':return [unique([COLS[0],ROWS[0],ROWS[2],ROWS[4]])];
  case 'letter_c':return [unique([COLS[0],ROWS[0],ROWS[4]])];
  case 'letter_n':return [unique([COLS[0],COLS[4],D1])];
  case 'letter_w':return [unique([COLS[0],COLS[4],[p(3,1),p(4,2),p(3,3)]])];
  default:return ALL_LINES;
 }
}
export function findWinningPattern(grid:(number|null)[][],called:Set<number>,pattern:WinPattern='any_line'):{positions:Pos[];missing:number}{
 if(pattern==='half_house'){const marked=NON_FREE.filter(([r,c])=>called.has(grid[r][c] as number));return {positions:marked,missing:Math.max(0,12-marked.length)};}
 let best:Pos[]=[];let min=Infinity;
 for(const mask of patternMasks(pattern)){const missing=mask.filter(([r,c])=>grid[r][c]!==null&&!called.has(grid[r][c] as number)).length;if(missing<min){min=missing;best=mask;}if(missing===0)return {positions:mask,missing:0};}
 return {positions:best,missing:min};
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
