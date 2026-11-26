import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../client-source/src/components/games/CarRacing3D.tsx', import.meta.url), 'utf8');

test('Car Racing displays a visible WebGL-unavailable fallback with a retry action', () => {
  assert.match(source, /setRendererStatus\('unavailable'\)/);
  assert.match(source, /rendererStatus!=='ready'/);
  assert.match(source, /role="alert"/);
  assert.match(source, /onClick=\{retryRenderer\}/);
  assert.match(source, /እንደገና ሞክር/);
});

test('Car Racing handles WebGL context loss and recreates the renderer after restoration', () => {
  assert.match(source, /webglcontextlost/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /webglcontextrestored/);
  assert.match(source, /setRendererAttempt\(value=>value\+1\)/);
  assert.match(source, /\},\[rendererAttempt,p\.graphicsQuality\]\)/);
  assert.match(source, /removeEventListener\('webglcontextlost'/);
  assert.match(source, /removeEventListener\('webglcontextrestored'/);
});

test('Car Racing isolates React rendering failures and catches animation-loop errors', () => {
  assert.match(source, /class CarRacingRenderErrorBoundary extends Component/);
  assert.match(source, /getDerivedStateFromError/);
  assert.match(source, /componentDidCatch/);
  assert.match(source, /CarRacingRenderErrorBoundary><CarRacing3DViewportInner/);
  assert.match(source, /catch\(error\)\{\s*cancelAnimationFrame\(raf\);\s*if\(!lowGraphicsFallbackUsed\)/);
  assert.match(source, /renderer\.shadowMap\.enabled=false/);
  assert.match(source, /renderer\.setPixelRatio\(1\)/);
  assert.match(source, /setRendererStatus\('error'\)/);
  assert.match(source, /setRendererError\(error instanceof Error/);
});


test('Car Racing tolerates missing or malformed track/player/car arrays before rendering', () => {
  assert.match(source, /const safeTrack: RacingTrack =/);
  assert.match(source, /obstacles: Array\.isArray\(p\.track\?\.obstacles\) \? p\.track\.obstacles : \[\]/);
  assert.match(source, /const safePlayers = Array\.isArray\(p\.players\) \? p\.players : \[\]/);
  assert.match(source, /const safeCars = Array\.isArray\(p\.cars\) \? p\.cars : \[\]/);
  assert.match(source, /safeTrack\.obstacles\.map/);
  assert.match(source, /\[\.\.\.safePlayers\]\.sort/);
});
