'use client';

import { useState, useCallback, useEffect } from 'react';
import { useWallet } from '@/providers/WagmiProvider';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { getLPShare, getLPStats, ApiError } from '@/lib/api';
import type { WsMessage } from '@/lib/types';
import {
  MMFaucetCard,
  MMBalanceCard,
  MMFeeCard,
  PoolStatsCard,
  LPPositionCard,
  LPDepositForm,
  LPWithdrawForm,
  LPEventHistory,
} from '@/components/market-maker';

export default function MarketMakerPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [userShares, setUserShares] = useState(0);
  const [canWithdraw, setCanWithdraw] = useState(true);

  const { address } = useWallet();
  const walletAddress = address ?? null;
  const { subscribe } = useWebSocket();

  const fetchLPData = useCallback(async () => {
    try {
      const stats = await getLPStats();
      setCanWithdraw(stats.canWithdraw);
    } catch {
      // Non-critical
    }

    if (!walletAddress) {
      setUserShares(0);
      return;
    }

    try {
      const share = await getLPShare(walletAddress);
      setUserShares(share.shares);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setUserShares(0);
      }
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchLPData();
  }, [fetchLPData, refreshKey]);

  useEffect(() => {
    return subscribe((message: WsMessage) => {
      if (message.type === 'POOL_UPDATE') {
        setCanWithdraw(message.canWithdraw as boolean);
      }
      if (
        (message.type === 'LP_DEPOSIT' || message.type === 'LP_WITHDRAWAL') &&
        message.address === walletAddress
      ) {
        fetchLPData();
      }
    });
  }, [subscribe, walletAddress, fetchLPData]);

  const handleFunded = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleLPAction = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-mono uppercase tracking-wide text-text-primary">Liquidity Pool</h1>
        <p className="text-text-secondary mt-2">
          Provide liquidity and manage your LP position
        </p>
      </div>

      {/* LP Pool Section */}
      <div>
        <h2 className="text-lg font-bold font-mono uppercase tracking-wide text-text-primary mb-4">
          Liquidity Pool
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PoolStatsCard refreshKey={refreshKey} />
          <LPPositionCard address={walletAddress} refreshKey={refreshKey} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <LPDepositForm address={walletAddress} onDeposit={handleLPAction} />
          <LPWithdrawForm address={walletAddress} maxShares={userShares} canWithdraw={canWithdraw} onWithdraw={handleLPAction} />
        </div>

        <div className="mt-6">
          <LPEventHistory address={walletAddress ?? ''} refreshKey={refreshKey} />
        </div>
      </div>

      {/* Market Maker Section */}
      <div className="border-t border-border pt-6">
        <h2 className="text-lg font-bold font-mono uppercase tracking-wide text-text-primary mb-4">
          Market Maker
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <MMFaucetCard onFunded={handleFunded} />
          </div>
          <div className="space-y-6">
            <MMBalanceCard refreshKey={refreshKey} />
            <MMFeeCard />
          </div>
        </div>
      </div>
    </div>
  );
}
