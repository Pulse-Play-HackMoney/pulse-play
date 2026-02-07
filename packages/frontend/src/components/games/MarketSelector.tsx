'use client';

import { useEffect, useState } from 'react';
import { getSportCategories } from '@/lib/api';
import { useWebSocket } from '@/providers/WebSocketProvider';
import type { MarketCategory, MarketData, WsMessage } from '@/lib/types';

interface MarketSelectorProps {
  sportId: string;
  markets: MarketData[];
  selected: string | null;
  onSelect: (categoryId: string) => void;
  className?: string;
}

function getMarketForCategory(markets: MarketData[], categoryId: string): MarketData | undefined {
  // Find latest non-RESOLVED market for this category, or fallback to latest
  const categoryMarkets = markets.filter((m) => m.categoryId === categoryId);
  const active = categoryMarkets.find((m) => m.status !== 'RESOLVED');
  return active ?? categoryMarkets[0];
}

const STATUS_BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  OPEN: { bg: 'bg-green-500/20', text: 'text-green-400' },
  CLOSED: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  PENDING: { bg: 'bg-gray-600/50', text: 'text-gray-400' },
  RESOLVED: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
};

export function MarketSelector({
  sportId,
  markets,
  selected,
  onSelect,
  className = '',
}: MarketSelectorProps) {
  const [categories, setCategories] = useState<MarketCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { subscribe } = useWebSocket();

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getSportCategories(sportId)
      .then((data) => {
        if (!cancelled) {
          setCategories(data.categories);
          setIsLoading(false);
          // Auto-select first category if none selected
          if (!selected && data.categories.length > 0) {
            onSelect(data.categories[0].id);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sportId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for WS market status updates to refresh badges
  useEffect(() => {
    const handleMessage = (message: WsMessage) => {
      if (message.type === 'MARKET_STATUS') {
        // Parent component handles refetching markets
      }
    };
    return subscribe(handleMessage);
  }, [subscribe]);

  if (isLoading) {
    return (
      <div className={`flex gap-2 ${className}`} data-testid="market-selector-loading">
        <div className="h-9 w-24 bg-surface-input rounded-lg animate-pulse" />
        <div className="h-9 w-28 bg-surface-input rounded-lg animate-pulse" />
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className={className} data-testid="market-selector-empty">
        <p className="text-text-muted text-sm">No market categories for this sport.</p>
      </div>
    );
  }

  return (
    <div className={`flex gap-2 flex-wrap ${className}`} data-testid="market-selector">
      {categories.map((cat) => {
        const market = getMarketForCategory(markets, cat.id);
        const isSelected = selected === cat.id;
        const statusStyle = market
          ? STATUS_BADGE_STYLES[market.status] ?? STATUS_BADGE_STYLES.PENDING
          : null;

        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              isSelected
                ? 'bg-white text-gray-900'
                : 'bg-surface-raised border border-border text-text-secondary hover:text-text-primary'
            }`}
            data-testid={`category-${cat.id}`}
          >
            <span className="capitalize">{cat.name}</span>
            {market && statusStyle && (
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  isSelected ? 'bg-gray-200 text-gray-700' : `${statusStyle.bg} ${statusStyle.text}`
                }`}
                data-testid={`category-${cat.id}-status`}
              >
                {market.status}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
