import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadConfig } from './config.js';
import { createMemoryRepo } from './db/memoryRepo.js';
import { createMongoRepo } from './db/mongoRepo.js';
import { createAuthService } from './services/authService.js';
import { createGameService } from './services/gameService.js';
import { createWalletService } from './services/walletService.js';
import { createChapa } from './payments/chapa.js';
import { createApp } from './http/app.js';


/**
 * Emergency safe mode: serves only the static maintenance page and health check.
 * It deliberately does not connect to MongoDB or expose account/payment/game APIs.
 */
export function createMaintenanceHandler() {
  const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
  const indexPath = path.join(publicDir, 'index.html');
  return (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'");
    if (req.url === '/health') {
      const body = JSON.stringify({ ok: true, mode: 'maintenance' });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
      return res.end(req.method === 'HEAD' ? undefined : body);
    }
    if ((req.method === 'GET' || req.method === 'HEAD') && (req.url === '/' || req.url === '/index.html')) {
      let body;
      try {
        body = fs.readFileSync(indexPath);
      } catch {
        body = Buffer.from('Black Gold Bingo PRO is temporarily unavailable.');
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': body.length });
      return res.end(req.method === 'HEAD' ? undefined : body);
    }
    if (req.url?.startsWith('/api/')) {
      const body = JSON.stringify({ error: 'maintenance', message: 'The service is temporarily unavailable while security checks are completed.' });
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
      return res.end(req.method === 'HEAD' ? undefined : body);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  };
}

function startMaintenanceMode() {
  const server = http.createServer(createMaintenanceHandler());
  const port = Number(process.env.PORT || 10000);
  server.listen(port, '0.0.0.0', () => {
    console.log(`Black Gold Bingo is in safe maintenance mode on port ${port}`);
  });
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  return server;
}

/**
 * Compose the application for production, local development and tests.
 * No database records are deleted during startup.
 */
export async function build(config = loadConfig()) {
  const repo = config.storage === 'mongo'
    ? await createMongoRepo({ uri: config.mongoUri, dbName: config.dbName })
    : createMemoryRepo();

  try {
    await repo.init();
    const auth = createAuthService({ repo, config });

    if (config.adminPhone && config.adminPin) {
      const status = await auth.ensureAdmin({
        phone: config.adminPhone,
        pin: config.adminPin,
        name: config.adminName,
      });
      if (status === 'invalid') throw new Error('ADMIN_PHONE or ADMIN_PIN is invalid');
    }

    const chapa = createChapa({
      ...config.chapa,
      publicApiUrl: config.publicApiUrl,
    });
    const game = createGameService({ repo, config });
    const wallet = createWalletService({ repo, config, chapa });
    const app = createApp({ config, auth, game, wallet, chapa, repo });

    await game.resume();
    return { config, repo, auth, game, wallet, chapa, app };
  } catch (error) {
    await repo.close().catch(() => undefined);
    throw error;
  }
}

async function main() {
  const config = loadConfig();
  const ctx = await build(config);
  const server = http.createServer((req, res) => ctx.app.handle(req, res));

  server.listen(config.port, '0.0.0.0', () => {
    console.log(`Black Gold Bingo listening on port ${config.port} (storage: ${ctx.repo.kind})`);
  });

  let closing = false;
  const shutdown = () => {
    if (closing) return;
    closing = true;
    console.log('Shutting down Black Gold Bingo...');
    ctx.game.stop();
    ctx.app.close();
    server.close(async () => {
      await ctx.repo.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (/^(1|true|yes)$/i.test(process.env.MAINTENANCE_MODE ?? '')) {
    startMaintenanceMode();
  } else main().catch((error) => {
    console.error('Black Gold Bingo failed to start:', error);
    process.exit(1);
  });
}
