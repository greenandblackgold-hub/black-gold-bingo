import { randomBytes } from 'node:crypto';
import { HttpError } from '../util/errors.js';

export const CAR_RACING_MAX_PRIZE_ETB = 20_000;
export const CAR_RACING_COMPANY_PERCENT = 55;
export const CAR_RACING_POOL_PERCENT = 45;
const tracks = [
  { id: 'city', name: 'City Circuit', terrain: 'Urban asphalt', surface: 'Asphalt', environment: 'city', scenery: ['buildings', 'streetlights', 'lane-markings'], speedFactor: 1, grip: 1, curveType: 'straight', curveIntensity: 0, wallLimit: 1.04, obstacles: [{ at: 180, lane: 0.5, width: 0.24, type: 'barrier' }, { at: 430, lane: -0.55, width: 0.28, type: 'debris' }, { at: 690, lane: 0.55, width: 0.28, type: 'barrier' }, { at: 860, lane: -0.5, width: 0.24, type: 'debris' }] },
  { id: 'country', name: 'Country Run', terrain: 'Rural dirt', surface: 'Loose dirt', environment: 'country', scenery: ['green-fields', 'trees', 'fences'], speedFactor: 0.92, grip: 0.88, curveType: 'right', curveIntensity: 0.48, wallLimit: 1.02, obstacles: [{ at: 130, lane: -0.48, width: 0.3, type: 'rocks' }, { at: 350, lane: 0.48, width: 0.3, type: 'logs' }, { at: 590, lane: 0, width: 0.28, type: 'rocks' }, { at: 810, lane: -0.5, width: 0.3, type: 'logs' }] },
  { id: 'rocky', name: 'Rocky Ridge', terrain: 'Rough mountain', surface: 'Rock and gravel', environment: 'rocky', scenery: ['mountains', 'boulders', 'cliffs'], speedFactor: 0.78, grip: 0.68, curveType: 'left', curveIntensity: 0.82, wallLimit: 0.98, obstacles: [{ at: 100, lane: 0.48, width: 0.3, type: 'boulder' }, { at: 270, lane: -0.48, width: 0.3, type: 'boulder' }, { at: 470, lane: 0, width: 0.34, type: 'rockfall' }, { at: 720, lane: 0.5, width: 0.3, type: 'boulder' }, { at: 900, lane: -0.45, width: 0.3, type: 'rockfall' }] },
  { id: 'coast', name: 'Coastal Highway', terrain: 'Wet coastal tarmac', surface: 'Wet asphalt', environment: 'coastal', scenery: ['ocean', 'shoreline', 'waves'], speedFactor: 1.08, grip: 0.94, curveType: 's-bend', curveIntensity: 0.62, wallLimit: 1.02, obstacles: [{ at: 240, lane: -0.5, width: 0.3, type: 'debris' }, { at: 510, lane: 0.5, width: 0.3, type: 'barrier' }, { at: 780, lane: 0, width: 0.32, type: 'debris' }] },
];
const cars = [
  { id: 'hyperion-x', name: 'Hyperion X', length: 4.35, width: 0.38, speed: 1.28, handling: 1.02, color: '#d91f36', bodyStyle: 'hypercar' },
  { id: 'vortex-gt', name: 'Vortex GT', length: 4.42, width: 0.39, speed: 1.24, handling: 1.08, color: '#1678d4', bodyStyle: 'coupe' },
  { id: 'phantom-rs', name: 'Phantom RS', length: 4.55, width: 0.4, speed: 1.2, handling: 1.14, color: '#e5e7eb', bodyStyle: 'sedan' },
  { id: 'striker-r', name: 'Striker R', length: 4.28, width: 0.38, speed: 1.3, handling: 0.98, color: '#f0a51b', bodyStyle: 'track' },
  { id: 'eclipse-ev', name: 'Eclipse EV', length: 4.48, width: 0.39, speed: 1.18, handling: 1.2, color: '#20b8a5', bodyStyle: 'electric' },
  { id: 'titan-suv', name: 'Titan Sport', length: 4.72, width: 0.43, speed: 1.12, handling: 1.06, color: '#6b7280', bodyStyle: 'suv' },
  { id: 'raptor-x', name: 'Raptor X', length: 4.6, width: 0.41, speed: 1.22, handling: 0.96, color: '#8b5cf6', bodyStyle: 'muscle' },
  { id: 'zenith-roadster', name: 'Zenith Roadster', length: 4.18, width: 0.37, speed: 1.25, handling: 1.16, color: '#f472b6', bodyStyle: 'roadster' },
  { id: 'aurora-gt', name: 'Aurora GT', length: 4.38, width: 0.38, speed: 1.16, handling: 1.26, color: '#84cc16', bodyStyle: 'grandtourer' },
  { id: 'nova-concept', name: 'Nova Concept', length: 4.32, width: 0.38, speed: 1.32, handling: 1.0, color: '#38bdf8', bodyStyle: 'concept' },
];
const clone = (value) => JSON.parse(JSON.stringify(value));

