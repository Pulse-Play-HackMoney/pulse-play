'use client';

import { usePositions } from '@/hooks/usePositions';
import { useWallet } from '@/providers/WagmiProvider';
import { useSelectedMarket } from '@/providers/SelectedMarketProvider';
import type { Position } from '@/lib/types';

const OUTCOME_COLORS = [
  { border: 'border-blue-500/30', text: 'text-blue-400' },
  { border: 'border-red-500/30', text: 'text-red-400' },
  { border: 'border-green-500/30', text: 'text-green-400' },
  { border: 'border-amber-500/30', text: 'text-amber-400' },
  { border: 'border-purple-500/30', text: 'text-purple-400' },
];

function getOutcomeStyle(outcome: string, outcomes: string[]) {
  const index = outcomes.indexOf(outcome);
  if (index >= 0) return OUTCOME_COLORS[index % OUTCOME_COLORS.length];
  // fallback for unknown outcomes
  return { border: 'border-gray-500/30', text: 'text-gray-400' };
}

interface PositionListProps {
  className?: string;
}

function PositionCard({ position, outcomes }: { position: Position; outcomes: string[] }) {
  const style = getOutcomeStyle(position.outcome, outcomes);

  return (
    <div
      className={`bg-surface-input/50 rounded-lg p-4 border ${style.border}`}
      data-testid={`position-${position.marketId}`}
    >
      <div className="flex justify-between items-center mb-2">
        <span
          className={`text-sm font-medium ${style.text}`}
          data-testid="position-outcome"
        >
          {position.outcome}
        </span>
        <span className="text-xs text-text-muted">
          {new Date(position.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-text-muted">Shares</span>
          <div className="text-text-primary font-mono" data-testid="position-shares">
            {position.shares.toFixed(2)}
          </div>
        </div>
        <div>
          <span className="text-text-muted">Cost</span>
          <div className="text-text-primary font-mono" data-testid="position-cost">
            ${position.costPaid.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PositionList({ className = '' }: PositionListProps) {
  const { address } = useWallet();
  const { market, outcomes } = useSelectedMarket();
  const { positions, isLoading, error } = usePositions({
    address,
    marketId: market?.id,
  });

  if (!address) {
    return (
      <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="position-list">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">Your Positions</h2>
        <p className="text-text-secondary text-sm" data-testid="no-wallet">
          Connect wallet to view positions
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="positions-loading">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">Your Positions</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-20 bg-surface-input rounded" />
          <div className="h-20 bg-surface-input rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="positions-error">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">Your Positions</h2>
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="position-list">
      <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">
        Your Positions
        {positions.length > 0 && (
          <span className="text-sm text-text-muted ml-2">({positions.length})</span>
        )}
      </h2>
      {positions.length === 0 ? (
        <p className="text-text-secondary text-sm" data-testid="no-positions">
          No positions in current market
        </p>
      ) : (
        <div className="space-y-3" data-testid="positions-container">
          {positions.map((position, index) => (
            <PositionCard key={`${position.marketId}-${index}`} position={position} outcomes={outcomes} />
          ))}
        </div>
      )}
    </div>
  );
}
