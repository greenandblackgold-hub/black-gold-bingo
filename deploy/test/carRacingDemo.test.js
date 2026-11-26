import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCarRacingDemoService, calculateCarRacingSettlement, CAR_RACING_COMPANY_PERCENT, CAR_RACING_POOL_PERCENT, CAR_RACING_MAX_PRIZE_ETB } from '../src/services/carRacingDemoService.js';
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
  assert.deepEqual(catalog.tracks.map((track) => track.curveType), ['straight', 'right', 'left', 's-bend']);
  assert.ok(catalog.tracks.every((track) => track.curveIntensity >= 0 && track.wallLimit > 0));
  assert.equal(catalog.cars.length, 10);
  assert.equal(new Set(catalog.cars.map((car) => car.id)).size, 10);
  assert.ok(catalog.cars.every((car) => car.bodyStyle && car.color && car.speed > 1));
  assert.ok(catalog.cars.every((car) => car.length > 0 && car.width > 0));
  assert.equal(f.service.createRoom(f.a, { entryFeeEtb: 10 }).track.id, 'city');
  f.service.leave(f.a);
  assert.equal(f.service.createRoom(f.a, { entryFeeEtb: 10 }).track.id, 'country');
});

test('a driver can mark ready before the room is full; the second driver then starts the countdown', () => {
  const f = fixture();
  const room = f.service.createRoom(f.a, { entryFeeEtb: 20 });
  const firstReady = f.service.setReady(f.a, { ready: true, roomId: room.roomId });
  assert.equal(firstReady.status, 'lobby');
  assert.equal(firstReady.players.length, 1);
  assert.equal(firstReady.players[0].ready, true);

  f.service.joinRoom(f.b, { code: room.code });
  const secondSeesRoom = f.service.getState(f.b).room;
  assert.equal(secondSeesRoom.players.length, 2);
  assert.equal(secondSeesRoom.players.find((p) => p.userId === f.a.id).ready, true);
  assert.equal(secondSeesRoom.players.find((p) => p.userId === f.b.id).ready, false);

  const countdown = f.service.setReady(f.b, { ready: true, roomId: room.roomId });
  assert.equal(countdown.status, 'countdown');
  assert.equal(countdown.players.every((p) => p.ready), true);
  assert.equal(countdown.countdownEndsAt, 1_800_000_003_000);
  f.advance(3_100);
  assert.equal(f.service.getState(f.a).room.status, 'racing');
});

test('two authenticated drivers join, choose cars and race on server-controlled progress', () => {
  const f = fixture();
  const room = f.service.createRoom(f.a, { entryFeeEtb: 20 });
  f.service.joinRoom(f.b, { code: room.code });
  f.service.chooseCar(f.b, { carId: 'vortex-gt' });
  f.service.setReady(f.a, { ready: true });
  f.service.setReady(f.b, { ready: true });
  f.advance(3_100);
  let state = f.service.getState(f.a);
  assert.equal(state.room.status, 'racing');
  assert.equal(state.room.players.length, 2);
  assert.equal(state.room.players.find((p) => p.userId === f.b.id).carId, 'vortex-gt');
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
  assert.ok(state.room.settlement.verified);
  assert.equal(state.room.settlement.verificationMethod, 'server-authoritative');
  assert.equal(state.room.settlement.reason, 'finish_line');
  assert.match(state.room.settlement.resultId, /^BGR-[A-F0-9]{16}$/);
  assert.equal(state.room.settlement.winnerPlateNumber, state.room.winner.plateNumber);
  assert.equal(state.room.settlement.totalEntryPoolEtb, 40);
  assert.equal(state.room.settlement.companyShareEtb, 22);
  assert.equal(state.room.settlement.prizePoolEtb, 18);
  assert.equal(state.room.settlement.payoutCapEtb, 20_000);
  const winner = state.room.winner.userId === f.a.id ? f.a : f.b;
  const loser = winner.id === f.a.id ? f.b : f.a;
  assert.deepEqual(f.service.getState(loser).room.settlement, state.room.settlement, 'every racer receives the identical server result snapshot');
  assert.equal(state.room.settlement.finishOrder[0].plateNumber, state.room.winner.plateNumber);
  assert.equal(state.room.settlement.finishOrder[0].status, 'winner');
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
  f.advance(600_100);
  const state = f.service.getState(f.a).room;
  assert.equal(state.status, 'finished');
  assert.ok(state.winner.payoutEtb <= 20_000);
  assert.equal(state.settlement.reason, 'time_limit');
  assert.equal(state.settlement.winnerPlateNumber, state.winner.plateNumber);
  assert.equal(state.settlement.prizePoolEtb, 450);
  assert.equal(state.settlement.companyShareEtb, 550);
});

