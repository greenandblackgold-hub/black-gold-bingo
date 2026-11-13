import test from 'node:test';
import assert from 'node:assert/strict';
import { generateGrid, isValidGrid, findWinningLine, newCardCode } from '../src/game/engine.js';
import { loadConfig } from '../src/config.js';
import { normalizePhone } from '../src/services/authService.js';

test('generated cards are always valid and use the right column ranges', () => {
  for (let i = 0; i < 300; i++) assert.ok(isValidGrid(generateGrid()));
});

test('isValidGrid rejects forged grids', () => {
  const g = generateGrid();
  const bad1 = structuredClone(g); bad1[0][0] = 99;           // wrong column range
  const bad2 = structuredClone(g); bad2[2][2] = 5;            // center must be FREE
  const bad3 = structuredClone(g); bad3[1][0] = bad3[0][0];   // duplicate number
  const bad4 = g.slice(0, 4);                                  // wrong size
  for (const b of [bad1, bad2, bad3, bad4, null, 'x']) assert.equal(isValidGrid(b), false);
});

test('findWinningLine detects rows, columns and both diagonals, and ignores partial lines', () => {
  const g = generateGrid();
  assert.equal(findWinningLine(g, new Set()), null);
  const row = new Set(g[0]);
  assert.ok(findWinningLine(g, row));
  const col = new Set(g.map((r) => r[4]));
  assert.ok(findWinningLine(g, col));
  const diag = new Set([g[0][0], g[1][1], g[3][3], g[4][4]]); // center is free
  assert.ok(findWinningLine(g, diag));
  const anti = new Set([g[0][4], g[1][3], g[3][1], g[4][0]]);
  assert.ok(findWinningLine(g, anti));
  const almost = new Set(g[0].slice(0, 4));
  assert.equal(findWinningLine(g, almost), null);
});

test('card codes look like BG-XXXXXX', () => {
  for (let i = 0; i < 50; i++) assert.match(newCardCode(), /^BG-[A-HJ-NP-Z2-9]{6}$/);
});

test('phone numbers normalize to the local 09/07 form', () => {
  for (const p of ['0911223344', '+251911223344', '251911223344', '09 11-22 33 44', '911223344']) assert.equal(normalizePhone(p), '0911223344');
  assert.equal(normalizePhone('0711223344'), '0711223344');
  for (const p of ['', '12345', '0811223344', 'abc', null]) assert.equal(normalizePhone(p), null);
});

test('production config refuses unsafe settings', () => {
  assert.throws(() => loadConfig({ NODE_ENV: 'production' }), /JWT_SECRET/);
  assert.throws(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), STORAGE: 'memory' }), /STORAGE=mongo/);
  assert.throws(
    () => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), MONGODB_URI: 'mongodb://x', CHAPA_MOCK: 'true', CHAPA_SECRET_KEY: 'k' }),
    /CHAPA_MOCK/,
  );
  const ok = loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), MONGODB_URI: 'mongodb://x', CHAPA_SECRET_KEY: 'k' });
  assert.equal(ok.storage, 'mongo');
  assert.equal(ok.cardPrice, 1000);
});
