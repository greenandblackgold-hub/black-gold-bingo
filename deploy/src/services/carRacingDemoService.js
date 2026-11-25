import { randomBytes } from 'node:crypto';
import { HttpError } from '../util/errors.js';

export const CAR_RACING_MAX_PRIZE_ETB = 20_000;
export const CAR_RACING_COMPANY_PERCENT = 55;
export const CAR_RACING_POOL_PERCENT = 45;
const tracks = [
  { id: 'city', name: 'City Circuit', terrain: 'Asphalt', speedFactor: 1, grip: 1, obstacles: [180, 430, 690, 860] },
  { id: 'country', name: 'Country Run', terrain: 'Rural dirt', speedFactor: 0.92, grip: 0.88, obstacles: [130, 350, 590, 810] },
  { id: 'rocky', name: 'Rocky Ridge', terrain: 'Rough mountain', speedFactor: 0.78, grip: 0.68, obstacles: [100, 270, 470, 720, 900] },
  { id: 'coast', name: 'Coastal Highway', terrain: 'Mixed tarmac', speedFactor: 1.08, grip: 0.94, obstacles: [240, 510, 780] },
];
const cars = [
  { id: 'sport', name: 'GT Sport', speed: 1.18, handling: 0.88, color: '#f4b942' },
  { id: 'rally', name: 'Rally X', speed: 1.02, handling: 1.2, color: '#53c7a5' },
  { id: 'muscle', name: 'Muscle V8', speed: 1.12, handling: 0.82, color: '#e76f51' },
  { id: 'electric', name: 'Volt GT', speed: 1.08, handling: 1.08, color: '#65a9ff' },
];
const clone = (value) => JSON.parse(JSON.stringify(value));

