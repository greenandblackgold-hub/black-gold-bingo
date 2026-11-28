import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
  gameStarted: boolean;
};

function sameCardGrid(a: BingoCard, b: BingoCard): boolean {
  return a.grid.length === b.grid.length && a.grid.every((row, r) =>
    row.length === b.grid[r]?.length && row.every((value, c) => value === b.grid[r][c]));
}

function sameCardNumbersOnGrid(previous: Set<number>, next: Set<number>, grid: BingoCard['grid']): boolean {
  for (const row of grid) for (const value of row) {
    if (value !== null && previous.has(value) !== next.has(value)) return false;
  }
  return true;
}

function sameBingoCardProps(previous: CardProps, next: CardProps): boolean {
  if (previous.labels !== next.labels || previous.gameStarted !== next.gameStarted || previous.index !== next.index ||
      previous.markColor !== next.markColor || previous.pattern !== next.pattern ||
      previous.claimable !== next.claimable || previous.claiming !== next.claiming ||
      previous.draft !== next.draft || previous.registering !== next.registering) return false;
  if (previous.card.id !== next.card.id || previous.card.serial !== next.card.serial ||
      !!previous.card.locked !== !!next.card.locked || !sameCardGrid(previous.card, next.card) ||
      previous.called.size !== next.called.size) return false;
  return sameCardNumbersOnGrid(previous.marks, next.marks, previous.card.grid) &&
    sameCardNumbersOnGrid(previous.called, next.called, previous.card.grid);
}

function readableMarkText(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return '#111827';
  const channels = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = (value: number) => value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  const luminance = 0.2126 * linear(channels[0]) + 0.7152 * linear(channels[1]) + 0.0722 * linear(channels[2]);
  return luminance > 0.42 ? '#111827' : '#ffffff';
}

const BingoCardView = memo(function BingoCardView({ labels, card, index, marks, called, markColor, pattern, claimable, claiming, onClaim, onToggle, onRemove, draft = false, registering = false, onRegister, gameStarted }: CardProps) {
  const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];
  const winning = useMemo(() => {
    const result = findWinningPattern(card.grid, new Set([...called].filter(n => marks.has(n))), pattern);
    return result.missing === 0 ? result.positions : null;
  }, [card.grid, called, marks, pattern]);
  const winningCells = useMemo(() => new Set((winning ?? []).map(([r, c]) => r + '-' + c)), [winning]);

  return (
    <section className={`bingo-card-surface relative min-w-0 overflow-hidden rounded-[1.2rem] border-2 ${accent.border} bg-black p-0 shadow-xl ${accent.glow}`}>
      <div className={`flex min-h-7 items-center justify-between gap-1 bg-gradient-to-r ${accent.head} px-1.5 py-1 text-white sm:min-h-9 sm:px-2`}>
        <div className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden="true" className="shrink-0 text-xs sm:text-sm">▣</span>
          <span className="truncate text-xs font-black tabular-nums sm:text-sm">{card.serial}</span>
          <span className="shrink-0 rounded-full border border-white/25 bg-black/25 px-1.5 py-0.5 text-[9px] font-black leading-none text-white sm:text-[10px]">N-{called.size}</span>
          {card.locked && <span className="shrink-0 rounded bg-red-700 px-1.5 py-0.5 text-[9px] font-black">{labels.locked}</span>}
        </div>
        {draft ? (
          <button type="button" aria-label={`Remove card #${card.serial}`} onClick={(event) => { event.stopPropagation(); onRemove(); }} className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-xl font-medium leading-none text-white/95 transition hover:bg-black/20 focus:outline-none focus:ring-2 focus:ring-white/80 sm:h-7 sm:w-7">×</button>
        ) : (
          <span aria-label={`Card #${card.serial} locked`} title="Locked" className="grid h-6 w-6 shrink-0 place-items-center text-base text-white/95 sm:h-7 sm:w-7">🔒</span>
        )}
      </div>
      {draft ? (
        <button type="button" onClick={onRegister} disabled={registering} className="flex min-h-7 w-full items-center justify-center bg-emerald-700 px-2 py-1 text-xs font-black text-white transition hover:bg-emerald-600 disabled:opacity-60 sm:min-h-8 sm:text-xs">
          {registering ? '…' : 'ካርቴላ አመዝግብ'}
        </button>
      ) : (
        <div className="flex min-h-7 w-full items-center justify-center bg-emerald-700 px-2 py-1 text-xs font-black text-white sm:min-h-8 sm:text-xs">
          {gameStarted ? 'BINGO' : 'ተመዝግበዋል'}
        </div>
      )}
      <div className="grid grid-cols-5 gap-px overflow-hidden bg-zinc-300">
        {LETTERS.map((letter, col) => (
          <div key={letter} className={`grid min-h-7 place-items-center py-0.5 text-center text-sm font-black text-white sm:min-h-8 sm:text-lg ${['bg-blue-700','bg-sky-600','bg-orange-500','bg-fuchsia-700','bg-green-700'][col]}`}>{letter}</div>
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
              data-marked={marked && !free ? 'true' : undefined}
              style={marked && !free ? ({
                '--bingo-mark-color': markColor,
                '--bingo-mark-text-color': readableMarkText(markColor),
              } as CSSProperties) : undefined}
              className={[
                'relative grid aspect-square min-w-0 place-items-center border text-[clamp(12px,2.8vw,20px)] font-black leading-none transition',
                free ? 'rounded-full border-blue-300 bg-blue-600 text-white shadow-[0_0_12px_rgba(0,140,255,.9)]' :
                  wasCalled ? 'rounded-full border-pink-300 bg-pink-600 text-white shadow-[0_0_7px_rgba(236,72,153,.35)]' :
                  marked ? 'rounded-[3px] border-zinc-300 bg-white text-black' :
                  'rounded-[3px] border-zinc-300 bg-white text-black',
                inWinningLine ? 'outline outline-2 outline-yellow-300' : '',
              ].join(' ')}
            >
              {free ? '★' : value}
            </button>
          );
        }))}
      </div>
      {claimable && !card.locked && (
        <button type="button" onClick={onClaim} disabled={claiming} className="mt-1 w-full rounded-lg bg-gradient-to-r from-yellow-200 to-amber-500 py-1.5 text-sm font-black text-black">
          {claiming ? labels.claiming : 'BINGO'}
        </button>
      )}
    </section>
  );
}, sameBingoCardProps);

