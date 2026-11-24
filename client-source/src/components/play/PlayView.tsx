import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatAmount } from '@/lib/localization';
import { gameUi } from '@/lib/gameUi';
import { PlayerFeatures } from '@/components/play/PlayerFeatures';
import { useLanguage } from '@/context/LanguageContext';
import { usePlayer } from '@/context/PlayerContext';
import { useRound } from '@/context/RoundContext';
import { useAuth } from '@/context/AuthContext';
import { useAppSettings } from '@/context/AppSettingsContext';
import { play } from '@/lib/audio';
import { api } from '@/lib/api';
import { findWinningPattern, patternMasks } from '@/lib/bingo';
import { getPatternDescription } from '@/lib/patternCatalog';
import { patternNames } from '@/lib/localization';
import type { BingoCard, WinPattern } from '@/types/game';

type DepositAccount = {
  id: 'cbe' | 'anbesa' | 'telebirr';
  name: string;
  kind: string;
  number: string;
  owner: string;
  ussd: string;
  ussdHref: string;
  appLabel: string;
  appUrl: string;
};

const DEPOSIT_ACCOUNTS: DepositAccount[] = [
  {
    id: 'cbe',
    name: 'CBE · ባንክ',
    kind: 'የባንክ አካውንት',
    number: '1000737138686',
    owner: 'ቤተሊሄም',
    ussd: '*889#',
    ussdHref: 'tel:*889%23',
    appLabel: 'CBE Mobile Banking',
    appUrl: 'https://play.google.com/store/apps/details?id=com.combanketh.mobilebanking',
  },
  {
    id: 'anbesa',
    name: 'Anbesa Bank · አንበሳ ባንክ',
    kind: 'የባንክ አካውንት',
    number: '00311390826',
    owner: 'ኣሊክሳንደር',
    ussd: '*803#',
    ussdHref: 'tel:*803%23',
    appLabel: 'Anbesa Plus',
    appUrl: 'https://play.google.com/store/apps/details?id=com.anbesabank.anbesa_plus',
  },
  {
    id: 'telebirr',
    name: 'Telebirr · ቴሌብር',
    kind: 'የስልክ አካውንት',
    number: '0978202822',
    owner: 'ኣሊክሳንደር',
    ussd: '*127#',
    ussdHref: 'tel:*127%23',
    appLabel: 'telebirr App',
    appUrl: 'https://play.google.com/store/apps/details?id=cn.tydic.ethiopay',
  },
];

const LETTERS = ['B', 'I', 'N', 'G', 'O'] as const;
const letterFor = (n: number) => LETTERS[Math.min(4, Math.floor((n - 1) / 15))];
const CARD_ACCENTS = [
  { border: 'border-blue-500', glow: 'shadow-[0_0_18px_rgba(37,99,235,.55)]', head: 'from-blue-700 via-blue-500 to-blue-700' },
  { border: 'border-lime-500', glow: 'shadow-[0_0_18px_rgba(132,204,22,.5)]', head: 'from-green-700 via-lime-600 to-green-700' },
  { border: 'border-fuchsia-500', glow: 'shadow-[0_0_18px_rgba(217,70,239,.5)]', head: 'from-purple-700 via-fuchsia-600 to-purple-700' },
  { border: 'border-orange-500', glow: 'shadow-[0_0_18px_rgba(249,115,22,.5)]', head: 'from-orange-700 via-orange-500 to-orange-700' },
];
const WIN_PATTERN_OPTIONS: { value: WinPattern; label: string }[] = [
  { value: 'any_line', label: 'Any Line' },
  { value: 'horizontal_line', label: 'Horizontal Line' },
  { value: 'vertical_line', label: 'Vertical Line' },
  { value: 'diagonal', label: 'Diagonal' },
  { value: 'two_lines', label: 'Two Lines' },
  { value: 'two_horizontal_lines', label: 'Two Horizontal Lines' },
  { value: 'four_corners', label: 'Four Corners' },
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'two_rectangles', label: 'Two Rectangles' },
  { value: 'half_house', label: 'Half House' },
  { value: 'full_house', label: 'Full House' },
  { value: 'x', label: 'X Pattern' },
  { value: 't', label: 'T Pattern' },
  { value: 'l', label: 'L Pattern' },
  { value: 'plus', label: 'Plus' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'picture_frame', label: 'Picture Frame' },
  { value: 'six_pack', label: 'Six Pack' },
  { value: 'postage_stamp', label: 'Postage Stamp' },
  { value: 'three_lines', label: 'Three Lines' },
  { value: 'four_lines', label: 'Four Lines' },
  { value: 'top_bottom', label: 'Top & Bottom' },
  { value: 'left_right', label: 'Left & Right' },
  { value: 'checkerboard', label: 'Checkerboard' },
  { value: 'center_cross', label: 'Center Cross' },
  { value: 'coverall', label: 'Coverall' },
  { value: 'line_through_free', label: 'Line Through FREE' },
  { value: 'line_avoiding_free', label: 'Line Avoiding FREE' },
  { value: 'two_lines_through_free', label: 'Two Lines Through FREE' },
  { value: 'two_lines_avoiding_free', label: 'Two Lines Avoiding FREE' },
  { value: 'two_rectangles_touching', label: 'Touching Rectangles' },
  { value: 'two_rectangles_separate', label: 'Separate Rectangles' },
  { value: 'inner_frame', label: 'Inner Frame' },
  { value: 'inner_square', label: 'Inner Square' },
  { value: 'four_postage_stamps', label: 'Four Postage Stamps' },
  { value: 'z', label: 'Z Pattern' },
  { value: 'u', label: 'U Pattern' },
  { value: 's', label: 'S Pattern' },
  { value: 'arrow_up', label: 'Arrow Up' },
  { value: 'arrow_down', label: 'Arrow Down' },
  { value: 'star', label: 'Star' },
  { value: 'cross_and_corners', label: 'Cross & Corners' },
  { value: 'frame_and_center', label: 'Frame & Center' },
  { value: 'double_cross', label: 'Double Cross' },
  { value: 'nine_pack', label: 'Nine Pack' },
  { value: 'filled_diamond', label: 'Filled Diamond' },
  { value: 'window_pane', label: 'Window Pane' },
  { value: 'staircase', label: 'Staircase' },
  { value: 'hourglass', label: 'Hourglass' },
  { value: 'bow_tie', label: 'Bow Tie' },
  { value: 'ladder', label: 'Ladder' },
  { value: 'railroad_tracks', label: 'Railroad Tracks' },
  { value: 'lucky_seven', label: 'Lucky Seven' },
  { value: 'letter_h', label: 'Letter H' },
  { value: 'letter_e', label: 'Letter E' },
  { value: 'letter_c', label: 'Letter C' },
  { value: 'letter_n', label: 'Letter N' },
  { value: 'letter_w', label: 'Letter W' },
];
const RELATED_PATTERN_OPTIONS: Partial<Record<WinPattern, WinPattern[]>> = {
  any_line: ['horizontal_line', 'vertical_line', 'diagonal', 'line_through_free', 'line_avoiding_free'],
  two_lines: ['two_horizontal_lines', 'two_lines_through_free', 'two_lines_avoiding_free'],
  three_lines: ['three_lines'],
  four_lines: ['four_lines'],
};
const DIRECTIONAL_PATTERN_OPTIONS = new Set<WinPattern>([
  't', 'l', 'z', 'u', 's', 'arrow_up', 'arrow_down',
  'letter_h', 'letter_e', 'letter_c', 'letter_n', 'letter_w', 'lucky_seven',
]);
const getPatternCells = (pattern: WinPattern, variantIndex = 0) => {
  const masks = patternMasks(pattern);
  return (masks[variantIndex] ?? masks[0] ?? []).map(([r, c]) => r * 5 + c);
};
const orientationLabel = (index: number) => ['↑', '→', '↓', '←', '↗', '↘', '↙', '↖'][index] ?? '';

