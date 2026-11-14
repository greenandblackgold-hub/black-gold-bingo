/**
 * Server-mode providers. They fill the SAME contexts as the demo providers
 * (PlayerContext, RoundContext, BackendContext), so PlayView, WalletView, VerifyView and
 * HostView work unchanged: the difference is that wallets, cards, the game state and every
 * win decision now live on the server.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useAuth } from '@/context/AuthContext';
import { BackendContext } from '@/context/BackendContext';
import { PlayerContext } from '@/context/PlayerContext';
import { RoundContext } from '@/context/RoundContext';
import { usePlayer } from '@/context/PlayerContext';
import { play } from '@/lib/audio';
import { API_URL, api, ApiError, type ServerGameState } from '@/lib/api';
import type { BingoCard, GameBackend, PlayerContextValue, RoundContextValue, Tx, VerifyResult, WinPattern } from '@/types/game';

const MARKS_KEY = 'bgb.marks';
const NOOP_BACKEND = (canHost: boolean): GameBackend => ({
  kind: 'server',
  canHost,
  subscribeGame: () => () => undefined,
  saveGame: async () => undefined,
  submitClaim: async () => undefined,
  subscribeClaims: () => () => undefined,
  removeClaim: async () => undefined,
  clearClaims: async () => undefined,
});

function loadMarks(): Record<string, number[]> {
  try {
    const raw = localStorage.getItem(MARKS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number[]>) : {};
  } catch {
    return {};
  }
}

/* ───────────── player: balance, cards, ledger ───────────── */

function ServerPlayerProvider({ children }: { children: ReactNode }) {
  const { user, refresh } = useAuth();
  const [cards, setCards] = useState<BingoCard[]>([]);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [markedByCard, setMarks] = useState<Record<string, number[]>>(loadMarks);
  const marksRef = useRef(markedByCard);
  marksRef.current = markedByCard;

  const reloadCards = useCallback(async () => {
    try {
      setCards(await api.get<BingoCard[]>('/api/cards'));
    } catch {
      /* keep what we have */
    }
  }, []);
  const reloadLedger = useCallback(async () => {
    try {
      setTransactions(await api.get<Tx[]>('/api/ledger'));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void reloadCards();
    void reloadLedger();
  }, [reloadCards, reloadLedger]);

  useEffect(() => {
    try {
      localStorage.setItem(MARKS_KEY, JSON.stringify(markedByCard));
    } catch {
      /* ignore */
    }
  }, [markedByCard]);

  // Marks are only a convenience on this device: the server decides wins from its own record.
  const toggleMark = useCallback((cardId: string, n: number) => {
    const has = (marksRef.current[cardId] ?? []).includes(n);
    play(has ? 'unmark' : 'mark');
    setMarks((s) => {
      const cur = s[cardId] ?? [];
      return { ...s, [cardId]: cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n] };
    });
  }, []);

  const buyCards = useCallback(
    async (count: number, serial?: string) => {
      try {
        await api.post('/api/cards/buy', { count, ...(serial ? { serial } : {}) });
        play('coin');
        await Promise.all([reloadCards(), reloadLedger(), refresh()]);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof ApiError && e.status !== 402 ? e.message : undefined };
      }
    },
    [reloadCards, reloadLedger, refresh],
  );

  // New round: forget old marks, fetch this round's (empty) card list and the fresh balance.
  const clearCards = useCallback(() => {
    setMarks({});
    void reloadCards();
    void reloadLedger();
    void refresh();
  }, [reloadCards, reloadLedger, refresh]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      balance: user?.balance ?? 0,
      cards,
      markedByCard,
      transactions,
      toggleMark,
      // Real deposits go through Chapa (see ChapaDepositPanel); this demo hook is intentionally unusable here.
      deposit: async () => {
        throw new Error('Deposits use Chapa in server mode');
      },
      buyCards,
      clearCards,
    }),
    [user, cards, markedByCard, transactions, toggleMark, buyCards, clearCards],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

/* ───────────── round: live state over server-sent events ───────────── */

