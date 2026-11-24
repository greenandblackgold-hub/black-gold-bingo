import type { Lang } from '@/types/game';

const copy = {
  pin: {
    am:{title:'የPIN ማገገሚያ ጥያቄዎች',hint:'ተጫዋቹን በስልክ ያረጋግጡና ኮዱን ያንብቡለት።',refresh:'አድስ',empty:'የሚጠባበቅ የPIN ማገገሚያ ጥያቄ የለም።',error:'የPIN ማገገሚያ ጥያቄዎችን ማግኘት አልተቻለም።',attempts:'የቀሩ ሙከራዎች',expires:'የሚያበቃበት'},
    ti:{title:'ሕቶታት ምምላስ PIN',hint:'ተጻዋታይ ብተሌፎን ኣረጋግጹን ኮድ ኣንብቡሉን።',refresh:'ኣሐድስ',empty:'ዝጽበ ሕቶ ምምላስ PIN የለን።',error:'ሕቶታት ምምላስ PIN ምርካብ ኣይተኻእለን።',attempts:'ዝተረፉ ፈተነታት',expires:'ዝውድኣሉ'},
    en:{title:'PIN recovery requests',hint:'Verify the player by phone and read the recovery code to them.',refresh:'Refresh',empty:'No pending PIN recovery requests.',error:'Could not load PIN recovery requests.',attempts:'Attempts remaining',expires:'Expires'}
  },
  phone: {
    am:{title:'የስልክ ማረጋገጫ (OTP)',hint:'ተጫዋቹን በስልክ ደውለው ኮዱን ያንብቡለት። SMS አይላክም።',refresh:'አድስ',empty:'የሚጠባበቅ የስልክ ማረጋገጫ የለም።',error:'የማረጋገጫ ዝርዝሩን ማግኘት አልተቻለም።',attempts:'የቀሩ ሙከራዎች',expires:'የሚያበቃበት'},
    ti:{title:'ምርግጋጽ ተሌፎን (OTP)',hint:'ተጻዋታይ ብተሌፎን ደዊልኩም ኮድ ኣንብቡሉ። SMS ኣይለኣኽን።',refresh:'ኣሐድስ',empty:'ዝጽበ ምርግጋጽ ተሌፎን የለን።',error:'ዝርዝር ምርግጋጽ ምርካብ ኣይተኻእለን።',attempts:'ዝተረፉ ፈተነታት',expires:'ዝውድኣሉ'},
    en:{title:'Phone verification (OTP)',hint:'Call the player and read the verification code to them. No SMS is sent.',refresh:'Refresh',empty:'No pending phone verifications.',error:'Could not load phone verification requests.',attempts:'Attempts remaining',expires:'Expires'}
  },
  sms: {
    am:{title:'ራስ-ሰር የባንክ SMS ማመሳሰል',checking:'የSMS ማገናኛን በማዘጋጀት ላይ…',connected:'የAdmin ስልክ SMS ማገናኛ ተገናኝቷል። የባንክ/Telebirr SMS በራስ-ሰር ይላካል።',permission:'SMS ለማንበብ ፈቃድ አልተሰጠም። ፈቃዱን ከAndroid Settings ያብሩ።',browser:'ራስ-ሰር SMS ማገናኛ በAdmin Android APK ላይ ብቻ ይሰራል። በWeb ላይ Admin APK-ን ይጠቀሙ።',error:'SMS ማገናኛው አልተገናኘም። ኢንተርኔትንና የAdmin መግቢያን ያረጋግጡ።',reconnect:'እንደገና አገናኝ',reconnecting:'በመገናኘት ላይ…',details:'የባንክ/Telebirr መለያ ያላቸው SMS-ዎች ብቻ ይላካሉ። የTelebirr ወደ ተዋቀረው CBE አካውንት የተላለፈ ደረሰኝ ከDeposit ማጣቀሻና መጠን ጋር 100% ከተዛመደ በራስ-ሰር ይፀድቃል፤ ሌሎች ወይም ያልተዛመዱ ጉዳዮች Admin በእጅ ይመረምራል።'},
    ti:{title:'ባዕላዊ ምስምማዕ SMS ባንክ',checking:'መራኸቢ SMS ይዳሎ ኣሎ…',connected:'መራኸቢ SMS ተሌፎን Admin ተራኺቡ። SMS ባንክ/Telebirr ብባዕሉ ይለኣኽ።',permission:'ፍቓድ ንምንባብ SMS ኣይተዋህበን። ካብ Android Settings ኣብርህዎ።',browser:'ባዕላዊ መራኸቢ SMS ኣብ Admin Android APK ጥራይ ይሰርሕ። ኣብ Web Admin APK ተጠቐሙ።',error:'መራኸቢ SMS ኣይተራኸበን። ኢንተርነትን መእተዊ Adminን ኣረጋግጹ።',reconnect:'እንደገና ኣራኽብ',reconnecting:'ይራኸብ ኣሎ…',details:'መለለዪ ባንክ/Telebirr ዘለዎም SMS ጥራይ ይለኣኹ። ደረሰኝ Telebirr ናብ ዝተዳለወ CBE ሒሳብ ዝተላእከ ምስ ማጣቀሲ Depositን መጠንን 100% እንተተሰማሚዑ ብባዕሉ ይጸድቕ፤ ካልኦት ጉዳያት Admin ብኢድ ይምርምር።'},
    en:{title:'Automatic Bank SMS Sync',checking:'Setting up the SMS bridge…',connected:'The Admin phone SMS bridge is connected. Bank/Telebirr messages are forwarded automatically.',permission:'SMS read permission was not granted. Enable it in Android Settings.',browser:'Automatic SMS sync works only in the Admin Android APK. Use the Admin APK instead of the web app.',error:'The SMS bridge is not connected. Check the internet connection and Admin sign-in.',reconnect:'Reconnect',reconnecting:'Connecting…',details:'Only SMS messages identified as bank/Telebirr messages are forwarded. A Telebirr transfer receipt to the configured CBE account is auto-approved only when the deposit reference and amount match exactly; other or unmatched cases are reviewed manually by Admin.'}
  }
  app: {
    am:{menu:'ሜኑ',closeMenu:'ሜኑን ዝጋ',phoneTitle:'ስልክዎን ያረጋግጡ',phoneHelp:'የማረጋገጫ ቁጥሩን ከአስተዳዳሪው በስልክ ጥሪ ይቀበሉ። SMS አይላክም።',code:'6 አሃዝ የማረጋገጫ ኮድ',verifying:'በመፈተሽ ላይ…',verify:'አረጋግጥ',logout:'ውጣ',loading:'በመጫን ላይ…',invalidCode:'ኮዱ አልተቀበለም።'},
    ti:{menu:'ሜኑ',closeMenu:'ሜኑ ዕጸዉ',phoneTitle:'ተሌፎንኩም ኣረጋግጹ',phoneHelp:'ኮድ ምርግጋጽ ካብ ኣመሓዳሪ ብተሌፎን ጻውዒት ተቐበሉ። SMS ኣይለኣኽን።',code:'6 ኣሃዝ ኮድ ምርግጋጽ',verifying:'ይምርመር ኣሎ…',verify:'ኣረጋግጽ',logout:'ውጻእ',loading:'ይጽዓን ኣሎ…',invalidCode:'እቲ ኮድ ኣይተቐበለን።'},
    en:{menu:'Menu',closeMenu:'Close menu',phoneTitle:'Verify your phone',phoneHelp:'Get the verification code from the administrator by phone call. No SMS is sent.',code:'6-digit verification code',verifying:'Verifying…',verify:'Verify',logout:'Sign out',loading:'Loading…',invalidCode:'The code was not accepted.'}
  },
} as const;

export function adminSimpleLocale(section: keyof typeof copy, lang: Lang, key: string): string {
  const selected = copy[section][lang] as Record<string, string>;
  const fallback = copy[section].en as Record<string, string>;
  return selected[key] ?? fallback[key] ?? key;
}
