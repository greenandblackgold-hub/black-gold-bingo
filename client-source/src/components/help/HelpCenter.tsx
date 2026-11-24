import { useMemo, useState, type FormEvent } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { findHelpAnswer, helpQuickQuestionIds, helpTopics, type HelpTopic } from '@/lib/helpCenterContent';

const copy = {
  am: {
    eyebrow: 'BLACK GOLD · SMART HELP',
    title: 'Black Gold AI',
    intro: 'ስለ Game Center፣ ጨዋታዎች፣ ህጎች፣ መለያዎ እና የመተግበሪያው አጠቃቀም ይጠይቁኝ።',\n    welcome: 'ወደ Game Center በደህና መጡ!', greeting: 'ሰላም! እኔ Black Gold AI ነኝ።', online: 'የእገዛ ረዳት ዝግጁ ነው', prompt: 'ዛሬ ምን ላግዝዎ?', next: 'ወደ ጨዋታዎች ይግቡ',
    quick: 'ፈጣን ጥያቄዎች',
    placeholder: 'ጥያቄዎን እዚህ ይጻፉ…',
    ask: 'ጠይቅ',
    answer: 'መልስ',
    related: 'ተዛማጅ ጥያቄዎች',
    notFound: 'ይቅርታ፣ ለዚህ ጥያቄ በተቀመጠው መረጃ ውስጥ ግልጽ መልስ አላገኘሁም። የጨዋታውን ስም በመጥቀስ እንደገና ይጠይቁ ወይም በጨዋታው ገጽ ያለውን ደንብ ይመልከቱ።',
    note: 'ይህ የመረጃ ረዳት ነው፤ የግል Wallet፣ ክፍያ ወይም የጨዋታ ውጤት አያረጋግጥም። ሽልማት ወይም የገንዘብ ዋስትና አይሰጥም።',
    topics: 'የሚደግፋቸው ርዕሶች',
    general: 'አጠቃላይ', bingo: 'Bingo', keno: 'Keno', aviator: 'Aviator', mines: 'Mines', safety: 'ደህንነት',
    empty: 'ጥያቄዎን ይጻፉ ወይም ከላይ ካሉት ፈጣን ጥያቄዎች አንዱን ይምረጡ።',
  },
  ti: {
    eyebrow: 'BLACK GOLD · SMART HELP',
    title: 'Black Gold AI',
    intro: 'ብዛዕባ Game Center፣ ጸወታታት፣ ሕግታት፣ መለያኹምን ኣጠቓቕማ መተግበሪን ሕተቱኒ።',\n    welcome: 'ናብ Game Center ብደሓን መጻእኩም!', greeting: 'ሰላም! ኣነ Black Gold AI እየ።', online: 'ረዳኢ ሓበሬታ ድሉው እዩ', prompt: 'ሎሚ ብኸመይ ክሕግዘኩም?', next: 'ናብ ጸወታታት እቶ',
    quick: 'ቅልጡፍ ሕቶታት',
    placeholder: 'ሕቶኹም ኣብዚ ጽሓፉ…',
    ask: 'ሕተት',
    answer: 'መልሲ',
    related: 'ዝተኣሳሰሩ ሕቶታት',
    notFound: 'ይቕሬታ፣ ኣብቲ ዝተዳለወ ሓበሬታ ንዚ ሕቶ ንጹር መልሲ ኣይረኸብኩን። ስም እቲ ጸወታ ጠቒስኩም ደጊምኩም ሕተቱ ወይ ኣብ ገጽ ጸወታ ዘሎ ሕጊ ርኣዩ።',
    note: 'እዚ ረዳኢ ሓበሬታ እዩ፤ ናይ ባዕልኹም Wallet፣ ክፍሊት ወይ ውጽኢት ጸወታ ኣየረጋግጽን። ሽልማት ወይ ውሕስነት ገንዘብ ኣይህብን።',
    topics: 'ዝሕዞም ኣርእስታት',
    general: 'ሓፈሻዊ', bingo: 'Bingo', keno: 'Keno', aviator: 'Aviator', mines: 'Mines', safety: 'ድሕነት',
    empty: 'ሕቶኹም ጽሓፉ ወይ ካብቶም ኣብ ላዕሊ ዘለዉ ቅልጡፍ ሕቶታት ሓደ ምረጹ።',
  },
  en: {
    eyebrow: 'BLACK GOLD · SMART HELP',
    title: 'Black Gold AI',
    intro: 'Ask me about the Game Center, games, rules, your account, and how to use the app.',\n    welcome: 'Welcome to the Game Center!', greeting: 'Hello! I’m Black Gold AI.', online: 'Help assistant is ready', prompt: 'How can I help you today?', next: 'Enter the Games',
    quick: 'Quick questions',
    placeholder: 'Type your question here…',
    ask: 'Ask',
    answer: 'Answer',
    related: 'Related questions',
    notFound: 'Sorry, I could not find a clear answer in the available help content. Try including the game name, or check the rules shown on that game page.',
    note: 'This is an information assistant. It cannot check your personal wallet, payments, or game results, and it does not promise prizes or financial outcomes.',
    topics: 'Topics covered',
    general: 'General', bingo: 'Bingo', keno: 'Keno', aviator: 'Aviator', mines: 'Mines', safety: 'Safety',
    empty: 'Type a question or choose one of the quick questions above.',
  },
} as const;

