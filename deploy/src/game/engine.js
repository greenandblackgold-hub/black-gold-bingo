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
  three_lines: 'Three lines', four_lines: 'Four lines', top_bottom: 'Top and bottom rows',
  left_right: 'Left and right columns', checkerboard: 'Checkerboard', center_cross: 'Center cross',
  coverall: 'Coverall / blackout',
  line_through_free: 'Line through FREE', line_avoiding_free: 'Line avoiding FREE',
  two_lines_through_free: 'Two lines through FREE', two_lines_avoiding_free: 'Two lines avoiding FREE',
  two_rectangles_touching: 'Two touching rectangles', two_rectangles_separate: 'Two separate rectangles',
  inner_frame: 'Inner frame', inner_square: 'Inner 3×3 square', four_postage_stamps: 'Four postage stamps',
  z: 'Z shape', u: 'U shape', s: 'S shape', arrow_up: 'Up arrow', arrow_down: 'Down arrow',
  star: 'Star', cross_and_corners: 'Cross and four corners', frame_and_center: 'Frame and center', double_cross: 'Double cross',
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
const combos = (arr,n) => {
  const out = [];
  const choose = (start, picked) => {
    if (picked.length === n) { out.push(picked); return; }
    for (let i = start; i <= arr.length - (n - picked.length); i++) choose(i + 1, [...picked, arr[i]]);
  };
  choose(0, []);
  return out;
};
const allLines = [...rows,...cols,d1,d2];
const rectangles = [];
for(let r=0;r<4;r++) for(let c=0;c<4;c++) rectangles.push([pos(r,c),pos(r,c+1),pos(r+1,c),pos(r+1,c+1)]);
const sixPacks = [];
const ninePacks = [];
for(let r=0;r<3;r++) for(let c=0;c<3;c++) ninePacks.push(Array.from({length:3},(_,dr)=>Array.from({length:3},(_,dc)=>pos(r+dr,c+dc))).flat());
for(let r=0;r<4;r++) for(let c=0;c<3;c++) sixPacks.push(Array.from({length:2},(_,dr)=>Array.from({length:3},(_,dc)=>pos(r+dr,c+dc))).flat());
for(let r=0;r<3;r++) for(let c=0;c<4;c++) sixPacks.push(Array.from({length:3},(_,dr)=>Array.from({length:2},(_,dc)=>pos(r+dr,c+dc))).flat());
const nonFree = Array.from({length:25},(_,i)=>pos(Math.floor(i/5),i%5)).filter(([r,c])=>r!==2||c!==2);
const centerLines = [rows[2], cols[2], d1, d2];
const noFreeLines = [...rows.filter((_,i)=>i!==2), ...cols.filter((_,i)=>i!==2)];
const postageStamps = [[pos(0,0),pos(0,1),pos(1,0),pos(1,1)],[pos(0,3),pos(0,4),pos(1,3),pos(1,4)],[pos(3,0),pos(3,1),pos(4,0),pos(4,1)],[pos(3,3),pos(3,4),pos(4,3),pos(4,4)]];
const rectanglePairs = combos(rectangles,2).filter(([a,b]) => {
  const overlaps = a.some(([r,c])=>b.some(([rr,cc])=>r===rr&&c===cc));
  return !overlaps;
});
const edgeAdjacent = (a,b) => a.some(([r,c])=>b.some(([rr,cc])=>Math.abs(r-rr)+Math.abs(c-cc)===1));
const touchingRectanglePairs = rectanglePairs.filter(([a,b])=>edgeAdjacent(a,b));
const separateRectanglePairs = rectanglePairs.filter(([a,b])=>!edgeAdjacent(a,b));
const innerFrame = Array.from({length:9},(_,i)=>pos(Math.floor(i/3)+1,i%3+1)).filter(([r,c])=>r===1||r===3||c===1||c===3);
const innerSquare = Array.from({length:9},(_,i)=>pos(Math.floor(i/3)+1,i%3+1));
const allCells = Array.from({length:25},(_,i)=>pos(Math.floor(i/5),i%5));

