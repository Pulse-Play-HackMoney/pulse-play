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
  const { balance, refreshBalance } = useClearnode();

  if (balance === null) {
    return (
      <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="account-balance-not-connected">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">Balance</h2>
        <p className="text-text-secondary text-sm">Authenticate to view balance</p>
      </div>
    );
  }

  return (
    <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="account-balance-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary">Balance</h2>
        <button
          onClick={() => refreshBalance()}
          className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          data-testid="account-refresh-button"
        >
          Refresh
        </button>
      </div>

      <div className="text-3xl font-bold text-text-primary" data-testid="account-balance">
        ${formatBalance(balance ?? '0')}
      </div>
      <p className="text-xs text-text-muted mt-1">ytest.usd</p>
    </div>
  );
}
