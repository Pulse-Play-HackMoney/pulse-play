'use client';

import { useState, useEffect, useCallback } from 'react';
import { getLPStats } from '@/lib/api';
import { useWebSocket } from '@/providers/WebSocketProvider';
import type { PoolStats, WsMessage } from '@/lib/types';

interface PoolStatsCardProps {
  className?: string;
  refreshKey?: number;
}

function formatUsd(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PoolStatsCard({ className = '', refreshKey }: PoolStatsCardProps) {
  const [stats, setStats] = useState<PoolStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { subscribe } = useWebSocket();

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getLPStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pool stats');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, refreshKey]);

  // Subscribe to real-time pool updates
  useEffect(() => {
    return subscribe((message: WsMessage) => {
      if (message.type === 'POOL_UPDATE') {
        setStats({
          poolValue: message.poolValue,
          totalShares: message.totalShares,
          sharePrice: message.sharePrice,
          lpCount: message.lpCount,
          canWithdraw: message.canWithdraw,
        });
      }
    });
  }, [subscribe]);

  if (isLoading && !stats) {
    return (
      <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="pool-stats-loading">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">Liquidity Pool</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-surface-input rounded w-3/4" />
          <div className="h-8 bg-surface-input rounded w-1/2" />
          <div className="h-4 bg-surface-input rounded w-1/3" />
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="pool-stats-error">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">Liquidity Pool</h2>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-sm text-red-400">
          {error}
        </div>
        <button
          onClick={fetchStats}
          className="w-full py-2 rounded-lg font-medium bg-surface-input hover:bg-surface-overlay text-text-primary transition-colors"
          data-testid="pool-stats-retry"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="pool-stats-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary">Liquidity Pool</h2>
        <button
          onClick={fetchStats}
          disabled={isLoading}
          className="text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          data-testid="pool-stats-refresh"
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-text-secondary">Pool Value</span>
          <span className="text-text-primary text-lg font-semibold" data-testid="pool-value">
            ${formatUsd(stats?.poolValue ?? 0)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-text-secondary">Total Shares</span>
          <span className="text-text-primary" data-testid="pool-total-shares">
            {formatUsd(stats?.totalShares ?? 0)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-text-secondary">Share Price</span>
          <span className="text-text-primary" data-testid="pool-share-price">
            ${formatUsd(stats?.sharePrice ?? 0)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-text-secondary">LP Count</span>
          <span className="text-text-primary" data-testid="pool-lp-count">
            {stats?.lpCount ?? 0}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-text-secondary">Withdrawals</span>
          <span
            className={stats?.canWithdraw ? 'text-green-400' : 'text-yellow-400'}
            data-testid="pool-withdraw-status"
          >
            {stats?.canWithdraw ? 'Enabled' : 'Locked'}
          </span>
        </div>
      </div>
    </div>
  );
}
