export const DEFAULT_GAME = {
  phase: 'waiting', // waiting | running | ended
  winPattern: 'any_line',
  roundNumber: 1,
  calledNumbers: [],
  autoCall: false,
  callIntervalSec: 5,
  nextCallAt: null,
  winner: null, // { cardCode, serial, userId, at }
  pot: 0, // santim collected from card sales this round
  roundPlayerIds: [], // private unique participant IDs; never included in public state
  prizeMode: 'revenue_percent',
  prizePercent: 45,
  fixedPrize: 0, // santim; fixed mode only
  roundPrize: null, // frozen santim for a fixed-prize round

  prizePerPlayer: 0,
  maxPrizeCap: 0, // zero means capped by gross revenue only
  roundIntervalMinutes: 10,
  // Sponsored bonus cycle; bonus rounds are excluded from the regular-round counter.
  regularRoundsSinceBonus: 0,
  lastCountedRegularRound: 0,
  lastCompletedRoundNumber: 0,
  lastCompletedWasBonus: false,
  bonusDue: false,
  bonusRound: false,
  bonusRoundPrepared: false,
  bonusSavedPrizeSettings: null,
  version: 0,
};
