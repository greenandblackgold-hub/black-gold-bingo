/** Pure bingo rules. No I/O. */
import { randomInt } from '../util/crypto.js';
export const ALL_NUMBERS = Array.from({ length: 75 }, (_, i) => i + 1);
export const LETTERS = ['B', 'I', 'N', 'G', 'O'];
export const WIN_PATTERNS = {
  any_line: 'Any line', horizontal_line: 'Horizontal line', vertical_line: 'Vertical line',
  diagonal: 'Diagonal', two_lines: 'Two lines', two_horizontal_lines: 'Two horizontal lines',
  four_corners: 'Four corners', rectangle: '2×2 rectangle', two_rectangles: 'Two rectangles',
  half_house: 'Half house (12 numbers)', full_house: 'Full house / blackout',
  x: 'X shape', t: 'T shape', l: 'L shape', plus: 'Plus sign', diamond: 'Diamond',
  picture_frame: 'Picture frame', six_pack: 'Six-pack (2×3 rectangle)', postage_stamp: 'Postage stamp',
};
export function isWinPattern(value) { return Object.hasOwn(WIN_PATTERNS, value); }
export function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function generateGrid() {
  const columns = Array.from({ length: 5 }, (_, c) => shuffle(Array.from({ length: 15 }, (_, i) => c * 15 + i + 1)).slice(0, 5));
  const grid = Array.from({ length: 5 }, (_, r) => columns.map((col) => col[r]));
  grid[2][2] = null; return grid;
}
const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newCardCode() { let id = 'BG-'; for (let i = 0; i < 6; i++) id += ID_CHARS[randomInt(ID_CHARS.length)]; return id; }
export function isValidGrid(grid) {
  if (!Array.isArray(grid) || grid.length !== 5) return false;
  const seen = new Set();
  for (let r = 0; r < 5; r++) {
    if (!Array.isArray(grid[r]) || grid[r].length !== 5) return false;
    for (let c = 0; c < 5; c++) {
      const v = grid[r][c];
      if (r === 2 && c === 2) { if (v !== null) return false; continue; }
      if (!Number.isInteger(v) || v < c * 15 + 1 || v > c * 15 + 15 || seen.has(v)) return false;
      seen.add(v);
    }
  }
  return true;
}
const pos = (r,c) => [r,c];
const rows = Array.from({length:5},(_,r)=>Array.from({length:5},(_,c)=>pos(r,c)));
const cols = Array.from({length:5},(_,c)=>Array.from({length:5},(_,r)=>pos(r,c)));
const d1 = Array.from({length:5},(_,i)=>pos(i,i));
const d2 = Array.from({length:5},(_,i)=>pos(i,4-i));
const corners = [pos(0,0),pos(0,4),pos(4,0),pos(4,4)];
const frame = Array.from({length:25},(_,i)=>pos(Math.floor(i/5),i%5)).filter(([r,c])=>r===0||r===4||c===0||c===4);
const combine = (...groups) => groups.flat().filter(([r,c],i,a)=>a.findIndex(([x,y])=>x===r&&y===c)===i);
const combos = (arr,n) => arr.flatMap((v,i)=>i+n<=arr.length? [arr.slice(i,i+n)]:[]);
const allLines = [...rows,...cols,d1,d2];
const rectangles = [];
for(let r=0;r<4;r++) for(let c=0;c<4;c++) rectangles.push([pos(r,c),pos(r,c+1),pos(r+1,c),pos(r+1,c+1)]);
const sixPacks = [];
for(let r=0;r<5;r++) for(let c=0;c<4;c++) sixPacks.push(Array.from({length:2},(_,dr)=>Array.from({length:3},(_,dc)=>pos(r+dr,c+dc))).flat());
for(let r=0;r<4;r++) for(let c=0;c<5;c++) sixPacks.push(Array.from({length:3},(_,dr)=>Array.from({length:2},(_,dc)=>pos(r+dr,c+dc))).flat());
const nonFree = Array.from({length:25},(_,i)=>pos(Math.floor(i/5),i%5)).filter(([r,c])=>r!==2||c!==2);
export function patternMasks(pattern='any_line') {
  switch(pattern) {
    case 'horizontal_line': return rows;
    case 'vertical_line': return cols;
    case 'diagonal': return [d1,d2];
    case 'two_lines': return combos(allLines,2).map(g=>combine(...g));
    case 'two_horizontal_lines': return combos(rows,2).map(g=>combine(...g));
    case 'four_corners': return [corners];
    case 'rectangle': case 'postage_stamp': return rectangles;
    case 'two_rectangles': return combos(rectangles,2).map(g=>combine(...g));
    case 'full_house': return [nonFree];
    case 'x': return [combine(d1,d2)];
    case 't': return [combine(rows[0],cols[2])];
    case 'l': return [combine(cols[0],rows[4])];
    case 'plus': return [combine(rows[2],cols[2])];
    case 'diamond': return [[pos(0,2),pos(1,1),pos(1,3),pos(2,0),pos(2,4),pos(3,1),pos(3,3),pos(4,2)]];
    case 'picture_frame': return [frame];
    case 'six_pack': return sixPacks;
    default: return allLines;
  }
}
export function findWinningPattern(grid, called, pattern='any_line') {
  if (pattern === 'half_house') {
    const marked = nonFree.filter(([r,c])=>called.has(grid[r][c]));
    const missing = Math.max(0,12-marked.length);
    return missing===0 ? {positions:marked,missing:0} : {positions:[],missing};
  }
  const masks=patternMasks(pattern);
  let best=null, bestMissing=Infinity;
  for(const mask of masks) {
    const missing=mask.filter(([r,c])=>grid[r][c]!==null&&!called.has(grid[r][c])).length;
    if(missing<bestMissing){bestMissing=missing;best=mask;}
    if(missing===0)return {positions:mask,missing:0};
  }
  return {positions:best??[],missing:bestMissing};
}
export const LINES = allLines;
export function findWinningLine(grid, called) {
  const result=findWinningPattern(grid,called,'any_line');
  return result.missing===0?result.positions:null;
}
