import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.js';
import { createMemoryRepo } from './db/memoryRepo.js';
import { createMongoRepo } from './db/mongoRepo.js';
import { createAuthService } from './services/authService.js';
import { createGameService } from './services/gameService.js';
import { createWalletService } from './services/walletService.js';
import { createChapa } from './payments/chapa.js';
import { createApp } from './http/app.js';

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
  main().catch((error) => {
    console.error('Black Gold Bingo failed to start:', error);
    process.exit(1);
  });
}
