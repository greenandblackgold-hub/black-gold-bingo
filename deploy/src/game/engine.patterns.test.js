import test from 'node:test';
import assert from 'node:assert/strict';
import { findWinningPattern, isWinPattern } from './engine.js';

const grid = [
  [1,16,31,46,61],
  [2,17,32,47,62],
  [3,18,null,48,63],
  [4,19,34,49,64],
  [5,20,35,50,65],
];
const nums = (positions) => new Set(positions.map(([r,c]) => grid[r][c]).filter(Number.isInteger));

test('supports the requested pattern catalogue', () => {
  for (const id of ['any_line','horizontal_line','vertical_line','diagonal','two_lines','two_horizontal_lines','four_corners','rectangle','two_rectangles','half_house','full_house','x','t','l','plus','diamond','picture_frame','six_pack','postage_stamp','three_lines','four_lines','top_bottom','left_right','checkerboard','center_cross','coverall','line_through_free','line_avoiding_free','two_lines_through_free','two_lines_avoiding_free','two_rectangles_touching','two_rectangles_separate','inner_frame','inner_square','four_postage_stamps','z','u','s','arrow_up','arrow_down','star','cross_and_corners','frame_and_center','double_cross']) {
    assert.equal(isWinPattern(id), true, id);
  }
  assert.equal(isWinPattern('unknown'), false);
});

test('one horizontal line and diagonal are checked independently', () => {
  assert.equal(findWinningPattern(grid, nums([[0,0],[0,1],[0,2],[0,3],[0,4]]), 'horizontal_line').missing, 0);
  assert.equal(findWinningPattern(grid, nums([[0,0],[1,1],[3,3],[4,4]]), 'diagonal').missing, 0);
});

test('two horizontal lines require two complete rows', () => {
  const called = nums([[0,0],[0,1],[0,2],[0,3],[0,4],[4,0],[4,1],[4,2],[4,3],[4,4]]);
  assert.equal(findWinningPattern(grid, called, 'two_horizontal_lines').missing, 0);
  assert.ok(findWinningPattern(grid, nums([[0,0],[0,1],[0,2],[0,3],[0,4]]), 'two_horizontal_lines').missing > 0);
});

test('full house requires all 24 numbered cells; half house requires 12', () => {
  const all = nums(Array.from({length:25},(_,i)=>[Math.floor(i/5),i%5]).filter(([r,c])=>r!==2||c!==2));
  assert.equal(findWinningPattern(grid, all, 'full_house').missing, 0);
  const half = new Set([...all].slice(0,12));
  assert.equal(findWinningPattern(grid, half, 'half_house').missing, 0);
  assert.ok(findWinningPattern(grid, half, 'full_house').missing > 0);
});

test('a 2x2 rectangle and postage stamp are recognized', () => {
  const topLeft = nums([[0,0],[0,1],[1,0],[1,1]]);
  assert.equal(findWinningPattern(grid, topLeft, 'rectangle').missing, 0);
  assert.equal(findWinningPattern(grid, topLeft, 'postage_stamp').missing, 0);
});

test('additional line, edge and coverage patterns are recognized', () => {
  const all = nums(Array.from({length:25},(_,i)=>[Math.floor(i/5),i%5]).filter(([r,c])=>r!==2||c!==2));
  assert.equal(findWinningPattern(grid, all, 'coverall').missing, 0);
  assert.equal(findWinningPattern(grid, all, 'checkerboard').missing, 0);
  assert.equal(findWinningPattern(grid, all, 'center_cross').missing, 0);
  assert.equal(findWinningPattern(grid, all, 'three_lines').missing, 0);
  assert.equal(findWinningPattern(grid, all, 'four_lines').missing, 0);
});


test('FREE-aware line patterns distinguish lines through and away from the center', () => {
  const through = nums([[2,0],[2,1],[2,3],[2,4]]);
  const away = nums([[0,0],[0,1],[0,2],[0,3],[0,4]]);
  assert.equal(findWinningPattern(grid, through, 'line_through_free').missing, 0);
  assert.ok(findWinningPattern(grid, through, 'line_avoiding_free').missing > 0);
  assert.equal(findWinningPattern(grid, away, 'line_avoiding_free').missing, 0);
  assert.ok(findWinningPattern(grid, away, 'line_through_free').missing > 0);
});

test('two rectangle variants require disjoint blocks with the requested relationship', () => {
  const touching = nums([[0,0],[0,1],[1,0],[1,1],[0,2],[0,3],[1,2],[1,3]]);
  const separate = nums([[0,0],[0,1],[1,0],[1,1],[3,3],[3,4],[4,3],[4,4]]);
  assert.equal(findWinningPattern(grid, touching, 'two_rectangles_touching').missing, 0);
  assert.ok(findWinningPattern(grid, touching, 'two_rectangles_separate').missing > 0);
  assert.equal(findWinningPattern(grid, separate, 'two_rectangles_separate').missing, 0);
});

test('complex shape catalogue exposes non-empty masks', () => {
  for (const id of ['inner_frame','inner_square','four_postage_stamps','z','u','s','arrow_up','arrow_down','star','cross_and_corners','frame_and_center','double_cross']) {
    assert.ok(findWinningPattern(grid, new Set(), id).missing > 0, id);
  }
});
