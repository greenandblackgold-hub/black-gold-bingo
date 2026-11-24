/**
 * Server-mode providers. They fill the SAME contexts as the demo providers
 * (PlayerContext, RoundContext, BackendContext), so PlayView, WalletView, VerifyView and
 * HostView work unchanged: the difference is that wallets, cards, the game state and every
 * win decision now live on the server.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PushNotificationPrompt } from '@/components/notifications/PushNotificationPrompt';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useAuth } from '@/context/AuthContext';
import { BackendContext } from '@/context/BackendContext';
import { PlayerContext } from '@/context/PlayerContext';
import { RoundContext } from '@/context/RoundContext';
import { usePlayer } from '@/context/PlayerContext';
import { play } from '@/lib/audio';
import { API_URL, api, ApiError, type ServerGameState } from '@/lib/api';
import type { BingoCard, GameBackend, PlayerContextValue, RoundContextValue, Tx, VerifyResult, WinPattern } from '@/types/game';

const LEGACY_MARKS_KEY = 'bgb.marks';
const marksKeyFor = (userId: string) => `bgb.marks.${userId}`;
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

function loadMarks(userId?: string): Record<string, number[]> {
  try {
    const scoped = userId ? localStorage.getItem(marksKeyFor(userId)) : null;
    const legacy = localStorage.getItem(LEGACY_MARKS_KEY);
    const raw = scoped ?? legacy;
    const parsed = raw ? JSON.parse(raw) as Record<string, number[]> : {};
    if (userId && scoped === null && raw) {
      localStorage.setItem(marksKeyFor(userId), JSON.stringify(parsed));
      localStorage.removeItem(LEGACY_MARKS_KEY);
    }
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/* ───────────── player: balance, cards, ledger ───────────── */

