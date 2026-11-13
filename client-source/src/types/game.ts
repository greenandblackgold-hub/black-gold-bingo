/**
 * src/types/game.ts
 *
 * Shared types for Black Gold PLC Bingo PRO. PlayerContext and RoundContext
 * implement PlayerContextValue / RoundContextValue, and every view reads
 * them through the context hooks with no casts.
 */

export type Lang = 'am' | 'ti' | 'en';
export type Phase = 'waiting' | 'running' | 'ended';
export type PayMethod = 'telebirr' | 'cbe';

/** [row, column] on a 5x5 card. */
export type Pos = [number, number];

export interface BingoCard {
  id: string;
  serial: string | number;
  /** 5x5 grid, null = FREE center. */
  grid: (number | null)[][];
}

export interface Tx {
  id: string;
  kind: 'deposit' | 'purchase';
  /** > 0 money in, < 0 money out (ETB). */
  amount: number;
  label?: string;
  /** epoch ms */
  at: number;
}

export interface VerifyResult {
  status: 'valid' | 'not_found' | 'tampered';
  card?: BingoCard & { marked?: number[] };
  /** Must come from the server, never computed in the browser. */
  isWinner?: boolean;
  winningLine?: Pos[];
}

export interface PlayerContextValue {
  /** ETB */
  balance: number;
  cards: BingoCard[];
  markedByCard: Record<string, number[]>;
  toggleMark: (cardId: string, n: number) => void;
  transactions?: Tx[];
  deposit: (amount: number, method: PayMethod, reference: string) => Promise<void>;
  buyCards: (count: number) => Promise<{ ok: boolean; error?: string }>;
  /** Removes all cards and marks (called when a new round is set up). */
  clearCards: () => void;
}

/** Game state shared by everyone. Only the host may write it. */
export interface SharedGame {
  phase: Phase;
  roundNumber: number;
  /** In call order, values 1..75. */
  calledNumbers: number[];
  autoCall: boolean;
  /** 1..60 */
  callIntervalSec: number;
  /** epoch ms of the next scheduled auto-call, or null */
  nextCallAt: number | null;
  /** Set by the host when a claim is accepted. */
  winner: { cardId: string; serial: string | number; at: number } | null;
}

/** A player's "BINGO!" request, reviewed by the host. */
export interface Claim {
  /** The claiming player's id (one open claim per player). */
  id: string;
  cardId: string;
  serial: string | number;
  grid: (number | null)[][];
  round: number;
  at: number;
}

/** A claim as the Control Center shows it, with the host-side checks. */
export interface HostClaim extends Claim {
  gridValid: boolean;
  /** The submitted grid has a complete line of called numbers. */
  wins: boolean;
  /** This device's card registry also knows the card (only possible in single-browser demo mode). */
  originVerified: boolean;
}

/**
 * Where the shared game lives.
 *  - 'artifact'    hosted page: shared db, host = the page owner, writes enforced by db rules
 *  - 'local'       single-browser demo (dev / zip): same-browser tabs sync through localStorage
 *  - 'unavailable' hosted page but no shared store for this viewer (not signed in)
 */
export interface GameBackend {
  kind: 'artifact' | 'local' | 'server' | 'unavailable';
  /** True only for the host/owner. UI hides controls with it, and the store refuses everyone else's writes. */
  canHost: boolean;
  subscribeGame: (cb: (game: SharedGame | null) => void) => () => void;
  saveGame: (game: SharedGame) => Promise<void>;
  submitClaim: (claim: Omit<Claim, 'id'>) => Promise<void>;
  subscribeClaims: (cb: (claims: Claim[]) => void) => () => void;
  removeClaim: (id: string) => Promise<void>;
  clearClaims: () => Promise<void>;
}

export interface RoundContextValue {
  roomId: string;
  /** True once the first game state has arrived. */
  loaded: boolean;
  /** True only for the host. Every host action below is a no-op for players. */
  canHost: boolean;
  phase: Phase;
  roundNumber: number;
  /** In call order, values 1..75. */
  calledNumbers: number[];
  winner: SharedGame['winner'];
  /** Host only: open claims for the current round (empty for players). */
  claims: HostClaim[];
  /** waiting -> running (host only) */
  startRound: () => void;
  /** running -> ended (host only) */
  endRound: () => void;
  /** ended -> waiting: clears numbers, increments the round, every device clears its cards (host only). */
  resetRound: () => void;
  /** Host only. Returns null when all 75 are drawn, the round is not running, or the caller is not the host. */
  drawNext: () => number | null;
  /** Host only: accept a claim, end the round and record the winner. */
  acceptClaim: (claimId: string) => Promise<boolean>;
  /** Host only: dismiss a claim. */
  rejectClaim: (claimId: string) => Promise<void>;
  /** Player: check the card on this device, then send the claim to the host. ok = claim sent. */
  claimBingo: (cardId: string) => Promise<{ ok: boolean }>;
  verifyCard: (cardId: string) => Promise<VerifyResult>;
  /** The auto-call timer runs in the host's RoundContext (host only). */
  autoCall: boolean;
  setAutoCall: (on: boolean) => void;
  /** 1..60 */
  callIntervalSec: number;
  setCallIntervalSec: (sec: number) => void;
  /** epoch ms of the next scheduled call, or null */
  nextCallAt: number | null;
}