export function createCarRacingDemoService({ prod = false, now = Date.now } = {}) {
  const rooms = new Map();
  const playerRooms = new Map();
  const balances = new Map();
  let roundSequence = 0;

  function assertDemo() {
    if (prod) throw new HttpError(503, 'car_racing_demo_only', 'Car Racing is available only in the isolated demo/simulation environment. Real-money play is locked.');
  }
  function balance(userId) {
    if (!balances.has(userId)) balances.set(userId, 100_000);
    return balances.get(userId);
  }
  function player(room, userId) {
    const found = room.players.find((item) => item.userId === userId);
    if (!found) throw new HttpError(403, 'not_in_race', 'You are not a member of this race.');
    return found;
  }
  function publicRoom(room, userId) {
    return {
      roomId: room.id, code: room.code, status: room.status, track: room.track,
      entryFeeEtb: room.entryFeeEtb, playerCount: room.players.length, maxPlayers: 8,
      poolEtb: room.poolSantim / 100, companyShareEtb: room.companyShareSantim / 100,
      prizePoolEtb: room.prizeSantim / 100, payoutCapEtb: CAR_RACING_MAX_PRIZE_ETB,
      countdownEndsAt: room.countdownEndsAt, startedAt: room.startedAt, finishedAt: room.finishedAt,
      winner: room.winner ? { userId: room.winner.userId, name: room.winner.name, payoutEtb: room.winner.payoutSantim / 100 } : null,
      players: room.players.map((p) => ({
        userId: p.userId, name: p.name, car: cars.find((c) => c.id === p.carId)?.name ?? 'GT Sport',
        carId: p.carId, ready: p.ready, progress: Math.min(100, Math.round(p.progress / 10)),
        lane: p.lane, speed: Math.round(p.velocity * 100), finished: p.finished,
        isMe: p.userId === userId,
      })),
    };
  }
  function settle(room, winner, at) {
    if (room.status === 'finished') return;
    // One synchronous server-side settlement: no awaits or client-supplied result/payout.
    const grossSantim = room.poolSantim;
    room.companyShareSantim = Math.floor(grossSantim * CAR_RACING_COMPANY_PERCENT / 100);
    room.prizeSantim = Math.min(Math.floor(grossSantim * CAR_RACING_POOL_PERCENT / 100), CAR_RACING_MAX_PRIZE_ETB * 100);
    winner.payoutSantim = room.prizeSantim;
    winner.finished = true;
    winner.finishedAt = at;
    balances.set(winner.userId, balance(winner.userId) + room.prizeSantim);
    room.winner = { userId: winner.userId, name: winner.name, payoutSantim: room.prizeSantim };
    room.status = 'finished';
    room.finishedAt = at;
    room.settlement = {
      totalEntryPoolSantim: grossSantim,
      companyShareSantim: room.companyShareSantim,
      prizePoolSantim: room.prizeSantim,
      companyPercent: CAR_RACING_COMPANY_PERCENT,
      poolPercent: CAR_RACING_POOL_PERCENT,
      payoutCapSantim: CAR_RACING_MAX_PRIZE_ETB * 100,
      winnerUserId: winner.userId,
    };
  }
  function advance(room, at = now()) {
    if (room.status === 'countdown' && at >= room.countdownEndsAt) {
      room.status = 'racing';
      room.startedAt = room.countdownEndsAt;
      room.lastTickAt = room.startedAt;
    }
    if (room.status !== 'racing') return;
    const dt = Math.min(1, Math.max(0, (at - room.lastTickAt) / 1000));
    if (!dt) return;
    room.lastTickAt = at;
    const finishers = [];
    for (const p of room.players) {
      if (p.finished) continue;
      const car = cars.find((item) => item.id === p.carId) ?? cars[0];
      const controlFresh = at - p.controlAt < 900;
      const throttle = controlFresh ? p.throttle : 0;
      const steer = controlFresh ? p.steer : 0;
      p.lane = Math.max(-1, Math.min(1, p.lane + steer * car.handling * dt * 1.7));
      const gripPenalty = Math.abs(p.lane) > room.track.grip ? 0.62 : 1;
      p.velocity = Math.max(0, Math.min(1, p.velocity + throttle * dt * 0.8 - (throttle ? 0 : dt * 0.7)));
      let obstaclePenalty = 1;
      const obstacle = room.track.obstacles[p.obstacleIndex];
      if (obstacle && p.progress < obstacle && p.progress + p.velocity * car.speed * room.track.speedFactor * dt * 145 >= obstacle) {
        p.obstacleIndex += 1;
        if (Math.abs(p.lane) < 0.32) obstaclePenalty = 0.55;
      }
      const gain = p.velocity * car.speed * room.track.speedFactor * gripPenalty * obstaclePenalty * dt * 145;
      const next = p.progress + gain;
      if (next >= 1000) {
        const crossing = at - dt * ((1000 - p.progress) / Math.max(gain, 0.001));
        p.progress = 1000;
        finishers.push({ player: p, at: crossing });
      } else p.progress = next;
    }
    finishers.sort((a, b) => a.at - b.at);
    if (finishers.length) settle(room, finishers[0].player, finishers[0].at);
    if (room.status === 'racing' && at - room.startedAt > 90_000) {
      const leader = [...room.players].sort((a, b) => b.progress - a.progress)[0];
      if (leader) settle(room, leader, at);
    }
  }
  function findRoom(userId, roomId) {
    const id = roomId || playerRooms.get(userId);
    const room = id ? rooms.get(id) : null;
    if (!room) throw new HttpError(404, 'race_not_found', 'Race room not found.');
    player(room, userId);
    advance(room);
    return room;
  }
  function validateCar(carId) {
    if (!cars.some((car) => car.id === carId)) throw new HttpError(400, 'invalid_car', 'Choose an available car.');
    return carId;
  }
  function joinPlayer(room, user) {
    if (room.status !== 'lobby') throw new HttpError(409, 'race_started', 'This race has already started.');
    if (room.players.length >= 8) throw new HttpError(409, 'room_full', 'This race room is full.');
    if (room.players.some((p) => p.userId === user.id)) return;
    if (playerRooms.has(user.id)) throw new HttpError(409, 'already_in_race', 'Leave your current race before joining another.');
    const fee = room.entryFeeEtb * 100;
    if (balance(user.id) < fee) throw new HttpError(400, 'insufficient_demo_credits', 'Not enough simulation credits.');
    balances.set(user.id, balance(user.id) - fee);
    room.poolSantim += fee;
    room.players.push({ userId: user.id, name: String(user.name || 'Driver').slice(0, 28), carId: 'sport', ready: false, progress: 0, lane: 0, velocity: 0, throttle: 0, steer: 0, controlAt: 0, obstacleIndex: 0, finished: false });
    playerRooms.set(user.id, room.id);
  }

  return {
    getCatalog() {
      return { enabled: !prod, simulationOnly: true, currency: 'DEMO ETB', maxPlayers: 8, minPlayers: 2, maxPrizeEtb: CAR_RACING_MAX_PRIZE_ETB, companyPercent: 55, poolPercent: 45, tracks: clone(tracks.map(({ obstacles, ...t }) => t)), cars: clone(cars) };
    },
    getState(user) {
      assertDemo();
      const roomId = playerRooms.get(user.id);
      const room = roomId ? rooms.get(roomId) : null;
      if (room) advance(room);
      return {
        ...this.getCatalog(),
        balanceEtb: balance(user.id) / 100,
        openRooms: [...rooms.values()].filter((r) => r.status === 'lobby' && r.players.length < 8).slice(-12).map((r) => ({ code: r.code, track: r.track.name, players: r.players.length, entryFeeEtb: r.entryFeeEtb })),
        room: room ? publicRoom(room, user.id) : null,
      };
    },
    createRoom(user, input = {}) {
      assertDemo();
      if (playerRooms.has(user.id)) throw new HttpError(409, 'already_in_race', 'Leave your current race before creating another.');
      const fee = Number(input.entryFeeEtb);
      if (!Number.isInteger(fee) || fee < 5 || fee > 500) throw new HttpError(400, 'invalid_entry_fee', 'Entry fee must be between 5 and 500 simulation ETB.');
      if (balance(user.id) < fee * 100) throw new HttpError(400, 'insufficient_demo_credits', 'Not enough simulation credits.');
      const track = tracks[roundSequence % tracks.length];
      roundSequence += 1;
      const id = randomBytes(12).toString('hex');
      const room = { id, code: randomBytes(3).toString('hex').toUpperCase(), status: 'lobby', track: clone(track), entryFeeEtb: fee, poolSantim: 0, companyShareSantim: 0, prizeSantim: 0, players: [], createdAt: now(), countdownEndsAt: null, startedAt: null, finishedAt: null, winner: null };
      rooms.set(id, room);
      joinPlayer(room, user);
      return publicRoom(room, user.id);
    },
    joinRoom(user, input = {}) {
      assertDemo();
      const code = String(input.code || '').trim().toUpperCase();
      const room = [...rooms.values()].find((r) => r.code === code);
      if (!room) throw new HttpError(404, 'room_not_found', 'Race code not found.');
      joinPlayer(room, user);
      return publicRoom(room, user.id);
    },
    chooseCar(user, input = {}) {
      const room = findRoom(user.id, input.roomId);
      if (room.status !== 'lobby') throw new HttpError(409, 'race_started', 'Car selection is closed after the race starts.');
      const p = player(room, user.id);
      p.carId = validateCar(input.carId);
      return publicRoom(room, user.id);
    },
    setReady(user, input = {}) {
      const room = findRoom(user.id, input.roomId);
      if (room.status !== 'lobby') throw new HttpError(409, 'race_started', 'This race is no longer in the lobby.');
      const p = player(room, user.id);
      p.ready = input.ready !== false;
      if (room.players.length >= 2 && room.players.every((item) => item.ready)) {
        room.status = 'countdown';
        room.countdownEndsAt = now() + 3000;
      }
      return publicRoom(room, user.id);
    },
    control(user, input = {}) {
      const room = findRoom(user.id, input.roomId);
      if (room.status !== 'racing') throw new HttpError(409, 'race_not_running', 'The race is not running.');
      const p = player(room, user.id);
      p.throttle = Math.max(0, Math.min(1, Number(input.throttle) || 0));
      p.steer = Math.max(-1, Math.min(1, Number(input.steer) || 0));
      p.controlAt = now();
      return { ok: true };
    },
    leave(user) {
      const roomId = playerRooms.get(user.id);
      if (!roomId) return { ok: true };
      const room = rooms.get(roomId);
      if (room && room.status === 'lobby') {
        room.players = room.players.filter((p) => p.userId !== user.id);
        room.poolSantim = Math.max(0, room.poolSantim - room.entryFeeEtb * 100);
        balances.set(user.id, balance(user.id) + room.entryFeeEtb * 100);
        if (!room.players.length) rooms.delete(roomId);
      }
      playerRooms.delete(user.id);
      return { ok: true };
    },
  };
}
