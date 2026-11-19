import { useState } from 'react';
import { patternNames } from '@/lib/localization';
import { getPatternDescription } from '@/lib/patternCatalog';
import { patternMasks } from '@/lib/bingo';
import type { Lang, WinPattern } from '@/types/game';

export function PatternGuide({ pattern, lang, compact = false }: { pattern: WinPattern; lang: Lang; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const title = patternNames[lang][pattern];
  const mask = patternMasks(pattern)[0] ?? [];
  const highlighted = new Set(mask.map(([r,c]) => `${r}-${c}`));
  const detailLabel = lang === 'am' ? 'ዝርዝር' : lang === 'ti' ? 'ዝርዝር' : 'Details';
  const freeLabel = lang === 'am' ? 'ነፃ' : lang === 'ti' ? 'ነጻ' : 'FREE';
  const legend = lang === 'am' ? 'ወርቃማ ሳጥኖች የሚፈለገውን ቅርጽ ያሳያሉ። መካከለኛው FREE ሳጥን በነፃ ይቆጠራል።' : 'Gold cells show the target pattern. The center FREE space counts automatically when included in the pattern.';
  return (
    <section className={`rounded-2xl border border-gold-700/45 bg-cardbg p-3 sm:p-4 ${compact ? 'mt-3' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gold-500">{lang === 'am' ? 'የአሁኑ ዙር የBingo ዓይነት' : 'Current round pattern'}</p>
          <h3 className="mt-1 truncate text-base font-black text-gold-200">{title}</h3>
        </div>
        <button type="button" onClick={() => setExpanded(v => !v)} aria-expanded={expanded} className="shrink-0 rounded-lg border border-gold-500/40 bg-gold-500/10 px-3 py-2 text-sm font-bold text-gold-300 hover:bg-gold-500/20">
          {expanded ? (lang === 'am' ? 'ደብቅ' : 'Hide') : detailLabel}
        </button>
      </div>
      {expanded && (
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,220px)_1fr] sm:items-center">
          <div className="mx-auto grid w-full max-w-[220px] grid-cols-5 gap-1 rounded-xl border border-gold-700/40 bg-black/30 p-2" role="img" aria-label={`${title} winning pattern diagram`}>
            {Array.from({ length: 25 }, (_, i) => {
              const r = Math.floor(i / 5), c = i % 5;
              const isFree = r === 2 && c === 2;
              const active = highlighted.has(`${r}-${c}`);
              return <div key={i} className={`grid aspect-square place-items-center rounded-sm text-[9px] font-black sm:text-xs ${active ? 'bg-gold-400 text-black' : isFree ? 'bg-amber-950 text-gold-300 ring-1 ring-gold-700/50' : 'bg-slate-800 text-slate-500'}`}>{isFree ? freeLabel : active ? '●' : ''}</div>;
            })}
          </div>
          <div className="space-y-2">
            <p className="text-sm leading-relaxed text-gold-100">{getPatternDescription(lang, pattern)}</p>
            <p className="text-xs leading-relaxed text-gold-500">{legend}</p>
          </div>
        </div>
      )}
    </section>
  );
}
