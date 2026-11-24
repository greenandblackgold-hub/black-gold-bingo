import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  // Embed the Render commit so backend-only releases also invalidate stale player tabs.
  define: {
    __APP_BUILD_ID__: JSON.stringify(process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA || 'local'),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { host: true },
});
