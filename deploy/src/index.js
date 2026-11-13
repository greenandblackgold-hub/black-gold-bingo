import http from 'node:http';
import { loadConfig } from './config.js';
import { createApp } from './http/app.js';
import { createAuthService } from './services/authService.js';
import { createGameService } from './services/gameService.js';
import { createWalletService } from './services/walletService.js';
import { createChapa } from './payments/chapa.js';
import { createMemoryRepo } from './db/memoryRepo.js';

export async function createRepo(config) {
  if (config.storage === 'mongo') {
    const { createMongoRepo } = await import('./db/mongoRepo.js');
    return createMongoRepo({ uri: config.mongoUri, dbName: config.dbName });
  }
  return createMemoryRepo();
}

/** Wires everything together. Used by `npm start` and by the tests. */
export async function build(config, { repo, chapa } = {}) {
  const r = repo ?? (await createRepo(config));
  await r.init();
  const c = chapa ?? createChapa({ ...config.chapa, publicApiUrl: config.publicApiUrl });
  const auth = createAuthService({ repo: r, config });
  const game = createGameService({ repo: r, config });
  const wallet = createWalletService({ repo: r, config, chapa: c });
  const app = createApp({ config, auth, game, wallet, chapa: c, repo: r });
  await game.resume();
  if (config.adminPhone) {
    const result = await auth.ensureAdmin({ phone: config.adminPhone, pin: config.adminPin, name: config.adminName });
    if (result !== 'ok') console.log(`Owner account (${config.adminPhone}): ${result}`);
  } else if (config.prod) {
    console.warn('WARNING: ADMIN_PHONE / ADMIN_PIN are not set, so there is no owner account to sign in to the Control Center.');
  }
  return { repo: r, chapa: c, auth, game, wallet, app };
}

async function main() {
  process.on('unhandledRejection', (e) => console.error('Unhandled promise rejection:', e));
  const config = loadConfig();
  const ctx = await build(config);
  const server = http.createServer((req, res) => ctx.app.handle(req, res));
  server.listen(config.port, () => {
    console.log(`Bingo API on :${config.port} (${config.nodeEnv}, storage=${ctx.repo.kind}, chapa=${ctx.chapa.mock ? 'MOCK' : 'live'})`);
    if (ctx.repo.kind === 'memory') console.warn('WARNING: in-memory storage. Data is lost on restart. Use STORAGE=mongo in production.');
  });

  const shutdown = async (signal) => {
    console.log(`${signal}: shutting down`);
    ctx.game.stop();
    server.close();
    await ctx.repo.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
