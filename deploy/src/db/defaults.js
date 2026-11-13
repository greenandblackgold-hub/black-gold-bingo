export const DEFAULT_GAME = {
  phase: 'waiting', // waiting | running | ended
  roundNumber: 1,
  calledNumbers: [],
  autoCall: false,
  callIntervalSec: 5,
  nextCallAt: null,
  winner: null, // { cardCode, serial, userId, at }
  pot: 0, // santim collected from card sales this round
  version: 0,
};
