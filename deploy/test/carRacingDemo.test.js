import test from 'node:test';
import assert from 'node:assert/strict';
import { createCarRacingDemoService, CAR_RACING_COMPANY_PERCENT, CAR_RACING_POOL_PERCENT, CAR_RACING_MAX_PRIZE_ETB } from '../src/services/carRacingDemoService.js';
import { HttpError } from '../src/util/errors.js';

function fixture() {
  let clock = 1_800_000_000_000;
  const service = createCarRacingDemoService({ realMoneyEnabled: false, now: () => clock });
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
  const plateA = state.room.players.find((p) => p.userId === f.a.id).plateNumber;
  const plateB = state.room.players.find((p) => p.userId === f.b.id).plateNumber;
  assert.match(plateA, /^BGB-[A-Z0-9]+-[A-Z0-9]+$/);
  assert.match(plateB, /^BGB-[A-Z0-9]+-[A-Z0-9]+$/);
  assert.notEqual(plateA, plateB, 'each driver receives a unique plate');
  f.service.control(f.a, { throttle: 0, steer: 0, progress: 1000, payoutEtb: 20_000 });
  assert.equal(f.service.getState(f.a).room.players.find((p) => p.isMe).progress, 0, 'client-supplied progress and payout are ignored');
  f.service.control(f.a, { throttle: 1, steer: 0 });
  f.service.control(f.b, { throttle: 1, steer: 0 });
  for (let i = 0; i < 300 && state.room.status === 'racing'; i++) {
    f.service.control(f.a, { throttle: 1, steer: 0 });
    f.service.control(f.b, { throttle: 1, steer: 0 });
    f.advance(250);
    state = f.service.getState(f.a);
  }
  assert.equal(state.room.status, 'finished');
  assert.ok(state.room.winner);
  assert.match(state.room.winner.plateNumber, /^BGB-[A-Z0-9]+-[A-Z0-9]+$/);
  assert.equal(state.room.prizePoolEtb, 18);
  assert.equal(state.room.companyShareEtb, 22);
  const winner = state.room.winner.userId === f.a.id ? f.a : f.b;
  const credited = f.service.getState(winner).balanceEtb;
  f.service.getState(f.a); f.service.getState(f.b);
  assert.equal(f.service.getState(winner).balanceEtb, credited, 're-reading a settled race never credits the winner twice');
});

test('reverse gear reduces race progress and nitro increases acceleration', () => {
  const f = fixture();
  const room = f.service.createRoom(f.a, { entryFeeEtb: 10 });
  f.service.joinRoom(f.b, { code: room.code });
  f.service.setReady(f.a, {});
  f.service.setReady(f.b, {});
  f.advance(3_100);
  f.service.control(f.a, { throttle: 1 });
  f.advance(1_000);
  const forwardState = f.service.getState(f.a).room;
  const forwardProgress = forwardState.players.find((p) => p.isMe).progress;
  assert.ok(forwardProgress > 0, 'forward drive advances the car');
  f.service.control(f.a, { throttle: 1, reverse: true });
  f.advance(1_000);
  const reverseState = f.service.getState(f.a).room;
  assert.ok(reverseState.players.find((p) => p.isMe).progress < forwardProgress, 'reverse gear moves the car back');

  const boosted = fixture();
  const boostedRoom = boosted.service.createRoom(boosted.a, { entryFeeEtb: 10 });
  boosted.service.joinRoom(boosted.b, { code: boostedRoom.code });
  boosted.service.setReady(boosted.a, {});
  boosted.service.setReady(boosted.b, {});
  boosted.advance(3_100);
  boosted.service.control(boosted.a, { throttle: 1, boost: true });
  boosted.advance(500);
  const boostedSpeed = boosted.service.getState(boosted.a).room.players.find((p) => p.isMe).speed;
  assert.ok(boostedSpeed > 30, 'nitro provides additional acceleration');
});

test('a returning driver keeps the same demo plate across rooms', () => {
  const f = fixture();
  f.service.createRoom(f.a, { entryFeeEtb: 10 });
  const plate = f.service.getState(f.a).room.players.find((p) => p.isMe).plateNumber;
  f.service.leave(f.a);
  f.service.createRoom(f.a, { entryFeeEtb: 10 });
  const next = f.service.getState(f.a).room.players.find((p) => p.isMe).plateNumber;
  assert.equal(next, plate);
  const restartedService = createCarRacingDemoService({ realMoneyEnabled: false });
  restartedService.createRoom(f.a, { entryFeeEtb: 10 });
  const afterRestart = restartedService.getState(f.a).room.players.find((p) => p.isMe).plateNumber;
  assert.equal(afterRestart, plate, 'account plate remains stable after service restart');
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

test('production simulation mode can use Car Racing, but real-money mode cannot', () => {
  const simulation = createCarRacingDemoService({ realMoneyEnabled: false });
  assert.equal(simulation.getCatalog().enabled, true);
  assert.equal(simulation.getState({ id: 'driver-a' }).simulationOnly, true);
  const realMoney = createCarRacingDemoService({ realMoneyEnabled: true });
  assert.equal(realMoney.getCatalog().enabled, false);
  assert.throws(() => realMoney.getState({ id: 'driver-a' }), (error) => error instanceof HttpError && error.code === 'car_racing_demo_only');
});

test('leaving an unstarted lobby refunds only simulation credits', () => {
  const f = fixture();
  const before = f.service.getState(f.a).balanceEtb;
  f.service.createRoom(f.a, { entryFeeEtb: 25 });
  assert.equal(f.service.getState(f.a).balanceEtb, before - 25);
  f.service.leave(f.a);
  assert.equal(f.service.getState(f.a).balanceEtb, before);
});
