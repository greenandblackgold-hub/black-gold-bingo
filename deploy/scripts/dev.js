/**
 * Local sandbox: in-memory database, fake Chapa, and a ready-made admin account.
 *   npm run dev      ->  API on http://localhost:8080
 * Admin login: phone 0900000001, PIN 654321. Data is lost when you stop it.
 */
import http from 'node:http';
import { loadConfig } from '../src/config.js';
import { build } from '../src/index.js';

const config = loadConfig({ ...process.env, STORAGE: 'memory', CHAPA_MOCK: 'true', NODE_ENV: 'development', ADMIN_PHONE: '0900000001', ADMIN_PIN: '654321', ADMIN_NAME: 'Dev Admin' });
const ctx = await build(config);
http.createServer((req, res) => ctx.app.handle(req, res)).listen(config.port, () => {
  console.log(`Dev API on http://localhost:${config.port}  (admin: 0900000001 / 654321, fake Chapa, memory storage)`);
});
