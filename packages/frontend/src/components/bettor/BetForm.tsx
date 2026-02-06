'use client';

import { useState } from 'react';
import { useMarket } from '@/providers/MarketProvider';
import { useWallet } from '@/providers/WagmiProvider';
import { useBet } from '@/hooks/useBet';
import { MM_ADDRESS } from '@/lib/config';
import type { Outcome } from '@/lib/types';

interface BetFormProps {
  className?: string;
  onBetPlaced?: (outcome: Outcome, shares: number) => void;
}

const PRESET_AMOUNTS = [1, 5, 10, 25];

export function BetForm({ className = '', onBetPlaced }: BetFormProps) {
  const { market } = useMarket();
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

  return (
    <div className={`bg-gray-800 rounded-lg p-6 ${className}`} data-testid="bet-form">
      <h2 className="text-lg font-semibold text-white mb-4">Place Bet</h2>

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
        <label className="block text-sm text-gray-400 mb-2">Select Outcome</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setSelectedOutcome('BALL')}
            disabled={!isMarketOpen}
            className={`p-3 rounded-lg border transition-colors ${
              selectedOutcome === 'BALL'
                ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                : 'border-gray-600 text-gray-400 hover:border-gray-500 disabled:opacity-50'
            }`}
            data-testid="outcome-ball"
          >
            Ball
          </button>
          <button
            onClick={() => setSelectedOutcome('STRIKE')}
            disabled={!isMarketOpen}
            className={`p-3 rounded-lg border transition-colors ${
              selectedOutcome === 'STRIKE'
                ? 'bg-red-500/20 border-red-500 text-red-400'
                : 'border-gray-600 text-gray-400 hover:border-gray-500 disabled:opacity-50'
            }`}
            data-testid="outcome-strike"
          >
            Strike
          </button>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">Amount</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={!isMarketOpen}
          placeholder="Enter amount..."
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          data-testid="amount-input"
        />
        <div className="flex gap-2 mt-2">
          {PRESET_AMOUNTS.map((preset) => (
            <button
              key={preset}
              onClick={() => setAmount(String(preset))}
              disabled={!isMarketOpen}
              className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 disabled:opacity-50"
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
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
        data-testid="place-bet-button"
      >
        {getButtonText()}
      </button>
    </div>
  );
}
