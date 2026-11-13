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
import { generateGrid, newCardId } from '@/lib/bingo';
import { play } from '@/lib/audio';
import { registerCard } from '@/lib/mockServer';
import type { BingoCard, PayMethod, PlayerContextValue, Tx } from '@/types/game';

interface PlayerState {
  balance: number;
  cards: BingoCard[];
  markedByCard: Record<string, number[]>;
  transactions: Tx[];
  nextSerial: number;
}

const KEY = 'bgb.player';
/** Demo credit so the app can be tested immediately. Set to 0 for production. */
const START_BALANCE = 100;

export const PlayerContext = createContext<PlayerContextValue | null>(null);

function initialState(): PlayerState {
  return { balance: START_BALANCE, cards: [], markedByCard: {}, transactions: [], nextSerial: 1 };
}

function loadState(): PlayerState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialState();
    const p = JSON.parse(raw) as Partial<PlayerState>;
    return {
      balance: typeof p.balance === 'number' ? p.balance : START_BALANCE,
      cards: Array.isArray(p.cards) ? p.cards : [],
      markedByCard: p.markedByCard && typeof p.markedByCard === 'object' ? p.markedByCard : {},
      transactions: Array.isArray(p.transactions) ? p.transactions : [],
      nextSerial: typeof p.nextSerial === 'number' ? p.nextSerial : 1,
    };
  } catch {
    return initialState();
  }
}

const txId = () => `tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { cardPrice } = useAppSettings();
  const [state, setState] = useState<PlayerState>(loadState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  // Same-browser tabs (local demo): adopt changes made in another tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY || !e.newValue || e.newValue === JSON.stringify(stateRef.current)) return;
      setState(loadState());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggleMark = useCallback((cardId: string, n: number) => {
    const has = (stateRef.current.markedByCard[cardId] ?? []).includes(n);
    play(has ? 'unmark' : 'mark');
    setState((s) => {
      const cur = s.markedByCard[cardId] ?? [];
      const next = cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n];
      return { ...s, markedByCard: { ...s.markedByCard, [cardId]: next } };
    });
  }, []);

  const deposit = useCallback(async (amount: number, method: PayMethod, reference: string) => {
    const label = `${method === 'telebirr' ? 'Telebirr' : 'CBE'} · ${reference}`;
    setState((s) => ({
      ...s,
      balance: s.balance + amount,
      transactions: [{ id: txId(), kind: 'deposit' as const, amount, label, at: Date.now() }, ...s.transactions].slice(0, 50),
    }));
    play('coin');
  }, []);

  const buyCards = useCallback(
    async (count: number) => {
      const s = stateRef.current;
      const total = count * cardPrice;
      if (!Number.isInteger(count) || count < 1 || total > s.balance) return { ok: false };

      const bought: BingoCard[] = Array.from({ length: count }, (_, i) => ({
        id: newCardId(),
        serial: s.nextSerial + i,
        grid: generateGrid(),
      }));
      bought.forEach(registerCard);

      setState((prev) => ({
        ...prev,
        balance: prev.balance - total,
        cards: [...prev.cards, ...bought],
        nextSerial: prev.nextSerial + count,
        transactions: [{ id: txId(), kind: 'purchase' as const, amount: -total, at: Date.now() }, ...prev.transactions].slice(0, 50),
      }));
      play('coin');
      return { ok: true };
    },
    [cardPrice],
  );

  const clearCards = useCallback(() => {
    setState((s) => ({ ...s, cards: [], markedByCard: {} }));
  }, []);

  const value = useMemo<PlayerContextValue>(
    () => ({
      balance: state.balance,
      cards: state.cards,
      markedByCard: state.markedByCard,
      transactions: state.transactions,
      toggleMark,
      deposit,
      buyCards,
      clearCards,
    }),
    [state, toggleMark, deposit, buyCards, clearCards],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const v = useContext(PlayerContext);
  if (!v) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return v;
}
