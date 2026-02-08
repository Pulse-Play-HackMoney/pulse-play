'use client';

import { useState, useEffect, useCallback } from 'react';
import { getLPShare, ApiError } from '@/lib/api';
import { useWebSocket } from '@/providers/WebSocketProvider';
import type { LPShare, WsMessage } from '@/lib/types';

interface LPPositionCardProps {
  address: string | null;
  className?: string;
  refreshKey?: number;
}

function formatUsd(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function LPPositionCard({ address, className = '', refreshKey }: LPPositionCardProps) {
  const [share, setShare] = useState<LPShare | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noPosition, setNoPosition] = useState(false);
  const { subscribe } = useWebSocket();

  const fetchShare = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    setError(null);
    setNoPosition(false);
    try {
      const data = await getLPShare(address);
      setShare(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNoPosition(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch LP position');
      }
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchShare();
  }, [fetchShare, refreshKey]);

  // Re-fetch when LP events affect this user's position
  useEffect(() => {
    if (!address) return;
    return subscribe((message: WsMessage) => {
      if (
        ((message.type === 'LP_DEPOSIT' || message.type === 'LP_WITHDRAWAL') &&
          message.address === address) ||
        message.type === 'POOL_UPDATE'
      ) {
        fetchShare();
      }
    });
  }, [subscribe, address, fetchShare]);

  if (!address) {
    return (
      <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="lp-position-card">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">Your LP Position</h2>
        <p className="text-text-muted text-sm" data-testid="lp-connect-wallet">Connect wallet to view your LP position</p>
      </div>
    );
  }

  if (isLoading && !share) {
    return (
      <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="lp-position-loading">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">Your LP Position</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-surface-input rounded w-3/4" />
          <div className="h-8 bg-surface-input rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="lp-position-error">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">Your LP Position</h2>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-sm text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (noPosition) {
    return (
      <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="lp-position-card">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">Your LP Position</h2>
        <p className="text-text-muted text-sm" data-testid="lp-no-position">No LP position found. Deposit to get started.</p>
      </div>
    );
  }

  const pnl = share?.pnl ?? 0;
  const pnlColor = pnl >= 0 ? 'text-green-400' : 'text-red-400';
  const pnlPrefix = pnl >= 0 ? '+' : '';

  return (
    <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="lp-position-card">
      <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">Your LP Position</h2>

      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-text-secondary">Shares</span>
          <span className="text-text-primary" data-testid="lp-shares">
            {formatUsd(share?.shares ?? 0)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-text-secondary">Current Value</span>
          <span className="text-text-primary text-lg font-semibold" data-testid="lp-current-value">
            ${formatUsd(share?.currentValue ?? 0)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-text-secondary">Total Deposited</span>
          <span className="text-text-primary" data-testid="lp-total-deposited">
            ${formatUsd(share?.totalDeposited ?? 0)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-text-secondary">PnL</span>
          <span className={pnlColor} data-testid="lp-pnl">
            {pnlPrefix}${formatUsd(Math.abs(pnl))}
          </span>
        </div>
      </div>
    </div>
  );
}
