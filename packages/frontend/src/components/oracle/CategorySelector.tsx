'use client';

import { useEffect, useState } from 'react';
import { getSportCategories } from '@/lib/api';
import type { MarketCategory, MarketData } from '@/lib/types';

interface CategorySelectorProps {
  sportId: string;
  markets: MarketData[];
  selected: string | null;
  onSelect: (categoryId: string, outcomes: string[]) => void;
  className?: string;
}

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  OPEN: { bg: 'bg-green-500/20', text: 'text-green-400' },
  CLOSED: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  PENDING: { bg: 'bg-gray-600/50', text: 'text-gray-400' },
  RESOLVED: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
};

export function CategorySelector({
  sportId,
  markets,
  selected,
  onSelect,
  className = '',
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<MarketCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getSportCategories(sportId)
      .then((data) => {
        if (!cancelled) {
          setCategories(data.categories);
          setIsLoading(false);
          // Auto-select first if nothing selected
          if (!selected && data.categories.length > 0) {
            onSelect(data.categories[0].id, data.categories[0].outcomes);
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

  if (isLoading) {
    return (
      <div className={`flex gap-2 ${className}`} data-testid="category-selector-loading">
        <div className="h-9 w-24 bg-surface-input rounded-lg animate-pulse" />
        <div className="h-9 w-28 bg-surface-input rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className={`flex gap-2 flex-wrap ${className}`} data-testid="category-selector">
      {categories.map((cat) => {
        const catMarket = markets.find(
          (m) => m.categoryId === cat.id && m.status !== 'RESOLVED'
        );
        const isSelected = selected === cat.id;
        const statusStyle = catMarket
          ? STATUS_BADGE[catMarket.status] ?? STATUS_BADGE.PENDING
          : null;

        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id, cat.outcomes)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              isSelected
                ? 'bg-white text-gray-900'
                : 'bg-surface-raised border border-border text-text-secondary hover:text-text-primary'
            }`}
            data-testid={`oracle-category-${cat.id}`}
          >
            <span className="capitalize">{cat.name}</span>
            {catMarket && statusStyle && (
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  isSelected ? 'bg-gray-200 text-gray-700' : `${statusStyle.bg} ${statusStyle.text}`
                }`}
                data-testid={`oracle-category-${cat.id}-status`}
              >
                {catMarket.status}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