export function calculateCarRacingSettlement(totalEntryPoolSantim) {
  const grossSantim = Math.max(0, Math.floor(Number(totalEntryPoolSantim) || 0));
  const companyShareSantim = Math.floor(grossSantim * CAR_RACING_COMPANY_PERCENT / 100);
  const prizePoolSantim = Math.min(
    Math.floor(grossSantim * CAR_RACING_POOL_PERCENT / 100),
    CAR_RACING_MAX_PRIZE_ETB * 100,
  );
  return { grossSantim, companyShareSantim, prizePoolSantim };
}

export function createCarRacingDemoService({ realMoneyEnabled = false, isRealMoneyEnabled, now = Date.now } = {}) {
  const realMoneyIsEnabled = typeof isRealMoneyEnabled === 'function' ? isRealMoneyEnabled : () => realMoneyEnabled;
  let gameRunning = true;
  function assertRunning() {
    if (!gameRunning) throw new HttpError(503, 'car_racing_stopped', 'Car Racing is currently stopped by the host.');
  }
  function stopAllRooms(reason = 'host_stopped') {
    const at = now();
    for (const room of rooms.values()) {
      if (room.status === 'finished') continue;
      room.status = 'finished';
      room.endReason = reason;
      room.finishedAt = at;
      room.countdownEndsAt = null;
      for (const p of room.players) {
        p.throttle = 0; p.steer = 0; p.reverse = false; p.boost = false; p.brake = false; p.velocity = 0;
      }
    }
  }
  const rooms = new Map();
  const playerRooms = new Map();
  const balances = new Map();
  let roundSequence = 0;

  function assertDemo() {
    if (realMoneyIsEnabled()) throw new HttpError(503, 'car_racing_demo_only', 'Car Racing is unavailable while real-money play is enabled.');
  }
  function balance(userId) {
    if (!balances.has(userId)) balances.set(userId, 100_000);
    return balances.get(userId);
  }
  function plateFor(userId) {
    // Stable, collision-free encoding of the account ID; survives restarts without a schema change.
    const id = String(userId);
    const bytes = /^[a-f0-9]{24}$/i.test(id) ? Buffer.from(id, 'hex') : Buffer.from(id, 'utf8');
    const encoded = BigInt(`0x${bytes.toString('hex') || '0'}`).toString(36).toUpperCase();
    return `BGB-${bytes.length.toString(36).toUpperCase()}-${encoded}`;
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
      countdownEndsAt: room.countdownEndsAt, startedAt: room.startedAt, finishedAt: room.finishedAt, endReason: room.endReason ?? null,
      winner: room.winner ? { userId: room.winner.userId, name: room.winner.name, plateNumber: room.winner.plateNumber, payoutEtb: room.winner.payoutSantim / 100 } : null,
      settlement: room.settlement ? {
        resultId: room.settlement.resultId,
        verified: true,
        verificationMethod: 'server-authoritative',
        reason: room.settlement.reason,
        settledAt: room.settlement.settledAt,
        winnerUserId: room.settlement.winnerUserId,
        winnerPlateNumber: room.settlement.winnerPlateNumber,
        totalEntryPoolEtb: room.settlement.totalEntryPoolSantim / 100,
        companyShareEtb: room.settlement.companyShareSantim / 100,
        prizePoolEtb: room.settlement.prizePoolSantim / 100,
        companyPercent: room.settlement.companyPercent,
        poolPercent: room.settlement.poolPercent,
        payoutCapEtb: room.settlement.payoutCapSantim / 100,
        finishOrder: clone(room.settlement.finishOrder),
      } : null,
      collisionEvents: clone((room.collisionEvents ?? []).slice(-12)),
      players: room.players.map((p) => ({
        userId: p.userId, name: p.name, car: cars.find((c) => c.id === p.carId)?.name ?? 'GT Sport',
        carId: p.carId, plateNumber: p.plateNumber, ready: p.ready, progress: Math.min(100, Math.round(p.progress / 10)),
        lane: p.lane, speed: Math.round(Math.abs(p.velocity) * 100), finished: p.finished,
        damage: p.damage ?? 0, collisionEvent: p.collisionEvent ?? null,
        eliminated: p.eliminated === true, eliminationReason: p.eliminationReason ?? null, eliminatedAt: p.eliminatedAt ?? null,
        isMe: p.userId === userId,
      })),
    };
  }
  function settle(room, winner, at, reason = 'finish_line') {
    if (room.status === 'finished') return;
    // Winner identity is verified against the unique, server-issued BGB plate roster.
    const plateMatches = room.players.filter((p) => p.plateNumber === winner?.plateNumber);
    const verifiedWinner = room.players.find((p) =>
      p.userId === winner?.userId && p.plateNumber === winner?.plateNumber
    );
    const platesAreUnique = new Set(room.players.map((p) => p.plateNumber)).size === room.players.length;
    if (!platesAreUnique || plateMatches.length !== 1 || !verifiedWinner || verifiedWinner.eliminated) {
      throw new HttpError(409, 'invalid_race_winner', 'The server could not verify a unique eligible winner plate.');
    }
    if (reason === 'finish_line' && verifiedWinner.progress < 1000) {
      throw new HttpError(409, 'winner_not_at_finish', 'A finish-line winner must cross the server-verified finish line.');
    }

    // One synchronous, idempotent simulation-only settlement; no client-supplied result or payout is accepted.
    const { grossSantim, companyShareSantim, prizePoolSantim } = calculateCarRacingSettlement(room.poolSantim);
    room.companyShareSantim = companyShareSantim;
    room.prizeSantim = prizePoolSantim;
    verifiedWinner.payoutSantim = prizePoolSantim;
    verifiedWinner.finished = true;
    verifiedWinner.finishedAt = at;
    balances.set(verifiedWinner.userId, balance(verifiedWinner.userId) + prizePoolSantim);
    room.winner = {
      userId: verifiedWinner.userId,
      name: verifiedWinner.name,
      plateNumber: verifiedWinner.plateNumber,
      payoutSantim: prizePoolSantim,
    };
    room.status = 'finished';
    room.finishedAt = at;
    const finishOrder = [...room.players]
      .sort((a, b) => (a.userId === verifiedWinner.userId ? -1 : b.userId === verifiedWinner.userId ? 1 : b.progress - a.progress))
      .map((p, index) => ({
        position: index + 1,
        plateNumber: p.plateNumber,
        progress: Math.min(100, Math.round(p.progress / 10)),
        status: p.eliminated ? 'eliminated' : p.userId === verifiedWinner.userId ? 'winner' : p.finished || p.progress >= 1000 ? 'finished' : 'racing',
      }));
    room.settlement = {
      resultId: `BGR-${randomBytes(8).toString('hex').toUpperCase()}`,
      reason,
      settledAt: at,
      totalEntryPoolSantim: grossSantim,
      companyShareSantim,
      prizePoolSantim,
      companyPercent: CAR_RACING_COMPANY_PERCENT,
      poolPercent: CAR_RACING_POOL_PERCENT,
      payoutCapSantim: CAR_RACING_MAX_PRIZE_ETB * 100,
      winnerUserId: verifiedWinner.userId,
      winnerPlateNumber: verifiedWinner.plateNumber,
      finishOrder,
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
    room.collisionEvents ??= [];
    for (const p of room.players) {
      if (p.finished || p.eliminated) continue;
      const car = cars.find((item) => item.id === p.carId) ?? cars[0];
      const controlFresh = at - p.controlAt < 1500;
      const throttle = controlFresh ? p.throttle : 0;
      const steer = controlFresh ? p.steer : 0;
      const reverse = controlFresh && p.reverse;
      const boost = controlFresh && p.boost;
      const brake = controlFresh && p.brake;
      const curveWave = room.track.curveType === 's-bend' ? Math.sin((p.progress / 1000) * Math.PI * 2) : 1;
      const damagePenalty = Math.max(0.55, 1 - (p.damage ?? 0) * 0.004);
      const curveForce = (room.track.curveType === 'left' ? -1 : room.track.curveType === 'right' ? 1 : room.track.curveType === 's-bend' ? curveWave : 0) * room.track.curveIntensity;
      p.lane += steer * car.handling * damagePenalty * dt * 1.7 - curveForce * dt * 0.1;
      if (Math.abs(p.lane) >= room.track.wallLimit) {
        const severity = Math.abs(p.velocity) >= 0.72 ? 'severe' : 'medium';
        const event = { id: `${at}-${p.userId}-wall`, at, type: 'wall', severity, participants: [p.userId] };
        room.collisionEvents.push(event); p.collisionEvent = event; p.damage = Math.min(100, (p.damage ?? 0) + (severity === 'severe' ? 100 : 38));
        if (severity === 'severe' || p.damage >= 100) { p.eliminated = true; p.eliminationReason = 'wall'; p.eliminatedAt = at; }
        p.velocity = p.eliminated ? 0 : p.velocity * 0.28; p.throttle = 0; p.steer = 0; p.reverse = false; p.boost = false; p.brake = false;
        continue;
      }
      const gripPenalty = (Math.abs(p.lane) > room.track.grip ? 0.62 : 1) * damagePenalty;
      const acceleration = throttle * (reverse ? 1.05 : boost ? 1.3 : 0.8);
      const drag = throttle ? 0 : dt * (brake ? 4.2 : 0.7);
      const nextVelocity = brake
        ? Math.sign(p.velocity) * Math.max(0, Math.abs(p.velocity) - drag)
        : p.velocity + (reverse ? -acceleration : acceleration) * dt + (p.velocity > 0 ? -drag : p.velocity < 0 ? drag : 0);
      p.velocity = Math.max(-0.55, Math.min(boost ? 1.35 : 1, nextVelocity));
      const obstacle = room.track.obstacles[p.obstacleIndex];
      const nextProgress = p.progress + p.velocity * car.speed * room.track.speedFactor * gripPenalty * dt * 145;
      if (p.velocity > 0 && obstacle && p.progress < obstacle.at && nextProgress >= obstacle.at) {
        p.obstacleIndex += 1;
        if (Math.abs(p.lane - obstacle.lane) <= obstacle.width) {
          p.progress = obstacle.at;
          const impact = Math.abs(p.velocity); const severity = impact >= 0.82 ? 'severe' : impact >= 0.42 ? 'medium' : 'light';
          const event = { id: `${at}-${p.userId}-${obstacle.at}`, at, type: obstacle.type || 'obstacle', severity, participants: [p.userId] };
          room.collisionEvents.push(event); p.collisionEvent = event;
          p.damage = Math.min(100, (p.damage ?? 0) + (severity === 'severe' ? 100 : severity === 'medium' ? 38 : 12));
          if (severity === 'severe' || p.damage >= 100) { p.eliminated = true; p.eliminationReason = obstacle.type || 'obstacle'; p.eliminatedAt = at; }
          p.velocity = p.eliminated ? 0 : p.velocity * (severity === 'medium' ? 0.24 : 0.72);
          p.throttle = 0; p.boost = false;
          if (p.eliminated) { p.steer = 0; p.reverse = false; continue; }
        }
      }
      const gain = p.velocity * car.speed * room.track.speedFactor * gripPenalty * dt * 145;
      const next = Math.max(0, p.progress + gain);
      if (gain > 0 && next >= 1000) {
        const crossing = at - dt * ((1000 - p.progress) / Math.max(gain, 0.001));
        p.progress = 1000;
        finishers.push({ player: p, at: crossing });
      } else p.progress = next;
    }
    // Server-authoritative oriented body bounds use each selected car's length and width.
    const active = room.players.filter((p) => !p.finished && !p.eliminated);
    for (let i = 0; i < active.length; i += 1) for (let j = i + 1; j < active.length; j += 1) {
      const a = active[i], b = active[j];
      const carA = cars.find((item) => item.id === a.carId) ?? cars[0];
      const carB = cars.find((item) => item.id === b.carId) ?? cars[0];
      const longitudinalOverlap = (carA.length + carB.length) / 2;
      const lateralOverlap = (carA.width + carB.width) / 2;
      if (Math.abs(a.progress - b.progress) > longitudinalOverlap || Math.abs(a.lane - b.lane) > lateralOverlap) continue;
      if (a.lastCollisionAt && at - a.lastCollisionAt < 850) continue;
      const closingSpeed = Math.abs(a.velocity - b.velocity);
      const impact = Math.max(closingSpeed, Math.min(Math.abs(a.velocity), Math.abs(b.velocity)) * 0.9);
      const severity = impact >= 0.82 ? 'severe' : impact >= 0.42 ? 'medium' : 'light';
      const event = { id: `${at}-${a.userId}-${b.userId}`, at, type: 'car-to-car', severity, participants: [a.userId, b.userId] };
      room.collisionEvents.push(event);
      for (const p of [a, b]) {
        p.collisionEvent = event; p.lastCollisionAt = at;
        p.damage = Math.min(100, (p.damage ?? 0) + (severity === 'severe' ? 100 : severity === 'medium' ? 32 : 8));
        const eliminated = severity === 'severe' || p.damage >= 100;
        if (eliminated) { p.eliminated = true; p.eliminationReason = 'car-to-car'; p.eliminatedAt = at; p.steer = 0; p.reverse = false; }
        p.velocity = eliminated ? 0 : p.velocity * (severity === 'medium' ? 0.42 : 0.78);
        p.lane += p === a ? -0.14 : 0.14;
        p.throttle = 0; p.boost = false;
      }
    }
    if (room.collisionEvents.length > 40) room.collisionEvents.splice(0, room.collisionEvents.length - 40);
    finishers.sort((a, b) => a.at - b.at);
    const validFinishers = finishers.filter(({ player: finisher }) => !finisher.eliminated);
    if (validFinishers.length) settle(room, validFinishers[0].player, validFinishers[0].at, 'finish_line');
    if (room.status === 'racing' && room.players.every((p) => p.finished || p.eliminated)) {
      room.status = 'finished'; room.finishedAt = at; room.endReason = 'all_eliminated';
    }
    if (room.status === 'racing' && at - room.startedAt > 90_000) {
      const leader = room.players.filter((p) => !p.eliminated).sort((a, b) => b.progress - a.progress)[0];
      if (leader) settle(room, leader, at, 'time_limit');
      else { room.status = 'finished'; room.finishedAt = at; room.endReason = 'all_eliminated'; }
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
    const seat = room.players.length;
    const startingLane = (seat % 2 === 0 ? -1 : 1) * (Math.floor(seat / 2) + 1) * 0.24;
    room.players.push({ userId: user.id, name: String(user.name || 'Driver').slice(0, 28), carId: 'sport', plateNumber: plateFor(user.id), ready: false, progress: 0, lane: startingLane, velocity: 0, throttle: 0, steer: 0, reverse: false, boost: false, brake: false, controlAt: 0, obstacleIndex: 0, damage: 0, collisionEvent: null, lastCollisionAt: 0, finished: false, eliminated: false, eliminationReason: null, eliminatedAt: null });
    playerRooms.set(user.id, room.id);
  }

  return {
    setRunning(enabled) {
      gameRunning = enabled === true;
      if (!gameRunning) stopAllRooms('host_stopped');
      return gameRunning;
    },
    getCatalog() {
      return { enabled: !realMoneyIsEnabled(), simulationOnly: true, currency: 'DEMO ETB', maxPlayers: 8, minPlayers: 2, maxPrizeEtb: CAR_RACING_MAX_PRIZE_ETB, companyPercent: 55, poolPercent: 45, tracks: clone(tracks.map(({ obstacles, ...t }) => t)), cars: clone(cars) };
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
      assertRunning();
      if (playerRooms.has(user.id)) throw new HttpError(409, 'already_in_race', 'Leave your current race before creating another.');
      const fee = Number(input.entryFeeEtb);
      if (!Number.isInteger(fee) || fee < 5 || fee > 500) throw new HttpError(400, 'invalid_entry_fee', 'Entry fee must be between 5 and 500 simulation ETB.');
      if (balance(user.id) < fee * 100) throw new HttpError(400, 'insufficient_demo_credits', 'Not enough simulation credits.');
      const track = tracks[roundSequence % tracks.length];
      roundSequence += 1;
      const id = randomBytes(12).toString('hex');
      const room = { id, code: randomBytes(3).toString('hex').toUpperCase(), status: 'lobby', track: clone(track), entryFeeEtb: fee, poolSantim: 0, companyShareSantim: 0, prizeSantim: 0, players: [], createdAt: now(), countdownEndsAt: null, startedAt: null, finishedAt: null, winner: null, collisionEvents: [] };
      rooms.set(id, room);
      joinPlayer(room, user);
      return publicRoom(room, user.id);
    },
    joinRoom(user, input = {}) {
      assertDemo();
      assertRunning();
      const code = String(input.code || '').trim().toUpperCase();
      const room = [...rooms.values()].find((r) => r.code === code);
      if (!room) throw new HttpError(404, 'room_not_found', 'Race code not found.');
      joinPlayer(room, user);
      return publicRoom(room, user.id);
    },
    chooseCar(user, input = {}) {
      assertRunning();
      const room = findRoom(user.id, input.roomId);
      if (room.status !== 'lobby') throw new HttpError(409, 'race_started', 'Car selection is closed after the race starts.');
      const p = player(room, user.id);
      p.carId = validateCar(input.carId);
      return publicRoom(room, user.id);
    },
    setReady(user, input = {}) {
      assertRunning();
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
      assertRunning();
      const room = findRoom(user.id, input.roomId);
      if (room.status !== 'racing') throw new HttpError(409, 'race_not_running', 'The race is not running.');
      const p = player(room, user.id);
      if (p.eliminated) throw new HttpError(409, 'driver_eliminated', 'You have been eliminated from this race.');
      p.brake = input.brake === true;
      p.throttle = p.brake ? 0 : Math.max(0, Math.min(1, Number(input.throttle) || 0));
      p.steer = Math.max(-1, Math.min(1, Number(input.steer) || 0));
      p.reverse = input.reverse === true;
      p.boost = input.boost === true && !p.reverse && !p.brake;
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
