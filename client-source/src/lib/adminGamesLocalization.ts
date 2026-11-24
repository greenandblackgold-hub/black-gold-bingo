import type { Lang } from '@/types/game';

const games = {
  am: {
    management:'የጨዋታ አስተዳደር', controls:'የጨዋታ ማዕከል ቁጥጥሮች', simulation:'የሙከራ ሁነታ ብቻ',
    maxPayout:'በእያንዳንዱ Keno ቲኬት / Aviator ውርርድ ከፍተኛ ክፍያ', enforced:'በሰርቨሩ በኩል ይተገበራል።',
    commission:'የኩባንያ ኮሚሽን', playerPool:'የተጫዋቾች ገንዘብ ገንዳ', poolNote:'Keno እና Aviator ክፍያዎች ከዙሩ ገንዘብ ገንዳ ብቻ ይከፈላሉ። Cash Out ብዜቶች ወዲያውኑ ይመዘገባሉ፤ Aviator ክፍያ ዙሩ ከተቋረጠ በኋላ ይገባል።',
    poolCap:'የዙር ገንዳ ገደብ በሰርቨሩ በኩል ተነቅቷል፤ ጠቅላላ ሽልማቶች ከተሰበሰበው ውርርድ የተጫዋቾች ድርሻ 40%–50% አይበልጡም።',
    announcement:'የአስተዳዳሪ ማስታወቂያ', announcementHelp:'የጥገና፣ የዝማኔ ወይም የደህንነት ማስታወቂያ እዚህ ይጻፉ። አስተናጋጁ ማሳያውን ሲያበራ ተጫዋቾች ያዩታል።',
    announcementPlaceholder:'የታቀደ ጥገና ስለሚኖር የጨዋታ ማዕከሉ ለጊዜው አይገኝም።', saveAnnouncement:'ማስታወቂያ አስቀምጥ',
    hostControls:'የአስተናጋጅ ቁጥጥሮች · በተጫዋች ጨዋታ ማዕከል የሚታዩ ጨዋታዎች',
    general:'አጠቃላይ የጨዋታ ማዕከል', allOn:'ሁሉም የጨዋታ ማዕከል አገልግሎቶች በርተዋል', allOff:'ሁሉም የተጫዋች ጨዋታ ገጾች ጠፍተዋል',
    confirmOff:'እርግጠኛ ነዎት መላውን የጨዋታ ማዕከል መዝጋት ይፈልጋሉ?', generalOff:'አጠቃላይ አጥፋ', generalOn:'አጠቃላይ አብራ',
    showAnnouncement:'ማስታወቂያውን ለተጫዋቾች አሳይ', visibleOff:'አጠቃላይ ሲጠፋ ይታያል', hidden:'ከተጫዋቾች ተደብቋል', hideMessage:'መልዕክቱን ደብቅ', showMessage:'መልዕክቱን አሳይ',
    visible:'ለተጫዋቾች ይታያል', hiddenPlayers:'ከተጫዋቾች ተደብቋል', turnOff:'አጥፋ', turnOn:'አብራ', loading:'በመጫን ላይ',
    minBet:'ዝቅተኛ ውርርድ (ETB)', maxBet:'ከፍተኛ ውርርድ (ETB)', houseEdge:'የኩባንያ ኮሚሽን / House Edge (%)',
    kenoDuration:'የKeno ዙር / የውርርድ ቆይታ', seconds:'ሰከንዶች', minutes:'ደቂቃ', nextKeno:'ከሚቀጥለው የKeno ዙር ጀምሮ ይተገበራል።',
    aviatorWindow:'የAviator ውርርድ ጊዜ (ሰከንዶች)', saving:'በማስቀመጥ ላይ…', saveSettings:'የጨዋታ ቅንብሮችን አስቀምጥ',
    footer:'የጨዋታ መገኘት፣ የውርርድ ገደቦች፣ የዙር ጊዜዎችና የገንዘብ ገንዳ ኮሚሽን (50%–60%)። የክፍያ ስሌት በዙር የተሰበሰበው ውርርድ ይገደባል፤ የዕጣና የድራው ፍትሃዊነት ስልቶች አይቀየሩም።',
    loadError:'የጨዋታ ቅንብሮችን ማምጣት አልተቻለም።', saved:'የጨዋታ ማዕከል ቅንብሮች ተቀምጠዋል።', saveError:'ቅንብሮቹን ማስቀመጥ አልተቻለም።',
    allUnavailable:'በአሁኑ ጊዜ ሁሉም ጨዋታዎች አይገኙም። እባክዎ ቆይተው ይመልከቱ።',
  },
  ti: {
    management:'ምሕደራ ጸወታ', controls:'ቁጽጽር ማእከል ጸወታ', simulation:'ናይ ፈተነ ሞድ ጥራይ',
    maxPayout:'ዝለዓለ ክፍሊት ንነፍሲ ወከፍ Keno ቲኬት / Aviator ውርርድ', enforced:'ብሰርቨር ይትግበር።',
    commission:'ኮሚሽን ኩባንያ', playerPool:'ገንዘብ ገንዳ ተጻወትቲ', poolNote:'ክፍሊት Kenoን Aviatorን ካብ ገንዳ ዙር ጥራይ ይኽፈል። ብዜት Cash Out ብቕጽበት ይምዝገብ፤ ክፍሊት Aviator ዙር ምስ ተቛረጸ ይኣቱ።',
    poolCap:'ገደብ ገንዳ ዙር ብሰርቨር ይትግበር፤ ድምር ሽልማት ካብ 40%–50% ድርሻ ተጻወትቲ ናይ ዝተኣከበ ውርርድ ኣይሓልፍን።',
    announcement:'መልእኽቲ ኣመሓዳሪ', announcementHelp:'ናይ ጽገና፣ ሓድሽ ስራሕ ወይ ድሕነት ሓበሬታ ኣብዚ ጽሓፉ። ኣስተናጋዲ ምርኣይ ምስ ኣብርሀ ተጻወትቲ ክርእይዎ እዮም።',
    announcementPlaceholder:'ብምኽንያት ዝተመደበ ጽገና ማእከል ጸወታ ንግዚኡ ኣይርከብን።', saveAnnouncement:'መልእኽቲ ኣቐምጥ',
    hostControls:'ቁጽጽር ኣስተናጋዲ · ኣብ ማእከል ጸወታ ተጻወትቲ ዝርአ ጸወታታት',
    general:'ሓፈሻዊ ማእከል ጸወታ', allOn:'ኩሎም ኣገልግሎታት ማእከል ጸወታ ኣብሪሆም', allOff:'ኩሎም ገጻት ጸወታ ተጻወትቲ ጠፊኦም',
    confirmOff:'ርግጸኛ ዲኹም ምሉእ ማእከል ጸወታ ክትዓጽዉ ትደልዩ?', generalOff:'ሓፈሻዊ ኣጥፍእ', generalOn:'ሓፈሻዊ ኣብርህ',
    showAnnouncement:'መልእኽቲ ንተጻወትቲ ኣርኢ', visibleOff:'ሓፈሻዊ ምስ ጠፍአ ይርአ', hidden:'ካብ ተጻወትቲ ተሓቢኡ', hideMessage:'መልእኽቲ ሕባእ', showMessage:'መልእኽቲ ኣርኢ',
    visible:'ንተጻወትቲ ይርአ', hiddenPlayers:'ካብ ተጻወትቲ ተሓቢኡ', turnOff:'ኣጥፍእ', turnOn:'ኣብርህ', loading:'ይጽዓን ኣሎ',
    minBet:'ዝተሓተ ውርርድ (ETB)', maxBet:'ዝለዓለ ውርርድ (ETB)', houseEdge:'ኮሚሽን ኩባንያ / House Edge (%)',
    kenoDuration:'ዙር Keno / ግዜ ውርርድ', seconds:'ካልኢታት', minutes:'ደቓይቕ', nextKeno:'ካብ ዝቕጽል ዙር Keno ጀሚሩ ይትግበር።',
    aviatorWindow:'ግዜ ውርርድ Aviator (ካልኢታት)', saving:'ይቕመጥ ኣሎ…', saveSettings:'ቅንብራት ጸወታ ኣቐምጥ',
    footer:'ምርካብ ጸወታ፣ ገደብ ውርርድ፣ ግዜ ዙርን ኮሚሽን ገንዳን (50%–60%)። ክፍሊት ብዝተኣከበ ውርርድ ዙር ይገደብ፤ ስልቲ ፍትሓዊነት ዕጫን ድራውን ኣይቅየርን።',
    loadError:'ቅንብራት ጸወታ ምምጻእ ኣይተኻእለን።', saved:'ቅንብራት ማእከል ጸወታ ተቐሚጦም።', saveError:'ቅንብራት ምቕማጥ ኣይተኻእለን።',
    allUnavailable:'ኣብዚ ሕጂ ኩሎም ጸወታታት ኣይርከቡን። በጃኹም ድሕሪ ግዜ ፈትሹ።', statusBetting:'ውርርድ ክፉት እዩ', statusSettled:'ዙር ተወዲኡ', statusCrashed:'ዙር ተቛሪጹ', betsLabel:'ውርርድ',
  },
  en: {
    management:'Games management', controls:'Games Center Controls', simulation:'SIMULATION ONLY',
    maxPayout:'Maximum payout per Keno ticket / Aviator bet', enforced:'Enforced server-side.',
    commission:'Company commission', playerPool:'player pool', poolNote:'Keno and Aviator pay from the round pool only. Cash Out multipliers are recorded immediately; Aviator wallet credits settle after the crash.',
    poolCap:'Round-level pool cap is enforced server-side; total prizes cannot exceed the configured 40%–50% player share of collected stakes.',
    announcement:'Admin announcement message', announcementHelp:'Write the maintenance, update or security notice here. Players see it only when Host turns announcement display ON.',
    announcementPlaceholder:'Games Center is temporarily unavailable for scheduled maintenance.', saveAnnouncement:'Save announcement',
    hostControls:'Host controls · Games shown in Player Game Center',
    general:'General Games Center', allOn:'All Games Center services ON', allOff:'All player game pages OFF',
    confirmOff:'Are you sure you want to turn off the entire Games Center?', generalOff:'GENERAL OFF', generalOn:'GENERAL ON',
    showAnnouncement:'Show announcement to Players', visibleOff:'Visible when General is OFF', hidden:'Hidden from players', hideMessage:'HIDE MESSAGE', showMessage:'SHOW MESSAGE',
    visible:'Visible to players', hiddenPlayers:'Hidden from players', turnOff:'Turn OFF', turnOn:'Turn ON', loading:'Loading',
    minBet:'Minimum bet (ETB)', maxBet:'Maximum bet (ETB)', houseEdge:'Company commission / House Edge (%)',
    kenoDuration:'Keno round / betting duration', seconds:'Seconds', minutes:'Minutes', nextKeno:'Applies to the next Keno round.',
    aviatorWindow:'Aviator betting window (seconds)', saving:'Saving…', saveSettings:'Save game settings',
    footer:'Game availability, bet limits, round timers and pool commission (50%–60%). Payout settlement is capped by each round’s collected stakes; draw and crash fairness algorithms remain unchanged.',
    loadError:'Could not load game settings.', saved:'Games Center settings saved.', saveError:'Settings could not be saved.',
    allUnavailable:'All games are currently unavailable. Please check again later.', statusBetting:'Betting open', statusSettled:'Round settled', statusCrashed:'Round crashed', betsLabel:'bets',
  },
} satisfies Record<Lang, Record<string, string>>;

export const adminGamesText = games;
export function adminGamesLocale(lang: Lang, key: keyof typeof games.en): string {
  const selected = games[lang] as Record<string, string>;
  return selected[key] ?? games.en[key];
}
