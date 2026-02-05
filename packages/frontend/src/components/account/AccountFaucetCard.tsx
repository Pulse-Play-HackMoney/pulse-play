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
    <div className={`bg-gray-800 rounded-lg p-6 ${className}`} data-testid="account-faucet-card">
      <h2 className="text-lg font-semibold text-white mb-4">Fund Account</h2>

      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">Select Amount (ytest.usd)</label>
        <div className="grid grid-cols-4 gap-2">
          {PRESET_AMOUNTS.map((amount) => (
            <button
              key={amount}
              onClick={() => handlePresetClick(amount)}
              className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedAmount === amount
                  ? 'bg-blue-500/20 border border-blue-500 text-blue-400'
                  : 'bg-gray-700 border border-gray-600 text-gray-300 hover:border-gray-500'
              }`}
              data-testid={`account-faucet-preset-${amount}`}
            >
              ${amount}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">Custom Amount (multiples of $10)</label>
        <input
          type="number"
          value={customAmount}
          onChange={(e) => handleCustomChange(e.target.value)}
          placeholder="e.g. 200"
          step={10}
          min={10}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
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
        className="w-full py-3 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
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
