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
      am: 'Black Gold የተለያዩ ጨዋታዎችን በአንድ ቦታ ያቀርባል። ከጨዋታዎች ማዕከል የሚፈልጉትን ጨዋታ ይምረጡ። የጨዋታውን መመሪያ ያንብቡ፣ በስክሪኑ ላይ የሚታዩትን ደረጃዎች ይከተሉ። የሚታዩ አማራጮችና ባህሪያት እንደ ጨዋታው እና እንደ ሁነታው ሊለያዩ ይችላሉ።',
      ti: 'Black Gold ዝተፈላለዩ ጸወታታት ኣብ ሓደ ቦታ የቕርብ። ካብ ማእከል ጸወታታት እቲ እትደልይዎ ጸወታ ምረጹ። መምርሒ እቲ ጸወታ ኣንብቡ፣ ኣብ ስክሪን ዝርአ ደረጃታት ተኸተሉ። ዝርከቡ ኣማራጺታት ከከም ጸወታን ሞድን ክፈላለዩ ይኽእሉ።',
      en: 'Black Gold brings several games together in one place. Choose a game from the Games Center, read its on-screen instructions, and follow the steps shown. Available options can differ by game and mode.'
    },
    keywords: { am: ['ጌም ሴንተር','አጠቃቀም','እንዴት ይሠራል','መተግበሪያ'], ti: ['game center','ኣጠቓቕማ','ብኸመይ','መተግበሪ'], en: ['game center','how it works','app','use the app'] }
  },
  {
    id: 'demo-vs-real', category: 'general',
    question: { am: 'የሙከራ እና ቀጥታ ሁነታ ልዩነታቸው ምንድን ነው?', ti: 'ናይ ፈተነን ቀጥታዊን ሞድ እንታይ ፍልልይ ኣለዎም?', en: 'What is the difference between Demo and Real mode?' },
    answer: {
      am: 'የሙከራ ሁነታ ማለት ለመለማመድ የሚጠቀሙበት ሁነታ ነው፤ የሙከራ ክሬዲት እውነተኛ ገንዘብ አይደለም እና ወደ ውጭ ማውጣት አይቻልም። እውነተኛ ገንዘብ የሚጠቀም ቀጥታ ሁነታ ካለ፣ በገጹ ላይ የሚታየውን ማስታወቂያና ደንብ በጥንቃቄ ያንብቡ። በዚህ መረጃ ማዕከል የሁነታዎን ሁኔታ ወይም ቀሪ ሂሳብ ማረጋገጥ አይቻልም።',
      ti: 'ናይ ፈተነ ሞድ ማለት ንምልምማድ ዝጥቀሙሉ ሞድ እዩ፤ ናይ ፈተነ ክረዲት ሓቀኛ ገንዘብ ኣይኮነን፣ ክወጽእ እውን ኣይክእልን። ሓቀኛ ገንዘብ ዝጥቀም ቀጥታዊ ሞድ እንተሃልዩ፣ ኣብቲ ገጽ ዘሎ ሓበሬታን ሕግታትን ብጥንቃቐ ኣንብቡ። እዚ ማእከል ሓበሬታ ኩነታት ሞድኩም ወይ ሒሳብኩም ኣየረጋግጽን።',
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
      am: 'የማሸነፍ ቅርጽ በካርድ ላይ ምልክት ማድረግ ያለብዎትን ሳጥኖች ያሳያል፤ ለምሳሌ መስመር፣ X ወይም ሌላ ቅርጽ። ሁሉም የሚታዩ ምሳሌዎች በአንድ ዙር አይሰሩም። በዚያ ዙር የሚሰራውን ቅርጽ በጨዋታው ላይ ያለውን “የአሸናፊነት ቅርጽ” መረጃ ይመልከቱ።',
      ti: 'ቅርጺ ዓወት ኣብ ካርድ ኣየኖት ሳጹናት ምልክት ክትገብሩ ከም ዘለኩም የርኢ፤ ንኣብነት መስመር፣ X ወይ ካልእ ቅርጺ። ኩሎም ዝርኣዩ ኣብነታት ኣብ ሓደ ዙር ኣይሰርሑን። ኣብቲ ዙር ዝሰርሕ ቅርጺ ኣብ “የአሸናፊነት ቅርጽ” ሓበሬታ እቲ ጸወታ ርኣዩ።',
      en: 'A winning pattern shows which squares on your card must be marked, such as a line, X, or another shape. Not every example pattern is active in every round. Check the “የአሸናፊነት ቅርጽ” shown in the game for the pattern selected for the current round.'
    },
    keywords: { am: ['winning pattern','ቅርጽ','ማሸነፍ','x','መስመር'], ti: ['winning pattern','ቅርጺ','ዓወት','መስመር'], en: ['winning pattern','pattern','line','x pattern'] }
  },
  {
    id: 'keno-how', category: 'keno',
    question: { am: 'Keno እንዴት ይጫወታል?', ti: 'Keno ብኸመይ ይጽወት?', en: 'How do I play Keno?' },
    answer: {
      am: 'Keno ላይ ከ1 እስከ 80 ያሉ ቁጥሮች ውስጥ እስከ 10 ቁጥሮችን ይምረጡ። በዙሩ 20 ቁጥሮች ይወጣሉ። የመረጡት ቁጥሮች ከወጡት ጋር ስንት እንደተዛመዱ ውጤቱን ይወስናል። የሽልማት ስሌቱ በጨዋታው የሚታየው የክፍያ ሰንጠረዥ ላይ ይመሰረታል፤ ሽልማት ዋስትና የለውም።',
      ti: 'ኣብ Keno ካብ 1 ክሳብ 80 ዘለዉ ቁጽሪታት ክሳብ 10 ምረጹ። ኣብ ዙር 20 ቁጽሪታት ይወጽኡ። ካብቶም ዝመረጽኩሞ ምስ ዝወጹ ዝተሰማምዑ ቁጽሪታት ውጽኢት ይውስኑ። ሽልማት ብኣብ ጸወታ ዝርአ ሰሌዳ ክፍሊት ይሕሰብ፤ ሽልማት ውሕስነት የብሉን።',
      en: 'In Keno, choose up to 10 numbers from 1 to 80. The game draws 20 numbers in a round. Your result depends on how many of your picks match the drawn numbers. Any payout is determined by the Payout Table shown in the game; a prize is never guaranteed.'
    },
    keywords: { am: ['keno','ኪኖ','ቁጥር','80','20','ሽልማት','payout'], ti: ['keno','ቁጽሪ','80','20','ሽልማት','payout'], en: ['keno','numbers','80','20','draw','payout table','prize'] }
  },
  {
    id: 'aviator-how', category: 'aviator',
    question: { am: 'Aviator እንዴት ይጫወታል?', ti: 'Aviator ብኸመይ ይጽወት?', en: 'How do I play Aviator?' },
    answer: {
      am: 'በዙሩ ከመጀመሩ በፊት እስከ ሁለት የተለያዩ ውርርዶችን ማስገባት ይችላሉ፤ እያንዳንዱም የራሱ መጠን አለው። ለእያንዳንዱ ውርርድ አማራጭ ራስ-ሰር ገንዘብ ማውጣት ብዜት ማስቀመጥ ይችላሉ። አውሮፕላኑ ሲበር ብዜቱ ይጨምራል፤ በእጅ ገንዘብ ማውጣት ካደረጉ ወይም የተቀመጠው ራስ-ሰር ገንዘብ ማውጣት ግብ አውሮፕላኑ ከመውደቁ በፊት ከደረሰ ውጤቱ በዚያ ብዜት ይሰላል። አውሮፕላኑ ቀድሞ ከወደቀ ከሆነ ውርርዱ ሊጠፋ ይችላል፤ የCrash ጊዜ ሊተነበይ አይችልም.',
      ti: 'ቅድሚ ዙር ምጅማሩ ክሳብ ክልተ ናጻ ውርርዳት ከእትዉ ትኽእሉ፤ ነፍሲ ወከፍ ውርርድ ናይ ባዕሉ መጠን ኣለዎ። ንነፍሲ ወከፍ ውርርድ ኣማራጺ ራስ-ሰር ገንዘብ ማውጣት ብዜት ክትውስኑ ትኽእሉ። ነፋሪት ክትነፍር ከላ ብዜት ይውስኽ፤ ብኢድ ገንዘብ ምውጻእ እንተገይርኩም ወይ እቲ ዝተወሰነ ብራስ-ሰር ገንዘብ ምውጻእ ዕላማ ቅድሚ ምውዳቕ ነፋሪት እንተበጺሑ ውጽኢት በቲ ብዜት ይሕሰብ። ነፋሪት ቀዲማ እንተወዲቓ እንተኾይኑ ውርርድኩም ክጠፍእ ይኽእል፤ ግዜ ምውዳቕ ነፋሪት ምግማት ኣይከኣልን.',
      en: 'You can place up to two independent bets before a round starts; each has its own stake. Each bet can also have an optional Auto Cash Out target. As the plane flies, the multiplier rises. You can cash out manually, or the server cashes out automatically if the bet target is reached before the crash. If the crash happens first, the stake can be lost. The crash point cannot be predicted.'
    },
    keywords: { am: ['aviator','አቪየተር','አውሮፕላን','cash out','ካሽ አውት','multiplier','ብዜት','crash'], ti: ['aviator','ነፋሪት','cash out','multiplier','ብዜት','crash'], en: ['aviator','plane','cash out','multiplier','crash'] }
  },
  {
    id: 'cash-out', category: 'aviator',
    question: { am: 'ገንዘብ ማውጣት ምንድን ነው?', ti: 'ገንዘብ ምውጻእ እንታይ እዩ?', en: 'What does Cash Out mean?' },
    answer: {
      am: 'ገንዘብ ማውጣት ማለት የAviator ዙር ከመቋረጡ በፊት ያለዎትን ውርርድ በአሁኑ ብዜት ላይ ማጠናቀቅ ነው። ቁልፉ በበረራ ላይ ሳለ ብቻ ይሰራል። ከአውሮፕላኑ ከወደቀ በኋላ ማውጣት አይቻልም። የተመዘገበውን ውጤት በጨዋታው ማሳያ ያረጋግጡ።',
      ti: 'ገንዘብ ምውጻእ ማለት ዙር Aviator ቅድሚ ምቁራጹ ውርርድኩም በእቲ እዋን ዘሎ ብዜት ምዝዛም እዩ። እቲ ቁልፊ ነፋሪት ኣብ በረራ ከላ ጥራይ ይሰርሕ። ድሕሪ ምውዳቕ ነፋሪት ምውጻእ ኣይከኣልን። እቲ ዝተመዝገበ ውጽኢት ኣብ ገጽ ጸወታ ኣረጋግጹ።',
      en: 'Cash Out means ending your Aviator bet at the multiplier currently shown, before the round crashes. The button is available only while the plane is flying. You cannot cash out after a crash. Check the game display for the recorded result.'
    },
    keywords: { am: ['cash out','ካሽ አውት','ገንዘብ ማውጣት','መቼ ማውጣት'], ti: ['cash out','ገንዘብ ምውጻእ','ምውጻእ'], en: ['cash out','cashout','withdraw','end bet'] }
  },
  {
    id: 'auto-cashout', category: 'aviator',
    question: { am: 'Aviator ውስጥ ብራስ-ሰር ገንዘብ ምውጻእ ምንድን ነው?', ti: 'ኣብ Aviator Auto ገንዘብ ምውጻእ እንታይ እዩ?', en: 'What is Auto Cash Out in Aviator?' },
    answer: {
      am: 'ብራስ-ሰር ገንዘብ ምውጻእ ማለት ለአንድ ውርርድ የሚፈልጉትን ብዜት አስቀድመው ማስቀመጥ ነው። ሰርቨሩ ያ ብዜት አውሮፕላኑ ከመውደቁ በፊት ከደረሰ በራስ-ሰር ገንዘብ ማውጣት ያከናውናል። አውሮፕላኑ ቀድሞ ከወደቀ ከሆነ ውርርዱ ሊጠፋ ይችላል። ይህ የአሸናፊነት ዋስትና አይደለም።',
      ti: 'ብራስ-ሰር ገንዘብ ምውጻእ ማለት ንሓደ ውርርድ እትደልይዎ ብዜት ኣቐዲምኩም ምውሳን እዩ። እቲ ብዜት ቅድሚ ምውዳቕ ነፋሪት እንተበጺሑ ሰርቨር ብራስ-ሰር ገንዘብ ምውጻእ ይገብር። ነፋሪት ቀዲማ እንተወዲቓ እንተኾይኑ ውርርድኩም ክጠፍእ ይኽእል። እዚ ውሕስነት ዓወት ኣይኮነን።',
      en: 'Auto Cash Out lets you set a target multiplier for an individual bet before the round. If the target is reached before the crash, the server cashes out that bet automatically. If the crash happens first, the stake can be lost. It does not guarantee a win.'
    },
    keywords: { am: ['auto cash out','ራስ-ሰር ገንዘብ ማውጣት','ብዜት','crash'], ti: ['auto cash out','ብራስ-ሰር ገንዘብ ምውጻእ','ብዜት','crash'], en: ['auto cash out','automatic cashout','target multiplier','crash'] }
  },
  {
    id: 'mines-how', category: 'mines',
    question: { am: 'Mines እንዴት ይጫወታል?', ti: 'Mines ብኸመይ ይጽወት?', en: 'How do I play Mines?' },
    answer: {
      am: 'Mines በ5×5 ሰሌዳ ላይ ይጫወታል፤ በውስጡ 25 ሳጥኖች አሉ። ከ1 እስከ 24 የሚፈልጉትን የፈንጂዎች ብዛት ይምረጡና ዙሩን ይጀምሩ። ደህና የሆነ ሳጥን ሲከፍቱ ብዜቱ ይጨምራል። ሚን ከከፈቱ ዙሩ ይጠፋል። ደህና ሳጥኖችን ከከፈቱ በኋላ በፈለጉት ጊዜ ገንዘብ ማውጣት ይችላሉ። ይህ የMines ስሪት በመሣሪያዎ ላይ የሚቀመጥ የሙከራ ክሬዲት ይጠቀማል።',
      ti: 'Mines ኣብ 5×5 ሰሌዳ ይጽወት፤ 25 ሳጹናት ኣለዉ። ካብ 1 ክሳብ 24 ብዝሒ ፈንጂታት ምረጹን ዙር ጀምሩን። ውሑስ ሳጹን ምስ ከፈትኩም ብዜት ይውስኽ። ፈንጂ እንተኸፊትኩም ዙር ይጠፍእ። ውሑሳት ሳጹናት ምስ ከፈትኩም ኣብ ዝደለኹሞ እዋን ገንዘብ ከተውጽኡ ትኽእሉ። እዚ ስሪት Mines ኣብ መሳርሒኹም ዝቕመጥ ናይ ፈተነ ክረዲት ይጥቀም።',
      en: 'Mines uses a 5×5 board with 25 tiles. Choose a mine count from 1 to 24 and start the round. Each safe tile you open increases the multiplier. Opening a mine ends the round as a loss. After opening safe tiles, you can Cash Out at any time. This version of Mines uses demo credits stored on your device.'
    },
    keywords: { am: ['mines','ማይንስ','ሚን','ሳጥን','25','5x5','cash out','ብዜት'], ti: ['mines','ሳጹን','25','5x5','cash out','ብዜት'], en: ['mines','mine','tiles','25','5x5','cash out','multiplier'] }
  },
  {
    id: 'fairness', category: 'safety',
    question: { am: 'ጨዋታዎቹ ፍትሃዊ መሆናቸውን እንዴት አውቃለሁ?', ti: 'ጸወታታት ፍትሓውያን ምዃኖም ብኸመይ እፈልጥ?', en: 'How can I understand game fairness?' },
    answer: {
      am: 'የጨዋታ ፍትሃዊነትን ለማረጋገጥ የጨዋታውን የተለየ መረጃ፣ የውጤት ታሪክ እና የሚታዩ ማረጋገጫዎች ይመልከቱ። Aviator ላይ የሰርቨር ዘር ሃሽ እና የተገለጠ ዘር መረጃ ሊታይ ይችላል። ይህ ማዕከል የጨዋታዎችን ውጤት በተናጠል አያረጋግጥም፣ የውጤት ትንበያም አይሰጥም።',
      ti: 'ፍትሓውነት ጸወታ ንምርግጋጽ እቲ ፍሉይ ሓበሬታ ጸወታ፣ ታሪኽ ውጽኢትን ዝርኣዩ መረጋገጺታትን ርኣዩ። ኣብ Aviator ሓበሬታ የሰርቨር ዘር ሃሽን ዝተገልጸ ዘርን ክርአ ይኽእል። እዚ ማእከል ውጽኢት ጸወታ ብናጻ ኣየረጋግጽን፣ ትንበያ እውን ኣይህብን።',
      en: 'To assess fairness, review each game’s own information, result history, and any verification details displayed there. Aviator may show a a Server Seed Hash and a revealed seed. This help center does not independently verify game outcomes or predict results.'
    },
    keywords: { am: ['ፍትሃዊ','fair','seed','hash','ማረጋገጥ','ትንበያ'], ti: ['ፍትሓዊ','fair','seed','hash','ምርግጋጽ','ትንበያ'], en: ['fairness','fair','seed','hash','verify','predict'] }
  },
  {
    id: 'wallet-deposit', category: 'safety',
    question: { am: 'በገንዘብ ቦርሳ የሙከራ ብር እንዴት እጨምራለሁ?', ti: 'ኣብ ቦርሳ ገንዘብ ናይ ፈተና ብር ብኸመይ እውስኽ?', en: 'How do I add test ETB to my Wallet?' },
    answer: {
      am: 'በገንዘብ ቦርሳ ገጽ ላይ ገንዘብ ማስገባትን ይምረጡ፤ መጠኑንና የባንክ/Telebirr የግብይት ማጣቀሻ ቁጥሩን ያስገቡ። ጥያቄው በመጠባበቅ ላይ ሆኖ ይቆያል። የአስተዳዳሪ ስልክ SMS ማዛመድ ማስረጃ ብቻ ነው፤ ባላንስ የሚጨምረው አስተዳዳሪው ደረሰኙን አረጋግጦ አጽድቅ ሲጫን ብቻ ነው። እውነተኛ ገንዘብ ክፍያዎች ተዘግተዋል።',
      ti: 'ኣብ ገጽ ቦርሳ ገንዘብ ምእታው ምረጹ፤ መጠንን ናይ ባንክ/Telebirr መወከሲ ቁጽርን ኣእትዉ። እቲ ሕቶ ኣብ ትጽቢት ኮይኑ ይጸንሕ። ናይ ኣማሓዳሪ ስልኪ SMS ምዝማድ መርትዖ ጥራይ እዩ፤ ባላንስ ዝውስኽ ኣማሓዳሪ ደረሰኝ ኣረጋጊጹ ኣጽድቕ ምስ ጠወቐ ጥራይ እዩ። ሓቀኛ ገንዘብ ክፍሊታት ተዓጽዮም ኣለዉ።',
      en: 'On the Wallet page, choose Deposit and enter the amount plus the bank/Telebirr transaction reference. The request stays pending. A matching SMS from the trusted Admin phone is evidence only; the balance increases only after an Admin independently checks the receipt and presses Approve. Real-money payments are disabled.'
    },
    keywords: { am: ['deposit','ገንዘብ መጨመር','ተቀማጭ','Telebirr','CBE','SMS','Approve'], ti: ['deposit','ተቐማጢ','ገንዘብ ምውሳኽ','Telebirr','CBE','SMS','Approve'], en: ['deposit','top up','Telebirr','CBE','transaction reference','pending','admin approval'] }
  },
  {
    id: 'wallet-withdrawal', category: 'safety',
    question: { am: 'የገንዘብ ቦርሳ የሙከራ ብርን ማውጣት ወይም መቀበል እችላለሁ?', ti: 'ናይ ቦርሳ ገንዘብ ፈተና ብር ከውጽእ ወይ ክቕበል ይኽእል?', en: 'Can I withdraw or receive a payout from test wallet credits?' },
    answer: {
      am: 'አይ። በዚህ የሙከራ ስሪት የየገንዘብ ቦርሳ የብር ቀሪ ሂሳብ የሙከራ ክሬዲት ብቻ ነው፤ የገንዘብ ዋጋ የለውም፣ ሊወጣ ወይም ሊከፈል አይችልም። እውነተኛ ገንዘብ ማስገባትና ማውጣት ተዘግተዋል።',
      ti: 'ኣይፋልን። ኣብዚ ናይ ፈተና ስሪት ናይ ቦርሳ ገንዘብ ሒሳብ ብር ናይ ፈተና ክሬዲት ጥራይ እዩ፤ ናይ ገንዘብ ዋጋ የብሉን፣ ክወጽእ ወይ ክኽፈል ኣይክእልን። ሓቀኛ ገንዘብ ምእታውን ምውጻእን ተዓጽዮም ኣለዉ።',
      en: 'No. Wallet ETB in this test version is simulated credit only. It has no cash value and cannot be withdrawn or paid out. Real-money deposits and payouts are disabled.'
    },
    keywords: { am: ['withdraw','cashout','ማውጣት','ወጪ','ክፍያ','payout'], ti: ['withdraw','cashout','ምውጻእ','ወጻኢ','ክፍሊት','payout'], en: ['withdraw','withdrawal','cash out','cashout','payout','cash value'] }
  },
  {
    id: 'wallet-safety', category: 'safety',
    question: { am: 'Black Gold AI የየገንዘብ ቦርሳ ሂሳቤን ማየት ወይም መቀየር ይችላል?', ti: 'Black Gold AI ሒሳብ የገንዘብ ቦርሳ ክርኢ ወይ ክቕይር ይኽእል?', en: 'Can Black Gold AI view or change my wallet?' },
    answer: {
      am: 'አይችልም። Black Gold AI የመረጃ እና የህግ ማብራሪያ ብቻ ይሰጣል። የግል የገንዘብ ቦርሳ ቀሪ ሂሳብ፣ ገቢ/ወጪ ግብይት ወይም የክፍያ ሁኔታ ማየት፣ መቀየር ወይም ማረጋገጥ አይችልም። ለእነዚህ የመተግበሪያውን ተዛማጅ የገንዘብ ቦርሳ ገጽ ይጠቀሙ።',
      ti: 'ኣይክእልን። Black Gold AI ሓበሬታን መብርህን ሕግታትን ጥራይ ይህብ። ናይ ባዕልኹም ቦርሳ ገንዘብ ሒሳብ፣ ኣታዊ/ወጻኢ ግብይት ወይ ኩነታት ክፍሊት ክርኢ፣ ክቕይር ወይ ከረጋግጽ ኣይክእልን። ነዚ ኣብ ተዛማዲ ገጽ ቦርሳ ገንዘብ እቲ መተግበሪ ተጠቐሙ።',
      en: 'No. Black Gold AI only explains information and game rules. It cannot view, change, or verify your personal wallet balance, deposits, withdrawals, or payment status. Use the relevant Wallet page in the app for account-specific information.'
    },
    keywords: { am: ['wallet','ዋሌት','ቦርሳ','ሂሳብ','ቀሪ ሂሳብ','ክፍያ'], ti: ['wallet','ቦርሳ','ሒሳብ','ክፍሊት'], en: ['wallet','balance','deposit','withdrawal','payment'] }
  },
];

export const helpQuickQuestionIds = [
  'how-center-works', 'bingo-how', 'keno-how', 'aviator-how', 'mines-how', 'cash-out', 'auto-cashout', 'wallet-deposit', 'wallet-withdrawal',
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
