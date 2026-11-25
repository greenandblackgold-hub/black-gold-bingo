import test from 'node:test';
import assert from 'node:assert/strict';
import { createCarRacingDemoService, CAR_RACING_COMPANY_PERCENT, CAR_RACING_POOL_PERCENT, CAR_RACING_MAX_PRIZE_ETB } from '../src/services/carRacingDemoService.js';
import { HttpError } from '../src/util/errors.js';

function fixture() {
  let clock = 1_800_000_000_000;
  const service = createCarRacingDemoService({ prod: false, now: () => clock });
  const a = { id: 'driver-a', name: 'Driver A' };
  const b = { id: 'driver-b', name: 'Driver B' };
  return { service, a, b, advance: (ms) => { clock += ms; } };
}

test('car racing is a demo-only isolated catalog with rotating tracks and car choices', () => {
  const f = fixture();
  const catalog = f.service.getCatalog();
  assert.equal(catalog.simulationOnly, true);
  assert.equal(catalog.companyPercent, 55);
  assert.equal(catalog.poolPercent, 45);
  assert.equal(catalog.maxPrizeEtb, 20_000);
  assert.equal(catalog.tracks.length, 4);
  assert.equal(catalog.cars.length, 4);
  assert.equal(f.service.createRoom(f.a, { entryFeeEtb: 10 }).track.id, 'city');
  f.service.leave(f.a);
  assert.equal(f.service.createRoom(f.a, { entryFeeEtb: 10 }).track.id, 'country');
});

test('two authenticated drivers join, choose cars and race on server-controlled progress', () => {
  const f = fixture();
  const room = f.service.createRoom(f.a, { entryFeeEtb: 20 });
  f.service.joinRoom(f.b, { code: room.code });
  f.service.chooseCar(f.b, { carId: 'rally' });
  f.service.setReady(f.a, { ready: true });
  f.service.setReady(f.b, { ready: true });
  f.advance(3_100);
  let state = f.service.getState(f.a);
  assert.equal(state.room.status, 'racing');
  assert.equal(state.room.players.length, 2);
  assert.equal(state.room.players.find((p) => p.userId === f.b.id).carId, 'rally');
  f.service.control(f.a, { throttle: 1, steer: 0 });
  f.service.control(f.b, { throttle: 1, steer: 0 });
  for (let i = 0; i < 300 && state.room.status === 'racing'; i++) {
    f.advance(250);
    state = f.service.getState(f.a);
  }
  assert.equal(state.room.status, 'finished');
  assert.ok(state.room.winner);
  assert.equal(state.room.prizePoolEtb, 18);
  assert.equal(state.room.companyShareEtb, 22);
});

test('server derives payout and enforces ETB 20,000 cap without touching wallet', () => {
  assert.equal(CAR_RACING_COMPANY_PERCENT, 55);
  assert.equal(CAR_RACING_POOL_PERCENT, 45);
  assert.equal(CAR_RACING_MAX_PRIZE_ETB, 20_000);
  const f = fixture();
  const room = f.service.createRoom(f.a, { entryFeeEtb: 500 });
  f.service.joinRoom(f.b, { code: room.code });
  f.service.setReady(f.a, {});
  f.service.setReady(f.b, {});
  f.advance(3_100);
  f.service.control(f.a, { throttle: 1 });
  f.advance(90_100);
  const state = f.service.getState(f.a).room;
  assert.equal(state.status, 'finished');
  assert.ok(state.winner.payoutEtb <= 20_000);
});

test('production real-money environment cannot use the car racing demo endpoints', () => {
  const service = createCarRacingDemoService({ prod: true });
  assert.throws(() => service.getCatalog(), (error) => error instanceof HttpError && error.code === 'car_racing_demo_only');
});
