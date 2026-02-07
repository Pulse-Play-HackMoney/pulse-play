'use client';

import { useState } from 'react';
import { useSelectedMarket } from '@/providers/SelectedMarketProvider';
import { useWallet } from '@/providers/WagmiProvider';
import { useBet } from '@/hooks/useBet';
import { MM_ADDRESS } from '@/lib/config';
import type { Outcome } from '@/lib/types';

const OUTCOME_COLORS = [
  { selected: 'bg-blue-500/20 border-blue-500 text-blue-400', unselected: 'border-gray-600 text-gray-400 hover:border-gray-500' },
  { selected: 'bg-red-500/20 border-red-500 text-red-400', unselected: 'border-gray-600 text-gray-400 hover:border-gray-500' },
  { selected: 'bg-green-500/20 border-green-500 text-green-400', unselected: 'border-gray-600 text-gray-400 hover:border-gray-500' },
  { selected: 'bg-amber-500/20 border-amber-500 text-amber-400', unselected: 'border-gray-600 text-gray-400 hover:border-gray-500' },
  { selected: 'bg-purple-500/20 border-purple-500 text-purple-400', unselected: 'border-gray-600 text-gray-400 hover:border-gray-500' },
];

function getOutcomeColor(index: number) {
  return OUTCOME_COLORS[index % OUTCOME_COLORS.length];
}

interface BetFormProps {
  className?: string;
  onBetPlaced?: (outcome: Outcome, shares: number) => void;
}

const PRESET_AMOUNTS = [1, 5, 10, 25];

export function BetForm({ className = '', onBetPlaced }: BetFormProps) {
  const { market, outcomes } = useSelectedMarket();
  const { address } = useWallet();
  const [amount, setAmount] = useState<string>('');
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome | null>(null);

  const { bet, isLoading, step, error } = useBet({
    address,
    marketId: market?.id,
    onSuccess: (response) => {
      if (response.accepted && selectedOutcome && response.shares) {
        onBetPlaced?.(selectedOutcome, response.shares);
        setAmount('');
        setSelectedOutcome(null);
      }
    },
  });

  const isMarketOpen = market?.status === 'OPEN';
  const canBet = isMarketOpen && address && selectedOutcome && Number(amount) > 0;

  const handleBet = async () => {
    if (!canBet || !selectedOutcome) return;
    await bet(selectedOutcome, Number(amount));
  };

  const getButtonText = () => {
    if (!isLoading) return 'Place Bet';
    if (step === 'creating-session') return 'Creating Session...';
    if (step === 'notifying-hub') return 'Placing Bet...';
    return 'Processing...';
  };

  const cols = outcomes.length <= 2 ? 'grid-cols-2' : outcomes.length === 3 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="bet-form">
      <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">Place Bet</h2>

      {!isMarketOpen && (
        <div
          className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4 text-sm text-yellow-400"
          data-testid="market-closed-warning"
        >
          Market is not open for betting
        </div>
      )}

      {!MM_ADDRESS && (
        <div
          className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-sm text-red-400"
          data-testid="mm-address-warning"
        >
          Market Maker address not configured
        </div>
      )}

      <div className="mb-4">
        <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-2">Select Outcome</label>
        <div className={`grid ${cols} gap-3`}>
          {outcomes.map((outcome, i) => {
            const color = getOutcomeColor(i);
            const isSelected = selectedOutcome === outcome;
            return (
              <button
                key={outcome}
                onClick={() => setSelectedOutcome(outcome)}
                disabled={!isMarketOpen}
                className={`p-3 rounded-lg border transition-colors ${
                  isSelected ? color.selected : `${color.unselected} disabled:opacity-50`
                }`}
                data-testid={`outcome-${outcome.toLowerCase()}`}
              >
                {outcome}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-2">Amount</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={!isMarketOpen}
          placeholder="Enter amount..."
          className="w-full bg-surface-input border border-border rounded-lg px-4 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent disabled:opacity-50"
          data-testid="amount-input"
        />
        <div className="flex gap-2 mt-2">
          {PRESET_AMOUNTS.map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(String(preset))}
              disabled={!isMarketOpen}
              className="px-3 py-1 text-xs bg-surface-input hover:bg-surface-overlay rounded text-text-secondary disabled:opacity-50 transition-colors"
              data-testid={`preset-${preset}`}
            >
              ${preset}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div
          className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-sm text-red-400"
          data-testid="bet-error"
        >
          {error}
        </div>
      )}

      <button
        onClick={handleBet}
        disabled={!canBet || isLoading}
        className="w-full bg-accent hover:bg-accent-hover disabled:bg-surface-input disabled:text-text-muted disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
        data-testid="place-bet-button"
      >
        {getButtonText()}
      </button>
    </div>
  );
}
