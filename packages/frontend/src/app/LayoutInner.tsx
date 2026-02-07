'use client';

import { WagmiProvider, useWallet } from '@/providers/WagmiProvider';
import { ClearnodeProvider } from '@/providers/ClearnodeProvider';
import { WebSocketProvider } from '@/providers/WebSocketProvider';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { BetResultToast } from '@/components/bettor/BetResultToast';

function Providers({ children }: { children: React.ReactNode }) {
  const { address } = useWallet();

  return (
    <ClearnodeProvider>
      <WebSocketProvider address={address}>
        {children}
        <BetResultToast />
      </WebSocketProvider>
    </ClearnodeProvider>
  );
}

export function LayoutInner({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider>
      <Providers>
        <div className="min-h-screen bg-surface flex flex-col">
          <Header />
          <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full">{children}</main>
          <Footer />
        </div>
      </Providers>
    </WagmiProvider>
  );
}
