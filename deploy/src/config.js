import { fileURLToPath } from 'node:url';

/** Reads and validates environment variables. Fails fast on unsafe production settings. */
const bool = (v, d = false) => (v === undefined || v === '' ? d : /^(1|true|yes)$/i.test(v));
const num = (v, d) => {
  if (v === undefined || v === '') return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const santim = (etb) => Math.round(etb * 100);

export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const prod = nodeEnv === 'production';
  const port = num(env.PORT, 8080);
  // Render provides the service's public address; one service serves both the website and the API.
  const selfUrl = (env.PUBLIC_API_URL ?? env.RENDER_EXTERNAL_URL ?? `http://localhost:${port}`).replace(/\/$/, '');
  const clientUrl = (env.CLIENT_URL ?? selfUrl).replace(/\/$/, '');
  const cfg = {
    nodeEnv,
    prod,
    port,
    trustProxy: bool(env.TRUST_PROXY, Boolean(env.RENDER)),
    storage: env.STORAGE ?? (env.MONGODB_URI ? 'mongo' : 'memory'),
    mongoUri: env.MONGODB_URI ?? '',
    dbName: env.DB_NAME ?? 'blackgold_bingo',
    jwtSecret: env.JWT_SECRET ?? (prod ? '' : 'dev-only-secret-change-me-dev-only-secret'),
    clientOrigins: (env.CLIENT_ORIGINS ?? clientUrl).split(',').map((s) => s.trim()).filter(Boolean),
    clientUrl,
    publicApiUrl: selfUrl,
    // The built website (served by this same process). Missing folder = API only.
    staticDir: env.STATIC_DIR ?? fileURLToPath(new URL('../public', import.meta.url)),
    adminPhone: env.ADMIN_PHONE ?? '',
    adminPin: env.ADMIN_PIN ?? '',
    adminName: env.ADMIN_NAME ?? 'Owner',
    resetPlayerAccountsOnce: bool(env.RESET_PLAYER_ACCOUNTS_ONCE, false),
    roomId: env.ROOM_ID ?? 'BINGO-99',
    cardPrice: santim(num(env.CARD_PRICE_ETB, 10)),
    prizePercent: num(env.PRIZE_PERCENT, 80),
    maxCardsPerPurchase: num(env.MAX_CARDS_PER_PURCHASE, 20),
    minDeposit: santim(num(env.MIN_DEPOSIT_ETB, 10)),
    maxDeposit: santim(num(env.MAX_DEPOSIT_ETB, 10000)),
    minWithdraw: santim(num(env.MIN_WITHDRAW_ETB, 50)),
    autoPayout: bool(env.AUTO_PAYOUT, false),
    // Real-money activity stays OFF in production until both the lottery permit and Chapa's written merchant approval exist.
    registrationEnabled: bool(env.REGISTRATION_ENABLED, !prod),
    realMoneyEnabled: bool(env.REAL_MONEY_ENABLED, !prod && bool(env.CHAPA_MOCK, false)),
    lotteryLicenseApproved: bool(env.LOTTERY_LICENSE_APPROVED, false),
    chapaMerchantApproved: bool(env.CHAPA_MERCHANT_APPROVED, false),
    // Requests per minute per IP. Many mobile users can share one carrier IP, so keep these generous.
    rateLimits: { auth: num(env.RATE_LIMIT_AUTH, 20), money: num(env.RATE_LIMIT_MONEY, 40), default: num(env.RATE_LIMIT_DEFAULT, 240) },
    chapa: {
      secretKey: env.CHAPA_SECRET_KEY ?? '',
      webhookSecret: env.CHAPA_WEBHOOK_SECRET ?? '',
      baseUrl: (env.CHAPA_BASE_URL ?? 'https://api.chapa.co/v1').replace(/\/$/, ''),
      // Chapa wants an email; players sign up with a phone, so one is generated: player-<id>@<this site's domain>.
      emailDomain: env.PAYMENT_EMAIL_DOMAIN ?? (/localhost|127\.0\.0\.1/.test(selfUrl) ? '' : new URL(selfUrl).hostname),
      mock: bool(env.CHAPA_MOCK, false),
    },
  };

  const problems = [];
  if (cfg.jwtSecret.length < 32) problems.push('JWT_SECRET must be at least 32 characters');
  if (cfg.prizePercent <= 0 || cfg.prizePercent > 100) problems.push('PRIZE_PERCENT must be between 1 and 100');
  if (cfg.cardPrice <= 0) problems.push('CARD_PRICE_ETB must be positive');
  if (prod) {
    if (cfg.storage !== 'mongo') problems.push('Production requires STORAGE=mongo with MONGODB_URI');
    if (cfg.chapa.mock) problems.push('CHAPA_MOCK must be false in production');
    if (cfg.realMoneyEnabled && !cfg.lotteryLicenseApproved) problems.push('LOTTERY_LICENSE_APPROVED is required before real-money play');
    if (cfg.realMoneyEnabled && !cfg.chapaMerchantApproved) problems.push('CHAPA_MERCHANT_APPROVED is required before real-money play');
    if (cfg.realMoneyEnabled && !cfg.chapa.secretKey) problems.push('CHAPA_SECRET_KEY is required when real-money play is enabled');
    if (cfg.adminPhone && !/^\d{6}$/.test(cfg.adminPin)) problems.push('ADMIN_PIN must be exactly 6 digits');
  }
  if (problems.length) throw new Error('Invalid configuration:\n - ' + problems.join('\n - '));
  return cfg;
}
