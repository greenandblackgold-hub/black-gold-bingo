import { lazy, Suspense, useEffect, useState, type ReactNode, type FormEvent } from 'react';
import { translations } from '@/lib/localization';
import { adminSimpleLocale } from '@/lib/adminSimpleLocalization';
import { useLanguage } from '@/context/LanguageContext';
import { AudioCallAnnouncer } from '@/components/audio/AudioCallAnnouncer';
import { PlayerFeatures } from '@/components/play/PlayerFeatures';
import { GamesCenter } from '@/components/games/GamesCenter';
import { AppHeader } from '@/components/layout/AppHeader';
import { BottomNav } from '@/components/layout/BottomNav';
import { HelpCenter } from '@/components/help/HelpCenter';
import { KenoGame } from '@/components/games/KenoGame';
import { AviatorGame } from '@/components/games/AviatorGame';
import { MinesGame } from '@/components/games/MinesGame';
import type { TabId } from '@/components/layout/BottomNav';
import { AppSettingsProvider } from '@/context/AppSettingsContext';
import { BackendProvider } from '@/context/BackendContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { PlayerProvider } from '@/context/PlayerContext';
import { RoundProvider } from '@/context/RoundContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { api, SERVER_MODE } from '@/lib/api';
import { ServerProviders } from '@/server/ServerProviders';

const ADMIN_HASH = '#host';

const AdminApp = lazy(() => import('@/components/admin/AdminApp').then((m) => ({ default: m.AdminApp })));
const PlayView = lazy(() => import('@/components/play/PlayView').then((m) => ({ default: m.PlayView })));
const WalletView = lazy(() => import('@/components/wallet/WalletView').then((m) => ({ default: m.WalletView })));
const AuthScreen = lazy(() => import('@/components/auth/AuthScreen').then((m) => ({ default: m.AuthScreen })));
const PaymentReturnBanner = lazy(() => import('@/server/PaymentReturnBanner').then((m) => ({ default: m.PaymentReturnBanner })));

function RouteLoading() {
  return <div className="grid min-h-[12rem] place-items-center text-sm text-gold-400" role="status" aria-live="polite">…</div>;
}

function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

