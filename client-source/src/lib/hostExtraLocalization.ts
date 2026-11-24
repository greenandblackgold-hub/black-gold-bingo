import type { Lang } from '@/types/game';

const copy = {
  am: {
    announcementLabel:'ለተጫዋቾች ቀጥታ ማስታወቂያ', announcementPlaceholder:'ማስታወቂያዎን እዚህ ይጻፉ…', clear:'ማጥፋት', send:'ማስታወቂያ ላክ', playerDisplay:'በተጫዋች ገጽ ላይ የሚታየው፦',
    winningPattern:'የዙሩ የBingo አሸናፊነት ቅጥ', prizeSchedule:'የሽልማት እና የቀጣይ ዙር ቅንብር',
    prizeMode:'የሽልማት ስሌት', revenuePercent:'ከጠቅላላ ገቢ መቶኛ', perPlayer:'ለእያንዳንዱ ተጫዋች', fixedPrize:'ቋሚ ሽልማት (ብር)',
    interval:'የዙር መጠበቂያ ጊዜ', minutes4:'4 ደቂቃ', minutes5:'5 ደቂቃ', minutes10:'10 ደቂቃ',
    grossPercent:'ከጠቅላላ ገቢ መቶኛ (%)', perPlayerAmount:'ለእያንዳንዱ ተጫዋች (ብር)', fixedAmount:'ቋሚ የሽልማት መጠን (ብር)',
    maxCap:'ከፍተኛ የሽልማት ገደብ (ብር፤ 0 = ጠቅላላ ገቢ)', save:'ቅንብሩን አስቀምጥ',
    locked:'ዙር በሂደት ላይ ሳለ የሽልማት ቅንብር አይቀየርም። ቀጣዩ ዙር ሲጠብቅ ይቀይሩት።',
    fixedNote:'ቋሚው መጠን ዙሩ ሲጀምር ይቆለፋል፤ ከጠቅላላ ገቢና ከከፍተኛ ገደቡ በላይ አይከፈልም።',
    grossLabel:'ጠቅላላ ገቢ', uniquePlayers:'ልዩ ተጫዋቾች', calculatedPrize:'አሁን የተሰላ ሽልማት'
  },
  ti: {
    announcementLabel:'ቀጥታዊ ሓበሬታ ንተጻወትቲ', announcementPlaceholder:'ሓበሬታኹም ኣብዚ ጽሓፉ…', clear:'ኣጥፍእ', send:'ሓበሬታ ስደድ', playerDisplay:'ኣብ ገጽ ተጻዋታይ ዝርአ፦',
    winningPattern:'ናይ ዙር Bingo ዓወት ቅርጺ', prizeSchedule:'ቅንብር ሽልማትን ዝቕጽል ዙርን',
    prizeMode:'ስሌት ሽልማት', revenuePercent:'ሚእታዊ ጠቕላላ ኣታዊ', perPlayer:'ንነፍሲ ወከፍ ተጻዋታይ', fixedPrize:'ቀዋሚ ሽልማት (ብር)',
    interval:'ግዜ ምጽባይ ዙር', minutes4:'4 ደቓይቕ', minutes5:'5 ደቓይቕ', minutes10:'10 ደቓይቕ',
    grossPercent:'ሚእታዊ ጠቕላላ ኣታዊ (%)', perPlayerAmount:'ንነፍሲ ወከፍ ተጻዋታይ (ብር)', fixedAmount:'መጠን ቀዋሚ ሽልማት (ብር)',
    maxCap:'ዝለዓለ ደረት ሽልማት (ብር፤ 0 = ጠቕላላ ኣታዊ)', save:'ቅንብር ኣቐምጥ',
    locked:'ዙር ኣብ ስራሕ ከሎ ቅንብር ሽልማት ኣይቅየርን። ዝቕጽል ዙር ክጽበ ከሎ ቀይርዎ።',
    fixedNote:'ቀዋሚ መጠን ዙር ምስ ጀመረ ይዕጾ፤ ካብ ጠቕላላ ኣታዊን ዝለዓለ ደረትን ኣይሓልፍን።',
    grossLabel:'ጠቕላላ ኣታዊ', uniquePlayers:'ፍሉያት ተጻወትቲ', calculatedPrize:'ሕጂ ዝተሰልሐ ሽልማት'
  },
  en: {
    announcementLabel:'Live announcement to players', announcementPlaceholder:'Write your announcement here…', clear:'Clear', send:'Send announcement', playerDisplay:'Shown on the Player page:',
    winningPattern:'Bingo winning pattern for the round', prizeSchedule:'Prize and next-round schedule',
    prizeMode:'Prize calculation', revenuePercent:'Gross revenue percentage', perPlayer:'Per player', fixedPrize:'Fixed prize (ETB)',
    interval:'Next-round waiting time', minutes4:'4 minutes', minutes5:'5 minutes', minutes10:'10 minutes',
    grossPercent:'Gross revenue percentage (%)', perPlayerAmount:'Per player (ETB)', fixedAmount:'Fixed prize amount (ETB)',
    maxCap:'Maximum prize cap (ETB; 0 = gross revenue)', save:'Save settings',
    locked:'Prize settings cannot be changed while a round is running. Change them while the next round is waiting.',
    fixedNote:'The fixed amount is locked when the round starts; it cannot exceed gross revenue or the maximum cap.',
    grossLabel:'Gross revenue', uniquePlayers:'Unique players', calculatedPrize:'Current calculated prize'
  }
} satisfies Record<Lang, Record<string, string>>;

export function hostExtraLocale(lang: Lang, key: keyof typeof copy.en): string {
  return copy[lang][key] ?? copy.en[key];
}
