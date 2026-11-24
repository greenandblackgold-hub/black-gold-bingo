import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { execFileSync } from 'node:child_process';

const appBuildId = process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA || (() => {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'local';
  }
})();

export default defineConfig({
  plugins: [react()],
  // Embed the Render commit so backend-only releases also invalidate stale player tabs.
  define: {
    __APP_BUILD_ID__: JSON.stringify(appBuildId),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { host: true },
});
