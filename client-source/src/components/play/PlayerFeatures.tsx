import { useEffect, useState } from 'react';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useLanguage } from '@/context/LanguageContext';
import { usePlayer } from '@/context/PlayerContext';
import { useRound } from '@/context/RoundContext';
import { formatAmount, formatDateTime, patternNames as localizedPatternNames, translations } from '@/lib/localization';
import { gameUi } from '@/lib/gameUi';
import { patternMasks } from '@/lib/bingo';
import { WIN_PATTERN_OPTIONS } from '@/lib/patternCatalog';
import type { WinPattern } from '@/types/game';
import { SERVER_MODE } from '@/lib/api';

type PatternOption = { label: string; cells: number[]; pattern?: WinPattern };
function getPatternOptions(pattern: WinPattern, labels: Partial<Record<WinPattern, string>>): PatternOption[] {
  const masks = pattern === 'half_house'
    ? [Array.from({length:25},(_,i)=>i).filter(i=>i!==12).slice(0,12).map(i=>[Math.floor(i/5),i%5] as [number,number])]
    : patternMasks(pattern);
  // Large combinatorial patterns are sampled evenly; every thumbnail is still a real backend rule mask.
  const stride = Math.max(1, Math.ceil(masks.length / 12));
  const samples = masks.filter((_,i)=>i%stride===0).slice(0,12);
  return samples.map((mask,index)=>({
    label: masks.length===1 ? (labels[pattern] ?? pattern.replace(/_/g, ' ')) : `${labels[pattern] ?? pattern.replace(/_/g, ' ')} · ${index+1}`,
    cells: mask.map(([r,c])=>r*5+c),
  }));
}
function getAllPatternOptions(labels: Partial<Record<WinPattern, string>>): PatternOption[] {
  return WIN_PATTERN_OPTIONS.map((pattern) => {
    const masks = pattern === 'half_house'
      ? [Array.from({length:25},(_,i)=>i).filter(i=>i!==12).slice(0,12).map(i=>[Math.floor(i/5),i%5] as [number,number])]
      : patternMasks(pattern);
    const mask = masks[0] ?? [];
    return {
      pattern,
      label: labels[pattern] ?? pattern.replace(/_/g, ' '),
      cells: mask.map(([r,c]) => r*5+c),
    };
  });
}


