import { useEffect, useState, type ReactNode } from 'react';
import { AdminApp } from '@/components/admin/AdminApp';
import { AppHeader } from '@/components/layout/AppHeader';
import { BottomNav, type TabId } from '@/components/layout/BottomNav';
import { PlayView } from '@/components/play/PlayView';
import { WalletView } from '@/components/wallet/WalletView';
import { VerifyView } from '@/components/verify/VerifyView';
import { AppSettingsProvider } from '@/context/AppSettingsContext';
import { BackendProvider } from '@/context/BackendContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { PlayerProvider } from '@/context/PlayerContext';
import { RoundProvider } from '@/context/RoundContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { SERVER_MODE } from '@/lib/api';
import { PaymentReturnBanner } from '@/server/PaymentReturnBanner';
import { ServerProviders } from '@/server/ServerProviders';

const ADMIN_HASH = '#host';

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
      <AppHeader onOpenWallet={() => setTab('wallet')} onOpenAdmin={onOpenAdmin} />
      <main className="mx-auto max-w-6xl px-4 pt-5 sm:pt-8">
        {tab === 'play' && <PlayView onGoToWallet={() => setTab('wallet')} />}
        {tab === 'wallet' && <WalletView onGoToPlay={() => setTab('play')} />}
        {tab === 'verify' && <VerifyView />}
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}

/** Local demo router. This tree is never used by the production build. */
function DemoRouter() {
  const hash = useHash();
  const openAdmin = () => { window.location.hash = ADMIN_HASH; };
  const closeAdmin = () => { window.location.hash = 'play'; };
  return hash === ADMIN_HASH ? <AdminApp onExit={closeAdmin} /> : <PlayerShell onOpenAdmin={openAdmin} />;
}

/** Production host route is guarded by the authenticated database role, not by the URL hash. */
function ServerRouter() {
  const hash = useHash();
  const { user } = useAuth();
  const closeAdmin = () => { window.location.hash = 'play'; };
  const openAdmin = () => {
    if (user?.role === 'admin') window.location.hash = ADMIN_HASH;
  };
  if (hash === ADMIN_HASH && user?.role !== 'admin') {
    return (
      <main className="grid min-h-screen place-items-center bg-black p-6 text-center text-white">
        <section className="max-w-md rounded-2xl border border-gold-500/40 bg-zinc-950 p-8">
          <h1 className="mb-3 text-xl font-bold text-gold-400">የሆስት ፈቃድ ያስፈልጋል</h1>
          <p className="mb-6 text-sm text-zinc-300">ይህ ክፍል ለተፈቀደለት ሆስት ብቻ ነው።</p>
          <button className="rounded-lg bg-gold-500 px-5 py-3 font-semibold text-black" onClick={closeAdmin}>ወደ ጨዋታ ተመለስ</button>
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
              <DemoRouter />
            </RoundProvider>
          </PlayerProvider>
        </BackendProvider>
      </LanguageProvider>
    </AppSettingsProvider>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center text-gold-500" role="status">…</div>;
  return user ? <>{children}</> : <AuthScreen />;
}

/** Production: server accounts, live game and database-backed host authorization. */
function ServerApp() {
  return (
    <AppSettingsProvider>
      <LanguageProvider>
        <AuthProvider>
          <AuthGate>
            <ServerProviders>
              <PaymentReturnBanner />
              <ServerRouter />
            </ServerProviders>
          </AuthGate>
        </AuthProvider>
      </LanguageProvider>
    </AppSettingsProvider>
  );
}

export default function App() {
  return SERVER_MODE ? <ServerApp /> : <DemoApp />;
}
