/**
 * src/lib/mockServer.ts
 *
 * DEMO "game server" that runs in the browser so the app works with no backend.
 * It keeps a signed registry of every issued card in localStorage and answers
 * verify / claim requests from that registry, never from the player's marks.
 *
 * A real deployment must do this on an actual server: the signing secret below
 * is visible to anyone who opens DevTools, so this proves the flow, not security.
 */
import type { BingoCard, VerifyResult } from '@/types/game';
import { findWinningLine } from '@/lib/bingo';

const KEY = 'bgb.registry';
const SECRET = 'black-gold-demo-only';

interface Entry {
  id: string;
  serial: string | number;
  grid: (number | null)[][];
  sig: string;
}

type Registry = Record<string, Entry>;

/** FNV-1a 32-bit hash, enough for a demo signature. */
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const sign = (id: string, grid: (number | null)[][]) => fnv1a(`${SECRET}|${id}|${JSON.stringify(grid)}`);

function read(): Registry {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Registry) : {};
  } catch {
    return {};
  }
}

function write(registry: Registry): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(registry));
  } catch {
    /* storage full or unavailable: demo continues without persistence */
  }
}

export function registerCard(card: BingoCard): void {
  const registry = read();
  registry[card.id] = { id: card.id, serial: card.serial, grid: card.grid, sig: sign(card.id, card.grid) };
  write(registry);
}

/** Cards expire when a round is reset. */
export function purgeRegistry(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function serverVerify(cardId: string, called: number[], local?: BingoCard): VerifyResult {
  const entry = read()[cardId];
  if (!entry) return { status: 'not_found' };

  const signatureOk = sign(entry.id, entry.grid) === entry.sig;
  const localOk = !local || JSON.stringify(local.grid) === JSON.stringify(entry.grid);
  if (!signatureOk || !localOk) return { status: 'tampered' };

  const line = findWinningLine(entry.grid, new Set(called));
  return {
    status: 'valid',
    card: { id: entry.id, serial: entry.serial, grid: entry.grid },
    isWinner: line !== null,
    winningLine: line ?? undefined,
  };
}

export function serverClaim(cardId: string, called: number[], local?: BingoCard): boolean {
  const res = serverVerify(cardId, called, local);
  return res.status === 'valid' && res.isWinner === true;
}
