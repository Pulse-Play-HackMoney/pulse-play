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
      <div className={`bg-gray-800 rounded-lg p-6 ${className}`} data-testid="mm-balance-loading">
        <h2 className="text-lg font-semibold text-white mb-4">Market Maker</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-700 rounded w-3/4" />
          <div className="h-8 bg-gray-700 rounded w-1/2" />
          <div className="h-4 bg-gray-700 rounded w-1/3" />
        </div>
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className={`bg-gray-800 rounded-lg p-6 ${className}`} data-testid="mm-balance-error">
        <h2 className="text-lg font-semibold text-white mb-4">Market Maker</h2>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-sm text-red-400">
          {error}
        </div>
        <button
          onClick={fetchInfo}
          className="w-full py-2 rounded-lg font-medium bg-gray-700 hover:bg-gray-600 text-white transition-colors"
          data-testid="mm-balance-retry"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-6 ${className}`} data-testid="mm-balance-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Market Maker</h2>
        <button
          onClick={fetchInfo}
          disabled={isLoading}
          className="text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          data-testid="mm-refresh-button"
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Address</span>
          <button
            onClick={handleCopy}
            className="font-mono text-white hover:text-blue-400 transition-colors"
            title={info?.address}
            data-testid="mm-address"
          >
            {copied ? 'Copied!' : truncateAddress(info?.address ?? '')}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-400">Balance</span>
          <span className="text-white text-lg font-semibold" data-testid="mm-balance">
            ${formatBalance(info?.balance ?? '0')}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-400">Connection</span>
          <span
            className={`px-3 py-1 rounded text-sm font-medium ${
              info?.isConnected
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}
            data-testid="mm-connection-status"
          >
            {info?.isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
    </div>
  );
}
