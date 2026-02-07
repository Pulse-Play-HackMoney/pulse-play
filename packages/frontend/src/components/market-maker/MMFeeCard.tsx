'use client';

import { useState, useEffect } from 'react';
import { getAdminConfig, updateAdminConfig } from '@/lib/api';

interface MMFeeCardProps {
  className?: string;
}

const PRESET_FEES = [0, 0.5, 1, 2];

export function MMFeeCard({ className = '' }: MMFeeCardProps) {
  const [currentFee, setCurrentFee] = useState<number | null>(null);
  const [selectedFee, setSelectedFee] = useState<number | null>(null);
  const [customFee, setCustomFee] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const activeFee = selectedFee ?? (customFee !== '' ? Number(customFee) : null);
  const isValidFee = activeFee !== null && activeFee >= 0 && activeFee <= 100 && !isNaN(activeFee);
  const hasChanged = activeFee !== null && activeFee !== currentFee;

  useEffect(() => {
    getAdminConfig()
      .then((config) => {
        setCurrentFee(config.transactionFeePercent);
        setSelectedFee(config.transactionFeePercent);
      })
      .catch(() => setError('Failed to load config'))
      .finally(() => setIsFetching(false));
  }, []);

  const handlePresetClick = (fee: number) => {
    setSelectedFee(fee);
    setCustomFee('');
    setError(null);
    setSuccess(null);
  };

  const handleCustomChange = (value: string) => {
    setCustomFee(value);
    setSelectedFee(null);
    setError(null);
    setSuccess(null);
  };

  const handleSave = async () => {
    if (!isValidFee || activeFee === null) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await updateAdminConfig(activeFee);
      setCurrentFee(result.transactionFeePercent);
      setSelectedFee(result.transactionFeePercent);
      setCustomFee('');
      setSuccess(`Fee updated to ${result.transactionFeePercent}%`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update fee');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="mm-fee-card">
      <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-1">Transaction Fee</h2>
      <p className="text-sm text-text-secondary mb-4">
        Current: <span data-testid="fee-current">{isFetching ? '...' : `${currentFee}%`}</span>
      </p>

      <div className="mb-4">
        <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-2">Fee Preset</label>
        <div className="grid grid-cols-4 gap-2">
          {PRESET_FEES.map((fee) => (
            <button
              key={fee}
              onClick={() => handlePresetClick(fee)}
              className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedFee === fee
                  ? 'bg-blue-500/20 border border-blue-500 text-blue-400'
                  : 'bg-surface-input border border-border text-text-secondary hover:border-border-emphasis'
              }`}
              data-testid={`fee-preset-${fee}`}
            >
              {fee}%
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-2">Custom Fee (%)</label>
        <input
          type="number"
          value={customFee}
          onChange={(e) => handleCustomChange(e.target.value)}
          placeholder="e.g. 1.5"
          step={0.1}
          min={0}
          max={100}
          className="w-full bg-surface-input border border-border rounded-lg px-4 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
          data-testid="fee-custom-input"
        />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-sm text-red-400" data-testid="fee-error">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4 text-sm text-green-400" data-testid="fee-success">
          {success}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={!isValidFee || !hasChanged || isLoading}
        className="w-full py-3 rounded-lg font-medium bg-accent hover:bg-accent-hover text-white disabled:bg-surface-input disabled:text-text-muted disabled:cursor-not-allowed transition-colors"
        data-testid="fee-submit"
      >
        {isLoading ? 'Saving...' : 'Save Fee'}
      </button>
    </div>
  );
}
