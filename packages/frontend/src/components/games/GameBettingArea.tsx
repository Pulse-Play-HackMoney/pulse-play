'use client';

import { useState } from 'react';
import { useSelectedMarket } from '@/providers/SelectedMarketProvider';
import { useWallet } from '@/providers/WagmiProvider';
import { OddsDisplay, BetForm, PositionList } from '@/components/bettor';
import { OrderBookTable, PlaceOrderForm, UserOrders } from '@/components/orderbook';
import { AccountBalanceCard } from '@/components/account';

type BettingMode = 'lmsr' | 'orderbook';

interface GameBettingAreaProps {
  gameId: string;
}

export function GameBettingArea({ gameId }: GameBettingAreaProps) {
  const { market, outcomes } = useSelectedMarket();
  const { address } = useWallet();
  const [mode, setMode] = useState<BettingMode>('lmsr');

  const isBinary = outcomes.length === 2;
  const marketId = market?.id ?? '';

  return (
    <>
      {/* Mode toggle — only for binary markets */}
      {isBinary && (
        <div className="flex gap-1 bg-surface-input rounded-lg p-1 mb-6" data-testid="betting-mode-toggle">
          <button
            onClick={() => setMode('lmsr')}
            className={`flex-1 py-2 px-4 text-xs font-mono uppercase tracking-wider rounded-md transition-colors ${
              mode === 'lmsr'
                ? 'bg-accent text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            data-testid="mode-lmsr"
          >
            Market Maker
          </button>
          <button
            onClick={() => setMode('orderbook')}
            className={`flex-1 py-2 px-4 text-xs font-mono uppercase tracking-wider rounded-md transition-colors ${
              mode === 'orderbook'
                ? 'bg-accent text-white'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            data-testid="mode-orderbook"
          >
            Order Book
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {mode === 'lmsr' || !isBinary ? (
          <>
            <div className="lg:col-span-2 space-y-6" data-testid="lmsr-area">
              <OddsDisplay />
              <BetForm />
            </div>
            <div className="space-y-6">
              <AccountBalanceCard />
              <PositionList />
            </div>
          </>
        ) : (
          <>
            <div className="lg:col-span-2 space-y-6" data-testid="orderbook-area">
              <OrderBookTable marketId={marketId} outcomes={outcomes} />
              <PlaceOrderForm marketId={marketId} gameId={gameId} outcomes={outcomes} />
            </div>
            <div className="space-y-6">
              <AccountBalanceCard />
              {address && <UserOrders address={address} marketId={marketId} />}
            </div>
          </>
        )}
      </div>
    </>
  );
}
