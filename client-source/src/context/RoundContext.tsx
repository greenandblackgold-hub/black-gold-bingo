import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useBackend } from '@/context/BackendContext';
import { usePlayer } from '@/context/PlayerContext';
import { ALL_NUMBERS, findWinningPattern, isValidGrid, randomInt } from '@/lib/bingo';
import { play } from '@/lib/audio';
import { DEFAULT_GAME } from '@/lib/backend';
import { purgeRegistry, serverClaim, serverVerify } from '@/lib/mockServer';
import type { Claim, HostClaim, RoundContextValue, SharedGame, VerifyResult } from '@/types/game';

const SEEN_ROUND_KEY = 'bgb.seenRound';
export const RoundContext = createContext<RoundContextValue | null>(null);

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function RoundProvider({ children }: { children: ReactNode }) {
  const backend = useBackend();
  const { roomId } = useAppSettings();
  const { cards, clearCards } = usePlayer();
  const canHost = backend.canHost;

  const [game, setGame] = useState<SharedGame>(DEFAULT_GAME);
  const [loaded, setLoaded] = useState(false);
  const [rawClaims, setRawClaims] = useState<Claim[]>([]);
  const gameRef = useRef<SharedGame>(game);

  /** Optimistically apply and persist a new game state. Host only. */
  const commit = useCallback(
    (next: SharedGame) => {
      if (!canHost) return;
      gameRef.current = next;
      setGame(next);
      void backend.saveGame(next).catch(() => undefined);
    },
    [backend, canHost],
  );

  // Everyone listens to the shared game state.
  useEffect(() => {
    const off = backend.subscribeGame((g) => {
      const next = g ?? DEFAULT_GAME;
      gameRef.current = next;
      setGame(next);
      setLoaded(true);
    });
    return off;
  }, [backend]);

  // Only the host listens to claims.
  useEffect(() => {
    if (!canHost) return;
    return backend.subscribeClaims(setRawClaims);
  }, [backend, canHost]);

  // A new round on any device: drop the old cards.
  useEffect(() => {
    if (!loaded) return;
    const raw = localStorage.getItem(SEEN_ROUND_KEY);
    const seen = raw === null ? null : Number(raw);
    if (seen !== null && seen < game.roundNumber) {
      clearCards();
      purgeRegistry();
    }
    try {
      localStorage.setItem(SEEN_ROUND_KEY, String(game.roundNumber));
    } catch {
      /* ignore */
    }
  }, [loaded, game.roundNumber, clearCards]);

  // Bell on every device when a new number arrives (not for the initial load).
  const prevLen = useRef<number | null>(null);
  const len = game.calledNumbers.length;
  useEffect(() => {
    if (!loaded) return;
    if (prevLen.current !== null && len > prevLen.current) play('call');
    prevLen.current = len;
  }, [loaded, len]);

  /* ───────────── host actions (all no-ops for players) ───────────── */

  const drawNext = useCallback((): number | null => {
    if (!canHost) return null;
    const g = gameRef.current;
    if (g.phase !== 'running') return null;
    const remaining = ALL_NUMBERS.filter((n) => !g.calledNumbers.includes(n));
    if (remaining.length === 0) return null;
    const n = remaining[randomInt(remaining.length)];
    commit({
      ...g,
      calledNumbers: [...g.calledNumbers, n],
      nextCallAt: g.autoCall ? Date.now() + g.callIntervalSec * 1000 : null,
    });
    return n;
  }, [canHost, commit]);

  const startRound = useCallback(() => {
    const g = gameRef.current;
    if (!canHost || g.phase !== 'waiting') return;
    commit({ ...g, phase: 'running', calledNumbers: [], winner: null, autoCall: false, nextCallAt: null });
  }, [canHost, commit]);

  const endRound = useCallback(() => {
    const g = gameRef.current;
    if (!canHost || g.phase !== 'running') return;
    commit({ ...g, phase: 'ended', autoCall: false, nextCallAt: null });
  }, [canHost, commit]);

  const resetRound = useCallback(() => {
    const g = gameRef.current;
    if (!canHost || g.phase !== 'ended') return;
    commit({
      ...g,
      phase: 'waiting',
      roundNumber: g.roundNumber + 1,
      calledNumbers: [],
      winner: null,
      autoCall: false,
      nextCallAt: null,
    });
    void backend.clearClaims().catch(() => undefined);
  }, [backend, canHost, commit]);

  const setAutoCall = useCallback(
    (on: boolean) => {
      const g = gameRef.current;
      if (!canHost) return;
      const enable = on && g.phase === 'running';
      commit({ ...g, autoCall: enable, nextCallAt: enable ? Date.now() + g.callIntervalSec * 1000 : null });
    },
    [canHost, commit],
  );

  const setCallIntervalSec = useCallback(
    (sec: number) => {
      const g = gameRef.current;
      if (!canHost) return;
      const clamped = Math.min(60, Math.max(1, Math.round(sec)));
      commit({ ...g, callIntervalSec: clamped, nextCallAt: g.autoCall ? Date.now() + clamped * 1000 : g.nextCallAt });
    },
    [canHost, commit],
  );

  // Auto-call timer: runs only in the host's session.
  useEffect(() => {
    if (!canHost || !game.autoCall || game.phase !== 'running') return;
    const due = game.nextCallAt ?? Date.now() + game.callIntervalSec * 1000;
    const timer = setTimeout(() => {
      if (drawNext() === null) {
        const g = gameRef.current;
        commit({ ...g, autoCall: false, nextCallAt: null });
      }
    }, Math.max(0, due - Date.now()));
    return () => clearTimeout(timer);
  }, [canHost, game.autoCall, game.phase, game.nextCallAt, game.callIntervalSec, len, drawNext, commit]);

  /* ───────────── claims ───────────── */

  const claims = useMemo<HostClaim[]>(() => {
    if (!canHost) return [];
    const called = new Set(game.calledNumbers);
    return rawClaims
      .filter((c) => c.round === game.roundNumber)
      .map((c) => {
        const gridValid = isValidGrid(c.grid);
        const wins = gridValid && findWinningPattern(c.grid, called, game.winPattern ?? 'any_line').missing === 0;
        const originVerified =
          gridValid && serverVerify(c.cardId, game.calledNumbers, { id: c.cardId, serial: c.serial, grid: c.grid }, game.winPattern ?? 'any_line').status === 'valid';
        return { ...c, gridValid, wins, originVerified };
      })
      .sort((a, b) => a.at - b.at);
  }, [canHost, rawClaims, game.roundNumber, game.calledNumbers, game.winPattern]);

  const acceptClaim = useCallback(
    async (claimId: string): Promise<boolean> => {
      const g = gameRef.current;
      if (!canHost || g.phase !== 'running') return false;
      const claim = claims.find((c) => c.id === claimId);
      if (!claim || !claim.gridValid || !claim.wins) return false;
      commit({
        ...g,
        phase: 'ended',
        autoCall: false,
        nextCallAt: null,
        winner: { cardId: claim.cardId, serial: claim.serial, at: Date.now() },
      });
      return true;
    },
    [canHost, claims, commit],
  );

  const rejectClaim = useCallback(
    async (claimId: string) => {
      if (canHost) await backend.removeClaim(claimId).catch(() => undefined);
    },
    [backend, canHost],
  );

  const claimBingo = useCallback(
    async (cardId: string): Promise<{ ok: boolean }> => {
      const g = gameRef.current;
      if (g.phase !== 'running') return { ok: false };
      const local = cards.find((c) => c.id === cardId);
      if (!local) return { ok: false };
      await delay(250);
      if (!serverClaim(cardId, gameRef.current.calledNumbers, local, gameRef.current.winPattern ?? 'any_line')) {
        play('error');
        return { ok: false };
      }
      try {
        await backend.submitClaim({
          cardId: local.id,
          serial: local.serial,
          grid: local.grid,
          round: g.roundNumber,
          at: Date.now(),
        });
      } catch {
        play('error');
        return { ok: false };
      }
      return { ok: true };
    },
    [backend, cards],
  );

  const verifyCard = useCallback(
    async (cardId: string): Promise<VerifyResult> => {
      await delay(450);
      const local = cards.find((c) => c.id === cardId);
      return serverVerify(cardId, gameRef.current.calledNumbers, local, gameRef.current.winPattern ?? 'any_line');
    },
    [cards],
  );

  const value = useMemo<RoundContextValue>(
    () => ({
      roomId,
      loaded,
      canHost,
      phase: game.phase,
      winPattern: game.winPattern ?? 'any_line',
      setWinPattern: (pattern) => {
        const g = gameRef.current;
        if (!canHost || g.phase !== 'waiting') return;
        commit({ ...g, winPattern: pattern });
      },
      roundNumber: game.roundNumber,
      calledNumbers: game.calledNumbers,
      winner: game.winner,
      claims,
      startRound,
      endRound,
      resetRound,
      drawNext,
      acceptClaim,
      rejectClaim,
      claimBingo,
      verifyCard,
      autoCall: game.autoCall,
      setAutoCall,
      callIntervalSec: game.callIntervalSec,
      setCallIntervalSec,
      nextCallAt: game.nextCallAt,
    }),
    [
      roomId, loaded, canHost, game, claims, startRound, endRound, resetRound, drawNext, acceptClaim,
      rejectClaim, claimBingo, verifyCard, setAutoCall, setCallIntervalSec,
    ],
  );

  return <RoundContext.Provider value={value}>{children}</RoundContext.Provider>;
}

export function useRound(): RoundContextValue {
  const v = useContext(RoundContext);
  if (!v) throw new Error('useRound must be used inside <RoundProvider>');
  return v;
}