function ServerRoundProvider({ children }: { children: ReactNode }) {
  const { user, refresh } = useAuth();
  const { clearCards } = usePlayer();
  const { setGameSettings } = useAppSettings();
  const [game, setGame] = useState<ServerGameState | null>(null);
  const [offset, setOffset] = useState(0); // server clock minus device clock
  const canHost = user?.role === 'admin';

  const apply = useCallback((s: ServerGameState) => {
    setGame(s);
    setOffset(s.serverTime - Date.now());
    setGameSettings({ cardPrice: s.cardPrice, roomId: s.roomId });
  }, [setGameSettings]);

  useEffect(() => {
    const es = new EventSource(`${API_URL}/api/stream`);
    es.addEventListener('game', (e) => apply(JSON.parse((e as MessageEvent<string>).data) as ServerGameState));
    return () => es.close();
  }, [apply]);

  // Bell on every device for each new number (not for the first snapshot).
  const prevLen = useRef<number | null>(null);
  const len = game?.calledNumbers.length ?? null;
  useEffect(() => {
    if (len === null) return;
    if (prevLen.current !== null && len > prevLen.current) play('call');
    prevLen.current = len;
  }, [len]);

  // New round or a decided round: refresh cards and balance.
  const round = game?.roundNumber ?? null;
  const seenRound = useRef<number | null>(null);
  useEffect(() => {
    if (round === null) return;
    if (seenRound.current !== null && seenRound.current !== round) clearCards();
    seenRound.current = round;
  }, [round, clearCards]);
  const winnerAt = game?.winner?.at ?? null;
  useEffect(() => {
    if (winnerAt !== null) void refresh(); // the prize may have just been paid
  }, [winnerAt, refresh]);

  const admin = useCallback(
    async (path: string, body: unknown = {}) => {
      try {
        apply(await api.post<ServerGameState>(`/api/admin/${path}`, body));
      } catch {
        /* the stream shows the real state; ignore 409s such as "round already running" */
      }
    },
    [apply],
  );

  const claimBingo = useCallback(async (cardId: string) => {
    try {
      const r = await api.post<{ ok: boolean }>('/api/claim', { cardId });
      if (!r.ok) play('error');
      return { ok: r.ok };
    } catch {
      play('error');
      return { ok: false };
    }
  }, []);

  const verifyCard = useCallback(async (cardId: string): Promise<VerifyResult> => {
    try {
      const r = await api.post<{
        status: VerifyResult['status'];
        isWinner?: boolean;
        winningLine?: VerifyResult['winningLine'];
        card?: { id: string; serial: string | number; grid?: (number | null)[][] };
      }>('/api/verify', { cardId });
      return {
        status: r.status,
        isWinner: r.isWinner,
        winningLine: r.winningLine,
        card: r.card?.grid ? { id: r.card.id, serial: r.card.serial, grid: r.card.grid } : undefined,
      };
    } catch (e) {
      if (e instanceof ApiError && e.status !== 0) return { status: 'not_found' };
      throw e;
    }
  }, []);

  const g = game;
  const value = useMemo<RoundContextValue>(
    () => ({
      roomId: g?.roomId ?? '',
      loaded: g !== null,
      canHost,
      phase: g?.phase ?? 'waiting',
      winPattern: g?.winPattern ?? 'any_line',
      setWinPattern: (pattern: WinPattern) => void admin('pattern', { pattern }),
      roundNumber: g?.roundNumber ?? 1,
      calledNumbers: g?.calledNumbers ?? [],
      winner: g?.winner ?? null,
      claims: [], // the server judges claims instantly; there is nothing for a host to review
      startRound: () => void admin('round/start'),
      endRound: () => void admin('round/end'),
      resetRound: () => void admin('round/reset'),
      drawNext: () => {
        void admin('draw');
        return null;
      },
      acceptClaim: async () => false,
      rejectClaim: async () => undefined,
      claimBingo,
      verifyCard,
      autoCall: g?.autoCall ?? false,
      setAutoCall: (on: boolean) => void admin('auto', { on, intervalSec: g?.callIntervalSec ?? 5 }),
      callIntervalSec: g?.callIntervalSec ?? 5,
      setCallIntervalSec: (sec: number) => void admin('auto', { on: g?.autoCall ?? false, intervalSec: sec }),
      nextCallAt: g?.nextCallAt != null ? g.nextCallAt - offset : null,
    }),
    [g, canHost, offset, admin, claimBingo, verifyCard],
  );

  return <RoundContext.Provider value={value}>{children}</RoundContext.Provider>;
}

export function ServerProviders({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const backend = useMemo(() => NOOP_BACKEND(user?.role === 'admin'), [user?.role]);
  return (
    <BackendContext.Provider value={backend}>
      <ServerPlayerProvider>
        <ServerRoundProvider>{children}</ServerRoundProvider>
      </ServerPlayerProvider>
    </BackendContext.Provider>
  );
}