test('host OFF immediately stops active races without winner or payout and blocks new races until ON', () => {
  const f = fixture();
  const room = f.service.createRoom(f.a, { entryFeeEtb: 20 });
  f.service.joinRoom(f.b, { code: room.code });
  f.service.setReady(f.a, {});
  f.service.setReady(f.b, {});
  f.advance(3_100);
  f.service.control(f.a, { throttle: 1, boost: true });
  f.service.setRunning(false);
  const stopped = f.service.getState(f.a).room;
  assert.equal(stopped.status, 'finished');
  assert.equal(stopped.endReason, 'host_stopped');
  assert.equal(stopped.winner, null);
  assert.equal(stopped.settlement, null);
  assert.ok(stopped.players.every((p) => p.speed === 0));
  assert.throws(() => f.service.createRoom({ id: 'driver-c' }, { entryFeeEtb: 10 }), (e) => e instanceof HttpError && e.code === 'car_racing_stopped');
  assert.throws(() => f.service.control(f.a, { throttle: 1 }), (e) => e instanceof HttpError && e.code === 'car_racing_stopped');
  f.service.setRunning(true);
  assert.equal(f.service.createRoom({ id: 'driver-c' }, { entryFeeEtb: 10 }).status, 'lobby');
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


test('server eliminates a driver on obstacle impact and locks their controls', () => {
  const f = fixture();
  const room = f.service.createRoom(f.a, { entryFeeEtb: 10 });
  f.service.joinRoom(f.b, { code: room.code });
  f.service.setReady(f.a, {});
  f.service.setReady(f.b, {});
  f.advance(3_100);
  f.service.getState(f.a);
  f.service.control(f.a, { throttle: 1, steer: 1 });
  f.advance(250);
  f.service.getState(f.a);
  f.service.control(f.a, { throttle: 1, steer: 0.5 });
  f.advance(250);
  f.service.getState(f.a);
  for (let i = 0; i < 30; i++) {
    f.service.control(f.a, { throttle: 1, steer: 0 });
    f.service.control(f.b, { throttle: 1, steer: 0 });
    f.advance(250);
    const state = f.service.getState(f.a).room;
    if (state.players.find((p) => p.isMe).eliminated) break;
  }
  const state = f.service.getState(f.a).room;
  const eliminated = state.players.find((p) => p.isMe);
  assert.equal(eliminated.eliminated, true);
  assert.equal(eliminated.eliminationReason, 'barrier');
  assert.equal(eliminated.speed, 0);
  const frozenProgress = eliminated.progress;
  f.advance(2_000);
  assert.equal(f.service.getState(f.a).room.players.find((p) => p.isMe).progress, frozenProgress);
  assert.throws(() => f.service.control(f.a, { throttle: 1 }), (error) => error instanceof HttpError && error.code === 'driver_eliminated');
  assert.equal(f.service.getState(f.b).room.players.find((p) => p.userId === f.a.id).eliminated, true);
});

test('server eliminates a driver who crosses the track wall', () => {
  const f = fixture();
  const room = f.service.createRoom(f.a, { entryFeeEtb: 10 });
  f.service.joinRoom(f.b, { code: room.code });
  f.service.setReady(f.a, {});
  f.service.setReady(f.b, {});
  f.advance(3_100);
  f.service.getState(f.a);
  for (let i = 0; i < 6; i++) {
    f.service.control(f.a, { throttle: 1, steer: 1 });
    f.advance(250);
    const state = f.service.getState(f.a).room;
    if (state.players.find((p) => p.isMe).eliminated) break;
  }
  const state = f.service.getState(f.a).room;
  const eliminated = state.players.find((p) => p.isMe);
  assert.equal(eliminated.eliminated, true);
  assert.equal(eliminated.eliminationReason, 'wall');
  assert.equal(eliminated.speed, 0);
  assert.equal(state.status, 'racing', 'the remaining driver continues the race');
});


test('race ends cleanly when every driver is eliminated', () => {
  const f = fixture();
  const room = f.service.createRoom(f.a, { entryFeeEtb: 10 });
  f.service.joinRoom(f.b, { code: room.code });
  f.service.setReady(f.a, {});
  f.service.setReady(f.b, {});
  f.advance(3_100);
  f.service.getState(f.a);
  f.service.control(f.a, { throttle: 1, steer: -1 });
  f.service.control(f.b, { throttle: 1, steer: 1 });
  f.advance(250);
  f.service.getState(f.a);
  f.service.control(f.a, { throttle: 1, steer: -1 });
  f.service.control(f.b, { throttle: 1, steer: 1 });
  f.advance(250);
  f.service.getState(f.a);
  let state;
  for (let i = 0; i < 30; i++) {
    f.service.control(f.a, { throttle: 1, steer: -1 });
    f.service.control(f.b, { throttle: 1, steer: 1 });
    f.advance(250);
    state = f.service.getState(f.a).room;
    if (state.status === 'finished') break;
  }
  assert.equal(state.status, 'finished');
  assert.equal(state.winner, null);
  assert.equal(state.endReason, 'all_eliminated');
  assert.ok(state.players.every((p) => p.eliminated));
  assert.equal(state.settlement, null, 'an all-eliminated race cannot issue a winner or payout settlement');
});


test('server detects car-to-car body collisions and publishes the same event to both drivers', () => {
  const f = fixture();
  const room = f.service.createRoom(f.a, { entryFeeEtb: 10 });
  f.service.joinRoom(f.b, { code: room.code });
  f.service.setReady(f.a, {}); f.service.setReady(f.b, {});
  f.advance(3_100); f.service.getState(f.a);
  f.service.control(f.a, { throttle: 0.3, steer: 0.45 });
  f.service.control(f.b, { throttle: 0.3, steer: -0.45 });
  f.advance(250);
  const a = f.service.getState(f.a).room;
  const b = f.service.getState(f.b).room;
  const event = a.collisionEvents.find((item) => item.type === 'car-to-car');
  assert.ok(event, 'overlapping server-side vehicle bodies create a collision');
  assert.equal(event.severity, 'light');
  assert.deepEqual(b.collisionEvents.find((item) => item.id === event.id), event);
  assert.ok(a.players.find((p) => p.isMe).damage > 0);
  assert.ok(b.players.find((p) => p.userId === f.b.id).damage > 0);
});

test('car-to-car collision severity separates light, medium and severe impacts', () => {
  const runImpact = (throttle, boost, duration) => {
    const f = fixture();
    const room = f.service.createRoom(f.a, { entryFeeEtb: 10 });
    f.service.joinRoom(f.b, { code: room.code });
    f.service.setReady(f.a, {}); f.service.setReady(f.b, {});
    f.advance(3_100); f.service.getState(f.a);
    const steer = duration === 250 ? 0.45 : 0.15;
    f.service.control(f.a, { throttle, boost, steer });
    f.service.control(f.b, { throttle, boost, steer: -steer });
    f.advance(duration);
    return f.service.getState(f.a).room;
  };
  const light = runImpact(0.3, false, 250);
  const medium = runImpact(0.6, false, 1_000);
  const severe = runImpact(1, true, 1_000);
  assert.equal(light.collisionEvents.find((e) => e.type === 'car-to-car')?.severity, 'light');
  assert.equal(medium.collisionEvents.find((e) => e.type === 'car-to-car')?.severity, 'medium');
  assert.equal(severe.collisionEvents.find((e) => e.type === 'car-to-car')?.severity, 'severe');
  assert.ok(severe.players.every((p) => p.eliminated && p.speed === 0));
  assert.ok(medium.players.every((p) => !p.eliminated && p.damage > 0 && p.speed < 100));
});

test('each dynamic track exposes distinct environment and scenery metadata', () => {
  const tracks = fixture().service.getCatalog().tracks;
  assert.deepEqual(tracks.map((track) => track.environment), ['city', 'country', 'rocky', 'coastal']);
  assert.ok(tracks.every((track) => Array.isArray(track.scenery) && track.scenery.length >= 3));
  assert.equal(new Set(tracks.map((track) => track.scenery.join(','))).size, 4);
});


test('frontend source includes all four Three.js track scenes, 3D obstacles and both driving views', () => {
  const frontend = readFileSync(new URL('../../client-source/src/components/games/CarRacingGame.tsx', import.meta.url), 'utf8');
  const scene = readFileSync(new URL('../../client-source/src/components/games/CarRacing3D.tsx', import.meta.url), 'utf8');
  for (const environment of ['city', 'country', 'rocky', 'coastal']) {
    assert.ok(scene.includes(`p.track.environment==='${environment}'`), `missing ${environment} 3D environment scene`);
  }
  for (const obstacle of ['barrier', 'logs', 'boulder', 'rockfall']) {
    assert.ok(scene.includes(`obstacle.type === '${obstacle}'`), `missing modeled 3D ${obstacle} obstacle`);
  }
  assert.match(scene, /s\.view==='chase'/);
  assert.match(scene, /s\.view==='cockpit'/);
  assert.match(scene, /steering\.rotation\.z=-s\.steer\*Math\.PI/);
  assert.match(scene, /own\.frontWheels\.forEach/);
  assert.match(scene, /gearLever\.rotation\.z=s\.reverse/);
  assert.match(scene, /brakePedal\.rotation\.x=s\.brake/);
  assert.match(scene, /accelPedal\.rotation\.x=s\.throttle/);
  assert.match(scene, /speedCtx\.fillText\(String\(Math\.round\(s\.speed\)\)/);
  assert.match(scene, /p\.onThrottle\(1,latest\.current\.reverse,false,false\)/);
  assert.match(scene, /p\.onThrottle\(0,latest\.current\.reverse,false,true\)/);
  assert.match(scene, /p\.onGearChange\(!latest\.current\.reverse\)/);
  assert.match(frontend, /throttle=\{throttle\} brake=\{brake\}/);
  assert.match(scene, /p\.me\.collisionEvent/);
  assert.match(frontend, /Vehicle damage/);
  assert.match(frontend, /SERVER VERIFIED/);
  assert.match(frontend, /winnerPlateNumber/);
  assert.match(frontend, /Final plate order/);
  assert.match(frontend, /Single-player test drive/);
});


test('settlement calculator preserves the 55/45 split and hard ETB 20,000 cap', () => {
  assert.deepEqual(calculateCarRacingSettlement(10_000), {
    grossSantim: 10_000,
    companyShareSantim: 5_500,
    prizePoolSantim: 4_500,
  });
  const capped = calculateCarRacingSettlement(10_000_000);
  assert.equal(capped.companyShareSantim, 5_500_000);
  assert.equal(capped.prizePoolSantim, 2_000_000);
  assert.ok(capped.prizePoolSantim <= CAR_RACING_MAX_PRIZE_ETB * 100);
});

test('settlement is plate-identified, identical across racer views and never accepts client payout fields', () => {
  const f = fixture();
  const room = f.service.createRoom(f.a, { entryFeeEtb: 35 });
  f.service.joinRoom(f.b, { code: room.code });
  f.service.setReady(f.a, {}); f.service.setReady(f.b, {});
  f.advance(3_100);
  f.service.control(f.a, { throttle: 1, progress: 1000, payoutEtb: 999_999, winnerPlateNumber: 'FAKE-PLATE' });
  for (let i = 0; i < 300; i++) {
    f.service.control(f.a, { throttle: 1, progress: 1000, payoutEtb: 999_999 });
    f.service.control(f.b, { throttle: 1, progress: 0, payoutEtb: 999_999 });
    f.advance(250);
    const state = f.service.getState(f.a).room;
    if (state.status === 'finished') break;
  }
  const a = f.service.getState(f.a).room;
  const b = f.service.getState(f.b).room;
  assert.equal(a.status, 'finished');
  assert.ok(a.settlement.verified);
  assert.equal(a.settlement.winnerPlateNumber, a.winner.plateNumber);
  assert.deepEqual(a.settlement, b.settlement);
  assert.notEqual(a.winner.plateNumber, 'FAKE-PLATE');
  assert.equal(a.winner.payoutEtb, a.settlement.prizePoolEtb);
  assert.equal(a.settlement.totalEntryPoolEtb, 70);
  assert.equal(a.settlement.companyShareEtb, 38.5);
  assert.equal(a.settlement.prizePoolEtb, 31.5);
});


test('finished result screen explains pool arithmetic, cap semantics, winner rank and simulation-only mode', () => {
  const frontend = readFileSync(new URL('../../client-source/src/components/games/CarRacingGame.tsx', import.meta.url), 'utf8');
  assert.match(frontend, /How the pool is calculated/);
  assert.match(frontend, /Maximum current room example: 8 × 500 ETB = 4,000 ETB total; company 55% = 2,200 ETB; prize pool 45% = 1,800 ETB/);
  assert.match(frontend, /upper payout limit, not a guaranteed prize/);
  assert.match(frontend, /REAL_MONEY_ENABLED=false/);
  assert.match(frontend, /Winner position:/);
  assert.match(frontend, /Demo credits only/);
});


test('Car Racing lobby state cannot be rolled back by an older poll after a Ready response', () => {
  const frontend = readFileSync(new URL('../../client-source/src/components/games/CarRacingGame.tsx', import.meta.url), 'utf8');
  assert.match(frontend, /stateRequestVersion = useRef\(0\)/);
  assert.match(frontend, /requestVersion === stateRequestVersion\.current/);
  assert.match(frontend, /api\.post<Room \| \{ ok: boolean \}>\(path, body\)/);
  assert.match(frontend, /setState\(\(current\) => current \? \{ \.\.\.current, room: result \} : current\)/);
});


test('steering supports the full signed range, reverse gear moves backward, and brake actively slows the car', () => {
  const f = fixture();
  const room = f.service.createRoom(f.a, { entryFeeEtb: 10 });
  f.service.joinRoom(f.b, { code: room.code });
  f.service.setReady(f.a, {}); f.service.setReady(f.b, {});
  f.advance(3_100);
  f.service.getState(f.a);

  f.service.control(f.a, { throttle: 1, steer: 0 });
  f.advance(500);
  let state = f.service.getState(f.a).room;
  let driver = state.players.find((p) => p.isMe);
  assert.ok(driver.speed > 0, 'accelerator increases speed');
  const progressBeforeReverse = driver.progress;

  f.service.control(f.a, { throttle: 0, steer: -1 });
  f.advance(200);
  state = f.service.getState(f.a).room;
  driver = state.players.find((p) => p.isMe);
  assert.ok(driver.lane < -0.2, 'full-left steering moves the car left');

  f.service.control(f.a, { throttle: 0, steer: 1, brake: true });
  f.advance(200);
  state = f.service.getState(f.a).room;
  driver = state.players.find((p) => p.isMe);
  assert.ok(driver.speed < 10, 'brake rapidly reduces forward speed');
  assert.ok(driver.lane > -0.3, 'full-right steering moves the car back toward center');

  f.service.control(f.a, { throttle: 1, steer: 0, reverse: true });
  f.advance(500);
  state = f.service.getState(f.a).room;
  driver = state.players.find((p) => p.isMe);
  assert.ok(driver.speed > 0, 'reverse gear engages reverse velocity');
  assert.ok(driver.progress <= progressBeforeReverse, 'reverse gear does not advance forward race progress');

  const frontend = readFileSync(new URL('../../client-source/src/components/games/CarRacing3D.tsx', import.meta.url), 'utf8');
  assert.match(frontend, /STEER LEFT/);
  assert.match(frontend, /STEER RIGHT/);
  assert.match(frontend, /D · DRIVE/);
  assert.match(frontend, /R · REVERSE/);
  assert.match(frontend, /GAS/);
  assert.match(frontend, /BRAKE/);
});
