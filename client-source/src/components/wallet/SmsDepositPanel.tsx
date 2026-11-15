import { useLanguage } from '@/context/LanguageContext';

const copy = {
  am: {
    title: 'የሲሙሌሽን ቦርሳ',
    notice: 'ይህ የሙከራ ስሪት ብቻ ነው። እውነተኛ ገንዘብ ወደ ማንኛውም የባንክ ወይም የቴሌብር ሂሳብ አትላኩ፤ የእውነተኛ ግብይት ማጣቀሻ ቁጥርም አታስገቡ።',
    detail: 'በዚህ ስሪት የቦርሳ ባላንስ ለሙከራ ብቻ ነው፤ ወደ እውነተኛ ገንዘብ አይቀየርም።',
  },
  ti: {
    title: 'ናይ ሲሙሌሽን ቦርሳ',
    notice: 'እዚ ናይ ፈተነ ስሪት ጥራይ እዩ። ሓቀኛ ገንዘብ ናብ ዝኾነ ባንኪ ወይ ቴሌብር ሒሳብ ኣይትልኣኹ፤ ሓቀኛ ቁጽሪ ግብይት እውን ኣይተእትዉ።',
    detail: 'ኣብዚ ስሪት ሚዛን ቦርሳ ንፈተነ ጥራይ እዩ፤ ናብ ሓቀኛ ገንዘብ ኣይቕየርን።',
  },
  en: {
    title: 'Simulation wallet',
    notice: 'This is a test-only version. Do not send real money to any bank or Telebirr account, and do not enter a real transaction reference.',
    detail: 'Wallet balances in this version are for testing only and cannot be converted to or withdrawn as real money.',
  },
} as const;

export function SmsDepositPanel() {
  const { lang } = useLanguage();
  const t = copy[lang] ?? copy.en;

  return (
    <section className="rounded-2xl border border-gold-700/50 bg-cardbg p-5" aria-labelledby="simulation-wallet-title">
      <h2 id="simulation-wallet-title" className="mb-3 text-lg font-bold text-gold-300">{t.title}</h2>
      <p role="note" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-200">
        {t.notice}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-gold-500">{t.detail}</p>
    </section>
  );
}
