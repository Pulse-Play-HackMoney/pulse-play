'use client';

import { WagmiProvider, useWallet } from '@/providers/WagmiProvider';
import { ClearnodeProvider } from '@/providers/ClearnodeProvider';
import { WebSocketProvider } from '@/providers/WebSocketProvider';
import { MarketProvider } from '@/providers/MarketProvider';
import { Header } from '@/components/Header';
import { BetResultToast } from '@/components/bettor/BetResultToast';

function Providers({ children }: { children: React.ReactNode }) {
  const { address } = useWallet();

  return (
    <ClearnodeProvider>
      <WebSocketProvider address={address}>
        <MarketProvider>
          {children}
          <BetResultToast />
        </MarketProvider>
      </WebSocketProvider>
    </ClearnodeProvider>
  );
}

export function LayoutInner({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider>
      <Providers>
        <div className="min-h-screen bg-gray-950">
          <Header />
          <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
        </div>
      </Providers>
    </WagmiProvider>
  );
}