export function HelpCenter({ onEnterGames }: { onEnterGames: () => void }) {
  const { lang } = useLanguage();
  const t = copy[lang];
  const [question, setQuestion] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [activeTopic, setActiveTopic] = useState<HelpTopic | null>(null);

  const matches = useMemo(() => submitted ? findHelpAnswer(question, lang) : [], [submitted, question, lang]);
  const selected = activeTopic ?? matches[0] ?? null;
  const quickTopics = helpQuickQuestionIds
    .map((id) => helpTopics.find((topic) => topic.id === id))
    .filter((topic): topic is HelpTopic => Boolean(topic));

  const askQuestion = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!question.trim()) return;
    setActiveTopic(null);
    setSubmitted(true);
  };

  const chooseTopic = (topic: HelpTopic) => {
    setQuestion(topic.question[lang]);
    setActiveTopic(topic);
    setSubmitted(true);
  };

  return (
    <main className="relative min-h-[100dvh] w-full overflow-hidden bg-[radial-gradient(ellipse_at_50%_0%,rgba(202,158,57,.13),transparent_48%),#070707] px-4 pb-28 pt-5 sm:px-6 sm:pt-8">\n      <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-amber-400/30 bg-[radial-gradient(ellipse_at_top_right,rgba(202,158,57,.2),transparent_45%),linear-gradient(125deg,#211a0b,#090909_60%,#171106)] px-5 py-8 shadow-[0_20px_60px_rgba(0,0,0,.4)] sm:px-8 sm:py-10">
        <div aria-hidden="true" className="absolute -right-12 -top-14 h-56 w-56 rounded-full border border-amber-300/10" />
        <div className="relative mb-5 flex items-center gap-4">\n          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-amber-300/55 bg-gradient-to-br from-amber-200 via-yellow-500 to-amber-800 shadow-[0_10px_35px_rgba(212,175,55,.22)]">\n            <svg viewBox="0 0 48 48" className="h-10 w-10" fill="none" aria-hidden="true"><path d="M24 4.5 28.7 17l12.8 4.8-12.8 4.7L24 39l-4.8-12.5L6.5 21.8 19.2 17 24 4.5Z" stroke="#171208" strokeWidth="2.4" strokeLinejoin="round"/><path d="m35.5 31.5 2 5.2 5 1.8-5 1.9-2 5.1-1.9-5.1-5.1-1.9 5.1-1.8 1.9-5.2Z" fill="#171208"/></svg>\n          </div>\n          <div><p className="text-[10px] font-black uppercase tracking-[.28em] text-amber-400">{t.eyebrow}</p><p className="mt-1 text-xs font-semibold text-emerald-300">● {t.online}</p></div>\n        </div>\n        <p className="text-sm font-bold tracking-wide text-amber-200/75">{t.welcome}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-amber-50 sm:text-5xl">{t.title}</h1>\n        <h2 className="mt-3 text-lg font-bold text-amber-100 sm:text-xl">{t.greeting}</h2>\n        <p className="mt-2 text-sm font-semibold text-amber-300">{t.prompt}</p>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-amber-100/70 sm:text-base">{t.intro}</p>
      </header>

      <section className="rounded-2xl border border-amber-400/20 bg-[#0c0c0a] p-4 sm:p-6">
        <form onSubmit={askQuestion} className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="black-gold-ai-question" className="sr-only">{t.placeholder}</label>
          <input
            id="black-gold-ai-question"
            value={question}
            onChange={(event) => { setQuestion(event.target.value); setSubmitted(false); setActiveTopic(null); }}
            placeholder={t.placeholder}
            className="min-h-12 min-w-0 flex-1 rounded-xl border border-amber-300/20 bg-black px-4 py-3 text-sm text-amber-50 outline-none placeholder:text-amber-100/35 focus:border-amber-300/60 focus:ring-2 focus:ring-amber-300/10"
          />
          <button type="submit" disabled={!question.trim()} className="min-h-12 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-600 px-6 py-3 text-sm font-black text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">{t.ask}</button>
        </form>
        <div className="mt-5">
          <h2 className="mb-3 text-xs font-black uppercase tracking-[.2em] text-amber-400">{t.quick}</h2>
          <div className="flex flex-wrap gap-2">
            {quickTopics.map((topic) => (
              <button key={topic.id} type="button" onClick={() => chooseTopic(topic)} className="rounded-full border border-amber-300/25 bg-amber-300/5 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:border-amber-300/60 hover:bg-amber-300/10">
                {topic.question[lang]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section aria-live="polite" className="rounded-2xl border border-amber-400/20 bg-[#0b0b09] p-5 sm:p-6">
        <h2 className="text-xs font-black uppercase tracking-[.2em] text-amber-400">{t.answer}</h2>
        {!submitted && <p className="mt-3 text-sm leading-7 text-amber-100/65">{t.empty}</p>}
        {submitted && !selected && <p className="mt-3 text-sm leading-7 text-amber-100/75">{t.notFound}</p>}
        {selected && (
          <div className="mt-3">
            <h3 className="text-lg font-bold leading-7 text-amber-50">{selected.question[lang]}</h3>
            <p className="mt-3 whitespace-pre-line text-sm leading-8 text-amber-100/75">{selected.answer[lang]}</p>
            {matches.length > 1 && (
              <div className="mt-6 border-t border-amber-300/15 pt-4">
                <h4 className="mb-3 text-xs font-bold text-amber-400">{t.related}</h4>
                <div className="flex flex-wrap gap-2">
                  {matches.filter((topic) => topic.id !== selected.id).map((topic) => (
                    <button key={topic.id} type="button" onClick={() => chooseTopic(topic)} className="rounded-lg border border-amber-300/20 px-3 py-2 text-left text-xs text-amber-100/80 hover:bg-amber-300/10">{topic.question[lang]}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-amber-400/15 bg-black/40 p-4 sm:p-5">
        <h2 className="mb-3 text-xs font-black uppercase tracking-[.2em] text-amber-400">{t.topics}</h2>
        <div className="flex flex-wrap gap-2">
          {(['general', 'bingo', 'keno', 'aviator', 'mines', 'safety'] as const).map((category) => (
            <span key={category} className="rounded-full border border-amber-300/15 bg-amber-300/5 px-3 py-1.5 text-[11px] font-semibold text-amber-100/70">{t[category]}</span>
          ))}
        </div>
      </section>

      <p className="rounded-xl border border-amber-300/15 bg-amber-300/[.04] p-4 text-xs leading-6 text-amber-100/55">{t.note}</p>
      </div>\n      <button type="button" onClick={onEnterGames} className="fixed bottom-5 right-4 z-50 inline-flex min-h-14 items-center gap-3 rounded-full border border-amber-200/70 bg-gradient-to-r from-amber-300 via-yellow-500 to-amber-600 px-5 py-3 text-sm font-black text-[#171208] shadow-[0_12px_36px_rgba(212,175,55,.28)] transition hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-100 sm:bottom-7 sm:right-7 sm:px-7">\n        <span>{t.next}</span><span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-black/10 text-xl">→</span>\n      </button>\n    </main>
  );
}
