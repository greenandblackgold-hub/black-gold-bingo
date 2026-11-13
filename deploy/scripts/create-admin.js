/**
 * Creates the owner/admin account:  npm run create-admin -- 0911223344 123456 "Owner Name"
 * Needs the same environment as the server (MONGODB_URI, JWT_SECRET...).
 */
import { loadConfig } from '../src/config.js';
import { createRepo } from '../src/index.js';
import { createAuthService } from '../src/services/authService.js';

const [phone, pin, ...nameParts] = process.argv.slice(2);
if (!phone || !pin) {
  console.error('Usage: npm run create-admin -- <phone> <6-digit-pin> [name]');
  process.exit(1);
}
const config = loadConfig();
if (config.storage === 'memory') {
  console.error('This needs a real database (set MONGODB_URI). The in-memory store is not shared with the running server.');
  process.exit(1);
}
const repo = await createRepo(config);
await repo.init();
try {
  const user = await createAuthService({ repo, config }).createAdmin({ phone, pin, name: nameParts.join(' ') || 'Owner' });
  console.log(`Admin created: ${user.phone} (${user.name})`);
} catch (e) {
  console.error('Failed:', e.message);
  process.exitCode = 1;
}
await repo.close();
