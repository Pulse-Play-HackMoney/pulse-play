'use client';

import { useState, useEffect, useCallback } from 'react';
import { getMMInfo } from '@/lib/api';
import type { MMInfoResponse } from '@/lib/types';

interface MMBalanceCardProps {
  className?: string;
  refreshKey?: number;
}

function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatBalance(raw: string): string {
  const num = Number(raw) / 1_000_000;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function MMBalanceCard({ className = '', refreshKey }: MMBalanceCardProps) {
  const [info, setInfo] = useState<MMInfoResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchInfo = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMMInfo();
      setInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch MM info');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo, refreshKey]);

  const handleCopy = async () => {
    if (!info?.address) return;
    try {
      await navigator.clipboard.writeText(info.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  };

  if (isLoading && !info) {
    return (
      <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="mm-balance-loading">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">Market Maker</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-surface-input rounded w-3/4" />
          <div className="h-8 bg-surface-input rounded w-1/2" />
          <div className="h-4 bg-surface-input rounded w-1/3" />
        </div>
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="mm-balance-error">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">Market Maker</h2>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-sm text-red-400">
          {error}
        </div>
        <button
          onClick={fetchInfo}
          className="w-full py-2 rounded-lg font-medium bg-surface-input hover:bg-surface-overlay text-text-primary transition-colors"
          data-testid="mm-balance-retry"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="mm-balance-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary">Market Maker</h2>
        <button
          onClick={fetchInfo}
          disabled={isLoading}
          className="text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          data-testid="mm-refresh-button"
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-text-secondary">Address</span>
          <button
            onClick={handleCopy}
            className="font-mono text-text-primary hover:text-accent transition-colors"
            title={info?.address}
            data-testid="mm-address"
          >
            {copied ? 'Copied!' : truncateAddress(info?.address ?? '')}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-text-secondary">Balance</span>
          <span className="text-text-primary text-lg font-semibold" data-testid="mm-balance">
            ${formatBalance(info?.balance ?? '0')}
          </span>
        </div>
      </div>
    </div>
  );
}
