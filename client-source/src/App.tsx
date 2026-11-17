import { lazy, Suspense, useEffect, useState, type ReactNode, type FormEvent } from 'react';
import { translations } from '@/lib/localization';
import { useLanguage } from '@/context/LanguageContext';
import { AudioCallAnnouncer } from '@/components/audio/AudioCallAnnouncer';
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
const AppHeader = lazy(() => import('@/components/layout/AppHeader').then((m) => ({ default: m.AppHeader })));
const BottomNav = lazy(() => import('@/components/layout/BottomNav').then((m) => ({ default: m.BottomNav })));
const PlayView = lazy(() => import('@/components/play/PlayView').then((m) => ({ default: m.PlayView })));
const WalletView = lazy(() => import('@/components/wallet/WalletView').then((m) => ({ default: m.WalletView })));
const VerifyView = lazy(() => import('@/components/verify/VerifyView').then((m) => ({ default: m.VerifyView })));
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

/** Player app: Play, Wallet and Verify only. */
function PlayerShell({ onOpenAdmin }: { onOpenAdmin: () => void }) {
  const [tab, setTab] = useState<TabId>(() => (window.location.hash === '#wallet' ? 'wallet' : 'play'));
  return (
    <div className="min-h-screen pb-28">
      <Suspense fallback={<RouteLoading />}><AppHeader onOpenWallet={() => setTab('wallet')} onOpenAdmin={onOpenAdmin} /></Suspense>
      <main className="mx-auto max-w-6xl px-4 pt-5 sm:pt-8">
        {tab === 'play' && <Suspense fallback={<RouteLoading />}><PlayView onGoToWallet={() => setTab('wallet')} /></Suspense>}
        {tab === 'wallet' && <Suspense fallback={<RouteLoading />}><WalletView onGoToPlay={() => setTab('play')} /></Suspense>}
        {tab === 'verify' && <Suspense fallback={<RouteLoading />}><VerifyView /></Suspense>}
      </main>
      <Suspense fallback={null}><BottomNav active={tab} onChange={setTab} /></Suspense>
    </div>
  );
}

/** Local demo router. This tree is never used by the production build. */
function DemoRouter() {
  const hash = useHash();
  const openAdmin = () => { window.location.hash = ADMIN_HASH; };
  const closeAdmin = () => { window.location.hash = 'play'; };
  return hash === ADMIN_HASH ? <Suspense fallback={<RouteLoading />}><AdminApp onExit={closeAdmin} /></Suspense> : <PlayerShell onOpenAdmin={openAdmin} />;
}

/** Production host route is guarded by the authenticated database role, not by the URL hash. */
function ServerRouter() {
  const hash = useHash();
  const { user } = useAuth();
  const { lang } = useLanguage();
  const accessText = translations.serverAccess[lang];
  const closeAdmin = () => { window.location.hash = 'play'; };
  const openAdmin = () => {
    if (user?.role === 'admin') window.location.hash = ADMIN_HASH;
  };
  if (hash === ADMIN_HASH && user?.role !== 'admin') {
    return (
      <main className="grid min-h-screen place-items-center bg-black p-6 text-center text-white">
        <section className="max-w-md rounded-2xl border border-gold-500/40 bg-zinc-950 p-8">
          <h1 className="mb-3 text-xl font-bold text-gold-400">{accessText.title}</h1>
          <p className="mb-6 text-sm text-zinc-300">{accessText.message}</p>
          <button className="rounded-lg bg-gold-500 px-5 py-3 font-semibold text-black" onClick={closeAdmin}>{accessText.back}</button>
        </section>
      </main>
    );
  }
  return hash === ADMIN_HASH ? <AdminApp onExit={closeAdmin} /> : <PlayerShell onOpenAdmin={openAdmin} />;
}

/** Demo tree: browser-only data, no real accounts or money. */
function DemoApp() {
  return (
    <AppSettingsProvider>
      <LanguageProvider>
        <BackendProvider>
          <PlayerProvider>
            <RoundProvider>
              <AudioCallAnnouncer />
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
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await api.post('/api/auth/phone-otp/verify', { code }); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'ኮዱ አልተቀበለም።'); }
    finally { setBusy(false); }
  };
  return <main className="grid min-h-screen place-items-center bg-darkbg px-5 text-gold-100"><form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl bg-cardbg p-6 ring-1 ring-gold-500/40">
    <h1 className="text-xl font-bold text-gold-400">ስልክዎን ያረጋግጡ</h1>
    <p className="text-sm text-gold-200/80">የማረጋገጫ ቁጥሩን ከአስተዳዳሪው በስልክ ጥሪ ይቀበሉ። SMS አይላክም።</p>
    <p className="text-sm text-gold-500">{user?.phone}</p>
    <input aria-label="6 digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))} className="w-full rounded-xl bg-black/30 p-3 text-center text-2xl tracking-[0.5em] text-gold-200" />
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    <button disabled={busy || code.length!==6} className="w-full rounded-xl bg-gold-500 p-3 font-bold text-black disabled:opacity-50">{busy ? 'በመፈተሽ ላይ…' : 'አረጋግጥ'}</button>
    <button type="button" onClick={logout} className="w-full p-2 text-sm text-gold-400">ውጣ</button>
  </form></main>;
}

function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center text-gold-500" role="status">…</div>;
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
