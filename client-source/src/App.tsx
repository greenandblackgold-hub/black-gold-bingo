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

/** Player app: Play, Wallet and Verify only. It contains no host controls. */
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

/** Routes by hash: the Control Center lives at #host, everything else is the player app. */
function Router() {
  const hash = useHash();
  const openAdmin = () => {
    window.location.hash = ADMIN_HASH;
  };
  const closeAdmin = () => {
    window.location.hash = 'play';
  };
  return hash === ADMIN_HASH ? <AdminApp onExit={closeAdmin} /> : <PlayerShell onOpenAdmin={openAdmin} />;
}

/** Demo tree: everything runs in the browser (no accounts, no real money). */
function DemoApp() {
  return (
    <AppSettingsProvider>
      <LanguageProvider>
        <BackendProvider>
          <PlayerProvider>
            <RoundProvider>
              <Router />
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

/** Production tree: accounts, server-held wallets and cards, Chapa payments, live game over SSE. */
function ServerApp() {
  return (
    <AppSettingsProvider>
      <LanguageProvider>
        <AuthProvider>
          <AuthGate>
            <ServerProviders>
              <PaymentReturnBanner />
              <Router />
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