type CardProps = {
  labels: { card: string; locked: string; free: string; claim: string; claiming: string };
  card: BingoCard;
  index: number;
  marks: Set<number>;
  called: Set<number>;
  markColor: string;
  pattern: WinPattern;
  claimable: boolean;
  claiming: boolean;
  onClaim: () => void;
  onToggle: (n: number) => void;
  onRemove: () => void;
  draft?: boolean;
  registering?: boolean;
  onRegister?: () => void;
};

function BingoCardView({ labels, card, index, marks, called, markColor, pattern, claimable, claiming, onClaim, onToggle, onRemove, draft = false, registering = false, onRegister }: CardProps) {
  const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];
  const winning = useMemo(() => {
    const result = findWinningPattern(card.grid, new Set([...called].filter(n => marks.has(n))), pattern);
    return result.missing === 0 ? result.positions : null;
  }, [card.grid, called, marks, pattern]);
  const winningCells = useMemo(() => new Set((winning ?? []).map(([r, c]) => r + '-' + c)), [winning]);

  return (
    <section className={`bingo-card-surface relative min-w-0 overflow-hidden rounded-[1.2rem] border-2 ${accent.border} bg-black p-1 shadow-xl ${accent.glow}`}>
      {draft ? (
        <button type="button" onClick={onRegister} disabled={registering} className={`flex w-full items-center justify-center bg-gradient-to-r ${accent.head} px-2 py-1 text-base font-black text-white sm:text-xl disabled:opacity-60`}>
          {registering ? '…' : 'REGISTER'} · #{String(card.serial).padStart(5, '0')}
        </button>
      ) : (
        <div className={`flex items-center justify-center bg-gradient-to-r ${accent.head} px-2 py-1 text-base font-black text-white sm:text-xl`}>
          {labels.card} #{String(card.serial).padStart(5, '0')} · BINGO
        </div>
      )}
      {card.locked && <span className="absolute left-1 top-1 z-10 rounded bg-red-700 px-2 py-0.5 text-[9px] font-black text-white">{labels.locked}</span>}
      <button type="button" aria-label={`Remove card #${card.serial}`} onClick={(event) => { event.stopPropagation(); onRemove(); }} className="absolute right-1 top-1 z-20 grid h-6 w-6 place-items-center rounded-full border border-white/70 bg-red-700 text-sm font-black leading-none text-white shadow">×</button>
      <div className="grid grid-cols-5 gap-px overflow-hidden rounded-b-lg bg-zinc-400">
        {LETTERS.map((letter, col) => (
          <div key={letter} className={`py-1 text-center text-base font-black text-white sm:text-2xl ${['bg-blue-700','bg-sky-600','bg-orange-500','bg-fuchsia-700','bg-green-700'][col]}`}>{letter}</div>
        ))}
        {card.grid.flatMap((row, r) => row.map((value, c) => {
          const free = value === null;
          const marked = free || (value !== null && marks.has(value));
          const wasCalled = value !== null && called.has(value);
          const inWinningLine = winningCells.has(r + '-' + c);
          return (
            <button
              key={r + '-' + c}
              type="button"
              disabled={free || !wasCalled || !!card.locked}
              onClick={() => { if (value !== null && wasCalled) onToggle(value); }}
              aria-pressed={marked}
              aria-label={free ? labels.free : `${LETTERS[c]} ${value}`}
              style={marked && !free ? {
                backgroundColor: markColor,
                color: (() => {
                  const hex = markColor.replace('#', '');
                  if (!/^[0-9a-f]{6}$/i.test(hex)) return '#111827';
                  const r = parseInt(hex.slice(0, 2), 16) / 255;
                  const g = parseInt(hex.slice(2, 4), 16) / 255;
                  const b = parseInt(hex.slice(4, 6), 16) / 255;
                  const linear = (v: number) => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
                  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b) > 0.42 ? '#111827' : '#ffffff';
                })(),
                boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.18), inset 0 0 9px rgba(255,255,255,.22)',
              } : undefined}
              className={[
                'relative grid aspect-square min-w-0 place-items-center rounded-[3px] text-[clamp(10px,2.1vw,22px)] font-black leading-none text-black transition',
                free ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(0,140,255,.9)]' :
                  marked ? 'border border-black/20' :
                  'bg-gradient-to-b from-white to-zinc-200',
                inWinningLine ? 'outline outline-2 outline-yellow-300' : '',
                wasCalled && !marked ? 'bg-blue-500 text-white' : '',
              ].join(' ')}
            >
              {free ? labels.free : value}
            </button>
          );
        }))}
      </div>
      {claimable && !card.locked && (
        <button type="button" onClick={onClaim} disabled={claiming} className="mt-1 w-full rounded-lg bg-gradient-to-r from-yellow-200 to-amber-500 py-1 text-xs font-black text-black">
          {claiming ? labels.claiming : 'BINGO'}
        </button>
      )}
    </section>
  );
}