/** Player app: Play, Wallet and Menu. */
function PlayerShell({ onOpenAdmin, onLogout }: { onOpenAdmin: () => void; onLogout: () => void }) {
  const { lang } = useLanguage();
  const appText = (key: string) => adminSimpleLocale('app', lang, key);
  type PlayerScreen = TabId | 'keno' | 'aviator' | 'mines' | 'help';
  const hash = useHash();
  const readScreenFromHash = (value: string): PlayerScreen => {
    const screen = value.replace(/^#/, '');
    return screen === 'play' || screen === 'wallet' || screen === 'games' || screen === 'keno' || screen === 'aviator' || screen === 'mines' || screen === 'help'
      ? screen
      : screen === '' ? 'help' : 'games';
  };
  const [tab, setTab] = useState<PlayerScreen>(() => readScreenFromHash(window.location.hash));
  useEffect(() => {
    // Restore the selected player screen when a URL hash changes (including browser back/forward).
    if (hash !== ADMIN_HASH) setTab(readScreenFromHash(hash));
  }, [hash]);
  useEffect(() => {
    // Keep the current screen in the URL so a page refresh returns to the same section.
    const nextHash = `#${tab}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`);
    }
  }, [tab]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [playerSettingsOpen, setPlayerSettingsOpen] = useState(false);
  const [generalEnabled, setGeneralEnabled] = useState(true);
  const [minesEnabled, setMinesEnabled] = useState(true);
  useEffect(() => {
    if (!SERVER_MODE) return;
    let active = true;
    let pending = false;
    let refreshQueued = false;
    const refresh = async () => {
      if (pending) { refreshQueued = true; return; }
      pending = true;
      try {
        const value = await api.get<{ generalEnabled: boolean; minesEnabled?: boolean }>('/api/games/settings');
        if (active) { setGeneralEnabled(value.generalEnabled !== false); setMinesEnabled(value.minesEnabled !== false); }
      } catch {
        // Keep the last confirmed state during temporary network failures.
      } finally {
        pending = false;
        if (active && refreshQueued) {
          refreshQueued = false;
          void refresh();
        }
      }
    };
    const onAdminChange = () => void refresh();
    void refresh();
    window.addEventListener('bgb:admin-change', onAdminChange);
    // Recovery fallback for missed SSE events or a temporarily disconnected network.
    const poll = window.setInterval(() => void refresh(), 30_000);
    return () => {
      active = false;
      window.clearInterval(poll);
      window.removeEventListener('bgb:admin-change', onAdminChange);
    };
  }, []);
  useEffect(() => {
    if (!generalEnabled) { setMenuOpen(false); setPlayerSettingsOpen(false); }
  }, [generalEnabled]);
  useEffect(() => {
    if (SERVER_MODE && !minesEnabled && tab === 'mines') setTab('games');
  }, [minesEnabled, tab]);
  const handleNavChange = (next: TabId) => {
    if (next === 'menu') { setMenuOpen(true); return; }
    setMenuOpen(false);
    setTab(next);
  };
  return (
    <div className="premium-ui min-h-screen">
      <AudioCallAnnouncer enabled={tab === 'play'} />
      {generalEnabled && tab !== 'help' && <AppHeader onOpenWallet={() => setTab('wallet')} onOpenAdmin={onOpenAdmin} onLogout={onLogout} onOpenMenu={() => setMenuOpen(true)} onOpenSettings={() => setPlayerSettingsOpen(true)} hideControls={tab === 'play'} />}
      <main className={!generalEnabled ? 'mx-auto w-full max-w-6xl px-4 pt-4' : tab === 'help' ? 'mx-auto w-full max-w-none px-0 pt-0 pb-0' : tab === 'keno' || tab === 'mines' ? 'mx-auto w-full max-w-none px-0 pt-0 pb-28' : tab === 'play' ? 'mx-auto w-full max-w-none px-2 pt-2 pb-28 sm:px-4 sm:pt-4' : tab === 'aviator' ? 'mx-auto w-full max-w-6xl px-3 pt-4 pb-28 sm:px-4 sm:pt-6' : 'mx-auto max-w-6xl px-4 pt-5 pb-28 sm:pt-8'}>
        {(tab === 'games' || (!generalEnabled && tab !== 'help')) && <GamesCenter serverMode={SERVER_MODE} onOpenBingo={() => setTab('play')} onOpenKeno={() => setTab('keno')} onOpenAviator={() => setTab('aviator')} onOpenMines={() => setTab('mines')} onOpenHelp={() => setTab('help')} />}
        {tab === 'help' && <HelpCenter onEnterGames={() => setTab('games')} />}
        {generalEnabled && tab === 'play' && <Suspense fallback={<RouteLoading />}><PlayView onGoToWallet={() => setTab('wallet')} settingsOpen={playerSettingsOpen} onSettingsOpenChange={setPlayerSettingsOpen} /></Suspense>}
        {generalEnabled && tab === 'keno' && <KenoGame onBack={() => setTab('games')} onSwitchGame={(game) => setTab(game === 'bingo' ? 'play' : game)} onOpenMenu={() => setMenuOpen(true)} />}
        {generalEnabled && tab === 'aviator' && <AviatorGame onBack={() => setTab('games')} onSwitchGame={(game) => setTab(game === 'bingo' ? 'play' : game)} />}
        {generalEnabled && tab === 'mines' && <MinesGame onBack={() => setTab('games')} onSwitchGame={(game) => setTab(game === 'bingo' ? 'play' : game)} />}
        {generalEnabled && tab === 'wallet' && <Suspense fallback={<RouteLoading />}><WalletView onGoToPlay={() => setTab('play')} /></Suspense>}
      </main>
      {generalEnabled && menuOpen && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={appText("menu")}>
        <section className="relative flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-amber-400/35 bg-[#090909] shadow-[0_24px_90px_rgba(0,0,0,.8)] sm:rounded-3xl">
          <header className="flex shrink-0 items-center justify-between border-b border-amber-400/20 bg-gradient-to-r from-zinc-950 via-zinc-900 to-amber-950 px-5 py-4">
            <div><p className="text-[10px] font-bold uppercase tracking-[.28em] text-amber-400">BLACK GOLD PLC · GAMES CENTER</p><h2 className="mt-1 text-lg font-black text-amber-100">{appText("menu")}</h2></div>
            <button type="button" onClick={() => setMenuOpen(false)} aria-label={appText("closeMenu")} className="rounded-xl border border-amber-300/30 bg-black/40 px-4 py-2 text-sm font-bold text-amber-200 hover:bg-amber-400/10">{appText("closeMenu")} ✕</button>
          </header>
          <div className="overflow-y-auto overscroll-contain px-4 pb-6"><PlayerFeatures onGoToWallet={() => { setMenuOpen(false); setTab('wallet'); }} menuOnly /></div>
        </section>
      </div>}
      {generalEnabled && tab !== 'help' && <BottomNav active={menuOpen ? 'menu' : tab === 'aviator' || tab === 'play' || tab === 'keno' || tab === 'mines' ? 'games' : tab} onChange={handleNavChange} />}
    </div>
  );
}