function ServerPlayerProvider({ children }: { children: ReactNode }) {
  const { user, refresh } = useAuth();
  const [cards, setCards] = useState<BingoCard[]>([]);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [markedByCard, setMarks] = useState<Record<string, number[]>>(() => loadMarks(user?.id));
  const cardsRequestInFlight = useRef(false);
  const marksStorageKey = user?.id ? marksKeyFor(user.id) : LEGACY_MARKS_KEY;
  const marksRef = useRef(markedByCard);
  marksRef.current = markedByCard;

  const reloadCards = useCallback(async () => {
    if (cardsRequestInFlight.current) return;
    cardsRequestInFlight.current = true;
    try {
      const latest = await api.get<BingoCard[]>('/api/cards');
      if (Array.isArray(latest)) setCards(latest);
    } catch {
      // Preserve the last confirmed cards. Focus/online polling below retries automatically.
    } finally {
      cardsRequestInFlight.current = false;
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
    setCards([]);
    setMarks(loadMarks(user?.id));
    void reloadCards();
    void reloadLedger();
  }, [user?.id, reloadCards, reloadLedger]);

  // Recover card lists after refreshes and transient API failures without ever replacing
  // a previously confirmed list with an empty/error response.
  useEffect(() => {
    let active = true;
    const refreshCards = () => { if (active && document.visibilityState !== 'hidden') void reloadCards(); };
    const timer = window.setInterval(refreshCards, 15_000);
    window.addEventListener('focus', refreshCards);
    window.addEventListener('online', refreshCards);
    document.addEventListener('visibilitychange', refreshCards);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshCards);
      window.removeEventListener('online', refreshCards);
      document.removeEventListener('visibilitychange', refreshCards);
    };
  }, [reloadCards]);

  // Admin-side changes can affect the player's profile, cards, or ledger.
  // Re-fetch only authorized player data after receiving the invalidation signal.
  useEffect(() => {
    const refreshAfterAdminChange = () => {
      void Promise.allSettled([refresh(), reloadCards(), reloadLedger()]);
    };
    window.addEventListener('bgb:admin-change', refreshAfterAdminChange);
    return () => window.removeEventListener('bgb:admin-change', refreshAfterAdminChange);
  }, [refresh, reloadCards, reloadLedger]);

  // Deposits and automatically credited prizes change the server wallet outside the player's session.
  // Refresh the profile and ledger at most every five seconds, and immediately when the player returns.
  // Prevent overlapping requests when a slow network response outlasts the polling interval.
  useEffect(() => {
    let refreshInFlight = false;
    const refreshWallet = async () => {
      if (document.visibilityState === 'hidden' || refreshInFlight) return;
      refreshInFlight = true;
      try {
        await Promise.allSettled([refresh(), reloadLedger()]);
      } finally {
        refreshInFlight = false;
      }
    };
    const timer = window.setInterval(() => void refreshWallet(), 5_000);
    window.addEventListener('focus', refreshWallet);
    document.addEventListener('visibilitychange', refreshWallet);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshWallet);
      document.removeEventListener('visibilitychange', refreshWallet);
    };
  }, [refresh, reloadLedger]);

  useEffect(() => {
    try {
      localStorage.setItem(marksStorageKey, JSON.stringify(markedByCard));
    } catch {
      /* ignore */
    }
  }, [markedByCard, marksStorageKey]);

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
    async (count: number, serial?: string, preview?: { grid: (number | null)[][]; token?: string }) => {
      try {
        await api.post('/api/cards/buy', { count, ...(serial ? { serial } : {}), ...(preview ? { previewGrid: preview.grid, ...(preview.token ? { previewToken: preview.token } : {}) } : {}) });
        play('coin');
        await Promise.all([reloadCards(), reloadLedger(), refresh()]);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof ApiError && e.code === 'card_number_taken' ? 'ይህ ቁጥር ቀድሞ ተይዟል። ሌላ ቁጥር ይምረጡ።' : e instanceof ApiError && e.status !== 402 ? e.message : undefined };
      }
    },
    [reloadCards, reloadLedger, refresh],
  );

  // New round: forget old marks, fetch this round's (empty) card list and the fresh balance.
  const clearMarks = useCallback(() => {
    setMarks({});
  }, []);

  // Player preference: hide selected cards from this device only; never delete server records.
  const removeCards = useCallback((ids: string[]) => {
    const remove = new Set(ids);
    setCards((current) => current.filter((card) => !remove.has(card.id)));
  }, []);

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
      clearMarks,
      removeCards,
    }),
    [user, cards, markedByCard, transactions, toggleMark, buyCards, clearCards, clearMarks, removeCards],
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
  // Keep the prize announced for this round stable on the player device. The
  // waiting -> running stream transition must not blank the banner if a server
  // update briefly reports zero while the round snapshot is being propagated.
  const prizeSnapshot = useRef<{ roundNumber: number; amountEtb: number } | null>(null);
  const latestServerTime = useRef(0);

  const apply = useCallback((incoming: ServerGameState) => {
    if (!incoming || !Number.isFinite(incoming.serverTime) || incoming.serverTime < latestServerTime.current) return;
    latestServerTime.current = incoming.serverTime;
    const amountEtb = Number(incoming.roundPrizeEtb);
    const safeAmount = Number.isFinite(amountEtb) && amountEtb > 0 ? amountEtb : 0;
    const previous = prizeSnapshot.current;
    if (!previous || previous.roundNumber !== incoming.roundNumber) {
      prizeSnapshot.current = { roundNumber: incoming.roundNumber, amountEtb: safeAmount };
    } else if (safeAmount > 0) {
      prizeSnapshot.current = { roundNumber: incoming.roundNumber, amountEtb: safeAmount };
    }

    const snapshot = prizeSnapshot.current;
    const stableGame = incoming.phase !== 'waiting' &&
      snapshot?.roundNumber === incoming.roundNumber &&
      incoming.roundPrizeEtb < snapshot.amountEtb
      ? { ...incoming, roundPrizeEtb: snapshot.amountEtb }
      : incoming;

    setGame(stableGame);
    setOffset(incoming.serverTime - Date.now());
    setGameSettings({ cardPrice: incoming.cardPrice, roomId: incoming.roomId });
  }, [setGameSettings]);

  useEffect(() => {
    let active = true;
    let snapshotInFlight = false;
    const refreshSnapshot = async () => {
      if (!active || snapshotInFlight || document.visibilityState === 'hidden') return;
      snapshotInFlight = true;
      try { apply(await api.get<ServerGameState>('/api/game')); } catch { /* SSE reconnect and next poll retry */ }
      finally { snapshotInFlight = false; }
    };
    void refreshSnapshot();
    const poll = window.setInterval(() => void refreshSnapshot(), 15_000);
    window.addEventListener('focus', refreshSnapshot);
    window.addEventListener('online', refreshSnapshot);
    document.addEventListener('visibilitychange', refreshSnapshot);
    const es = new EventSource(`${API_URL}/api/stream`);
    es.addEventListener('game', (e) => {
      try { apply(JSON.parse((e as MessageEvent<string>).data) as ServerGameState); } catch { /* malformed event; snapshot fallback repairs it */ }
    });
    es.addEventListener('admin-change', () => window.dispatchEvent(new Event('bgb:admin-change')));
    es.addEventListener('app-version', (e) => {
      const detail = JSON.parse((e as MessageEvent<string>).data) as { buildPath?: string };
      window.dispatchEvent(new CustomEvent('bgb:app-version', { detail }));
    });
    return () => {
      active = false;
      window.clearInterval(poll);
      window.removeEventListener('focus', refreshSnapshot);
      window.removeEventListener('online', refreshSnapshot);
      document.removeEventListener('visibilitychange', refreshSnapshot);
      es.close();
    };
  }, [apply]);

  // Notify players when the host publishes a new announcement (not on the initial snapshot).
  const previousAnnouncementAt = useRef<number | null>(null);
  const announcementAt = game?.announcement?.at ?? null;
  useEffect(() => {
    if (announcementAt === null) return;
    if (previousAnnouncementAt.current !== null && announcementAt !== previousAnnouncementAt.current) {
      play('notification');
      if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('BLACK GOLD BINGO', {
            body: game?.announcement?.message ?? 'አዲስ ማስታወቂያ ደርሷል።',
            tag: 'black-gold-bingo-announcement',
            icon: '/favicon.svg',
          });
        } catch {
          /* Browser notifications may be unavailable in restricted contexts. */
        }
      }
    }
    previousAnnouncementAt.current = announcementAt;
  }, [announcementAt, game?.announcement?.message]);

  // Announce each newly prepared round while it is still waiting to start.
  const previousRoundNumber = useRef<number | null>(null);
  const roundNumber = game?.roundNumber ?? null;
  useEffect(() => {
    if (roundNumber === null) return;
    const isNewWaitingRound =
      previousRoundNumber.current !== null &&
      roundNumber !== previousRoundNumber.current &&
      game?.phase === 'waiting';
    if (isNewWaitingRound) {
      play('notification');
      if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('BLACK GOLD BINGO', {
            body: `Round ${roundNumber} is ready. Open the game to review the winning pattern before it starts.`,
            tag: `black-gold-bingo-round-${roundNumber}`,
            icon: '/favicon.svg',
          });
        } catch {
          /* Browser notifications may be unavailable in restricted contexts. */
        }
      }
    }
    previousRoundNumber.current = roundNumber;
  }, [roundNumber, game?.phase]);

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

  const claimBingo = useCallback(async (cardId: string, expectedCallCount: number) => {
    try {
      const r = await api.post<{ ok: boolean }>('/api/claim', { cardId, expectedCallCount });
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
      bonusRound: g?.bonusRound ?? false,
      winPattern: g?.winPattern ?? 'any_line',
      setWinPattern: (pattern: WinPattern) => void admin('pattern', { pattern }),
      roundNumber: g?.roundNumber ?? 1,
      calledNumbers: g?.calledNumbers ?? [],
      winner: g?.winner ?? null,
      roundPrizeEtb: g?.roundPrizeEtb ?? 0,
      roundCardCount: g?.roundCardCount ?? 0,
      roundCardLimit: g?.roundCardLimit ?? 15000,
      availableCardCount: g?.availableCardCount ?? 15000,
      roundPlayerCount: g?.roundPlayerCount ?? 0,
      prizeMode: g?.prizeMode ?? 'revenue_percent',
      fixedPrizeEtb: g?.fixedPrizeEtb ?? 0,
      prizePercent: g?.prizePercent ?? 80,
      prizePerPlayer: g?.prizePerPlayer ?? 0,
      maxPrizeCap: g?.maxPrizeCap ?? 0,
      roundIntervalMinutes: g?.roundIntervalMinutes ?? 10,
      setPrizeScheduleSettings: (settings) => void admin('prize-schedule', settings),
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
      firstCallAt: g?.firstCallAt != null ? g.firstCallAt - offset : null,
      endedAt: g?.endedAt != null ? g.endedAt - offset : null,
      startedAt: null,
      nextRoundAt: g?.nextRoundAt != null ? g.nextRoundAt - offset : null,
      announcement: g?.announcement ?? null,
      setAnnouncement: (message: string) => void admin('announcement', { message }),
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
        <ServerRoundProvider>
          <PushNotificationPrompt />
          {children}
        </ServerRoundProvider>
      </ServerPlayerProvider>
    </BackendContext.Provider>
  );
}
