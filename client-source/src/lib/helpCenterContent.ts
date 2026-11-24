import type { Lang } from '@/types/game';

export type HelpTopic = {
  id: string;
  category: 'general' | 'bingo' | 'keno' | 'aviator' | 'mines' | 'safety';
  question: Record<Lang, string>;
  answer: Record<Lang, string>;
  keywords: Record<Lang, string[]>;
};

export const helpTopics: HelpTopic[] = [
  {
    id: 'how-center-works', category: 'general',
    question: { am: 'Black Gold Game Center እንዴት ይሠራል?', ti: 'Black Gold Game Center ብኸመይ ይሰርሕ?', en: 'How does the Black Gold Game Center work?' },
    answer: {
      am: 'Black Gold የተለያዩ ጨዋታዎችን በአንድ ቦታ ያቀርባል። ከGames Center የሚፈልጉትን ጨዋታ ይምረጡ። የጨዋታውን መመሪያ ያንብቡ፣ በስክሪኑ ላይ የሚታዩትን ደረጃዎች ይከተሉ። የሚታዩ አማራጮችና ባህሪያት እንደ ጨዋታው እና እንደ ሁነታው ሊለያዩ ይችላሉ።',
      ti: 'Black Gold ዝተፈላለዩ ጸወታታት ኣብ ሓደ ቦታ የቕርብ። ካብ Games Center እቲ እትደልይዎ ጸወታ ምረጹ። መምርሒ እቲ ጸወታ ኣንብቡ፣ ኣብ ስክሪን ዝርአ ደረጃታት ተኸተሉ። ዝርከቡ ኣማራጺታት ከከም ጸወታን ሞድን ክፈላለዩ ይኽእሉ።',
      en: 'Black Gold brings several games together in one place. Choose a game from the Games Center, read its on-screen instructions, and follow the steps shown. Available options can differ by game and mode.'
    },
    keywords: { am: ['ጌም ሴንተር','አጠቃቀም','እንዴት ይሠራል','መተግበሪያ'], ti: ['game center','ኣጠቓቕማ','ብኸመይ','መተግበሪ'], en: ['game center','how it works','app','use the app'] }
  },
  {
    id: 'demo-vs-real', category: 'general',
    question: { am: 'Demo እና Real ሁነታ ልዩነታቸው ምንድን ነው?', ti: 'Demoን Realን ሞድ እንታይ ፍልልይ ኣለዎም?', en: 'What is the difference between Demo and Real mode?' },
    answer: {
      am: 'Demo ማለት ለሙከራ የሚጠቀሙበት ሁነታ ነው፤ የሙከራ ክሬዲት እውነተኛ ገንዘብ አይደለም እና ወደ ውጭ ማውጣት አይቻልም። Real ወይም የቀጥታ ሁነታ ካለ፣ በገጹ ላይ የሚታየውን ማስታወቂያና ደንብ በጥንቃቄ ያንብቡ። በዚህ መረጃ ማዕከል የሁነታዎን ሁኔታ ወይም ቀሪ ሂሳብ ማረጋገጥ አይቻልም።',
      ti: 'Demo ማለት ንፈተነ ዝጥቀሙሉ ሞድ እዩ፤ ናይ ፈተነ ክረዲት ሓቀኛ ገንዘብ ኣይኮነን፣ ክወጽእ እውን ኣይክእልን። Real ወይ ቀጥታዊ ሞድ እንተሃልዩ፣ ኣብቲ ገጽ ዘሎ ሓበሬታን ሕግታትን ብጥንቃቐ ኣንብቡ። እዚ ማእከል ሓበሬታ ኩነታት ሞድኩም ወይ ሒሳብኩም ኣየረጋግጽን።',
      en: 'Demo mode is for practice. Demo credits are not real money and cannot be withdrawn. If a live or real-money mode is offered, read the notices and rules shown on that game page carefully. This help center cannot check your mode or account balance.'
    },
    keywords: { am: ['demo','real','ሙከራ','እውነተኛ ገንዘብ','ክሬዲት'], ti: ['demo','real','ፈተነ','ሓቀኛ ገንዘብ','ክረዲት'], en: ['demo','real mode','practice','credits','real money'] }
  },
  {
    id: 'bingo-how', category: 'bingo',
    question: { am: 'Bingo እንዴት እጫወታለሁ?', ti: 'Bingo ብኸመይ እጻወት?', en: 'How do I play Bingo?' },
    answer: {
      am: 'Bingo ካርድዎን ይክፈቱ። በጨዋታው የሚጠሩትን ቁጥሮች ይከታተሉና በካርድዎ ላይ ያሉትን የተጠሩ ቁጥሮች ምልክት ያድርጉ። የመካከለኛው FREE ሳጥን በራሱ እንደተሞላ ይቆጠራል። በዚያ ዙር የሚሰራው የአሸናፊነት ቅርጽ ሆስቱ የመረጠው ነው። ቅርጹን ሲያሟሉ “BINGO” ይጫኑ፤ ስርዓቱ ያረጋግጣል።',
      ti: 'ካርድ Bingoኹም ክፈቱ። እቶም ኣብ ጸወታ ዝጽውዑ ቁጽሪታት ተኸታተሉ፣ ኣብ ካርድኹም ዘለዉ ዝተጸውዑ ቁጽሪታት ምልክት ግበሩ። እቲ ኣብ ማእከል ዘሎ FREE ሳጹን ብኣውቶማቲክ ከም ዝተመልአ ይቑጸር። ኣብቲ ዙር ዝሰርሕ ቅርጺ ዓወት እቲ ሆስት ዝመረጾ እዩ። እቲ ቅርጺ ምስ ኣማላእኩም “BINGO” ጠውቑ፤ ስርዓቱ ክምርምሮ እዩ።',
      en: 'Open your Bingo card and follow the numbers called during the round. Mark called numbers that appear on your card. The center FREE square counts as complete automatically. Only the winning pattern selected by the Host is active for that round. When you complete it, press “BINGO” so the system can verify your claim.'
    },
    keywords: { am: ['bingo','ቢንጎ','ካርድ','ቁጥር','አሸናፊ','ሆስት'], ti: ['bingo','ቢንጎ','ካርድ','ቁጽሪ','ዓወት','ሆስት'], en: ['bingo','card','called numbers','winning pattern','host','claim'] }
  },
  {
    id: 'bingo-pattern', category: 'bingo',
    question: { am: 'በBingo የማሸነፍ ቅርጽ ምንድን ነው?', ti: 'ኣብ Bingo ቅርጺ ዓወት እንታይ እዩ?', en: 'What is the Bingo winning pattern?' },
    answer: {
      am: 'የማሸነፍ ቅርጽ በካርድ ላይ ምልክት ማድረግ ያለብዎትን ሳጥኖች ያሳያል፤ ለምሳሌ መስመር፣ X ወይም ሌላ ቅርጽ። ሁሉም የሚታዩ ምሳሌዎች በአንድ ዙር አይሰሩም። በዚያ ዙር የሚሰራውን ቅርጽ በጨዋታው ላይ ያለውን “Winning Pattern” መረጃ ይመልከቱ።',
      ti: 'ቅርጺ ዓወት ኣብ ካርድ ኣየኖት ሳጹናት ምልክት ክትገብሩ ከም ዘለኩም የርኢ፤ ንኣብነት መስመር፣ X ወይ ካልእ ቅርጺ። ኩሎም ዝርኣዩ ኣብነታት ኣብ ሓደ ዙር ኣይሰርሑን። ኣብቲ ዙር ዝሰርሕ ቅርጺ ኣብ “Winning Pattern” ሓበሬታ እቲ ጸወታ ርኣዩ።',
      en: 'A winning pattern shows which squares on your card must be marked, such as a line, X, or another shape. Not every example pattern is active in every round. Check the “Winning Pattern” shown in the game for the pattern selected for the current round.'
    },
    keywords: { am: ['winning pattern','ቅርጽ','ማሸነፍ','x','መስመር'], ti: ['winning pattern','ቅርጺ','ዓወት','መስመር'], en: ['winning pattern','pattern','line','x pattern'] }
  },
  {
    id: 'keno-how', category: 'keno',
    question: { am: 'Keno እንዴት ይጫወታል?', ti: 'Keno ብኸመይ ይጽወት?', en: 'How do I play Keno?' },
    answer: {
      am: 'Keno ላይ ከ1 እስከ 80 ያሉ ቁጥሮች ውስጥ እስከ 10 ቁጥሮችን ይምረጡ። በዙሩ 20 ቁጥሮች ይወጣሉ። የመረጡት ቁጥሮች ከወጡት ጋር ስንት እንደተዛመዱ ውጤቱን ይወስናል። የሽልማት ስሌቱ በጨዋታው የሚታየው የክፍያ ሰንጠረዥ (Payout Table) ላይ ይመሰረታል፤ ሽልማት ዋስትና የለውም።',
      ti: 'ኣብ Keno ካብ 1 ክሳብ 80 ዘለዉ ቁጽሪታት ክሳብ 10 ምረጹ። ኣብ ዙር 20 ቁጽሪታት ይወጽኡ። ካብቶም ዝመረጽኩሞ ምስ ዝወጹ ዝተሰማምዑ ቁጽሪታት ውጽኢት ይውስኑ። ሽልማት ብኣብ ጸወታ ዝርአ ሰሌዳ ክፍሊት (Payout Table) ይሕሰብ፤ ሽልማት ውሕስነት የብሉን።',
      en: 'In Keno, choose up to 10 numbers from 1 to 80. The game draws 20 numbers in a round. Your result depends on how many of your picks match the drawn numbers. Any payout is determined by the Payout Table shown in the game; a prize is never guaranteed.'
    },
    keywords: { am: ['keno','ኪኖ','ቁጥር','80','20','ሽልማት','payout'], ti: ['keno','ቁጽሪ','80','20','ሽልማት','payout'], en: ['keno','numbers','80','20','draw','payout table','prize'] }
  },
  {
    id: 'aviator-how', category: 'aviator',
    question: { am: 'Aviator እንዴት ይጫወታል?', ti: 'Aviator ብኸመይ ይጽወት?', en: 'How do I play Aviator?' },
    answer: {
      am: 'ዙሩ ከመጀመሩ በፊት የሚፈቀደውን ውርርድ ያስገቡ። አውሮፕላኑ ሲበር ብዜቱ (Multiplier) ይጨምራል። ዙሩ ከመቋረጡ (Crash) በፊት Cash Out ካደረጉ በዚያ ጊዜ በሚታየው ብዜት መሠረት ውጤት ይሰላል። Crash ከሆነ በፊት Cash Out ካላደረጉ ውርርዱ ሊጠፋ ይችላል። ጊዜውን መተንበይ አይቻልም።',
      ti: 'ዙር ቅድሚ ምጅማሩ እቲ ዝፍቀድ ውርርድ ኣእትዉ። ነፋሪት ክትነፍር ከላ ብዜት (Multiplier) ይውስኽ። ዙር ቅድሚ ምቁራጹ (Crash) Cash Out እንተገይርኩም፣ ውጽኢት በቲ እዋን ዝርአ ብዜት ይሕሰብ። Crash ቅድሚ ምዃኑ Cash Out እንተዘይገይርኩም ውርርድኩም ክጠፍእ ይኽእል። መዓስ ከም ዝቋረጽ ምግማት ኣይከኣልን።',
      en: 'Place an allowed stake before the round starts. As the plane flies, the multiplier rises. If you Cash Out before the round crashes, the result is calculated using the multiplier shown at that moment. If the crash happens before you cash out, the stake can be lost. The crash point cannot be predicted.'
    },
    keywords: { am: ['aviator','አቪየተር','አውሮፕላን','cash out','ካሽ አውት','multiplier','ብዜት','crash'], ti: ['aviator','ነፋሪት','cash out','multiplier','ብዜት','crash'], en: ['aviator','plane','cash out','multiplier','crash'] }
  },
  {
    id: 'cash-out', category: 'aviator',
    question: { am: 'Cash Out ምንድን ነው?', ti: 'Cash Out እንታይ እዩ?', en: 'What does Cash Out mean?' },
    answer: {
      am: 'Cash Out ማለት የAviator ዙር ከመቋረጡ በፊት ያለዎትን ውርርድ በአሁኑ ብዜት ላይ ማጠናቀቅ ነው። ቁልፉ በበረራ ላይ ሳለ ብቻ ይሰራል። ከCrash በኋላ ማውጣት አይቻልም። የተመዘገበውን ውጤት በጨዋታው ማሳያ ያረጋግጡ።',
      ti: 'Cash Out ማለት ዙር Aviator ቅድሚ ምቁራጹ ውርርድኩም በእቲ እዋን ዘሎ ብዜት ምዝዛም እዩ። እቲ ቁልፊ ነፋሪት ኣብ በረራ ከላ ጥራይ ይሰርሕ። ድሕሪ Crash ምውጻእ ኣይከኣልን። እቲ ዝተመዝገበ ውጽኢት ኣብ ገጽ ጸወታ ኣረጋግጹ።',
      en: 'Cash Out means ending your Aviator bet at the multiplier currently shown, before the round crashes. The button is available only while the plane is flying. You cannot cash out after a crash. Check the game display for the recorded result.'
    },
    keywords: { am: ['cash out','ካሽ አውት','ገንዘብ ማውጣት','መቼ ማውጣት'], ti: ['cash out','ገንዘብ ምውጻእ','ምውጻእ'], en: ['cash out','cashout','withdraw','end bet'] }
  },
  {
    id: 'mines-how', category: 'mines',
    question: { am: 'Mines እንዴት ይጫወታል?', ti: 'Mines ብኸመይ ይጽወት?', en: 'How do I play Mines?' },
    answer: {
      am: 'Mines በ5×5 ሰሌዳ ላይ ይጫወታል፤ በውስጡ 25 ሳጥኖች አሉ። ከ1 እስከ 24 የሚፈልጉትን የMines ብዛት ይምረጡና ዙሩን ይጀምሩ። ደህና የሆነ ሳጥን ሲከፍቱ ብዜቱ ይጨምራል። ሚን ከከፈቱ ዙሩ ይጠፋል። ደህና ሳጥኖችን ከከፈቱ በኋላ በፈለጉት ጊዜ Cash Out ማድረግ ይችላሉ። ይህ የMines ስሪት በመሣሪያዎ ላይ የሚቀመጥ የሙከራ ክሬዲት ይጠቀማል።',
      ti: 'Mines ኣብ 5×5 ሰሌዳ ይጽወት፤ 25 ሳጹናት ኣለዉ። ካብ 1 ክሳብ 24 ብዝሒ Mines ምረጹን ዙር ጀምሩን። ውሑስ ሳጹን ምስ ከፈትኩም ብዜት ይውስኽ። Mine እንተኸፊትኩም ዙር ይጠፍእ። ውሑሳት ሳጹናት ምስ ከፈትኩም ኣብ ዝደለኹሞ እዋን Cash Out ክትገብሩ ትኽእሉ። እዚ ስሪት Mines ኣብ መሳርሒኹም ዝቕመጥ ናይ ፈተነ ክረዲት ይጥቀም።',
      en: 'Mines uses a 5×5 board with 25 tiles. Choose a mine count from 1 to 24 and start the round. Each safe tile you open increases the multiplier. Opening a mine ends the round as a loss. After opening safe tiles, you can Cash Out at any time. This version of Mines uses demo credits stored on your device.'
    },
    keywords: { am: ['mines','ማይንስ','ሚን','ሳጥን','25','5x5','cash out','ብዜት'], ti: ['mines','ሳጹን','25','5x5','cash out','ብዜት'], en: ['mines','mine','tiles','25','5x5','cash out','multiplier'] }
  },
  {
    id: 'fairness', category: 'safety',
    question: { am: 'ጨዋታዎቹ ፍትሃዊ መሆናቸውን እንዴት አውቃለሁ?', ti: 'ጸወታታት ፍትሓውያን ምዃኖም ብኸመይ እፈልጥ?', en: 'How can I understand game fairness?' },
    answer: {
      am: 'የጨዋታ ፍትሃዊነትን ለማረጋገጥ የጨዋታውን የተለየ መረጃ፣ የውጤት ታሪክ እና የሚታዩ ማረጋገጫዎች ይመልከቱ። Aviator ላይ የServer Seed Hash እና የተገለጠ Seed መረጃ ሊታይ ይችላል። ይህ ማዕከል የጨዋታዎችን ውጤት በተናጠል አያረጋግጥም፣ የውጤት ትንበያም አይሰጥም።',
      ti: 'ፍትሓውነት ጸወታ ንምርግጋጽ እቲ ፍሉይ ሓበሬታ ጸወታ፣ ታሪኽ ውጽኢትን ዝርኣዩ መረጋገጺታትን ርኣዩ። ኣብ Aviator ሓበሬታ Server Seed Hashን ዝተገልጸ Seedን ክርአ ይኽእል። እዚ ማእከል ውጽኢት ጸወታ ብናጻ ኣየረጋግጽን፣ ትንበያ እውን ኣይህብን።',
      en: 'To assess fairness, review each game’s own information, result history, and any verification details displayed there. Aviator may show a Server Seed Hash and a revealed seed. This help center does not independently verify game outcomes or predict results.'
    },
    keywords: { am: ['ፍትሃዊ','fair','seed','hash','ማረጋገጥ','ትንበያ'], ti: ['ፍትሓዊ','fair','seed','hash','ምርግጋጽ','ትንበያ'], en: ['fairness','fair','seed','hash','verify','predict'] }
  },
  {
    id: 'wallet-withdrawal', category: 'safety',
    question: { am: 'የWallet የሙከራ ብርን ማውጣት ወይም መቀበል እችላለሁ?', ti: 'ናይ Wallet ፈተና ብር ከውጽእ ወይ ክቕበል ይኽእል?', en: 'Can I withdraw or receive a payout from test wallet credits?' },
    answer: {
      am: 'አይ። በዚህ የሙከራ ስሪት የWallet ETB ቀሪ ሂሳብ የሙከራ ክሬዲት ብቻ ነው፤ የገንዘብ ዋጋ የለውም፣ ሊወጣ ወይም ሊከፈል አይችልም። Real-money deposits እና payouts ተዘግተዋል።',
      ti: 'ኣይፋልን። ኣብዚ ናይ ፈተና ስሪት ናይ Wallet ETB ሒሳብ ናይ ፈተና ክሬዲት ጥራይ እዩ፤ ናይ ገንዘብ ዋጋ የብሉን፣ ክወጽእ ወይ ክኽፈል ኣይክእልን። Real-money depositsን payoutsን ተዓጽዮም ኣለዉ።',
      en: 'No. Wallet ETB in this test version is simulated credit only. It has no cash value and cannot be withdrawn or paid out. Real-money deposits and payouts are disabled.'
    },
    keywords: { am: ['withdraw','cashout','ማውጣት','ወጪ','ክፍያ','payout'], ti: ['withdraw','cashout','ምውጻእ','ወጻኢ','ክፍሊት','payout'], en: ['withdraw','withdrawal','cash out','cashout','payout','cash value'] }
  },
  {
    id: 'wallet-safety', category: 'safety',
    question: { am: 'Black Gold AI የWallet ሂሳቤን ማየት ወይም መቀየር ይችላል?', ti: 'Black Gold AI ሒሳብ Wallet ክርኢ ወይ ክቕይር ይኽእል?', en: 'Can Black Gold AI view or change my wallet?' },
    answer: {
      am: 'አይችልም። Black Gold AI የመረጃ እና የህግ ማብራሪያ ብቻ ይሰጣል። የግል Wallet ቀሪ ሂሳብ፣ ገቢ/ወጪ ግብይት ወይም የክፍያ ሁኔታ ማየት፣ መቀየር ወይም ማረጋገጥ አይችልም። ለእነዚህ የመተግበሪያውን ተዛማጅ የWallet ገጽ ይጠቀሙ።',
      ti: 'ኣይክእልን። Black Gold AI ሓበሬታን መብርህን ሕግታትን ጥራይ ይህብ። ናይ ባዕልኹም Wallet ሒሳብ፣ ኣታዊ/ወጻኢ ግብይት ወይ ኩነታት ክፍሊት ክርኢ፣ ክቕይር ወይ ከረጋግጽ ኣይክእልን። ነዚ ኣብ ተዛማዲ ገጽ Wallet እቲ መተግበሪ ተጠቐሙ።',
      en: 'No. Black Gold AI only explains information and game rules. It cannot view, change, or verify your personal wallet balance, deposits, withdrawals, or payment status. Use the relevant Wallet page in the app for account-specific information.'
    },
    keywords: { am: ['wallet','ዋሌት','ቦርሳ','ሂሳብ','ቀሪ ሂሳብ','ክፍያ'], ti: ['wallet','ቦርሳ','ሒሳብ','ክፍሊት'], en: ['wallet','balance','deposit','withdrawal','payment'] }
  },
];

export const helpQuickQuestionIds = [
  'how-center-works', 'bingo-how', 'keno-how', 'aviator-how', 'mines-how', 'cash-out', 'wallet-withdrawal',
] as const;

export function findHelpAnswer(query: string, lang: Lang): HelpTopic[] {
  const normalized = query.toLocaleLowerCase().trim();
  if (!normalized) return [];
  const tokens = normalized.split(/[\s,.;:!?/\\]+/).filter((token) => token.length > 1);
  return helpTopics
    .map((topic) => {
      const fields = [topic.question[lang], topic.answer[lang], ...topic.keywords[lang], topic.id.replace(/-/g, ' ')]
        .join(' ').toLocaleLowerCase();
      const score = tokens.reduce((total, token) => total + (fields.includes(token) ? (topic.keywords[lang].some((word) => word.toLocaleLowerCase().includes(token)) ? 3 : 1) : 0), 0);
      return { topic, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((item) => item.topic);
}