function CalledBall({ number, latest = false }: { number: number; latest?: boolean }) {
  const letter = letterFor(number);
  const color = letter === 'N' ? 'from-green-400 to-green-700' :
    letter === 'G' ? 'from-purple-500 to-purple-800' :
    letter === 'B' ? 'from-red-500 to-red-800' :
    letter === 'I' ? 'from-blue-400 to-blue-700' : 'from-orange-400 to-orange-700';
  return (
    <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/80 bg-gradient-to-br ${color} text-white shadow-[0_0_12px_rgba(255,255,255,.18)] sm:h-12 sm:w-12 sm:border-2 ${latest ? 'ring-2 ring-yellow-200' : ''}`}>
      <span className="text-[7px] font-black leading-none sm:text-[9px]">{letter}</span>
      <strong className="text-sm leading-none sm:text-xl">{number}</strong>
    </div>
  );
}

export function PlayView({ onGoToWallet, settingsOpen, onSettingsOpenChange }: { onGoToWallet: () => void; settingsOpen: boolean; onSettingsOpenChange: (open: boolean) => void }) {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const t = gameUi.bingoScreen[lang];
  const { cards, markedByCard, toggleMark, removeCards, balance, buyCards } = usePlayer();
  const {
    phase, bonusRound = false, winPattern, calledNumbers, claimBingo, winner, roundNumber, roomId, loaded,
    nextCallAt, roundPrizeEtb, nextRoundAt, firstCallAt, endedAt,
  } = useRound();
  const { cardPrice } = useAppSettings();
  const [now, setNow] = useState(() => Date.now());
  const [autoMark, setAutoMark] = useState(true);
  const [claimingCardId, setClaimingCardId] = useState<string | null>(null);
  const [patternOpen, setPatternOpen] = useState(false);
  const [numberBoardMode, setNumberBoardMode] = useState<'all' | 'called'>(() => {
    try { return localStorage.getItem('bgb.numberBoardMode') === 'called' ? 'called' : 'all'; } catch { return 'all'; }
  });
  const [numberBoardExpanded, setNumberBoardExpanded] = useState(() => {
    try { return localStorage.getItem('bgb.numberBoardExpanded') !== 'off'; } catch { return true; }
  });
  const [cardsPerRow, setCardsPerRow] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('bgb.cardsPerRow'));
      return Number.isInteger(saved) && saved >= 2 && saved <= 4 ? saved : 2;
    } catch { return 2; }
  });
  const [markColor, setMarkColor] = useState(() => {
    try {
      const saved = localStorage.getItem('bgb.markColor');
      return ['#d4af37','#ef4444','#3b82f6','#22c55e','#a855f7','#f97316','#ec4899','#ffffff'].includes(saved ?? '') ? saved! : '#d4af37';
    } catch { return '#d4af37'; }
  });
  const [cardOrder, setCardOrder] = useState<'oldest' | 'newest'>(() => {
    try { return localStorage.getItem('bgb.cardOrder') === 'newest' ? 'newest' : 'oldest'; } catch { return 'oldest'; }
  });
  const [quickBuyOpen, setQuickBuyOpen] = useState(false);
  const [draftCards, setDraftCards] = useState<BingoCard[]>([]);
  const draftCardsStorageKey = `bgb.draftCards.${user?.id ?? 'guest'}.${roomId || 'default'}.${roundNumber}`;
  const removedDraftsStorageKey = `bgb.removedDrafts.${user?.id ?? 'guest'}.${roomId || 'default'}.${roundNumber}`;
  const [draftCardsLoadedFor, setDraftCardsLoadedFor] = useState<string | null>(null);
  const [registeringDraftId, setRegisteringDraftId] = useState<string | null>(null);
  const [draftMessage, setDraftMessage] = useState('');
  const [quickBuyCount, setQuickBuyCount] = useState(15);
  const [quickBuyBusy, setQuickBuyBusy] = useState(false);
  const [quickBuyMessage, setQuickBuyMessage] = useState('');
  const [selectedDepositAccount, setSelectedDepositAccount] = useState<DepositAccount | null>(null);
  const [copyStatus, setCopyStatus] = useState('');


  // Keep unregistered preview cards across refreshes, scoped to this player, room, and round.
  // Registered cards and called numbers continue to come from their existing server sources.
  useEffect(() => {
    if (!loaded || !user?.id) return;
    let active = true;
    setDraftCardsLoadedFor(null);
    let saved: BingoCard[] = [];
    try {
      const raw = localStorage.getItem(draftCardsStorageKey);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      saved = Array.isArray(parsed) ? parsed as BingoCard[] : [];
    } catch {
      saved = [];
    }
    let removedSerials = new Set<string>();
    try {
      const rawRemoved = localStorage.getItem(removedDraftsStorageKey);
      const parsedRemoved: unknown = rawRemoved ? JSON.parse(rawRemoved) : [];
      if (Array.isArray(parsedRemoved)) removedSerials = new Set(parsedRemoved.filter((serial): serial is string => typeof serial === 'string'));
    } catch { removedSerials = new Set(); }
    saved = saved.filter(card => !removedSerials.has(String(card.serial)));
    setDraftCards(saved);
    setDraftCardsLoadedFor(draftCardsStorageKey);

    // The API copy survives an ordinary browser refresh even if local storage is blocked.
    let previewsInFlight = false;
    const refreshPreviews = async () => {
      if (!active || previewsInFlight || document.visibilityState === 'hidden') return;
      previewsInFlight = true;
      try {
        const serverPreviews = await api.get<BingoCard[]>('/api/cards/previews');
        if (!active || !Array.isArray(serverPreviews)) return;
        let removedNow = removedSerials;
        try {
          const rawRemoved = localStorage.getItem(removedDraftsStorageKey);
          const parsedRemoved: unknown = rawRemoved ? JSON.parse(rawRemoved) : [];
          if (Array.isArray(parsedRemoved)) removedNow = new Set([...removedSerials, ...parsedRemoved.filter((serial): serial is string => typeof serial === 'string')]);
        } catch { /* keep the already loaded removal set */ }
        setDraftCards(current => {
          const bySerial = new Map(current.filter(card => !removedNow.has(String(card.serial))).map(card => [String(card.serial), card]));
          for (const card of serverPreviews) if (!removedNow.has(String(card.serial))) bySerial.set(String(card.serial), { ...bySerial.get(String(card.serial)), ...card });
          return [...bySerial.values()].sort((a, b) => Number(a.serial) - Number(b.serial));
        });
      } catch {
        // Browser-saved previews remain available if the API is temporarily offline.
      } finally {
        previewsInFlight = false;
      }
    };
    void refreshPreviews();
    const previewPoll = window.setInterval(() => void refreshPreviews(), 15_000);
    window.addEventListener('focus', refreshPreviews);
    window.addEventListener('online', refreshPreviews);
    return () => {
      active = false;
      window.clearInterval(previewPoll);
      window.removeEventListener('focus', refreshPreviews);
      window.removeEventListener('online', refreshPreviews);
    };
  }, [loaded, user?.id, draftCardsStorageKey, removedDraftsStorageKey]);

  useEffect(() => {
    if (draftCardsLoadedFor !== draftCardsStorageKey) return;
    try {
      if (draftCards.length) localStorage.setItem(draftCardsStorageKey, JSON.stringify(draftCards));
      else localStorage.removeItem(draftCardsStorageKey);
    } catch {
      // Keep the active game usable if browser storage is unavailable or full.
    }
  }, [draftCards, draftCardsLoadedFor, draftCardsStorageKey]);

  useEffect(() => { setDraftMessage(''); }, [roundNumber]);

  useEffect(() => {
    try {
      localStorage.setItem('bgb.numberBoardMode', numberBoardMode);
      localStorage.setItem('bgb.numberBoardExpanded', numberBoardExpanded ? 'on' : 'off');
    } catch { /* keep the live board usable when storage is unavailable */ }
  }, [numberBoardMode, numberBoardExpanded]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try { setAutoMark(localStorage.getItem('bgb.autoMark') !== 'off'); } catch { /* use default */ }
  }, []);

  useEffect(() => {
    const syncCardSettings = () => {
      try {
        const layout = Number(localStorage.getItem('bgb.cardsPerRow'));
        setCardsPerRow(Number.isInteger(layout) && layout >= 2 && layout <= 4 ? layout : 2);
        const color = localStorage.getItem('bgb.markColor');
        setMarkColor(['#d4af37','#ef4444','#3b82f6','#22c55e','#a855f7','#f97316','#ec4899','#ffffff'].includes(color ?? '') ? color! : '#d4af37');
        setCardOrder(localStorage.getItem('bgb.cardOrder') === 'newest' ? 'newest' : 'oldest');
      } catch { /* Keep the current settings if storage is unavailable. */ }
    };
    window.addEventListener('bgb-player-settings', syncCardSettings);
    window.addEventListener('storage', syncCardSettings);
    syncCardSettings();
    return () => {
      window.removeEventListener('bgb-player-settings', syncCardSettings);
      window.removeEventListener('storage', syncCardSettings);
    };
  }, []);

  const called = useMemo(() => new Set(calledNumbers), [calledNumbers]);
  const orderedCards = useMemo(() => [...cards].sort((a, b) => {
    const difference = Number(a.serial) - Number(b.serial);
    return cardOrder === 'newest' ? -difference : difference;
  }), [cards, cardOrder]);
  const orderedDraftCards = useMemo(() => [...draftCards].sort((a, b) => {
    const difference = Number(a.serial) - Number(b.serial);
    return cardOrder === 'newest' ? -difference : difference;
  }), [draftCards, cardOrder]);
  const markSets = useMemo(() => {
    const result: Record<string, Set<number>> = {};
    cards.forEach(card => { result[card.id] = new Set(markedByCard[card.id] ?? []); });
    return result;
  }, [cards, markedByCard]);

  const active = phase === 'running';
  const claimableCards = useMemo(() => {
    if (!active || calledNumbers.length === 0) return [];
    const previous = new Set(calledNumbers.slice(0, -1));
    return cards.filter(card =>
      !card.locked &&
      findWinningPattern(card.grid, called, winPattern).missing === 0 &&
      findWinningPattern(card.grid, previous, winPattern).missing > 0
    );
  }, [active, cards, calledNumbers, called, winPattern]);

  useEffect(() => {
    if (!active || !autoMark || calledNumbers.length === 0) return;
    for (const card of cards) {
      const existing = new Set(markedByCard[card.id] ?? []);
      for (const number of calledNumbers) {
        if (card.grid.some(row => row.includes(number)) && !existing.has(number)) {
          toggleMark(card.id, number);
          existing.add(number);
        }
      }
    }
  }, [active, autoMark, calledNumbers, cards, markedByCard, toggleMark]);

  const celebrated = useRef<number | null>(null);
  const iWon = !!winner && cards.some(card => card.id === winner.cardId);
  useEffect(() => {
    if (!winner || !iWon || celebrated.current === winner.at) return;
    celebrated.current = winner.at;
    play('win');
  }, [winner, iWon]);

  const handleClaim = useCallback(async (cardId: string) => {
    if (claimingCardId) return;
    setClaimingCardId(cardId);
    try { await claimBingo(cardId, calledNumbers.length); }
    finally { setClaimingCardId(null); }
  }, [claimingCardId, claimBingo, calledNumbers.length]);

  const lastCalls = calledNumbers.slice(-5).reverse();
  const patternCells = useMemo(() => getPatternCells(winPattern), [winPattern]);
  const formatClock = (milliseconds: number) => {
    const seconds = Math.max(0, Math.floor(milliseconds / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  };
  const quickBuyTotal = bonusRound ? 0 : quickBuyCount * cardPrice;
  const quickBuyAllowed = bonusRound || phase === 'waiting';
  const quickBuyInsufficient = bonusRound && quickBuyTotal > balance;
  const quickBuyOptions = bonusRound ? [1, 2, 3] : [15, 25];

  useEffect(() => {
    setQuickBuyCount(bonusRound ? 1 : 15);
  }, [bonusRound]);
  const addPreviewCards = async (count: number) => {
    if (quickBuyBusy) return;
    setQuickBuyBusy(true);
    setQuickBuyMessage('');
    try {
      const previews = await api.post<BingoCard[]>('/api/cards/preview', { count });
      setDraftCards(current => [...current, ...previews]);
      setDraftMessage('');
      setQuickBuyOpen(false);
      setQuickBuyCount(15);
    } catch (error) {
      setQuickBuyMessage(error instanceof Error ? error.message : 'ካርቴላዎቹን ማዘጋጀት አልተቻለም።');
    } finally {
      setQuickBuyBusy(false);
    }
  };
  const registerDraftCard = async (card: BingoCard) => {
    if (registeringDraftId) return;
    setRegisteringDraftId(card.id);
    setDraftMessage('');
    try {
      const result = await buyCards(1, String(card.serial), { grid: card.grid, token: card.previewToken });
      if (result.ok) {
        setDraftCards(current => current.filter(item => item.id !== card.id));
        setDraftMessage('ካርቴላው ተመዝግቧል። BINGO!');
      } else {
        setDraftMessage(result.error ?? 'በቂ ቀሪ ሂሳብ የለም። ካርቴላው አልተመዘገበም።');
      }
    } finally {
      setRegisteringDraftId(null);
    }
  };
  const submitQuickBuy = async () => {
    if (!quickBuyAllowed || quickBuyInsufficient || quickBuyBusy) return;
    setQuickBuyBusy(true);
    setQuickBuyMessage('');
    try {
      const result = await buyCards(quickBuyCount);
      if (result.ok) {
        setQuickBuyMessage('ካርዶቹ በተሳካ ሁኔታ ተጨምረዋል።');
        setQuickBuyOpen(false);
        setQuickBuyCount(1);
      } else {
        setQuickBuyMessage(result.error ?? 'ግዢው አልተሳካም። ቀሪ ሂሳብዎን ያረጋግጡ።');
      }
    } catch {
      setQuickBuyMessage('ግዢው አልተሳካም። እባክዎ እንደገና ይሞክሩ።');
    } finally {
      setQuickBuyBusy(false);
    }
  };
  const callTimer = phase === 'waiting' && nextRoundAt !== null
    ? formatClock(nextRoundAt - now)
    : phase === 'running' && calledNumbers.length === 0 && nextCallAt !== null
      ? formatClock(nextCallAt - now)
      : calledNumbers.length > 0 && firstCallAt !== null
        ? formatClock((phase === 'ended' && endedAt !== null ? endedAt : now) - firstCallAt)
        : '0:00';

  return (
    <main className="player-play-view relative mx-auto min-h-full w-full max-w-[1100px] overflow-x-clip rounded-[2rem] border-2 border-zinc-500/80 bg-[#030303] px-2 pb-32 pt-2 text-white shadow-[0_0_35px_rgba(212,175,55,.22),inset_0_0_35px_rgba(212,175,55,.08)] sm:px-4 sm:pt-4">
      <div className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(ellipse_at_50%_12%,rgba(255,196,0,.17),transparent_36%),radial-gradient(ellipse_at_50%_100%,rgba(255,196,0,.13),transparent_38%)]" />
      <div className="relative z-10 space-y-2 sm:space-y-3">

        <div className="flex justify-end px-1 -mt-1" aria-label={`${t.round} ${roundNumber}`}>
          <span className="rounded-full border border-yellow-500/15 bg-black/35 px-1.5 py-0.5 text-[8px] font-medium leading-none tracking-wide text-yellow-200/45 tabular-nums">
            {t.round} #{roundNumber}
          </span>
        </div>

        {settingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label={t.settings}>
            <section className="relative max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-amber-400/40 bg-[#090909] p-4 shadow-2xl sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-amber-200">⚙ {t.settings}</h2>
                <button type="button" onClick={() => onSettingsOpenChange(false)} aria-label={t.close} className="rounded-lg border border-amber-300/30 px-3 py-2 text-sm font-bold text-amber-100">{t.close} ✕</button>
              </div>
              <PlayerFeatures onGoToWallet={onGoToWallet} settingsOnly />
            </section>
          </div>
        )}

        {phase === 'waiting' && (
          <section
            role="region"
            aria-label={t.depositAccounts}
            className="rounded-2xl border border-yellow-400/80 bg-yellow-950/70 px-3 py-3 text-center shadow-[0_0_20px_rgba(250,204,21,.2)]"
          >
            <span className="mb-2 block text-[11px] font-bold tracking-wide text-yellow-300">📢 {t.depositAccounts}</span>
            <p className="mb-2 text-[10px] text-yellow-100/80">{t.choosePayment}</p>
            <div className="mx-auto grid max-w-md gap-2 text-left">
              {DEPOSIT_ACCOUNTS.map(account => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => { setSelectedDepositAccount(account); setCopyStatus(''); }}
                  aria-label={`${account.id === 'cbe' ? t.cbeBank : account.id === 'anbesa' ? t.anbesaBank : t.telebirr} ${account.number} ${t.paymentOptions}`}
                  className="w-full rounded-xl border border-yellow-400/50 bg-black/60 px-3 py-2 text-left transition hover:border-yellow-200 hover:bg-yellow-950/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-yellow-300">{account.id === 'cbe' ? t.cbeBank : account.id === 'anbesa' ? t.anbesaBank : t.telebirr}</span>
                    <span className="text-[10px] text-yellow-100/70">{account.id === 'telebirr' ? t.phoneAccount : t.bankAccount}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-base font-black tracking-wider text-white tabular-nums">{account.number}</span>
                    <span className="text-[10px] font-bold text-yellow-300">{t.open} ›</span>
                  </div>
                  <p className="mt-0.5 text-[11px] font-medium text-yellow-100">{t.accountOwner}: {account.owner}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {selectedDepositAccount && phase === 'waiting' && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-2 backdrop-blur-sm sm:items-center" role="presentation" onClick={() => setSelectedDepositAccount(null)}>
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="deposit-dialog-title"
              className="w-full max-w-md rounded-2xl border-2 border-yellow-400 bg-zinc-950 p-4 text-left shadow-[0_0_35px_rgba(250,204,21,.3)]"
              onClick={event => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="deposit-dialog-title" className="text-base font-black text-yellow-300">{selectedDepositAccount.id === 'cbe' ? t.cbeBank : selectedDepositAccount.id === 'anbesa' ? t.anbesaBank : t.telebirr} · {t.paymentOptions}</h2>
                <button type="button" onClick={() => setSelectedDepositAccount(null)} aria-label={t.close} className="grid h-9 w-9 place-items-center rounded-full border border-yellow-500/50 text-xl text-white">×</button>
              </div>
              <p className="text-xs text-yellow-100/80">{t.accountNumber}</p>
              <p className="mb-3 break-all text-xl font-black tracking-wider text-white tabular-nums">{selectedDepositAccount.number}</p>
              <div className="grid gap-2">
                <a href={selectedDepositAccount.appUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-yellow-400 px-4 py-3 text-center text-sm font-black text-black hover:bg-yellow-300">
                  📱 {selectedDepositAccount.appLabel} {t.openDownload}
                </a>
                <a href={selectedDepositAccount.ussdHref} className="rounded-xl border border-emerald-400 bg-emerald-950/50 px-4 py-3 text-center text-sm font-black text-emerald-200 hover:bg-emerald-900">
                  ☎ USSD {selectedDepositAccount.ussd} {t.callUssd}
                </a>
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      try {
                        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
                        await navigator.clipboard.writeText(selectedDepositAccount.number);
                        setCopyStatus(t.copied);
                      } catch {
                        setCopyStatus(t.copyFailed);
                      }
                    })();
                  }}
                  className="rounded-xl border border-yellow-400/60 bg-black px-4 py-3 text-center text-sm font-bold text-yellow-200 hover:bg-yellow-950/60"
                >
                  ▣ {t.copyAccount}
                </button>
              </div>
              <p role="status" aria-live="polite" className="mt-3 min-h-5 text-center text-xs font-bold text-yellow-300">{copyStatus}</p>
              <p className="mt-1 text-center text-[10px] leading-relaxed text-zinc-400">{t.ussdHelp}</p>
            </section>
          </div>
        )}

        {(
          <section
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="rounded-2xl border border-yellow-400/80 bg-yellow-950/70 px-3 py-3 text-center shadow-[0_0_20px_rgba(250,204,21,.2)]"
          >
            <span className="mb-1 block text-[11px] font-bold tracking-wide text-yellow-300">{phase === 'running' ? '📢 ' + t.roundHelp : '📢 ' + t.nextRoundHelp}</span>
            <h2 className="text-xs font-bold text-yellow-100">
              {t.patternType}: {patternNames[lang][winPattern]}
            </h2>
            <p className="mt-1 text-[11px] font-medium leading-relaxed text-yellow-50">
              {getPatternDescription(lang, winPattern)}
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-yellow-300/90">
              {t.winInstruction}
            </p>
            <p className="mt-2 text-lg font-black text-yellow-300">{phase === 'waiting' ? '🏆 ' + t.nextPrize : '🏆 ' + t.currentPrize}: {Number(roundPrizeEtb ?? 0).toFixed(2)} ብር</p>
          </section>
        )}

        <section className="grid grid-cols-[0.9fr_0.65fr_1.8fr] items-start gap-2 rounded-2xl border border-yellow-400 bg-black p-2 shadow-[0_0_18px_rgba(250,204,21,.28)]">
          <div className="relative">
            <button
              type="button"
              aria-expanded={patternOpen}
              aria-controls="winning-pattern-options"
              onClick={() => setPatternOpen(open => !open)}
              className="flex min-h-[3.4rem] w-full items-center justify-center gap-1 rounded-xl border border-yellow-400 bg-black px-1.5 text-center text-xs font-black leading-tight text-yellow-300 sm:text-base"
            >
              {t.winningPattern} <span aria-hidden="true">{patternOpen ? '▴' : '▾'}</span>
            </button>
            {patternOpen && (
              <div id="winning-pattern-options" className="absolute left-0 top-full z-40 mt-1 max-h-64 w-56 max-w-[75vw] overflow-y-auto rounded-xl border border-yellow-400 bg-black p-2 text-left shadow-[0_0_18px_rgba(250,204,21,.35)]">
                <div className="grid grid-cols-2 gap-2">
                  {(DIRECTIONAL_PATTERN_OPTIONS.has(winPattern)
                    ? patternMasks(winPattern).map((_, index) => ({
                        key: `${winPattern}-orientation-${index}`,
                        value: winPattern,
                        label: `${patternNames[lang][winPattern] ?? winPattern} ${orientationLabel(index)}`,
                        cells: getPatternCells(winPattern, index),
                      }))
                    : WIN_PATTERN_OPTIONS
                        .filter(option => (RELATED_PATTERN_OPTIONS[winPattern] ?? [winPattern]).includes(option.value))
                        .map(option => ({
                          key: option.value,
                          value: option.value,
                          label: patternNames[lang][option.value] ?? option.label,
                          cells: getPatternCells(option.value),
                        }))
                  ).map(option => (
                    <div
                      key={option.key}
                      aria-label={option.label}
                      className="flex flex-col items-center gap-1 rounded-lg border border-yellow-300/70 bg-yellow-400/10 p-2"
                    >
                      <span className="grid aspect-square w-14 grid-cols-5 gap-[2px] rounded bg-zinc-800 p-1">
                        {Array.from({ length: 25 }, (_, index) => (
                          <span key={index} className={`rounded-[1px] ${option.cells.includes(index) ? 'bg-yellow-300 shadow-[0_0_3px_rgba(250,204,21,.7)]' : 'bg-zinc-700'}`} />
                        ))}
                      </span>
                      <span className="text-center text-[10px] font-bold leading-tight text-yellow-100">{option.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-center pt-1">
            <div className="grid w-full max-w-[6.5rem] grid-cols-5 gap-[2px] rounded-md border border-yellow-300/70 bg-white p-1 shadow-[0_0_12px_rgba(250,204,21,.35)]">
              {Array.from({ length: 25 }, (_, i) => <span key={i} className={`aspect-square rounded-[2px] ${patternCells.includes(i) ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,.9)]' : 'bg-zinc-200'}`} />)}
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex min-h-[3.4rem] items-center justify-around gap-0.5 rounded-xl border border-yellow-400 bg-black px-1 py-1">
              {lastCalls.length ? lastCalls.map((number, index) => <CalledBall key={number} number={number} latest={index === 0} />) : <span className="text-xs text-yellow-100/60">—</span>}
            </div>
            <div className="ml-auto mt-1 w-fit rounded-lg border border-red-500 bg-red-950 px-4 py-0.5 text-lg font-black leading-none text-red-500 shadow-[0_0_12px_rgba(239,68,68,.5)]">
              {callTimer}
            </div>
          </div>
        </section>

        <section aria-label={t.numberBoard} className="rounded-2xl border border-yellow-400 bg-black p-2 shadow-[0_0_18px_rgba(250,204,21,.22)] sm:p-3">
          <div className="mb-2 flex flex-nowrap items-center justify-between gap-1">
            <h2 className="shrink-0 text-[11px] font-black tracking-wide text-yellow-300 sm:text-base">{t.numberBoard}</h2>
            <div className="flex shrink-0 items-center gap-1">
              {numberBoardExpanded && (
                <>
                  <span aria-label={t.calledCount} className="rounded-md border border-yellow-500/60 bg-yellow-400 px-2 py-1.5 text-[11px] font-black text-black shadow sm:px-3 sm:text-sm tabular-nums">{calledNumbers.length}/75</span>
                  <button type="button" aria-pressed={numberBoardMode === 'called'} onClick={() => setNumberBoardMode(mode => mode === 'all' ? 'called' : 'all')} className={`rounded-md border border-yellow-500/60 px-2 py-1.5 text-[11px] font-black transition sm:px-3 sm:text-sm ${numberBoardMode === 'called' ? 'bg-yellow-400 text-black shadow' : 'bg-zinc-950 text-yellow-200 hover:bg-yellow-400/10'}`}>{numberBoardMode === 'called' ? t.fullBoard : t.called}</button>
                </>
              )}
              <button type="button" aria-expanded={numberBoardExpanded} aria-controls="bingo-number-board-grid" onClick={() => setNumberBoardExpanded(expanded => !expanded)} className="shrink-0 rounded-lg border border-yellow-400/70 bg-yellow-400/10 px-2 py-2 text-[11px] font-black text-yellow-200 hover:bg-yellow-400/20 sm:px-3 sm:text-xs">
                {numberBoardExpanded ? t.collapse + ' ▴' : t.expand + ' ▾'}
              </button>
            </div>
          </div>
          {numberBoardExpanded && (
            <div id="bingo-number-board-grid" className="space-y-1.5">
              {LETTERS.map((letter, row) => (
                <div key={letter} className="grid grid-cols-[1.5rem_repeat(15,minmax(0,1fr))] items-stretch gap-1 sm:grid-cols-[2.25rem_repeat(15,minmax(0,1fr))] sm:gap-1.5">
                  <div className={`grid place-items-center rounded-md text-sm font-black text-black shadow-inner sm:text-lg ${['bg-blue-400','bg-red-400','bg-emerald-400','bg-amber-300','bg-orange-400'][row]}`}>
                    {letter}
                  </div>
                  {Array.from({ length: 15 }, (_, col) => {
                    const number = row * 15 + col + 1;
                    const isCalled = called.has(number);
                    const isLatestCall = calledNumbers[calledNumbers.length - 1] === number;
                    const visible = numberBoardMode === 'all' || isCalled;
                    return (
                      <div key={number} aria-label={visible ? `${letter} ${number}${isLatestCall ? ', latest called number' : isCalled ? ', called' : ''}` : undefined} className={`grid aspect-square min-w-0 place-items-center rounded-[4px] border text-[clamp(12px,2vw,18px)] font-black tabular-nums transition sm:text-base ${!visible ? 'border-transparent bg-transparent text-transparent' : isLatestCall ? 'bingo-latest-called-number border-white text-black shadow-[0_0_18px_rgba(250,204,21,.95)] ring-2 ring-yellow-200' : isCalled ? 'border-yellow-200 bg-blue-600 text-white shadow-[0_0_8px_rgba(59,130,246,.65)]' : 'border-yellow-500/20 bg-zinc-900 text-yellow-100/90'}`}>
                        {visible ? number : ''}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </section>

        {(draftCards.length > 0 || cards.length > 0) && (
          <section className="grid gap-2 sm:gap-4" style={{ gridTemplateColumns: `repeat(${cardsPerRow}, minmax(0, 1fr))` }}>
            {orderedDraftCards.map((card, index) => (
              <BingoCardView
                labels={t}
                key={card.id}
                card={card}
                index={index}
                marks={new Set<number>()}
                called={called}
                markColor={markColor}
                pattern={winPattern}
                claimable={false}
                claiming={false}
                onClaim={() => undefined}
                onToggle={() => undefined}
                draft
                registering={registeringDraftId === card.id}
                onRegister={() => void registerDraftCard(card)}
                onRemove={() => {
                  const serial = String(card.serial);
                  try {
                    const raw = localStorage.getItem(removedDraftsStorageKey);
                    const parsed: unknown = raw ? JSON.parse(raw) : [];
                    const removed = new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []);
                    removed.add(serial);
                    localStorage.setItem(removedDraftsStorageKey, JSON.stringify([...removed]));
                  } catch { /* API removal below still clears the server copy */ }
                  setDraftCards(current => current.filter(item => item.id !== card.id));
                  void api.post('/api/cards/previews/remove', { serial }).catch(() => undefined);
                }}
              />
            ))}
            {orderedCards.map((card, index) => (
              <BingoCardView
                labels={t}
                key={card.id}
                card={card}
                index={draftCards.length + index}
                marks={markSets[card.id] ?? new Set<number>()}
                called={called}
                markColor={markColor}
                pattern={winPattern}
                claimable={claimableCards.some(candidate => candidate.id === card.id)}
                claiming={claimingCardId === card.id}
                onClaim={() => void handleClaim(card.id)}
                onToggle={number => toggleMark(card.id, number)}
                onRemove={() => removeCards([card.id])}
              />
            ))}
          </section>
        )}
        {draftMessage && <p role="status" className="rounded-lg bg-yellow-950/70 p-2 text-center text-xs font-bold text-yellow-200">{draftMessage}</p>}
        {quickBuyOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:pb-3" role="presentation" onClick={() => !quickBuyBusy && setQuickBuyOpen(false)}>
            <section role="dialog" aria-modal="true" aria-labelledby="quick-buy-title" className="max-h-[calc(100dvh-7.5rem-env(safe-area-inset-bottom))] w-full max-w-md overflow-y-auto rounded-2xl border-2 border-yellow-400 bg-zinc-950 p-4 shadow-[0_0_30px_rgba(250,204,21,.3)] sm:max-h-[calc(100dvh-2rem)]" onClick={event => event.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 id="quick-buy-title" className="text-lg font-black text-yellow-300">{t.quickBuyTitle}</h2>
                <button type="button" disabled={quickBuyBusy} onClick={() => setQuickBuyOpen(false)} aria-label={t.close} className="grid h-9 w-9 place-items-center rounded-full border border-yellow-500/50 text-xl text-white disabled:opacity-40">×</button>
              </div>
              {bonusRound ? (
                <p className="mb-3 rounded-lg border border-emerald-400/40 bg-emerald-950/40 p-2 text-center text-sm font-bold text-emerald-300">🎁 {t.bonusNotice}</p>
              ) : (
                <div className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-950/30 p-3 text-center">
                  <p className="text-sm font-bold text-yellow-100">የካርቴላ ፓኬጅ ይምረጡ</p>
                  <p className="mt-1 text-xs text-yellow-100/70">ካርቴላዎቹን በነፃ ይመልከቱ፤ REGISTER ሲጫኑ ብቻ የአንድ ካርቴላ ክፍያ ይፈጸማል።</p>
                  <p className="mt-2 text-xs text-yellow-300">{t.cardPrice}: {formatAmount(lang, cardPrice)} ብር / ካርቴላ</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {quickBuyOptions.map(count => (
                  <button key={count} type="button" aria-pressed={bonusRound && quickBuyCount === count} disabled={!quickBuyAllowed || quickBuyBusy} onClick={() => bonusRound ? setQuickBuyCount(count) : void addPreviewCards(count)} className={`rounded-xl border-2 px-3 py-4 text-base font-black transition disabled:opacity-40 ${bonusRound && quickBuyCount === count ? 'border-yellow-200 bg-yellow-400 text-black shadow-[0_0_18px_rgba(250,204,21,.3)]' : 'border-yellow-500/40 bg-black text-yellow-100 hover:bg-yellow-950'}`}>
                    {count} ካርቴላ
                  </button>
                ))}
              </div>
              {bonusRound && (
                <div className="my-4 flex items-center justify-between border-t border-yellow-500/30 pt-3 text-sm">
                  <span className="text-yellow-100/80">{t.balance}</span><strong className="text-yellow-200">{formatAmount(lang, balance)} ብር</strong>
                </div>
              )}
              {!quickBuyAllowed && <p role="status" className="mb-3 rounded-lg bg-amber-950/60 p-2 text-xs text-amber-200">{t.buyOnlyWaiting}</p>}
              {bonusRound && quickBuyInsufficient && <p role="alert" className="mb-3 text-xs text-red-300">{t.insufficient}</p>}
              {quickBuyMessage && <p role="status" className="mb-3 text-xs font-bold text-yellow-300">{quickBuyMessage}</p>}
              {bonusRound && (
                <button type="button" onClick={() => void submitQuickBuy()} disabled={!quickBuyAllowed || quickBuyInsufficient || quickBuyBusy} className="sticky bottom-0 z-10 mt-3 w-full rounded-xl border-t border-yellow-500/30 bg-zinc-950 bg-gradient-to-r from-yellow-200 to-amber-500 px-4 py-3 font-black text-black shadow-[0_-8px_18px_rgba(0,0,0,.7)] disabled:opacity-40">
                  {quickBuyBusy ? t.buying : t.getFreeCards}
                </button>
              )}
            </section>
          </div>
        )}

        <footer className="fixed inset-x-0 bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-30 px-2 sm:px-4">
          <div className="mx-auto flex max-w-[1100px] items-center gap-2 rounded-2xl border border-yellow-400 bg-black/95 p-2 shadow-[0_0_25px_rgba(250,204,21,.35)] backdrop-blur-xl">
            <button type="button" role="switch" aria-checked={autoMark} onClick={() => {
              const next = !autoMark;
              setAutoMark(next);
              try { localStorage.setItem('bgb.autoMark', next ? 'on' : 'off'); } catch { /* ignore */ }
            }} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
              <span className="text-[10px] font-black text-white sm:text-xs">{t.autoMark}</span>
              <span className={`relative h-6 w-10 shrink-0 rounded-full ${autoMark ? 'bg-green-500' : 'bg-zinc-600'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${autoMark ? 'translate-x-5' : 'translate-x-1'}`} /></span>
            </button>
            <button
              type="button"
              onClick={() => { setQuickBuyMessage(''); setQuickBuyOpen(true); }}
              disabled={!quickBuyAllowed}
              aria-label={t.quickBuy}
              className="player-quick-buy-footer-cta min-w-0 shrink-0 rounded-xl px-2 py-2 text-center disabled:opacity-40"
            >
              <span className="block text-lg font-black leading-none" aria-hidden="true">＋</span>
            </button>
            <button type="button" onClick={onGoToWallet} className="min-w-0 shrink-0 border-l border-yellow-500/50 px-2 text-left">
              <span className="flex items-center gap-1 text-lg leading-none text-yellow-400">▣ <span className="text-[9px] font-bold text-white sm:text-xs">{t.balance}</span></span>
              <strong className="text-xs font-black tabular-nums text-yellow-300 sm:text-base">{formatAmount(lang, balance)} ብር</strong>
            </button>
            <button type="button" disabled={claimableCards.length === 0 || !!claimingCardId} onClick={() => void handleClaim(claimableCards[0]?.id)} className="min-w-[34%] rounded-full border-2 border-yellow-200 bg-gradient-to-b from-yellow-200 via-yellow-400 to-amber-600 px-3 py-3 text-base font-black text-black shadow-[0_0_20px_rgba(250,204,21,.5)] disabled:opacity-45 sm:min-w-[30%] sm:text-xl">
              {claimingCardId ? '…' : '♛ ' + t.claim}
            </button>
          </div>
        </footer>
      </div>
      {winner && iWon && <div role="status" className="sr-only">{t.winAnnouncement}</div>}
    </main>
  );
}

export default PlayView;
