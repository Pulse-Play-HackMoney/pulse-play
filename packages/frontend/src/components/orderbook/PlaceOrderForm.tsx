'use client';

import { useState } from 'react';
import { useP2POrder } from '@/hooks/useP2POrder';
import { useWallet } from '@/providers/WagmiProvider';
import { useSelectedMarket } from '@/providers/SelectedMarketProvider';
import type { Outcome, P2POrderResponse } from '@/lib/types';

const OUTCOME_COLORS = [
  { selected: 'bg-blue-500/20 border-blue-500 text-blue-400', unselected: 'border-gray-600 text-gray-400 hover:border-gray-500' },
  { selected: 'bg-red-500/20 border-red-500 text-red-400', unselected: 'border-gray-600 text-gray-400 hover:border-gray-500' },
];

const PRESET_AMOUNTS = [1, 5, 10, 25];

interface PlaceOrderFormProps {
  marketId: string;
  gameId: string;
  outcomes: string[];
  className?: string;
  onOrderPlaced?: (response: P2POrderResponse) => void;
}

export function PlaceOrderForm({ marketId, gameId, outcomes, className = '', onOrderPlaced }: PlaceOrderFormProps) {
  const { address } = useWallet();
  const { market } = useSelectedMarket();
  const isMarketOpen = market?.status === 'OPEN';
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome | null>(null);
  const [mcps, setMcps] = useState<string>('');
  const [amount, setAmount] = useState<string>('');

  const { placeOrder, isLoading, step, error } = useP2POrder({
    address,
    marketId,
    gameId,
    onSuccess: (response) => {
      onOrderPlaced?.(response);
      setAmount('');
      setMcps('');
      setSelectedOutcome(null);
    },
  });

  const mcpsNum = Number(mcps);
  const amountNum = Number(amount);
  const isValidMcps = mcpsNum > 0 && mcpsNum < 1;
  const isValidAmount = amountNum > 0;
  const canSubmit = selectedOutcome && isValidMcps && isValidAmount && address && !isLoading && isMarketOpen;

  const maxShares = isValidMcps && isValidAmount ? amountNum / mcpsNum : 0;
  const matchHint = isValidMcps ? (1 - mcpsNum).toFixed(2) : '--';

  const handleSubmit = async () => {
    if (!canSubmit || !selectedOutcome) return;
    await placeOrder(selectedOutcome, mcpsNum, amountNum);
  };

  const getButtonText = () => {
    if (!isLoading) return 'Place Order';
    if (step === 'creating-session') return 'Creating Session...';
    if (step === 'submitting-order') return 'Submitting Order...';
    return 'Processing...';
  };

  return (
    <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="place-order-form">
      <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">Place Order</h2>

      {!isMarketOpen && (
        <div
          className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4 text-sm text-yellow-400"
          data-testid="market-closed-warning"
        >
          Market is not open for orders
        </div>
      )}

      {/* Outcome selector */}
      <div className="mb-4">
        <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-2">Outcome</label>
        <div className="grid grid-cols-2 gap-3">
          {outcomes.map((outcome, i) => {
            const color = OUTCOME_COLORS[i % OUTCOME_COLORS.length];
            const isSelected = selectedOutcome === outcome;
            return (
              <button
                key={outcome}
                onClick={() => setSelectedOutcome(outcome)}
                className={`p-3 rounded-lg border transition-colors ${
                  isSelected ? color.selected : color.unselected
                }`}
                data-testid={`order-outcome-${outcome.toLowerCase()}`}
              >
                {outcome}
              </button>
            );
          })}
        </div>
      </div>

      {/* MCPS input */}
      <div className="mb-4">
        <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-2">
          Max Cost Per Share (MCPS)
        </label>
        <input
          type="number"
          value={mcps}
          onChange={(e) => setMcps(e.target.value)}
          placeholder="0.01 - 0.99"
          min="0.01"
          max="0.99"
          step="0.01"
          className="w-full bg-surface-input border border-border rounded-lg px-4 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
          data-testid="mcps-input"
        />
        <p className="text-xs text-text-muted mt-1" data-testid="match-hint">
          Matches if opposite side &ge; ${matchHint}
        </p>
      </div>

      {/* Amount input */}
      <div className="mb-4">
        <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-2">Amount ($)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount..."
          min="0.01"
          step="0.01"
          className="w-full bg-surface-input border border-border rounded-lg px-4 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
          data-testid="order-amount-input"
        />
        <div className="flex gap-2 mt-2">
          {PRESET_AMOUNTS.map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(String(preset))}
              className="px-3 py-1 text-xs bg-surface-input hover:bg-surface-overlay rounded text-text-secondary transition-colors"
              data-testid={`order-preset-${preset}`}
            >
              ${preset}
            </button>
          ))}
        </div>
      </div>

      {/* Max shares display */}
      {isValidMcps && isValidAmount && (
        <div className="mb-4 bg-surface-input rounded-lg px-4 py-2" data-testid="max-shares-display">
          <span className="text-xs text-text-muted">Min Shares: </span>
          <span className="text-sm text-text-primary font-mono">{maxShares.toFixed(2)}</span>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div
          className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-sm text-red-400"
          data-testid="order-error"
        >
          {error}
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full bg-accent hover:bg-accent-hover disabled:bg-surface-input disabled:text-text-muted disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
        data-testid="place-order-button"
      >
        {getButtonText()}
      </button>
    </div>
  );
}
