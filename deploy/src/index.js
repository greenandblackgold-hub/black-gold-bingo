import http from 'node:http';
import { loadConfig } from './config.js';
import { createMemoryRepo } from './db/memoryRepo.js';
import { createMongoRepo } from './db/mongoRepo.js';
import { createAuthService } from './services/authService.js';
import { createGameService } from './services/gameService.js';
import { createWalletService } from './services/walletService.js';
import { createChapa } from './payments/chapa.js';
import { createApp } from './http/app.js';

/** Select persistent MongoDB in production; memory storage is for tests/development only. */
export async function createRepo(config) {
  if (config.storage === 'mongo') {
    if (!config.mongoUri) throw new Error('MONGODB_URI is required for MongoDB storage');
    return createMongoRepo({ uri: config.mongoUri, dbName: config.dbName });
  }
  if (config.prod) throw new Error('Production cannot use in-memory storage');
  return createMemoryRepo();
}

/** Compose the production API and its services. Also used by the integration tests. */
export async function build(config = loadConfig()) {
  const repo = await createRepo(config);
  try {
    await repo.init();
    const auth = createAuthService({ repo, config });
    const game = createGameService({ repo, config });
    const chapa = createChapa({ ...config.chapa, publicApiUrl: config.publicApiUrl });
    const wallet = createWalletService({ repo, config, chapa });

    // Bootstrap the one owner account from private Render environment variables.
    // Never promote an existing player account; ensureAdmin deliberately fails closed.
    if (config.adminPhone || config.adminPin) {
      if (!config.adminPhone || !/^\d{6}$/.test(config.adminPin)) {
        throw new Error('ADMIN_PHONE and a six-digit ADMIN_PIN must both be configured');
      }
      await auth.ensureAdmin({ phone: config.adminPhone, pin: config.adminPin, name: config.adminName });
    }

    await game.resume();
    const app = createApp({ config, auth, game, wallet, chapa, repo });
    return { config, repo, auth, game, wallet, chapa, app };
  } catch (error) {
    gameStopIfCreated();
    await repo.close().catch(() => undefined);
    throw error;
  }

  function gameStopIfCreated() {
    // The game service is created before bootstrapping the owner; no timer is started until resume().
  }
}

if (process.env.NODE_ENV !== 'test') {
  const config = loadConfig();
  const ctx = await build(config);
  const server = http.createServer((req, res) => ctx.app.handle(req, res));
  server.listen(config.port, () => {
    console.log(`Black Gold Bingo PRO listening on port ${config.port}`);
  });

  const shutdown = async () => {
    server.close();
    ctx.game.stop();
    ctx.app.close();
    await ctx.repo.close();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