export function patternMasks(pattern='any_line') {
  switch(pattern) {
    case 'horizontal_line': return rows;
    case 'vertical_line': return cols;
    case 'diagonal': return [d1,d2];
    case 'two_lines': return combos(allLines,2).map(g=>combine(...g));
    case 'two_horizontal_lines': return combos(rows,2).map(g=>combine(...g));
    case 'three_lines': return combos(allLines,3).map(g=>combine(...g));
    case 'four_lines': return combos(allLines,4).map(g=>combine(...g));
    case 'top_bottom': return [combine(rows[0],rows[4])];
    case 'left_right': return [combine(cols[0],cols[4])];
    case 'checkerboard': return [Array.from({length:25},(_,i)=>pos(Math.floor(i/5),i%5)).filter(([r,c])=>(r+c)%2===0)];
    case 'center_cross': return [combine(rows[2],cols[2])];
    case 'four_corners': return [corners];
    case 'rectangle': return rectangles;
    case 'postage_stamp': return [[pos(0,0),pos(0,1),pos(1,0),pos(1,1)],[pos(0,3),pos(0,4),pos(1,3),pos(1,4)],[pos(3,0),pos(3,1),pos(4,0),pos(4,1)],[pos(3,3),pos(3,4),pos(4,3),pos(4,4)]];
    case 'two_rectangles': return combos(rectangles,2).map(g=>combine(...g));
    case 'full_house': case 'coverall': return [nonFree];
    case 'half_house': return [nonFree.slice(0,12)];
    case 'x': return [combine(d1,d2)];
    case 't': return [combine(rows[0],cols[2])];
    case 'l': return [combine(cols[0],rows[4])];
    case 'plus': return [combine(rows[2],cols[2])];
    case 'diamond': return [[pos(0,2),pos(1,1),pos(1,3),pos(2,0),pos(2,4),pos(3,1),pos(3,3),pos(4,2)]];
    case 'picture_frame': return [frame];
    case 'six_pack': return sixPacks;
    case 'line_through_free': return centerLines;
    case 'line_avoiding_free': return noFreeLines;
    case 'two_lines_through_free': return combos(centerLines,2).map(g=>combine(...g));
    case 'two_lines_avoiding_free': return combos(noFreeLines,2).map(g=>combine(...g));
    case 'two_rectangles_touching': return touchingRectanglePairs.map(g=>combine(...g));
    case 'two_rectangles_separate': return separateRectanglePairs.map(g=>combine(...g));
    case 'inner_frame': return [innerFrame];
    case 'inner_square': return [innerSquare];
    case 'four_postage_stamps': return [combine(...postageStamps)];
    case 'z': return [combine(rows[0], d2, rows[4])];
    case 'u': return [combine(cols[0], cols[4], rows[4])];
    case 's': return [[...rows[0].slice(0,4),pos(1,0),...rows[2].slice(0,4),pos(3,3),...rows[4].slice(0,4)]];
    case 'arrow_up': return [[pos(0,2),pos(1,1),pos(1,2),pos(1,3),pos(2,2),pos(3,2),pos(4,2)]];
    case 'arrow_down': return [[pos(0,2),pos(1,2),pos(2,2),pos(3,1),pos(3,2),pos(3,3),pos(4,2)]];
    case 'star': return [[pos(0,2),pos(1,1),pos(1,3),pos(2,0),pos(2,2),pos(2,4),pos(3,1),pos(3,3),pos(4,2)]];
    case 'cross_and_corners': return [combine(rows[2],cols[2],corners)];
    case 'frame_and_center': return [combine(frame,[pos(2,2)])];
    case 'double_cross': return [combine(rows[2],cols[2],d1,d2)];
    case 'nine_pack': return ninePacks;
    case 'filled_diamond': return [[pos(0,2),pos(1,1),pos(1,2),pos(1,3),pos(2,0),pos(2,1),pos(2,2),pos(2,3),pos(2,4),pos(3,1),pos(3,2),pos(3,3),pos(4,2)]];
    case 'window_pane': return [combine(frame,rows[2],cols[2])];
    case 'staircase': return [[pos(0,0),pos(1,0),pos(1,1),pos(2,1),pos(2,2),pos(3,2),pos(3,3),pos(4,3),pos(4,4)]];
    case 'hourglass': return [combine(rows[0],rows[4],d1,d2)];
    case 'bow_tie': return [[pos(0,0),pos(0,4),pos(1,1),pos(1,3),...rows[2],pos(3,1),pos(3,3),pos(4,0),pos(4,4)]];
    case 'ladder': return [combine(cols[0],cols[4],rows[1],rows[3])];
    case 'railroad_tracks': return [combine(cols[1],cols[3],rows[0],rows[2],rows[4])];
    case 'lucky_seven': return [combine(rows[0],d2)];
    case 'letter_h': return [combine(cols[0],cols[4],rows[2])];
    case 'letter_e': return [combine(cols[0],rows[0],rows[2],rows[4])];
    case 'letter_c': return [combine(cols[0],rows[0],rows[4])];
    case 'letter_n': return [combine(cols[0],cols[4],d1)];
    case 'letter_w': return [combine(cols[0],cols[4],[pos(3,1),pos(4,2),pos(3,3)])];
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