/** Local demo router. This tree is never used by the production build. */
function DemoRouter() {
  const hash = useHash();
  const openAdmin = () => { window.location.hash = ADMIN_HASH; };
  const closeAdmin = () => { window.location.hash = 'play'; };
  return hash === ADMIN_HASH ? <Suspense fallback={<RouteLoading />}><AdminApp onExit={closeAdmin} /></Suspense> : <PlayerShell onOpenAdmin={openAdmin} onLogout={() => { window.location.hash = ''; }} />;
}

/** Production host route is guarded by the authenticated database role, not by the URL hash. */
function ServerRouter() {
  const hash = useHash();
  const { user, logout } = useAuth();
  const { lang } = useLanguage();
  const accessText = translations.serverAccess[lang];
  const closeAdmin = () => { window.location.hash = 'play'; };
  const openAdmin = () => {
    if (user?.role === 'admin') window.location.hash = ADMIN_HASH;
  };
  if (hash === ADMIN_HASH && user?.role !== 'admin') {
    return (
      <main className="premium-ui grid min-h-screen place-items-center bg-black p-6 text-center text-white">
        <section className="max-w-md rounded-2xl border border-gold-500/40 bg-zinc-950 p-8">
          <h1 className="mb-3 text-xl font-bold text-gold-400">{accessText.title}</h1>
          <p className="mb-6 text-sm text-zinc-300">{accessText.message}</p>
          <button className="rounded-lg bg-gold-500 px-5 py-3 font-semibold text-black" onClick={closeAdmin}>{accessText.back}</button>
        </section>
      </main>
    );
  }
  return hash === ADMIN_HASH ? <AdminApp onExit={closeAdmin} /> : <PlayerShell onOpenAdmin={openAdmin} onLogout={() => { window.location.hash = ''; logout(); }} />;
}

/** Demo tree: browser-only data, no real accounts or money. */
function DemoApp() {
  return (
    <AppSettingsProvider>
      <LanguageProvider>
        <BackendProvider>
          <PlayerProvider>
            <RoundProvider>
              <DemoRouter />
            </RoundProvider>
          </PlayerProvider>
        </BackendProvider>
      </LanguageProvider>
    </AppSettingsProvider>
  );
}

function PhoneVerificationGate() {
  const { user, refresh, logout } = useAuth();
  const { lang } = useLanguage();
  const appText = (key: string) => adminSimpleLocale('app', lang, key);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await api.post('/api/auth/phone-otp/verify', { code }); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : appText('invalidCode')); }
    finally { setBusy(false); }
  };
  return <main className="premium-ui grid min-h-screen place-items-center bg-darkbg px-5 text-gold-100"><form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl bg-cardbg p-6 ring-1 ring-gold-500/40">
    <h1 className="text-xl font-bold text-gold-400">{appText("phoneTitle")}</h1>
    <p className="text-sm text-gold-200/80">{appText("phoneHelp")}</p>
    <p className="text-sm text-gold-500">{user?.phone}</p>
    <input aria-label={appText("code")} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} className="w-full rounded-xl bg-black/30 p-3 text-center text-2xl tracking-[0.5em] text-gold-200" />
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    <button disabled={busy || code.length!==6} className="w-full rounded-xl bg-gold-500 p-3 font-bold text-black disabled:opacity-50">{busy ? appText('verifying') : appText('verify')}</button>
    <button type="button" onClick={logout} className="w-full p-2 text-sm text-gold-400">{appText("logout")}</button>
  </form></main>;
}

function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { lang } = useLanguage();
  const appText = (key: string) => adminSimpleLocale('app', lang, key);
  if (loading) return <div className="grid min-h-screen place-items-center text-gold-500" role="status">{appText("loading")}</div>;
  if (!user) return <Suspense fallback={<RouteLoading />}><AuthScreen /></Suspense>;
  if (user.role === 'player' && user.phoneVerified === false) return <PhoneVerificationGate />;
  return <>{children}</>;
}

/** Production: server accounts, live game and database-backed host authorization. */
function ServerApp() {
  return (
    <AppSettingsProvider>
      <LanguageProvider>
        <ToastProvider>
        <AuthProvider>
          <AuthGate>
            <ServerProviders>
              <Suspense fallback={null}><PaymentReturnBanner /></Suspense>
              <ServerRouter />
            </ServerProviders>
          </AuthGate>
        </AuthProvider>
        </ToastProvider>
      </LanguageProvider>
    </AppSettingsProvider>
  );
}

export default function App() {
  return SERVER_MODE ? <ServerApp /> : <DemoApp />;
}
