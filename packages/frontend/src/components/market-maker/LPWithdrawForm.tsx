'use client';

import { useState } from 'react';
import { withdrawLP } from '@/lib/api';

interface LPWithdrawFormProps {
  address: string | null;
  maxShares?: number;
  canWithdraw?: boolean;
  className?: string;
  onWithdraw?: () => void;
}

export function LPWithdrawForm({
  address,
  maxShares = 0,
  canWithdraw = true,
  className = '',
  onWithdraw,
}: LPWithdrawFormProps) {
  const [shares, setShares] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const numericShares = shares ? Number(shares) : 0;
  const isValid = numericShares > 0;

  const handleMax = () => {
    setShares(String(maxShares));
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async () => {
    if (!address || !isValid) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await withdrawLP(address, numericShares);
      setSuccess(`Withdrew $${result.amount.toFixed(2)} for ${numericShares} shares`);
      setShares('');
      onWithdraw?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Withdrawal failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!address) {
    return (
      <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="lp-withdraw-form">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">Withdraw from Pool</h2>
        <p className="text-text-muted text-sm" data-testid="lp-withdraw-connect">Connect wallet to withdraw</p>
      </div>
    );
  }

  if (!canWithdraw) {
    return (
      <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="lp-withdraw-form">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">Withdraw from Pool</h2>
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-400" data-testid="lp-withdraw-locked">
          Withdrawals are currently locked. Markets must be resolved before withdrawing.
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="lp-withdraw-form">
      <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">Withdraw from Pool</h2>

      <div className="mb-4">
        <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-2">Shares to Withdraw</label>
        <div className="flex gap-2">
          <input
            type="number"
            value={shares}
            onChange={(e) => {
              setShares(e.target.value);
              setError(null);
              setSuccess(null);
            }}
            placeholder="Enter shares"
            min={0}
            step="any"
            className="flex-1 bg-surface-input border border-border rounded-lg px-4 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
            data-testid="withdraw-shares-input"
          />
          <button
            onClick={handleMax}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-surface-input border border-border text-text-secondary hover:border-border-emphasis transition-colors"
            data-testid="withdraw-max-button"
          >
            Max
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-sm text-red-400" data-testid="withdraw-error">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4 text-sm text-green-400" data-testid="withdraw-success">
          {success}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!isValid || isSubmitting}
        className="w-full py-3 rounded-lg font-medium bg-accent hover:bg-accent-hover text-white disabled:bg-surface-input disabled:text-text-muted disabled:cursor-not-allowed transition-colors"
        data-testid="withdraw-submit"
      >
        {isSubmitting ? 'Withdrawing...' : isValid ? `Withdraw ${numericShares} shares` : 'Withdraw'}
      </button>
    </div>
  );
}