function formatClock(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function RoundCallTimer({
  phase, nextRoundAt, nextCallAt, calledCount, firstCallAt, endedAt,
}: {
  phase: string;
  nextRoundAt: number | null;
  nextCallAt: number | null;
  calledCount: number;
  firstCallAt: number | null;
  endedAt: number | null;
}) {
  // Keep the one-second clock isolated from the card list. Updating the
  // countdown must not reconcile thousands of card-list children.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const value = phase === 'waiting' && nextRoundAt !== null
    ? formatClock(nextRoundAt - now)
    : phase === 'running' && calledCount === 0 && nextCallAt !== null
      ? formatClock(nextCallAt - now)
      : calledCount > 0 && firstCallAt !== null
        ? formatClock((phase === 'ended' && endedAt !== null ? endedAt : now) - firstCallAt)
        : '0:00';
  return <>{value}</>;
}

function CalledBall({ number, latest = false, animateLatest = true }: { number: number; latest?: boolean; animateLatest?: boolean }) {
  const letter = letterFor(number);
  const color = letter === 'N' ? 'from-green-400 to-green-700' :
    letter === 'G' ? 'from-purple-500 to-purple-800' :
    letter === 'B' ? 'from-red-500 to-red-800' :
    letter === 'I' ? 'from-blue-400 to-blue-700' : 'from-orange-400 to-orange-700';
  return (
    <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/80 bg-gradient-to-br ${color} text-white shadow-[0_0_12px_rgba(255,255,255,.18)] sm:h-12 sm:w-12 sm:border-2 ${latest && animateLatest ? 'ring-2 ring-yellow-200 animate-pulse' : ''}`}>
      <span className="text-[7px] font-black leading-none sm:text-[9px]">{letter}</span>
      <strong className="text-sm leading-none sm:text-xl">{number}</strong>
    </div>
  );
}

export function PlayView({ onGoToWallet, settingsOpen, onSettingsOpenChange }: { onGoToWallet: () => void; settingsOpen: boolean; onSettingsOpenChange: (open: boolean) => void }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { lang } = useLanguage();
  const t = gameUi.bingoScreen[lang];
  const { cards, markedByCard, toggleMark, removeCards, balance, buyCards } = usePlayer();
  const {
    phase, bonusRound = false, winPattern, calledNumbers, claimBingo, winner, roundNumber, roomId, loaded,
    nextCallAt, roundPrizeEtb, nextRoundAt, firstCallAt, endedAt,
  } = useRound();
  const { cardPrice } = useAppSettings();
  const markUndoStack = useRef<Record<string, number[]>[]>([]);
  const markRedoStack = useRef<Record<string, number[]>[]>([]);
  const [autoMark, setAutoMark] = useState(true);
  const [autoClaim, setAutoClaim] = useState(() => { try { return localStorage.getItem('bgb.autoClaim') === 'on'; } catch { return false; } });
  const [autoBuyEnabled, setAutoBuyEnabled] = useState(() => { try { return localStorage.getItem('bgb.autoBuyEnabled') === 'on'; } catch { return false; } });
  const [autoBuyCount, setAutoBuyCount] = useState(() => { try { const n=Number(localStorage.getItem('bgb.autoBuyCount')); return [1,2,5,10,15,20,25,30].includes(n) ? n : 1; } catch { return 1; } });
  const [numberHighlight, setNumberHighlight] = useState(() => { try { return localStorage.getItem('bgb.numberHighlight') !== 'off'; } catch { return true; } });
  const autoBuyRoundRef = useRef<number | null>(null);
  const [claimingCardId, setClaimingCardId] = useState<string | null>(null);
  const [patternOpen, setPatternOpen] = useState(false);
  const [numberBoardMode, setNumberBoardMode] = useState<'all' | 'called'>(() => {
    try { return localStorage.getItem('bgb.numberBoardMode') === 'called' ? 'called' : 'all'; } catch { return 'all'; }
  });
  const [numberBoardExpanded, setNumberBoardExpanded] = useState(() => {
    try { return localStorage.getItem('bgb.numberBoardExpanded') !== 'off'; } catch { return true; }
  });
  const [markColor, setMarkColor] = useState(() => {
    try {
      const saved = localStorage.getItem('bgb.markColor');
      return ['#d4af37','#ef4444','#3b82f6','#22c55e','#a855f7','#f97316','#ec4899','#ffffff'].includes(saved ?? '') ? saved! : '#d4af37';
    } catch { return '#d4af37'; }
  });
  const [playerTheme, setPlayerTheme] = useState<'dark' | 'light'>(() => {
    try { return localStorage.getItem('bgb.playerTheme') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
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
  const [quickBuyCount, setQuickBuyCount] = useState(1);
  const [quickBuyBusy, setQuickBuyBusy] = useState(false);
  const [quickBuyMessage, setQuickBuyMessage] = useState('');
  const [selectedDepositAccount, setSelectedDepositAccount] = useState<DepositAccount | null>(null);
  const [depositAccountsExpanded, setDepositAccountsExpanded] = useState(false);
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
    window.dispatchEvent(new Event('bgb-player-settings'));
  }, [numberBoardMode, numberBoardExpanded]);

  useEffect(() => {
    try { setAutoMark(localStorage.getItem('bgb.autoMark') !== 'off'); } catch { /* use default */ }
  }, []);

  useEffect(() => {
    const syncCardSettings = () => {
      try {
        const color = localStorage.getItem('bgb.markColor');
        setMarkColor(['#d4af37','#ef4444','#3b82f6','#22c55e','#a855f7','#f97316','#ec4899','#ffffff'].includes(color ?? '') ? color! : '#d4af37');
        setCardOrder(localStorage.getItem('bgb.cardOrder') === 'newest' ? 'newest' : 'oldest');
        setPlayerTheme(localStorage.getItem('bgb.playerTheme') === 'light' ? 'light' : 'dark');
        setAutoMark(localStorage.getItem('bgb.autoMark') !== 'off');
        setAutoClaim(localStorage.getItem('bgb.autoClaim') === 'on');
        setAutoBuyEnabled(localStorage.getItem('bgb.autoBuyEnabled') === 'on');
        const autoCount = Number(localStorage.getItem('bgb.autoBuyCount'));
        setAutoBuyCount([1,2,5,10,15,20,25,30].includes(autoCount) ? autoCount : 1);
        setNumberHighlight(localStorage.getItem('bgb.numberHighlight') !== 'off');
        setNumberBoardMode(localStorage.getItem('bgb.numberBoardMode') === 'called' ? 'called' : 'all');
        setNumberBoardExpanded(localStorage.getItem('bgb.numberBoardExpanded') !== 'off');
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

  // SSE snapshots frequently contain fresh arrays even when no called number changed.
  // Keep the lookup Set stable until the actual call sequence changes.
  const calledKey = calledNumbers.join(',');
  const called = useMemo(() => new Set(calledNumbers), [calledKey]);
  const previousCalled = useMemo(() => new Set(calledNumbers.slice(0, -1)), [calledKey]);
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

  const handleManualMark = useCallback((cardId: string, number: number) => {
    markUndoStack.current.push(JSON.parse(JSON.stringify(markedByCard)) as Record<string, number[]>);
    if (markUndoStack.current.length > 100) markUndoStack.current.shift();
    markRedoStack.current = [];
    toggleMark(cardId, number);
  }, [markedByCard, toggleMark]);

  useEffect(() => {
    const applySnapshot = (snapshot: Record<string, number[]>) => {
      for (const card of cards) {
        const current = new Set(markedByCard[card.id] ?? []);
        const target = new Set(snapshot[card.id] ?? []);
        for (const number of new Set([...current, ...target])) {
          if (current.has(number) !== target.has(number)) toggleMark(card.id, number);
        }
      }
    };
    const undo = () => {
      const previous = markUndoStack.current.pop();
      if (!previous) return;
      markRedoStack.current.push(JSON.parse(JSON.stringify(markedByCard)) as Record<string, number[]>);
      applySnapshot(previous);
    };
    const redo = () => {
      const next = markRedoStack.current.pop();
      if (!next) return;
      markUndoStack.current.push(JSON.parse(JSON.stringify(markedByCard)) as Record<string, number[]>);
      applySnapshot(next);
    };
    window.addEventListener('bgb:undo-mark', undo);
    window.addEventListener('bgb:redo-mark', redo);
    return () => {
      window.removeEventListener('bgb:undo-mark', undo);
      window.removeEventListener('bgb:redo-mark', redo);
    };
  }, [cards, markedByCard, toggleMark]);

  const claimableCards = useMemo(() => {
    if (!active || calledKey.length === 0) return [];
    return cards.filter(card =>
      !card.locked &&
      findWinningPattern(card.grid, called, winPattern).missing === 0 &&
      findWinningPattern(card.grid, previousCalled, winPattern).missing > 0
    );
  }, [active, cards, called, previousCalled, winPattern]);

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
  }, [active, autoMark, calledKey, cards, markedByCard, toggleMark]);

  const celebrated = useRef<number | null>(null);
  const iWon = !!winner && cards.some(card => card.id === winner.cardId);
  useEffect(() => {
    if (!winner || !iWon || celebrated.current === winner.at) return;
    celebrated.current = winner.at;
    play('win');
  }, [winner, iWon]);

  const claimingCardIdRef = useRef<string | null>(null);
  const claimBingoRef = useRef(claimBingo);
  const calledCountRef = useRef(calledNumbers.length);
  claimBingoRef.current = claimBingo;
  calledCountRef.current = calledNumbers.length;
  const handleClaim = useCallback(async (cardId: string) => {
    if (claimingCardIdRef.current) return;
    claimingCardIdRef.current = cardId;
    setClaimingCardId(cardId);
    try { await claimBingoRef.current(cardId, calledCountRef.current); }
    finally {
      claimingCardIdRef.current = null;
      setClaimingCardId(null);
    }
  }, []);

  useEffect(() => {
    if (!autoClaim || claimableCards.length === 0) return;
    void handleClaim(claimableCards[0].id);
  }, [autoClaim, claimableCards, handleClaim]);

  const lastCalls = calledNumbers.slice(-5).reverse();
  const quickBuyTotal = bonusRound || isAdmin ? 0 : quickBuyCount * cardPrice;
  const quickBuyAllowed = bonusRound || phase === 'waiting';
  const quickBuyInsufficient = !bonusRound && !isAdmin && quickBuyTotal > balance;
  const quickBuyOptions = bonusRound ? [1, 2, 3] : [1, 2, 5, 10, 15, 20, 25, 30];

  useEffect(() => {
    setQuickBuyCount(1);
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
  const registeringDraftIdRef = useRef<string | null>(null);
  const buyCardsRef = useRef(buyCards);
  buyCardsRef.current = buyCards;
  const registerDraftCard = useCallback(async (card: BingoCard) => {
    if (registeringDraftIdRef.current) return;
    registeringDraftIdRef.current = card.id;
    setRegisteringDraftId(card.id);
    setDraftMessage('');
    try {
      const result = await buyCardsRef.current(1, String(card.serial), { grid: card.grid, token: card.previewToken });
      if (result.ok) {
        setDraftCards(current => current.filter(item => item.id !== card.id));
        setDraftMessage(isAdmin ? 'የAdmin ሙከራ ካርቴላ ያለ ክፍያ ተመዝግቧል።' : 'ካርቴላው ተመዝግቧል። BINGO!');
      } else {
        setDraftMessage(result.error ?? 'በቂ ቀሪ ሂሳብ የለም። ካርቴላው አልተመዘገበም።');
      }
    } finally {
      registeringDraftIdRef.current = null;
      setRegisteringDraftId(null);
    }
  }, [isAdmin]);
  useEffect(() => {
    if (!loaded || !autoBuyEnabled || phase !== 'waiting') return;
    let targetRound = 0;
    try { targetRound = Number(localStorage.getItem('bgb.autoBuyNextRound')); } catch { /* ignore */ }
    if (!Number.isInteger(targetRound) || targetRound < 1) {
      try { localStorage.setItem('bgb.autoBuyNextRound', String(roundNumber + 1)); } catch { /* ignore */ }
      return;
    }
    if (roundNumber < targetRound || autoBuyRoundRef.current === roundNumber) return;
    autoBuyRoundRef.current = roundNumber;
    void buyCardsRef.current(autoBuyCount).then(result => {
      if (result.ok) {
        try { localStorage.setItem('bgb.autoBuyNextRound', String(roundNumber + 1)); } catch { /* ignore */ }
        setDraftMessage(String(autoBuyCount) + ' ካርቴላ ለዙር ' + String(roundNumber) + (isAdmin ? ' በAdmin ሙከራ ነጻ ተመዝግቧል።' : ' በራስ-ሰር ተገዝቷል።'));
      } else {
        setAutoBuyEnabled(false);
        try { localStorage.setItem('bgb.autoBuyEnabled', 'off'); } catch { /* ignore */ }
        setDraftMessage(result.error ?? 'Auto-buy አልተሳካም፤ ቅንብሩ ተዘግቷል።');
      }
    }).catch(() => {
      setAutoBuyEnabled(false);
      try { localStorage.setItem('bgb.autoBuyEnabled', 'off'); } catch { /* ignore */ }
      setDraftMessage('Auto-buy አልተሳካም፤ ቅንብሩ ተዘግቷል።');
    });
  }, [loaded, autoBuyEnabled, autoBuyCount, phase, roundNumber, isAdmin]);

  const submitQuickBuy = async () => {
    if (!quickBuyAllowed || quickBuyInsufficient || quickBuyBusy) return;
    setQuickBuyBusy(true);
    setQuickBuyMessage('');
    try {
      const result = await buyCards(quickBuyCount);
      if (result.ok) {
        setQuickBuyMessage(isAdmin ? 'የAdmin ሙከራ ካርዶች ያለ ክፍያ ተጨምረዋል።' : 'ካርዶቹ በተሳካ ሁኔታ ተጨምረዋል።');
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
  return (
    <main data-player-theme={playerTheme} className="player-play-view relative mx-auto mb-[calc(env(safe-area-inset-bottom)-2.875rem)] min-h-[calc(100dvh-7.625rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-[1100px] overflow-visible rounded-[2rem] border-2 border-zinc-500/80 bg-black px-2 pb-8 pt-2 text-white shadow-[0_0_35px_rgba(212,175,55,.22)] sm:min-h-[calc(100dvh-8.375rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] sm:px-4 sm:pt-4 lg:min-h-[calc(100dvh-9.375rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]">

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
            <button
              type="button"
              aria-expanded={depositAccountsExpanded}
              aria-controls="deposit-account-options"
              onClick={() => setDepositAccountsExpanded(expanded => !expanded)}
              className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300"
            >
              <span className="min-w-0">
                <span className="block text-[11px] font-bold tracking-wide text-yellow-300">📢 {t.depositAccounts}</span>
                <span className="mt-1 block text-[10px] text-yellow-100/80">{t.choosePayment}</span>
              </span>
              <span className="shrink-0 rounded-full border border-yellow-400/40 bg-black/40 px-3 py-1.5 text-xs font-black text-yellow-200">
                {depositAccountsExpanded ? '−' : '+'} 3
              </span>
            </button>
            {depositAccountsExpanded && (
              <div id="deposit-account-options" className="mx-auto mt-3 grid max-w-md gap-2 text-left">
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
            )}
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
            className="rounded-xl border border-yellow-400/80 bg-yellow-950/70 px-2 py-1.5 text-center shadow-[0_0_12px_rgba(250,204,21,.14)]"
          >
            <span className="block text-[9px] font-bold leading-tight tracking-wide text-yellow-300">{phase === 'running' ? t.roundHelp : t.nextRoundHelp}</span>
            <h2 className="mt-0.5 text-[10px] font-bold leading-tight text-yellow-100">
              {t.patternType}: {patternNames[lang][winPattern]}
            </h2>
            <p className="mt-0.5 text-[9px] font-medium leading-snug text-yellow-50">
              {getPatternDescription(lang, winPattern)}
            </p>
            <p className="mt-0.5 text-[8px] leading-snug text-yellow-300/90">
              {t.winInstruction}
            </p>
          </section>
        )}

        <section className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-xl border border-yellow-400 bg-black p-2 shadow-[0_0_14px_rgba(250,204,21,.2)]">
          <div className="relative">
            <button
              type="button"
              aria-expanded={patternOpen}
              aria-controls="winning-pattern-options"
              onClick={() => setPatternOpen(open => !open)}
              className="inline-flex min-h-0 w-fit items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-yellow-400 bg-black px-2 py-1.5 text-[10px] font-black leading-tight text-yellow-300 sm:text-xs"
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
          <div className="min-w-0">
            <div className="flex min-h-[3.4rem] items-center justify-around gap-0.5 rounded-xl border border-yellow-400 bg-black px-1 py-1">
              {lastCalls.length ? lastCalls.map((number, index) => <CalledBall key={number} number={number} latest={index === 0} animateLatest={numberHighlight} />) : <span className="text-xs text-yellow-100/60">—</span>}
            </div>
          </div>
        </section>

        <section aria-label={t.numberBoard} className="rounded-2xl border border-yellow-400 bg-black p-2 shadow-[0_0_18px_rgba(250,204,21,.22)] sm:p-3">
          <div className="mb-2 flex flex-nowrap items-center gap-1">
            <h2 className="shrink-0 text-[11px] font-black tracking-wide text-yellow-300 sm:text-base">{t.numberBoard}</h2>
            <div className="shrink-0 rounded-lg border border-red-500 bg-red-950 px-2 py-0.5 text-sm font-black leading-none text-red-500 shadow-[0_0_12px_rgba(239,68,68,.5)] sm:px-4 sm:text-lg">
              <RoundCallTimer phase={phase} nextRoundAt={nextRoundAt} nextCallAt={nextCallAt} calledCount={calledNumbers.length} firstCallAt={firstCallAt} endedAt={endedAt} />
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1">
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
                    const isLatestCall = numberHighlight && calledNumbers[calledNumbers.length - 1] === number;
                    const visible = numberBoardMode === 'all' || isCalled;
                    return (
                      <div key={number} aria-label={visible ? `${letter} ${number}${isLatestCall ? ', latest called number' : isCalled ? ', called' : ''}` : undefined} className={`grid aspect-square min-w-0 place-items-center rounded-[4px] border text-[clamp(13px,2.2vw,19px)] font-black tabular-nums transition sm:text-[19px] ${!visible ? 'border-transparent bg-transparent text-transparent' : isLatestCall ? 'bingo-latest-called-number border-white text-black shadow-[0_0_18px_rgba(250,204,21,.95)] ring-2 ring-yellow-200' : isCalled ? 'border-yellow-200 bg-blue-600 text-white shadow-[0_0_8px_rgba(59,130,246,.65)]' : 'border-yellow-500/20 bg-zinc-900 text-yellow-100/90'}`}>
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
          <section className="grid grid-cols-2 items-start gap-1.5 sm:gap-4">
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
                gameStarted={phase !== 'waiting'}
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
                gameStarted={phase !== 'waiting'}
                claiming={claimingCardId === card.id}
                onClaim={() => void handleClaim(card.id)}
                onToggle={number => handleManualMark(card.id, number)}
                onRemove={() => removeCards([card.id])}
              />
            ))}
          </section>
        )}
        <button
          type="button"
          onClick={() => { setQuickBuyMessage(''); setQuickBuyOpen(true); }}
          disabled={!quickBuyAllowed}
          aria-label={t.quickBuy}
          title={t.quickBuy}
          className="fixed bottom-[calc(6.25rem+env(safe-area-inset-bottom))] right-4 z-40 grid h-16 w-16 place-items-center rounded-full border-2 border-emerald-300/70 bg-emerald-600 text-4xl font-black leading-none text-white shadow-[0_8px_24px_rgba(16,185,129,.45)] transition hover:bg-emerald-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 sm:right-6 sm:h-[4.5rem] sm:w-[4.5rem]"
        >
          <span aria-hidden="true">＋</span>
        </button>
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
                  <p className="mt-1 text-xs text-yellow-100/70">የሚፈልጉትን ፓኬጅ ይምረጡ፤ በግዢ ማረጋገጫው ላይ የተመረጡት ካርቴላዎች በአንድ ጊዜ ይጨመራሉ።</p>
                  <p className="mt-2 text-xs text-yellow-300">{isAdmin ? 'ADMIN TEST · ነጻ ካርቴላ' : `${t.cardPrice}: ${formatAmount(lang, cardPrice)} ብር / ካርቴላ`}</p>
                  {isAdmin && <p className="mt-1 text-[11px] font-bold text-emerald-300">Admin account only · No balance deduction · Testing use</p>}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {quickBuyOptions.map(count => (
                  <button key={count} type="button" aria-pressed={quickBuyCount === count} disabled={!quickBuyAllowed || quickBuyBusy} onClick={() => setQuickBuyCount(count)} className={`rounded-xl border-2 px-3 py-4 text-base font-black transition disabled:opacity-40 ${quickBuyCount === count ? 'border-yellow-200 bg-yellow-400 text-black shadow-[0_0_18px_rgba(250,204,21,.3)]' : 'border-yellow-500/40 bg-black text-yellow-100 hover:bg-yellow-950'}`}>
                    {count} ካርቴላ
                  </button>
                ))}
              </div>
              <div className="my-4 space-y-2 border-t border-yellow-500/30 pt-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-yellow-100/80">{t.balance}</span>
                  <strong className="text-yellow-200">{formatAmount(lang, balance)} ብር</strong>
                </div>
                {!bonusRound && !isAdmin && (
                  <>
                    <div className="flex items-center justify-between gap-3 text-yellow-100/80">
                      <span>{t.cardPrice} × {quickBuyCount}</span>
                      <strong>{formatAmount(lang, cardPrice)} × {quickBuyCount}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-yellow-500/20 pt-2">
                      <span className="font-bold text-yellow-100">{lang === 'am' ? 'ጠቅላላ ዋጋ' : lang === 'ti' ? 'ጠቕላላ ዋጋ' : 'Total'}</span>
                      <strong className="text-lg text-yellow-300">{formatAmount(lang, quickBuyTotal)} ብር</strong>
                    </div>
                  </>
                )}
                {isAdmin && !bonusRound && <p className="flex items-center justify-between gap-3 border-t border-yellow-500/20 pt-2 text-emerald-300"><span className="font-bold">Admin test total</span><strong className="text-lg">FREE · 0 ETB</strong></p>}
              </div>
              {!quickBuyAllowed && <p role="status" className="mb-3 rounded-lg bg-amber-950/60 p-2 text-xs text-amber-200">{t.buyOnlyWaiting}</p>}
              {quickBuyInsufficient && <p role="alert" className="mb-3 text-xs text-red-300">{t.insufficient}</p>}
              {quickBuyMessage && <p role="status" className="mb-3 text-xs font-bold text-yellow-300">{quickBuyMessage}</p>}
              <button type="button" onClick={() => void submitQuickBuy()} disabled={!quickBuyAllowed || quickBuyInsufficient || quickBuyBusy} className="sticky bottom-0 z-10 mt-3 w-full rounded-xl border-t border-yellow-500/30 bg-zinc-950 bg-gradient-to-r from-yellow-200 to-amber-500 px-4 py-3 font-black text-black shadow-[0_-8px_18px_rgba(0,0,0,.7)] disabled:opacity-40">
                {quickBuyBusy ? t.buying : bonusRound ? t.getFreeCards : isAdmin ? 'GET FREE ADMIN TEST CARDS' : t.buyCards}
              </button>
            </section>
          </div>
        )}


      </div>
      {winner && iWon && <div role="status" className="sr-only">{t.winAnnouncement}</div>}
    </main>
  );
}

export default PlayView;
