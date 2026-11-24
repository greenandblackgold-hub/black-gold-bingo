import { StrictMode } from 'react';
import { Capacitor } from '@capacitor/core';
import { createRoot } from 'react-dom/client';
import { hasPendingApiRequests } from '@/lib/api';
import App from '@/App';
import './index.css';

// The server advertises the current Vite entry bundle over the existing SSE channel.
 // Defer automatic reload while a game, wallet flow, or admin screen is active.
const CLIENT_BUILD_PATH = new URL(import.meta.url).pathname;
let pendingAppUpdate = false;
const applyPendingAppUpdate = () => {
  const safeScreen = ['', '#games', '#help'].includes(window.location.hash);
  if (!pendingAppUpdate || !navigator.onLine || document.visibilityState !== 'visible' || !safeScreen || hasPendingApiRequests()) return;
  pendingAppUpdate = false;
  window.location.reload();
};
window.addEventListener('bgb:app-version', (event) => {
  const detail = (event as CustomEvent<{ buildPath?: string }>).detail;
  const buildChanged = detail?.buildId && detail.buildId !== 'unknown' && detail.buildId !== __APP_BUILD_ID__;
  const bundleChanged = detail?.buildPath && detail.buildPath !== 'unknown' && detail.buildPath !== CLIENT_BUILD_PATH;
  if (!Capacitor.isNativePlatform() && (buildChanged || bundleChanged)) {
    pendingAppUpdate = true;
    applyPendingAppUpdate();
  }
});
window.addEventListener('hashchange', applyPendingAppUpdate);
document.addEventListener('visibilitychange', applyPendingAppUpdate);
window.addEventListener('online', applyPendingAppUpdate);
// React updates the hash with history.replaceState, which does not emit hashchange.
window.setInterval(applyPendingAppUpdate, 3000);

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
