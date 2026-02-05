'use client';

import { useClearnode } from '@/providers/ClearnodeProvider';

interface AccountBalanceCardProps {
  className?: string;
  refreshKey?: number;
}

function formatBalance(raw: string): string {
  const num = Number(raw) / 1_000_000;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function AccountBalanceCard({ className = '' }: AccountBalanceCardProps) {
  const { status, balance, refreshBalance } = useClearnode();

  const isConnected = status === 'connected';

  if (!isConnected) {
    return (
      <div className={`bg-gray-800 rounded-lg p-6 ${className}`} data-testid="account-balance-not-connected">
        <h2 className="text-lg font-semibold text-white mb-4">Balance</h2>
        <p className="text-gray-400 text-sm">Connect wallet to view balance</p>
      </div>
    );
  }

  return (
    <div className={`bg-gray-800 rounded-lg p-6 ${className}`} data-testid="account-balance-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Balance</h2>
        <button
          onClick={() => refreshBalance()}
          className="text-sm text-gray-400 hover:text-white transition-colors"
          data-testid="account-refresh-button"
        >
          Refresh
        </button>
      </div>

      <div className="text-3xl font-bold text-white" data-testid="account-balance">
        ${formatBalance(balance ?? '0')}
      </div>
      <p className="text-xs text-gray-500 mt-1">ytest.usd</p>
    </div>
  );
}
