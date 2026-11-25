import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { createMemoryRepo } from './db/memoryRepo.js';
import { createMongoRepo } from './db/mongoRepo.js';
import { createAuthService } from './services/authService.js';
import { createGameService } from './services/gameService.js';
import { createBonusService } from './services/bonusService.js';
import { createPushService } from './services/pushService.js';
import { createWalletService } from './services/walletService.js';
import { createGamesHubService } from './services/gamesHubService.js';
import { createCarRacingDemoService } from './services/carRacingDemoService.js';
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
  let gamesHub = null;
  try {
    await repo.init();
    const auth = createAuthService({ repo, config });
    const game = createGameService({ repo, config });
    const push = createPushService({ repo, config });
    const bonus = createBonusService({ repo, game, config, push });
    const chapa = createChapa({ ...config.chapa, publicApiUrl: config.publicApiUrl });
    const wallet = createWalletService({ repo, config, chapa });
    gamesHub = createGamesHubService({ repo, config });
    const carRacing = createCarRacingDemoService({ isRealMoneyEnabled: () => config.realMoneyEnabled === true });

    // Bootstrap the one owner account from private Render environment variables.
    // Never promote an existing player account; ensureAdmin deliberately fails closed.
    if (config.adminPhone || config.adminPin) {
      if (!config.adminPhone || !/^\d{6}$/.test(config.adminPin)) {
        throw new Error('ADMIN_PHONE and a six-digit ADMIN_PIN must both be configured');
      }
      await auth.ensureAdmin({ phone: config.adminPhone, pin: config.adminPin, name: config.adminName });
    }

    await game.resume();
    await bonus.resume();
    await gamesHub.resume();
    const app = createApp({ config, auth, game, wallet, chapa, repo, push, gamesHub, carRacing });
    return { config, repo, auth, game, bonus, push, wallet, chapa, gamesHub, carRacing, app };
  } catch (error) {
    gamesHub?.stop();
    gameStopIfCreated();
    await repo.close().catch(() => undefined);
    throw error;
  }

  function gameStopIfCreated() {
    // The game service is created before bootstrapping the owner; no timer is started until resume().
  }
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (process.env.RUN_SERVER === 'true' && isMainModule) {
  const config = loadConfig();
  const ctx = await build(config);
  const server = http.createServer((req, res) => ctx.app.handle(req, res));
  server.listen(config.port, () => {
    console.log(`Black Gold Bingo PRO listening on port ${config.port}`);
  });

  const shutdown = async () => {
    server.close();
    ctx.game.stop();
    ctx.bonus.stop();
    ctx.gamesHub.stop();
    ctx.app.close();
    await ctx.repo.close();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