export function PlayerFeatures({ onGoToWallet, settingsOnly = false, menuOnly = false, selectionMode = false, selectedCardCount = 0, cardColumns = 2, onToggleSelectionMode, onCardColumnsChange }: { onGoToWallet: () => void; settingsOnly?: boolean; menuOnly?: boolean; selectionMode?: boolean; selectedCardCount?: number; cardColumns?: 2 | 3 | 4; onToggleSelectionMode?: () => void; onCardColumnsChange?: (columns: 2 | 3 | 4) => void }) {
  const { lang, setLang } = useLanguage();
  const t = gameUi.playerFeatures[lang];
  const { balance, cards, transactions, clearMarks, removeCards, buyCards } = usePlayer();
  const { cardPrice, audioVolume, setAudioVolume, backgroundMusicEnabled, setBackgroundMusicEnabled, gameSpeed, setGameSpeed } = useAppSettings();
  const { calledNumbers, roundNumber, phase, winner, winPattern, roundPrizeEtb, roundCardCount, verifyCard } = useRound();
  const { soundEnabled, setSoundEnabled, voiceEnabled, setVoiceEnabled } = useAppSettings();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try { return localStorage.getItem('bgb.playerTheme') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
  });
  const [notifications, setNotifications] = useState(() => {
    try { return localStorage.getItem('bgb.playerNotifications') === 'on'; } catch { return false; }
  });
  const [cardOrder, setCardOrder] = useState<'oldest' | 'newest'>(() => {
    try { return localStorage.getItem('bgb.cardOrder') === 'newest' ? 'newest' : 'oldest'; } catch { return 'oldest'; }
  });
  const markColors = ['#3b82f6','#ec4899','#06b6d4','#22c55e','#f97316','#ef4444','#a855f7','#1e3a8a','#d4af37','#ffffff'];
  const [markColor, setMarkColor] = useState(() => {
    try { const value = localStorage.getItem('bgb.markColor'); return markColors.includes(value ?? '') ? value! : '#d4af37'; } catch { return '#d4af37'; }
  });
  const [autoDaub, setAutoDaub] = useState(() => { try { return localStorage.getItem('bgb.autoMark') !== 'off'; } catch { return true; } });
  const [numberHighlight, setNumberHighlight] = useState(() => { try { return localStorage.getItem('bgb.numberHighlight') !== 'off'; } catch { return true; } });
  const [autoClaim, setAutoClaim] = useState(() => { try { return localStorage.getItem('bgb.autoClaim') === 'on'; } catch { return false; } });
  const [autoBuyEnabled, setAutoBuyEnabled] = useState(() => { try { return localStorage.getItem('bgb.autoBuyEnabled') === 'on'; } catch { return false; } });
  const [autoBuyCount, setAutoBuyCount] = useState(() => { try { const n = Number(localStorage.getItem('bgb.autoBuyCount')); return [1,2,5,10,15,20,25,30].includes(n) ? n : 1; } catch { return 1; } });
  const [chatMessagesVisible, setChatMessagesVisible] = useState(() => { try { return localStorage.getItem('bgb.chatMessagesVisible') !== 'off'; } catch { return true; } });
  const [hideUnregistered, setHideUnregistered] = useState(() => { try { return localStorage.getItem('bgb.hideUnregistered') === 'on'; } catch { return false; } });
  const [removeUnregistered, setRemoveUnregistered] = useState(() => {
    try { return localStorage.getItem('bgb.removeUnregistered') === 'on'; } catch { return false; }
  });
  const [selectedCards, setSelectedCards] = useState<string[]>(() => {
    try { const value: unknown = JSON.parse(localStorage.getItem('bgb.selectedCards') || '[]'); return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []; } catch { return []; }
  });
  useEffect(() => {
    const syncSettings = () => {
      try {
        setTheme(localStorage.getItem('bgb.playerTheme') === 'light' ? 'light' : 'dark');
        setNotifications(localStorage.getItem('bgb.playerNotifications') === 'on');
        setCardOrder(localStorage.getItem('bgb.cardOrder') === 'newest' ? 'newest' : 'oldest');
        const color = localStorage.getItem('bgb.markColor');
        setMarkColor(markColors.includes(color ?? '') ? color! : '#d4af37');
        setRemoveUnregistered(localStorage.getItem('bgb.removeUnregistered') === 'on');
        setHideUnregistered(localStorage.getItem('bgb.hideUnregistered') === 'on');
        setAutoDaub(localStorage.getItem('bgb.autoMark') !== 'off');
        setNumberHighlight(localStorage.getItem('bgb.numberHighlight') !== 'off');
        setAutoClaim(localStorage.getItem('bgb.autoClaim') === 'on');
        setAutoBuyEnabled(localStorage.getItem('bgb.autoBuyEnabled') === 'on');
        const autoCount = Number(localStorage.getItem('bgb.autoBuyCount'));
        setAutoBuyCount([1,2,5,10,15,20,25,30].includes(autoCount) ? autoCount : 1);
        setChatMessagesVisible(localStorage.getItem('bgb.chatMessagesVisible') !== 'off');
        const selected: unknown = JSON.parse(localStorage.getItem('bgb.selectedCards') || '[]');
        setSelectedCards(Array.isArray(selected) ? selected.filter((id): id is string => typeof id === 'string') : []);
      } catch { /* Keep the current visible settings if storage is unavailable. */ }
    };
    window.addEventListener('bgb-player-settings', syncSettings);
    window.addEventListener('storage', syncSettings);
    return () => {
      window.removeEventListener('bgb-player-settings', syncSettings);
      window.removeEventListener('storage', syncSettings);
    };
  }, []);
  const [expanded, setExpanded] = useState<string | null>(settingsOnly ? 'settings' : null);
  const [inlineMenuOpen, setInlineMenuOpen] = useState(false);
  const [showCardPurchase, setShowCardPurchase] = useState(false);
  const [purchaseCount, setPurchaseCount] = useState(1);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [showPatternOptions, setShowPatternOptions] = useState(false);
  const [selectedPatternOption, setSelectedPatternOption] = useState(0);
  const light = theme === 'light';
  const patternNames = localizedPatternNames[lang];
  const patternOptions = getPatternOptions(winPattern, patternNames);
  const allPatternOptions = getAllPatternOptions(patternNames);
  const activePatternOption = patternOptions[selectedPatternOption % patternOptions.length] ?? patternOptions[0];
  const panel = light ? 'border-amber-300 bg-amber-50 text-zinc-900' : 'border-gold-700/40 bg-zinc-950/70 text-gold-100';
  const muted = light ? 'text-zinc-600' : 'text-gold-600';
  const title = light ? 'text-amber-800' : 'text-gold-300';
  const toggle = (key: string) => setExpanded((v) => v === key ? null : key);
  const submitCardPurchase = async () => {
    if (purchaseBusy || phase !== 'waiting') return;
    const total = purchaseCount * cardPrice;
    if (total > balance) {
      setPurchaseMessage({ kind: 'err', text: t.purchaseInsufficient });
      return;
    }
    setPurchaseBusy(true);
    setPurchaseMessage(null);
    try {
      const result = await buyCards(purchaseCount);
      if (result.ok) {
        setPurchaseMessage({ kind: 'ok', text: `${purchaseCount} ${t.cards} ${t.purchaseSuccess}` });
        setPurchaseCount(1);
      } else {
        setPurchaseMessage({ kind: 'err', text: t.purchaseError });
      }
    } catch {
      setPurchaseMessage({ kind: 'err', text: t.purchaseRetry });
    } finally {
      setPurchaseBusy(false);
    }
  };
  const setPlayerTheme = (value: 'dark' | 'light') => {
    setTheme(value);
    try { localStorage.setItem('bgb.playerTheme', value); } catch { /* keep the in-memory choice */ }
    window.dispatchEvent(new Event('bgb-player-settings'));
  };
  const enableNotifications = async (on: boolean) => {
    if (!on) {
      setNotifications(false);
      try { localStorage.setItem('bgb.playerNotifications', 'off'); } catch { /* ignore */ }
      window.dispatchEvent(new Event('bgb-player-settings'));
      return;
    }
    if (!('Notification' in window)) return;
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    const enabled = permission === 'granted';
    setNotifications(enabled);
    try { localStorage.setItem('bgb.playerNotifications', enabled ? 'on' : 'off'); } catch { /* ignore */ }
    window.dispatchEvent(new Event('bgb-player-settings'));
  };

  const rows = [
    { id: 'messages', label: t.messages, icon: '✉' },
    { id: 'settings', label: t.settings, icon: '⚙' },
    { id: 'rules', label: t.rules, icon: '▤' },
    { id: 'app', label: t.app, icon: '▣' },
    { id: 'history', label: t.history, icon: '◷' },
    { id: 'contact', label: t.contact, icon: '☎' },
    { id: 'info', label: t.info, icon: 'ⓘ' },
  ];

  return (
    <section className="mt-6 space-y-4" aria-label={t.ariaLabel}>
      {!settingsOnly && !menuOnly && <div className={`overflow-hidden rounded-2xl border ${panel} shadow-xl`}>
        <div className="relative overflow-hidden bg-gradient-to-r from-zinc-950 via-zinc-900 to-amber-950 px-4 py-5 sm:px-6">
          <div className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full border-[18px] border-amber-300/10" />
          <div className="relative flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.28em] text-amber-300">BLACK GOLD BINGO</p>
              <h2 className="mt-1 text-xl font-black text-amber-100 sm:text-2xl">{t.currentGameType}</h2>
              <p className="mt-1 text-base font-extrabold text-amber-300">{patternNames[winPattern] ?? winPattern.replace(/_/g, ' ')}</p>
              <p className="mt-1 text-xs text-amber-200/70">{t.round} #{roundNumber} · {phase === 'running' ? t.running : phase === 'waiting' ? t.waiting : t.ended}</p>
            </div>
            <button type="button" onClick={() => setShowPatternOptions(true)} aria-label={t.showPatterns} className="group shrink-0 rounded-2xl border border-amber-300/50 bg-black/40 p-2 text-left shadow-lg shadow-amber-900/30 focus:outline-none focus:ring-2 focus:ring-amber-300">
              <span className="grid h-16 w-16 grid-cols-5 gap-1 sm:h-20 sm:w-20" aria-hidden="true">{Array.from({length:25},(_,i)=><span key={i} className={`rounded-[2px] ${activePatternOption.cells.includes(i)?'bg-sky-400 ring-1 ring-white/80':'bg-white/10'}`}/>)}</span>
              <span className="mt-1 block text-center text-[9px] font-bold text-amber-200">{t.showPatterns}</span>
            </button>
          </div>
        </div>
        {showPatternOptions && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={t.patternList}>
          <div className="max-h-[82vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-amber-400/50 bg-zinc-950 p-4 text-amber-50 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-base font-black text-amber-200">{t.possiblePatterns}</h3><p className="mt-1 text-xs text-amber-100/60">{patternNames[winPattern] ?? winPattern.replace(/_/g, ' ')} · {allPatternOptions.length} {t.patternCount}</p></div><button type="button" onClick={() => setShowPatternOptions(false)} className="rounded-lg border border-amber-300/30 px-3 py-2 text-sm font-bold">{t.close} ✕</button></div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{allPatternOptions.map((option)=><div key={option.pattern} className={`flex items-center gap-3 rounded-xl border p-3 text-left ${option.pattern===winPattern?'border-sky-300 bg-sky-950/60':'border-amber-900 bg-black/30'}`}>
              <span className="grid h-14 w-14 shrink-0 grid-cols-5 gap-0.5 rounded-lg bg-black p-1">{Array.from({length:25},(_,i)=><span key={i} className={`rounded-[1px] ${option.cells.includes(i)?'bg-sky-400':'bg-white/10'}`}/>)}</span><span className="text-xs font-bold leading-5">{option.label}{option.pattern===winPattern&&<span className="mt-1 block text-[10px] text-sky-300">{t.currentPattern}</span>}</span>
            </div>)}</div><p className="mt-3 text-[11px] leading-5 text-amber-100/60">{t.freeExplanation}</p>
          </div></div>}
        <div className="space-y-2 p-3 sm:p-4">
          <div className="mx-auto w-full max-w-3xl rounded-xl border border-gold-700/30 bg-black/20 p-2 sm:p-2.5">
            <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
            {[
              ['ዋጋ', `${formatAmount(lang, cardPrice)} ${translations.wallet[lang].etb}`],
              ['የአሁኑ ዋና ሽልማት', SERVER_MODE && roundPrizeEtb !== undefined ? `${formatAmount(lang, roundPrizeEtb)} ${translations.wallet[lang].etb}` : '—'],
              ['ካርድ ግዛ', ''],
              ['ጠቅላላ ካርቴላ', String(cards.length)],
            ].map(([label, value]) => (
              label === 'ካርድ ግዛ' ? (
                <button key={label} type="button" onClick={() => { setPurchaseMessage(null); setShowCardPurchase(true); }} className={`min-w-0 rounded-md border p-1.5 text-left transition hover:border-amber-400 ${light ? 'border-amber-300 bg-amber-100' : 'border-amber-400/50 bg-amber-400/10'}`}>
                  <p className="text-[9px] leading-3 text-amber-600">{t.buyCard}</p>
                  <p className="mt-0.5 flex items-center gap-0.5 text-[11px] font-black leading-4 text-amber-400"><span aria-hidden="true" className="text-base font-black leading-none text-red-500">＋</span>{t.addCard}</p>
                </button>
              ) : (
                <div key={label} className={`min-w-0 rounded-md border p-1.5 ${light ? 'border-amber-200 bg-white' : 'border-gold-700/30 bg-black/25'}`}>
                  <p className={`text-[9px] leading-3 ${muted}`}>{label}</p><p className={`mt-0.5 text-[11px] font-black leading-4 tabular-nums ${title}`}>{value}</p>
                </div>
              )
            ))}
            </div>
          </div>
          {showCardPurchase && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-3" role="dialog" aria-modal="true" aria-label={t.cardPurchase}>
              <div className="w-full max-w-md space-y-4 rounded-2xl border border-amber-400/50 bg-zinc-950 p-4 text-amber-50 shadow-2xl sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-xs font-bold text-amber-400">BLACK GOLD BINGO</p><h3 className="text-lg font-black text-amber-200">{t.cardPurchase}</h3></div>
                  <button type="button" onClick={() => setShowCardPurchase(false)} aria-label={t.close} className="rounded-lg border border-amber-400/40 px-3 py-2">✕</button>
                </div>
                <div className="rounded-xl border border-amber-400/20 bg-black/40 p-3">
                  <p className="text-xs text-amber-200/70">{t.currentBalance}</p>
                  <p className="text-xl font-black tabular-nums text-amber-300">{formatAmount(lang, balance)} {translations.wallet[lang].etb}</p>
                </div>
                <div className="space-y-3 rounded-xl border border-amber-400/20 p-3">
                  <p className="text-sm font-semibold">{t.chooseCardCount}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[1, 2, 5, 10, 15, 20, 25, 30].map((count) => (
                      <button key={count} type="button" disabled={purchaseBusy} onClick={() => setPurchaseCount(count)} aria-pressed={purchaseCount === count} className={`rounded-lg border px-2 py-3 text-sm font-black transition disabled:opacity-50 ${purchaseCount === count ? 'border-amber-300 bg-amber-400 text-zinc-950' : 'border-amber-400/40 bg-black/30 text-amber-200 hover:border-amber-300'}`}>
                        {count} {t.card}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between text-sm"><span className="text-amber-100/60">{t.pricePerCard}</span><strong>{formatAmount(lang, cardPrice)} {translations.wallet[lang].etb}</strong></div>
                  <div className="flex justify-between border-t border-amber-400/20 pt-3"><span className="font-bold">{t.payable}</span><strong className="text-lg text-amber-300">{formatAmount(lang, purchaseCount * cardPrice)} {translations.wallet[lang].etb}</strong></div>
                </div>
                {phase !== 'waiting' && <p className="rounded-lg bg-red-950/60 p-2 text-sm text-red-200">{t.purchaseOnlyWaiting}</p>}
                {purchaseMessage && <p role="status" className={`rounded-lg p-2 text-sm ${purchaseMessage.kind === 'ok' ? 'bg-emerald-950 text-emerald-200' : 'bg-red-950 text-red-200'}`}>{purchaseMessage.text}</p>}
                <button type="button" disabled={purchaseBusy || phase !== 'waiting' || purchaseCount * cardPrice > balance} onClick={() => void submitCardPurchase()} className="w-full rounded-xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 font-black text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50">{purchaseBusy ? t.buying : t.buyCards}</button>
                <p className="text-center text-[11px] leading-5 text-amber-100/50">{t.autoGenerated}</p>
              </div>
            </div>
          )}
          <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm ${light ? 'border-amber-200 bg-white' : 'border-gold-700/30 bg-black/25'}`}>
            <span className={muted}>{t.roundStatus}</span>
            <strong className={title}>{calledNumbers.length} / 75 {t.balls}</strong>
          </div>
          <div className="space-y-1.5">
            {['B','I','N','G','O'].map((letter, i) => (
              <div key={letter} className="grid grid-cols-[1.4rem_repeat(15,minmax(0,1fr))] items-center gap-1 rounded-lg border border-gold-700/30 bg-black/25 p-1">
                <span className="text-center text-xs font-black text-gold-300">{letter}</span>
                {Array.from({length:15},(_,j)=>i*15+j+1).map((n)=>(<span key={n} className={["grid h-6 min-w-0 place-items-center rounded text-[9px] font-semibold tabular-nums",calledNumbers.includes(n) ? "border border-white bg-blue-600 text-white" : "bg-white/[0.035] text-gold-600"].join(" ")}>{n}</span>))}
              </div>
            ))}
          </div>
        </div>
      </div>}
      {(menuOnly || settingsOnly || inlineMenuOpen) && <div className={`overflow-hidden rounded-2xl border ${panel}`}>
        {rows.filter(row => (chatMessagesVisible || row.id !== 'messages') && (settingsOnly ? row.id === 'settings' : menuOnly ? ['messages','rules','app','history','contact','info'].includes(row.id) : true)).map((row) => (
          <div key={row.id} className="border-b border-current/10 last:border-0">
            {!settingsOnly && <button type="button" onClick={() => toggle(row.id)} aria-expanded={expanded === row.id} className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left">
              <span className="flex items-center gap-3 font-semibold"><span className={`grid h-9 w-9 place-items-center rounded-xl ${light ? 'bg-amber-100 text-amber-800' : 'bg-gold-500/10 text-gold-300'}`}>{row.icon}</span>{row.label}</span>
              <span className={muted}>{expanded === row.id ? '−' : '+'}</span>
            </button>}
            {expanded === row.id && (
              <div className="space-y-3 px-4 pb-4">
                {row.id === 'messages' && <p className={`text-sm ${muted}`}>{t.adminMessages}</p>}
                {row.id === 'info' && <p className={`text-sm leading-6 ${muted}`}>{t.infoText}</p>}
                {row.id === 'contact' && <p className={`text-sm ${muted}`}>{t.contactText}</p>}
                {row.id === 'history' && <div className="space-y-2 rounded-xl border border-amber-400/25 bg-black/25 p-3"><div className="space-y-2 px-2 py-1">{(transactions ?? []).length === 0 ? <p className="py-3 text-center text-xs text-gold-600">{t.noTransactions}</p> : (transactions ?? []).slice().sort((a,b)=>b.at-a.at).map(tx => <div key={tx.id} className="flex items-center justify-between gap-3 border-b border-gold-700/20 py-2 text-xs"><div className="min-w-0"><p className="font-semibold text-gold-200">{tx.label ?? (tx.kind === 'deposit' ? t.deposit : t.cardPurchaseLabel)}</p><p className="text-[10px] text-gold-700">{formatDateTime(lang, tx.at)}</p></div><strong className={tx.amount >= 0 ? 'shrink-0 text-emerald-300' : 'shrink-0 text-amber-300'}>{tx.amount >= 0 ? '+' : '−'}{formatAmount(lang, Math.abs(tx.amount))} {translations.wallet[lang].etb}</strong></div>)}</div><p className="px-3 py-3 text-xs leading-5 text-gold-600">{t.noPreviousRounds}</p><button type="button" onClick={onGoToWallet} className="w-full rounded-lg bg-amber-400/10 px-3 py-2 text-xs font-bold text-amber-200">{t.goWalletHistory}</button></div>}
                {row.id === 'wallet' && <button type="button" onClick={onGoToWallet} className="w-full rounded-xl bg-gradient-to-r from-amber-300 to-yellow-600 px-4 py-3 font-bold text-zinc-950">{t.goWallet}</button>}
                {row.id === 'gameHistory' && <p className={`text-sm ${muted}`}>{t.gameHistoryUnavailable}</p>}
                {row.id === 'settings' && settingsOnly && (
                  <div className="space-y-4 text-sm text-slate-100">
                    <div className="grid grid-cols-2 gap-3">
                      <button type="button" onClick={onToggleSelectionMode} aria-pressed={selectionMode} className={`flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border p-3 text-center transition ${selectionMode ? 'border-sky-300 bg-sky-950/70' : 'border-sky-500/40 bg-sky-950/35 hover:border-sky-300'}`}>
                        <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-600 text-2xl font-black text-white">☑</span>
                        <span className="text-sm font-bold">ብዙ ካርቴላዎችን ምረጥ (Select)</span>
                        {selectionMode && <span className="text-[11px] text-sky-200">{selectedCardCount} ተመርጠዋል</span>}
                      </button>
                      <button type="button" onClick={clearMarks} className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border border-red-500/35 bg-red-950/25 p-3 text-center transition hover:border-red-400">
                        <span className="grid h-11 w-11 place-items-center rounded-full bg-red-700/80 text-2xl font-black text-white">↻</span>
                        <span className="text-sm font-bold">ምልክት የተደረጉ ቁጥሮችን አጥፋ (Reset)</span>
                      </button>
                    </div>

                    <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-sky-200">▦ <span>ሰሌዳ</span></h3>
                      <div className="grid grid-cols-3 gap-2">
                        {([2, 3, 4] as const).map(columns => (
                          <button key={columns} type="button" aria-pressed={cardColumns === columns} onClick={() => onCardColumnsChange?.(columns)} className={`rounded-xl border p-2 transition ${cardColumns === columns ? 'border-sky-300 bg-sky-950/70 ring-2 ring-sky-400/70' : 'border-slate-600 bg-slate-950/70'}`}>
                            <span className="mx-auto grid h-12 w-full max-w-16 gap-1" style={{gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`, gridTemplateRows: 'repeat(2,minmax(0,1fr))'}}>
                              {Array.from({length: columns * 2}, (_, i) => <span key={i} className={`rounded-sm ${cardColumns === columns ? 'bg-sky-500' : 'bg-slate-500'}`} />)}
                            </span>
                            <span className="mt-1 block text-center text-sm font-black">{columns}</span>
                          </button>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-700 pt-3">
                        <span className="text-sm font-semibold text-slate-200">⚙ የካርቴላዎች አደራደር</span>
                        <div className="flex gap-1">
                          <button type="button" aria-pressed={cardOrder === 'oldest'} onClick={() => {setCardOrder('oldest');try{localStorage.setItem('bgb.cardOrder','oldest');}catch{}window.dispatchEvent(new Event('bgb-player-settings'));}} className={`rounded-lg border px-2 py-1.5 text-xs font-bold ${cardOrder === 'oldest' ? 'border-sky-300 bg-sky-900 text-white' : 'border-slate-600 text-slate-300'}`}>L·LT</button>
                          <button type="button" aria-pressed={cardOrder === 'newest'} onClick={() => {setCardOrder('newest');try{localStorage.setItem('bgb.cardOrder','newest');}catch{}window.dispatchEvent(new Event('bgb-player-settings'));}} className={`rounded-lg border px-2 py-1.5 text-xs font-bold ${cardOrder === 'newest' ? 'border-sky-300 bg-sky-900 text-white' : 'border-slate-600 text-slate-300'}`}>LT·L</button>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-black text-sky-200">ϟ <span>በጨዋታ ጊዜ</span></h3>
                      <div className="divide-y divide-slate-700">
                        <label className="flex items-center gap-3 py-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-xl text-amber-300">★</span>
                          <span className="min-w-0 flex-1"><strong className="block text-sm">አውቶማቲክ አጥቁር</strong><small className="block text-xs leading-5 text-slate-400">የተጠራ ቁጥር ሁሉ በካርቴላው ላይ በራሱ ይመረጣል።</small></span>
                          <input type="checkbox" className="h-5 w-5 accent-sky-500" checked={autoDaub} onChange={e => {const on=e.target.checked;setAutoDaub(on);try{localStorage.setItem('bgb.autoMark',on?'on':'off');}catch{}window.dispatchEvent(new Event('bgb-player-settings'));}} />
                        </label>
                        <label className="flex items-center gap-3 py-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-700 text-xl text-slate-300">◉̸</span>
                          <span className="min-w-0 flex-1"><strong className="block text-sm">ያልተመዘገቡ ካርቴላዎችን ደብቅ</strong><small className="block text-xs leading-5 text-slate-400">ያስመዘገቧቸው ካርቴላዎች ብቻ በሰሌዳው ላይ ይቀራሉ።</small></span>
                          <input type="checkbox" className="h-5 w-5 accent-sky-500" checked={hideUnregistered} onChange={e => {const on=e.target.checked;setHideUnregistered(on);try{localStorage.setItem('bgb.hideUnregistered',on?'on':'off');}catch{}window.dispatchEvent(new Event('bgb-player-settings'));}} />
                        </label>
                        <label className="flex items-center gap-3 py-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-xl text-emerald-300">🔊</span>
                          <span className="min-w-0 flex-1"><strong className="block text-sm">ድምጽ</strong><small className="block text-xs leading-5 text-slate-400">የእስቱ የቢንጎ እና የጨዋታ መጀመሪያ ድምጾች።</small></span>
                          <input type="checkbox" className="h-5 w-5 accent-sky-500" checked={soundEnabled} onChange={e => setSoundEnabled(e.target.checked)} />
                        </label>
                      </div>
                    </section>
                  </div>
                )}
                {row.id === 'settings' && settingsOnly && (
                  <div className="space-y-4 text-sm text-slate-100">
                    <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                      <div className="mb-4 flex items-center justify-between gap-2">
                        <h3 className="flex items-center gap-2 text-sm font-black text-sky-200"><span className="text-lg">☆</span> ማጣቀሻ ቀለም</h3>
                        <div className="flex items-center gap-1.5" aria-label="የቀለም ምሳሌ">
                          {[7,23,61].map(number => <span key={number} className="grid h-8 min-w-8 place-items-center rounded-full px-1.5 text-xs font-black text-white shadow" style={{backgroundColor:markColor}}>{number}</span>)}
                        </div>
                      </div>
                      <div className="grid grid-cols-5 gap-3 sm:grid-cols-8">
                        {markColors.map(color => (
                          <button key={color} type="button" aria-label={`ማጣቀሻ ቀለም ${color}`} aria-pressed={markColor===color} onClick={() => {setMarkColor(color);try{localStorage.setItem('bgb.markColor',color);}catch{}window.dispatchEvent(new Event('bgb-player-settings'));}} className={`mx-auto grid h-10 w-10 place-items-center rounded-xl border-2 transition focus:outline-none focus:ring-2 focus:ring-sky-300 ${markColor===color?'border-white ring-2 ring-sky-300 ring-offset-2 ring-offset-slate-900':'border-white/25 hover:border-white/80'}`} style={{backgroundColor:color}}>
                            {markColor===color && <span className="text-lg font-black text-white drop-shadow">✓</span>}
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-sky-200"><span className="text-lg">◎</span> ቋንቋ</h3>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          {value:'ti' as const,label:'ትግርኛ'},
                          {value:'am' as const,label:'አማርኛ'},
                          {value:'en' as const,label:'እንግሊዝኛ'},
                        ]).map(option => (
                          <button key={option.value} type="button" aria-pressed={lang===option.value} onClick={() => setLang(option.value)} className={`min-h-11 rounded-full border px-2 py-2 text-xs font-black transition sm:text-sm ${lang===option.value?'border-sky-300 bg-sky-500 text-white shadow-[0_0_14px_rgba(56,189,248,.25)]':'border-slate-600 bg-slate-950 text-slate-300 hover:border-slate-400'}`}>{option.label}</button>
                        ))}
                      </div>
                    </section>
                  </div>
                )}
                {row.id === 'settings' && !settingsOnly && (
                  <div className="space-y-4 text-sm">
                    <div className="rounded-xl border border-amber-400/25 bg-black/20 p-3">
                      <h4 className="mb-3 font-black text-amber-300">{t.gameSettings}</h4>
                      <div className="space-y-4">
                        <div><p className="mb-2 font-semibold text-amber-200">{t.layout}</p><div className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 font-bold text-amber-100">2 {t.card} · 2-column grid</div></div>
                        <div><p className="mb-2 font-semibold text-amber-200">{t.cardOrder}</p><div className="flex flex-wrap gap-2"><button type="button" aria-pressed={cardOrder==='oldest'} onClick={()=>{setCardOrder('oldest');try{localStorage.setItem('bgb.cardOrder','oldest');}catch{}window.dispatchEvent(new Event('bgb-player-settings'));}} className={`rounded-lg border px-3 py-2 ${cardOrder==='oldest'?'border-amber-200 bg-amber-400/20 text-amber-100':'border-amber-400/40'}`}>{t.oldestFirst}</button><button type="button" aria-pressed={cardOrder==='newest'} onClick={()=>{setCardOrder('newest');try{localStorage.setItem('bgb.cardOrder','newest');}catch{}window.dispatchEvent(new Event('bgb-player-settings'));}} className={`rounded-lg border px-3 py-2 ${cardOrder==='newest'?'border-amber-200 bg-amber-400/20 text-amber-100':'border-amber-400/40'}`}>{t.newestFirst}</button></div></div>

                        <label className="flex items-center justify-between gap-3"><span>{t.removeUnregistered}</span><input type="checkbox" checked={removeUnregistered} onChange={async e=>{const enabled=e.target.checked;setRemoveUnregistered(enabled);try{localStorage.setItem('bgb.removeUnregistered',enabled?'on':'off');}catch{}window.dispatchEvent(new Event('bgb-player-settings'));if(enabled){const results=await Promise.allSettled(cards.map(async c=>({id:c.id,result:await verifyCard(c.id)})));const removableIds=results.flatMap(result=>result.status==='fulfilled'&&result.value.result.status!=='valid'?[result.value.id]:[]);removeCards(removableIds);}}}/></label>
                        <div><p className="mb-2 font-semibold text-amber-200">{t.markColor}</p><div className="flex flex-wrap gap-3">{markColors.map(color=><button key={color} type="button" aria-label={`${t.markColor}: ${color}`} aria-pressed={markColor===color} onClick={()=>{setMarkColor(color);try{localStorage.setItem('bgb.markColor',color);}catch{}window.dispatchEvent(new Event('bgb-player-settings'));}} className={`h-9 w-9 rounded-full border-2 ${markColor===color?'border-amber-300 ring-2 ring-amber-300 ring-offset-2 ring-offset-zinc-950':'border-white/50'}`} style={{backgroundColor:color}}/>)}</div></div>
                        <div><p className="mb-2 font-semibold text-amber-200">{t.chooseMultipleCards}</p><div className="mb-2 flex gap-2"><button type="button" onClick={()=>{const ids=cards.map(c=>c.id);setSelectedCards(ids);try{localStorage.setItem('bgb.selectedCards',JSON.stringify(ids));}catch{}window.dispatchEvent(new Event('bgb-player-settings'));}} className="rounded-lg border border-amber-400/40 px-3 py-2">{t.selectAll}</button><button type="button" onClick={()=>{setSelectedCards([]);try{localStorage.setItem('bgb.selectedCards','[]');}catch{}window.dispatchEvent(new Event('bgb-player-settings'));}} className="rounded-lg border border-current/20 px-3 py-2">{t.clearSelection}</button></div><div className="grid grid-cols-2 gap-2">{cards.map(c=><label key={c.id} className="flex items-center gap-2 rounded-lg border border-current/15 p-2"><input type="checkbox" checked={selectedCards.includes(c.id)} onChange={e=>{const ids=e.target.checked?[...selectedCards.filter(id=>id!==c.id),c.id]:selectedCards.filter(id=>id!==c.id);setSelectedCards(ids);try{localStorage.setItem('bgb.selectedCards',JSON.stringify(ids));}catch{}window.dispatchEvent(new Event('bgb-player-settings'));}}/><span>{t.card} #{c.serial}</span></label>)}</div>{selectedCards.some(id=>cards.some(card=>card.id===id))&&<button type="button" onClick={()=>{const ids=selectedCards.filter(id=>cards.some(card=>card.id===id));removeCards(ids);setSelectedCards([]);try{localStorage.setItem('bgb.selectedCards','[]');}catch{}window.dispatchEvent(new Event('bgb-player-settings'));}} className="w-full rounded-lg border border-red-400/40 px-3 py-2 font-bold text-red-300">{lang==='am'?'የተመረጡትን ካርቴላዎች አስወግድ':lang==='ti'?'እተን ዝተመርጻ ካርድታት ኣወግድ':'Remove selected cards'}</button>}</div>
                        <button type="button" onClick={()=>{clearMarks();setSelectedCards([]);try{localStorage.setItem('bgb.selectedCards','[]');}catch{}window.dispatchEvent(new Event('bgb-player-settings'));}} className="w-full rounded-lg border border-amber-400/40 px-3 py-2 font-bold text-amber-200">{t.clearMarks}</button>
                      </div>
                    </div>
                    <div><p className="mb-2 font-black text-amber-300">5. Theme / Card Color</p><p className={`mb-2 font-semibold ${title}`}>{t.theme}</p><div className="flex gap-2"><button type="button" onClick={() => setPlayerTheme('light')} aria-pressed={light} className={`rounded-lg border px-4 py-2 ${light ? 'border-amber-500 bg-amber-100 text-amber-900' : 'border-current/20'}`}>{t.light}</button><button type="button" onClick={() => setPlayerTheme('dark')} aria-pressed={!light} className={`rounded-lg border px-4 py-2 ${!light ? 'border-amber-400 bg-zinc-900 text-amber-200' : 'border-current/20'}`}>{t.dark}</button></div></div>
                    <h5 className="font-black text-amber-300">1. Sound Effects</h5>
                    <label className="flex items-center justify-between gap-3"><span>{t.soundEffects}</span><input type="checkbox" checked={soundEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} /></label>
                    <label className="flex items-center justify-between gap-3"><span>{t.numberVoice}</span><input type="checkbox" checked={voiceEnabled} onChange={(e) => setVoiceEnabled(e.target.checked)} /></label>
                    <h5 className="font-black text-amber-300">3. Volume Slider</h5>
                    <label className="block"><span className="mb-2 block">{t.volume}</span><input type="range" min="0" max="1" step="0.05" value={audioVolume} onChange={(e) => setAudioVolume(Number(e.target.value))} className="w-full accent-yellow-500" /></label>
                    <div className="space-y-3 rounded-lg border border-amber-400/20 p-3">
                      <h5 className="font-black text-amber-300">2. Background Music</h5>
                      <label className="flex items-center justify-between gap-3"><span>{lang === 'am' ? 'ረጋ ያለ የጨዋታ ሙዚቃ' : lang === 'ti' ? 'ህዱእ ሙዚቃ ጸወታ' : 'Calm in-game music'}</span><input type="checkbox" checked={backgroundMusicEnabled} onChange={(e) => setBackgroundMusicEnabled(e.target.checked)} /></label>
                    </div>
                    <div className="space-y-2 rounded-lg border border-amber-400/20 p-3">
                      <h5 className="font-black text-amber-300">4. Auto-Daub</h5>
                      <label className="flex items-center justify-between gap-3"><span>{lang === 'am' ? 'የተጠሩ ቁጥሮችን በራስ-ሰር ምልክት አድርግ' : lang === 'ti' ? 'ዝተጸውዑ ቁጽርታት ብኣውቶማቲክ ምልክት ግበር' : 'Automatically mark called numbers'}</span><input type="checkbox" checked={autoDaub} onChange={(e) => { const on=e.target.checked; setAutoDaub(on); try { localStorage.setItem('bgb.autoMark',on?'on':'off'); } catch {} window.dispatchEvent(new Event('bgb-player-settings')); }} /></label>
                    </div>
                    <div className="space-y-2 rounded-lg border border-amber-400/20 p-3">
                      <h5 className="font-black text-amber-300">6. Number Highlight / Animation</h5>
                      <label className="flex items-center justify-between gap-3"><span>{lang === 'am' ? 'የመጨረሻውን የተጠራ ቁጥር አድምቅ' : lang === 'ti' ? 'ናይ መወዳእታ ዝተጸውዐ ቁጽሪ ኣጉልሕ' : 'Highlight the latest called number'}</span><input type="checkbox" checked={numberHighlight} onChange={(e) => { const on=e.target.checked; setNumberHighlight(on); try { localStorage.setItem('bgb.numberHighlight',on?'on':'off'); } catch {} window.dispatchEvent(new Event('bgb-player-settings')); }} /></label>
                    </div>
                    <div className="space-y-2 rounded-lg border border-amber-400/20 p-3">
                      <h5 className="font-black text-amber-300">7. Game Speed</h5>
                      <label className="block"><span className="mb-2 block">{lang === 'am' ? 'የቁጥር ድምጽ ፍጥነት' : lang === 'ti' ? 'ፍጥነት ድምጺ ቁጽሪ' : 'Number announcement speed'}</span><select value={gameSpeed} onChange={(e) => setGameSpeed(e.target.value as 'slow'|'normal'|'fast')} className="w-full rounded-lg border border-amber-400/40 bg-zinc-950 px-3 py-2 text-amber-100"><option value="slow">Slow</option><option value="normal">Normal</option><option value="fast">Fast</option></select></label>
                      <p className="text-xs text-amber-100/60">{lang === 'am' ? 'የServer ዙር ጥሪ ጊዜ በHost ይቆጣጠራል፤ ይህ የድምጽ ማሳወቂያ ፍጥነትን ብቻ ይቀይራል።' : lang === 'ti' ? 'ግዜ ጻውዒት Server ብHost ይቆጻጸር፤ እዚ ፍጥነት ድምጺ ጥራይ ይቕይር።' : 'The Host controls shared server call timing; this changes only local spoken announcement speed.'}</p>
                    </div>
                    <div className="space-y-3 rounded-lg border border-amber-400/20 p-3">
                      <h5 className="font-black text-amber-300">8. Auto-Buy Tickets</h5>
                      <label className="flex items-center justify-between gap-3"><span>{lang === 'am' ? 'ለቀጣዩ ዙር በራስ-ሰር ካርቴላ ግዛ' : lang === 'ti' ? 'ንዝቕጽል ዙር ብኣውቶማቲክ ካርድ ዓድግ' : 'Automatically buy tickets for next rounds'}</span><input type="checkbox" checked={autoBuyEnabled} onChange={(e) => { const on=e.target.checked; setAutoBuyEnabled(on); try { localStorage.setItem('bgb.autoBuyEnabled',on?'on':'off'); if(on) localStorage.setItem('bgb.autoBuyNextRound',String(roundNumber+1)); } catch {} window.dispatchEvent(new Event('bgb-player-settings')); }} /></label>
                      <label className="block"><span className="mb-2 block">{lang === 'am' ? 'ካርቴላዎች ብዛት' : lang === 'ti' ? 'ብዝሒ ካርድታት' : 'Cards per round'}</span><select value={autoBuyCount} onChange={(e) => { const n=Number(e.target.value); setAutoBuyCount(n); try { localStorage.setItem('bgb.autoBuyCount',String(n)); } catch {} window.dispatchEvent(new Event('bgb-player-settings')); }} className="w-full rounded-lg border border-amber-400/40 bg-zinc-950 px-3 py-2 text-amber-100">{[1,2,5,10,15,20,25,30].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
                      <p className="text-xs text-amber-100/60">{lang === 'am' ? 'ከቀጣዩ ዙር ጀምሮ የነባሩን የግዢና የዋሌት ማረጋገጫ ይጠቀማል።' : lang === 'ti' ? 'ካብ ዝቕጽል ዙር ጀሚሩ ነቲ ዘሎ ኣገባብ ዕድጊ ይጥቀም።' : 'Starts next round and uses the existing purchase and wallet validation flow.'}</p>
                    </div>
                    <div className="space-y-2 rounded-lg border border-amber-400/20 p-3">
                      <h5 className="font-black text-amber-300">9. Confirm Bingo / Auto-Claim</h5>
                      <label className="flex items-center justify-between gap-3"><span>{lang === 'am' ? 'ቢንጎ ሲሆን በራስ-ሰር አረጋግጥ' : lang === 'ti' ? 'Bingo ምስ ዝኸውን ብኣውቶማቲክ ኣረጋግጽ' : 'Automatically claim verified Bingo'}</span><input type="checkbox" checked={autoClaim} onChange={(e) => { const on=e.target.checked; setAutoClaim(on); try { localStorage.setItem('bgb.autoClaim',on?'on':'off'); } catch {} window.dispatchEvent(new Event('bgb-player-settings')); }} /></label>
                    </div>
                    <div className="space-y-3 rounded-lg border border-amber-400/20 p-3">
                      <h5 className="font-black text-amber-300">10. Chat Settings</h5>
                      <label className="flex items-center justify-between gap-3"><span>{lang === 'am' ? 'የመልዕክት ክፍሉን አሳይ' : lang === 'ti' ? 'ክፍሊ መልእኽቲ ኣርኢ' : 'Show messages section'}</span><input type="checkbox" checked={chatMessagesVisible} onChange={(e) => { const on=e.target.checked; setChatMessagesVisible(on); try { localStorage.setItem('bgb.chatMessagesVisible',on?'on':'off'); } catch {} window.dispatchEvent(new Event('bgb-player-settings')); }} /></label>
                      <label className="flex items-center justify-between gap-3"><span>{t.notifications}</span><input type="checkbox" checked={notifications} onChange={(e) => void enableNotifications(e.target.checked)} /></label>
                      {'Notification' in window && Notification.permission === 'denied' && <p className="text-xs text-amber-600">{t.notificationBlocked}</p>}
                      <p className={`text-xs ${muted}`}>{t.notificationPermission}</p>
                    </div>
                    <div><p className={`mb-2 font-semibold ${title}`}>{t.language}</p><div className="flex flex-wrap gap-2">{[['am','አማርኛ'],['ti','ትግርኛ'],['en','English']].map(([id,label]) => <button key={id} type="button" onClick={() => setLang(id as 'am'|'ti'|'en')} aria-pressed={lang === id} className={`rounded-lg border px-3 py-2 ${lang === id ? 'border-amber-400 bg-amber-400/15' : 'border-current/20'}`}>{label}</button>)}</div></div>

                  </div>
                )}
                {row.id === 'rules' && <ol className={`list-decimal space-y-2 pl-5 text-sm leading-6 ${muted}`}>{t.rulesList.map((rule) => <li key={rule}>{rule}</li>)}</ol>}
                
              </div>
            )}
          </div>
        ))}
      </div>}
      {!settingsOnly && !menuOnly && <p className="pb-2 text-center text-xs text-gold-700">{t.customerService}</p>}
    </section>
  );
}
