'use client';

import { useSelectedMarket } from '@/providers/SelectedMarketProvider';

interface StateDisplayProps {
  className?: string;
  gameActive?: boolean;
  positionCount?: number;
  connectionCount?: number;
}

export function StateDisplay({
  className = '',
  gameActive = false,
  positionCount = 0,
  connectionCount = 0,
}: StateDisplayProps) {
  const { market, outcomes, isLoading, error } = useSelectedMarket();

  if (isLoading) {
    return (
      <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="state-loading">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">System State</h2>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-surface-input rounded w-3/4" />
          <div className="h-4 bg-surface-input rounded w-1/2" />
          <div className="h-4 bg-surface-input rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="state-error">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">System State</h2>
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="state-display">
      <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">System State</h2>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-text-secondary">Game Active</span>
          <span
            className={gameActive ? 'text-green-400' : 'text-text-muted'}
            data-testid="state-game-active"
          >
            {gameActive ? 'Yes' : 'No'}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-text-secondary">Market ID</span>
          <span className="text-text-primary font-mono" data-testid="state-market-id">
            {market?.id || '-'}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-text-secondary">Market Status</span>
          <span className="text-text-primary" data-testid="state-market-status">
            {market?.status || 'None'}
          </span>
        </div>

        {outcomes.length > 0 && (
          <div className="flex justify-between">
            <span className="text-text-secondary">Outcomes</span>
            <span className="text-text-primary" data-testid="state-outcomes">
              {outcomes.join(', ')}
            </span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-text-secondary">Positions</span>
          <span className="text-text-primary" data-testid="state-position-count">
            {positionCount}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-text-secondary">Connections</span>
          <span className="text-text-primary" data-testid="state-connection-count">
            {connectionCount}
          </span>
        </div>
      </div>
    </div>
  );
}
