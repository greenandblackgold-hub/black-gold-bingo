/**
 * HTTP layer on Node's built-in `http` module (no web framework needed).
 * createApp() returns a request handler, so tests can run it on an ephemeral port.
 */
import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from '../util/errors.js';
import { publicUser } from '../services/authService.js';

const MAX_BODY = 64 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
};

// The website is one page with inline script and styles, plus Google Fonts for Amharic/Tigrinya lettering.
const PAGE_CSP = [
  "default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com", "img-src 'self' data:", "connect-src 'self'", "frame-ancestors 'none'",
  "base-uri 'self'", "form-action 'self'",
].join('; ');

export function createApp({ config, auth, game, wallet, chapa, repo }) {
  /* ───────────── rate limiting (per IP, in memory: fine for a single instance) ───────────── */
  const hits = new Map();
  const sweep = setInterval(() => {
    const t = Date.now();
    for (const [k, v] of hits) if (v.resetAt < t) hits.delete(k);
  }, 60_000);
  sweep.unref?.();

  function rateLimit(ip, bucket) {
    const max = config.rateLimits[bucket];
    const windowMs = 60_000;
    const key = `${ip}|${bucket}`;
    const t = Date.now();
    let h = hits.get(key);
    if (!h || h.resetAt < t) h = { count: 0, resetAt: t + windowMs };
    h.count += 1;
    hits.set(key, h);
    if (h.count > max) throw new HttpError(429, 'rate_limited', 'Too many requests. Slow down.');
  }

  const clientIp = (req) =>
    (config.trustProxy && String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim()) || req.socket.remoteAddress || 'unknown';

  /* ───────────── helpers ───────────── */
  const send = (res, status, body, headers = {}) => {
    const payload = JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload), ...headers });
    res.end(payload);
  };

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > MAX_BODY) {
          reject(new HttpError(413, 'too_large', 'Request body too large'));
          req.destroy();
        } else chunks.push(c);
      });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });
  }

  const parseJson = (raw) => {
    if (!raw) return {};
    try {
      const v = JSON.parse(raw);
      return v && typeof v === 'object' ? v : {};
    } catch {
      throw new HttpError(400, 'invalid_json', 'Body must be valid JSON');
    }
  };

  const applyCors = (req, res) => {
    const origin = req.headers.origin;
    if (origin && config.clientOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Max-Age', '86400');
    }
  };

  /* ───────────── routes ───────────── */
  // [method, path, access, rate bucket, handler]
  const routes = [];
  const route = (method, path, access, bucket, handler) => {
    const keys = [];
    const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
    routes.push({ method, re, keys, access, bucket, handler });
  };

  // Production money routes remain locked until the required permit and provider approval are confirmed.
  const requireRegistration = () => {
    if (config.prod && !config.registrationEnabled) {
      throw new HttpError(503, 'registration_disabled', 'Registration is temporarily unavailable');
    }
  };
  const requireRealMoney = () => {
    if (config.prod && (!config.realMoneyEnabled || !config.lotteryLicenseApproved || !config.chapaMerchantApproved)) {
      throw new HttpError(503, 'real_money_disabled', 'Real-money play is not enabled until licensing and payment approval are verified');
    }
  };

  const ledgerLabel = { prize: 'Prize', withdraw_hold: 'Cash-out', withdraw_refund: 'Cash-out refund' };
  const ledgerKind = (k) => (k === 'card_purchase' || k === 'withdraw_hold' ? 'purchase' : 'deposit');

  route('GET', '/health', 'public', 'default', async () => ({ ok: true, storage: repo.kind }));

  /* auth */
  route('POST', '/api/auth/register', 'public', 'auth', ({ body }) => { requireRegistration(); return auth.register(body); });
  route('POST', '/api/auth/login', 'public', 'auth', ({ body }) => auth.login(body));
  route('GET', '/api/me', 'user', 'default', ({ user }) => publicUser(user));

  /* game (public state; the SSE stream is handled separately below) */
  route('GET', '/api/game', 'public', 'default', () => game.getPublicState());

  /* cards */
  route('GET', '/api/cards', 'user', 'default', ({ user }) => game.myCards(user));
  route('POST', '/api/cards/buy', 'user', 'default', async ({ user, body }) => game.buyCards(user, body.count));
  route('POST', '/api/claim', 'user', 'default', ({ user, body }) => game.claim(user, body.cardId));
  route('POST', '/api/verify', 'user', 'default', ({ user, body }) => game.verify(user, body.cardId));

  /* wallet */
  route('GET', '/api/ledger', 'user', 'default', async ({ user }) => {
    const rows = await repo.listLedger(user.id, 30);
    return rows.map((e) => ({ id: e.ref, kind: ledgerKind(e.kind), amount: e.amount / 100, label: ledgerLabel[e.kind], at: new Date(e.createdAt).getTime() }));
  });
  route('POST', '/api/payments/deposit', 'user', 'money', ({ user, body }) => { requireRealMoney(); return wallet.startDeposit(user, body.amount); });


  route('GET', '/api/payments/status/:txRef', 'user', 'money', async ({ user, params }) => {
    requireRealMoney();
    const r = await wallet.paymentStatus(user, decodeURIComponent(params.txRef));
    const fresh = await repo.findUserById(user.id);
    return { status: r.status, balance: fresh.balance / 100 };
  });
  route('GET', '/api/banks', 'user', 'default', () => chapa.banks());
  route('GET', '/api/withdrawals', 'user', 'default', async ({ user }) =>
    (await wallet.myWithdrawals(user)).map((w) => ({ id: w.id, amount: w.amount / 100, status: w.status, at: new Date(w.createdAt).getTime() })),
  );
  route('POST', '/api/withdrawals', 'user', 'money', async ({ user, body }) => {
    requireRealMoney();
    const w = await wallet.requestWithdrawal(user, body);
    const fresh = await repo.findUserById(user.id);
    return { id: w.id, status: w.status, balance: fresh.balance / 100 };
  });

  /* payment provider callbacks (public, but never trusted: every one re-verifies with Chapa) */
  route('GET', '/api/payments/chapa/callback', 'public', 'default', async ({ query }) => {
    const ref = query.get('trx_ref') ?? query.get('tx_ref');
    if (!config.realMoneyEnabled) return { ok: true, ignored: true };
    if (ref) await wallet.confirmDeposit(ref).catch((e) => (e instanceof HttpError ? null : Promise.reject(e)));
    return { ok: true };
  });
  route('POST', '/api/payments/chapa/webhook', 'public', 'default', async ({ rawBody, req }) => {
    if (!config.realMoneyEnabled) return { ok: true, ignored: true };
    if (!chapa.verifyWebhookSignature(rawBody, req.headers)) throw new HttpError(401, 'bad_signature', 'Invalid signature');
    const body = parseJson(rawBody);
    const ref = body.tx_ref ?? body.trx_ref ?? body.reference;
    if (typeof ref === 'string') await wallet.confirmDeposit(ref).catch((e) => (e instanceof HttpError ? null : Promise.reject(e)));
    return { ok: true };
  });

  /* admin */
  const admin = (method, path, handler, bucket = 'default') => route(method, path, 'admin', bucket, handler);
  admin('GET', '/api/admin/stats', () => repo.stats());
  admin('POST', '/api/admin/round/start', async () => (await game.startRound(), game.getPublicState()));
  admin('POST', '/api/admin/round/end', async () => (await game.endRound(), game.getPublicState()));
  admin('POST', '/api/admin/round/reset', async () => (await game.resetRound(), game.getPublicState()));
  admin('POST', '/api/admin/draw', async () => (await game.draw(), game.getPublicState()));
  admin('POST', '/api/admin/auto', async ({ body }) => (await game.setAuto(body.on === true, body.intervalSec), game.getPublicState()));
  admin('GET', '/api/admin/withdrawals', async ({ query }) =>
    (await wallet.listWithdrawals({ status: query.get('status') || undefined })).map((w) => ({
      id: w.id, userId: w.userId, amount: w.amount / 100, status: w.status, accountName: w.accountName,
      accountNumber: w.accountNumber, bankCode: w.bankCode, note: w.note, at: new Date(w.createdAt).getTime(),
    })),
  );
  const wd = (w) => ({ id: w.id, status: w.status });
  admin('POST', '/api/admin/withdrawals/:id/approve', async ({ params }) => { requireRealMoney(); return wd(await wallet.approveWithdrawal(params.id)); }, 'money');
  admin('POST', '/api/admin/withdrawals/:id/refresh', async ({ params }) => { requireRealMoney(); return wd(await wallet.refreshWithdrawal(params.id)); }, 'money');
  admin('POST', '/api/admin/withdrawals/:id/reject', async ({ params, body }) => { requireRealMoney(); return wd(await wallet.rejectWithdrawal(params.id, body.note)); }, 'money');

  /* local testing only: a fake Chapa checkout page */
  if (chapa.mock) {
    route('GET', '/mock/chapa/checkout', 'public', 'default', async ({ query }) => ({
      __html: `<!doctype html><meta charset="utf-8"><title>Mock Chapa</title><body style="font-family:sans-serif;max-width:360px;margin:60px auto;text-align:center">
        <h2>Mock Chapa checkout</h2><p>Reference: ${String(query.get('tx_ref')).replace(/[<>&"]/g, '')}</p>
        <a href="/mock/chapa/pay?tx_ref=${encodeURIComponent(query.get('tx_ref') ?? '')}" style="display:inline-block;padding:12px 24px;background:#D4AF37;color:#000;border-radius:8px;text-decoration:none;font-weight:bold">Pay (fake)</a>`,
    }));
    route('GET', '/mock/chapa/pay', 'public', 'default', async ({ query }) => {
      const ref = query.get('tx_ref');
      const p = chapa.mockPayments.get(ref);
      if (!p) throw new HttpError(404, 'unknown', 'Unknown reference');
      p.paid = true;
      return { __redirect: p.returnUrl };
    });
  }

  /* ───────────── server-sent events: live game state for everyone ───────────── */
  function stream(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const write = (state) => res.write(`event: game\ndata: ${JSON.stringify(state)}\n\n`);
    game.getPublicState().then(write).catch(() => undefined);
    const off = game.subscribe(write);
    const beat = setInterval(() => res.write(': keep-alive\n\n'), 25_000);
    req.on('close', () => {
      clearInterval(beat);
      off();
    });
  }

  /* ───────────── the website itself (static files + single-page fallback) ───────────── */
  const staticRoot = config.staticDir && fs.existsSync(path.join(config.staticDir, 'index.html')) ? path.resolve(config.staticDir) : null;

  function serveStatic(req, res, pathname) {
    if (!staticRoot || (req.method !== 'GET' && req.method !== 'HEAD')) return false;
    if (/^\/(api|mock)\//.test(pathname) || pathname === '/health') return false;
    let rel;
    try {
      rel = decodeURIComponent(pathname);
    } catch {
      return false;
    }
    if (rel.includes('\0')) return false;
    let file = path.resolve(staticRoot, '.' + path.sep + rel);
    if (file !== staticRoot && !file.startsWith(staticRoot + path.sep)) return false; // path traversal
    let stat = fs.existsSync(file) ? fs.statSync(file) : null;
    if (stat?.isDirectory()) {
      file = path.join(file, 'index.html');
      stat = fs.existsSync(file) ? fs.statSync(file) : null;
    }
    if (!stat) {
      if (path.extname(rel)) return false; // a missing asset is a real 404
      file = path.join(staticRoot, 'index.html'); // app routes like /wallet load the single page
      stat = fs.statSync(file);
    }
    const ext = path.extname(file).toLowerCase();
    const headers = {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    };
    if (ext === '.html') {
      headers['Content-Security-Policy'] = PAGE_CSP;
      headers['X-Frame-Options'] = 'DENY';
      headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
      if (config.prod) headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
    }
    res.writeHead(200, headers);
    if (req.method === 'HEAD') res.end();
    else fs.createReadStream(file).pipe(res);
    return true;
  }

  /* ───────────── request pipeline ───────────── */
  async function handle(req, res) {
    try {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'no-referrer');
      if (req.url?.startsWith('/api/') || req.url === '/health') res.setHeader('Cache-Control', 'no-store');
      applyCors(req, res);
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
      }

      const url = new URL(req.url ?? '/', 'http://localhost');
      const ip = clientIp(req);

      if (req.method === 'GET' && url.pathname === '/api/stream') {
        rateLimit(ip, 'default');
        return stream(req, res);
      }

      const match = routes
        .map((r) => ({ r, m: r.method === req.method ? url.pathname.match(r.re) : null }))
        .find((x) => x.m);
      if (!match) {
        if (serveStatic(req, res, url.pathname)) return;
        throw new HttpError(404, 'not_found', 'Not found');
      }
      const { r, m } = match;
      rateLimit(ip, r.bucket);

      let user = null;
      if (r.access !== 'public') {
        const header = String(req.headers.authorization ?? '');
        user = await auth.authenticate(header.startsWith('Bearer ') ? header.slice(7) : '');
        if (!user) throw new HttpError(401, 'unauthorized', 'Please sign in');
        if (r.access === 'admin' && user.role !== 'admin') throw new HttpError(403, 'forbidden', 'Admins only');
      }

      const rawBody = req.method === 'POST' ? await readBody(req) : '';
      const body = req.method === 'POST' && !url.pathname.endsWith('/webhook') ? parseJson(rawBody) : {};
      const params = Object.fromEntries(r.keys.map((k, i) => [k, m[i + 1]]));
      const out = await r.handler({ req, user, body, rawBody, params, query: url.searchParams });

      if (out && out.__html) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(out.__html);
      }
      if (out && out.__redirect) {
        res.writeHead(302, { Location: out.__redirect });
        return res.end();
      }
      return send(res, 200, out ?? { ok: true });
    } catch (e) {
      if (res.headersSent) return res.end();
      if (e instanceof HttpError) return send(res, e.status, { error: e.code, message: e.message });
      console.error('Unhandled error:', e);
      return send(res, 500, { error: 'server_error', message: 'Something went wrong' });
    }
  }

  return { handle, resetLimits: () => hits.clear(), close: () => clearInterval(sweep) };
}