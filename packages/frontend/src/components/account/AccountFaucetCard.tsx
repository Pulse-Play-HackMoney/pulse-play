'use client';

import { useState } from 'react';
import { useWallet } from '@/providers/WagmiProvider';
import { useClearnode } from '@/providers/ClearnodeProvider';
import { requestUserFaucet } from '@/lib/api';

interface AccountFaucetCardProps {
  className?: string;
  onFunded?: () => void;
}

const PRESET_AMOUNTS = [10, 50, 100, 500];

export function AccountFaucetCard({ className = '', onFunded }: AccountFaucetCardProps) {
  const { address } = useWallet();
  const { refreshBalance } = useClearnode();

  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const activeAmount = selectedAmount ?? (customAmount ? Number(customAmount) : null);
  const isValidAmount = activeAmount !== null && activeAmount > 0 && activeAmount % 10 === 0;

  const handlePresetClick = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
    setError(null);
    setSuccess(null);
    setWarning(null);
  };

  const handleCustomChange = (value: string) => {
    setCustomAmount(value);
    setSelectedAmount(null);
    setError(null);
    setSuccess(null);
    setWarning(null);
  };

  const handleFund = async () => {
    if (!isValidAmount || !activeAmount || !address) return;

    const count = activeAmount / 10;
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setWarning(null);

    try {
      const result = await requestUserFaucet(address, count);
      const fundedDollars = result.funded * 10;

      if (result.error) {
        setWarning(`Partially funded: $${fundedDollars} of $${activeAmount} (${result.error})`);
      } else {
        setSuccess(`Successfully funded $${fundedDollars}`);
      }

      onFunded?.();
      await refreshBalance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Faucet request failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="account-faucet-card">
      <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">Fund Account</h2>

      <div className="mb-4">
        <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-2">Select Amount (ytest.usd)</label>
        <div className="grid grid-cols-4 gap-2">
          {PRESET_AMOUNTS.map((amount) => (
            <button
              key={amount}
              onClick={() => handlePresetClick(amount)}
              className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedAmount === amount
                  ? 'bg-blue-500/20 border border-blue-500 text-blue-400'
                  : 'bg-surface-input border border-border text-text-secondary hover:border-border-emphasis'
              }`}
              data-testid={`account-faucet-preset-${amount}`}
            >
              ${amount}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-2">Custom Amount (multiples of $10)</label>
        <input
          type="number"
          value={customAmount}
          onChange={(e) => handleCustomChange(e.target.value)}
          placeholder="e.g. 200"
          step={10}
          min={10}
          className="w-full bg-surface-input border border-border rounded-lg px-4 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
          data-testid="account-faucet-custom-input"
        />
      </div>

      {error && (
        <div
          className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-sm text-red-400"
          data-testid="account-faucet-error"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4 text-sm text-green-400"
          data-testid="account-faucet-success"
        >
          {success}
        </div>
      )}

      {warning && (
        <div
          className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4 text-sm text-yellow-400"
          data-testid="account-faucet-warning"
        >
          {warning}
        </div>
      )}

      <button
        onClick={handleFund}
        disabled={!isValidAmount || isLoading || !address}
        className="w-full py-3 rounded-lg font-medium bg-accent hover:bg-accent-hover text-white disabled:bg-surface-input disabled:text-text-muted disabled:cursor-not-allowed transition-colors"
        data-testid="account-faucet-submit"
      >
        {isLoading
          ? `Funding $${activeAmount}...`
          : isValidAmount
          ? `Fund $${activeAmount}`
          : 'Fund Account'}
      </button>
    </div>
  );
}
