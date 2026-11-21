/**
 * Server-mode providers. They fill the SAME contexts as the demo providers
 * (PlayerContext, RoundContext, BackendContext), so PlayView, WalletView, VerifyView and
 * HostView work unchanged: the difference is that wallets, cards, the game state and every
 * win decision now live on the server.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AudioCallAnnouncer } from '@/components/audio/AudioCallAnnouncer';
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

  const apply = useCallback((incoming: ServerGameState) => {
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
    const es = new EventSource(`${API_URL}/api/stream`);
    es.addEventListener('game', (e) => apply(JSON.parse((e as MessageEvent<string>).data) as ServerGameState));
    return () => es.close();
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
          <AudioCallAnnouncer />
          <PushNotificationPrompt />
          {children}
        </ServerRoundProvider>
      </ServerPlayerProvider>
    </BackendContext.Provider>
  );
}
