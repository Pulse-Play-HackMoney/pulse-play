'use client';

import { useSelectedMarket } from '@/providers/SelectedMarketProvider';

const OUTCOME_COLORS = [
  { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
  { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' },
  { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400' },
  { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
  { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400' },
];

function getColor(index: number) {
  return OUTCOME_COLORS[index % OUTCOME_COLORS.length];
}

interface OddsDisplayProps {
  className?: string;
}

export function OddsDisplay({ className = '' }: OddsDisplayProps) {
  const { prices, outcomes, market, isLoading } = useSelectedMarket();

  if (isLoading) {
    return (
      <div
        className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`}
        data-testid="odds-loading"
      >
        <div className="animate-pulse">
          <div className="h-4 bg-surface-input rounded w-24 mb-4" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-20 bg-surface-input rounded" />
            <div className="h-20 bg-surface-input rounded" />
          </div>
        </div>
      </div>
    );
  }

  const formatPercent = (price: number) => `${(price * 100).toFixed(1)}%`;
  const formatOdds = (price: number) => {
    if (price <= 0) return '-';
    const americanOdds = price >= 0.5
      ? Math.round(-100 * price / (1 - price))
      : Math.round(100 * (1 - price) / price);
    return americanOdds > 0 ? `+${americanOdds}` : String(americanOdds);
  };

  const isMarketOpen = market?.status === 'OPEN';
  const cols = outcomes.length <= 2 ? 'grid-cols-2' : outcomes.length === 3 ? 'grid-cols-3' : `grid-cols-2 sm:grid-cols-${Math.min(outcomes.length, 4)}`;

  return (
    <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="odds-display">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary">Current Odds</h2>
        <span
          className={`text-xs px-2 py-1 rounded ${
            isMarketOpen
              ? 'bg-green-500/20 text-green-400'
              : 'bg-gray-600/50 text-gray-400'
          }`}
          data-testid="market-status-badge"
        >
          {market?.status || 'NO MARKET'}
        </span>
      </div>
      <div className={`grid ${cols} gap-4`}>
        {outcomes.map((outcome, i) => {
          const color = getColor(i);
          const price = prices[i] ?? 0.5;
          return (
            <div
              key={outcome}
              className={`${color.bg} border ${color.border} rounded-lg p-4 text-center`}
              data-testid={`odds-${outcome.toLowerCase()}`}
            >
              <div className={`text-2xl font-bold ${color.text}`} data-testid={`price-${outcome.toLowerCase()}-percent`}>
                {formatPercent(price)}
              </div>
              <div className="text-sm text-text-secondary mt-1" data-testid={`price-${outcome.toLowerCase()}-american`}>
                {formatOdds(price)}
              </div>
              <div className="text-xs text-text-muted mt-2">{outcome}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
