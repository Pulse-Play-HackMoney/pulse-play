'use client';

import { useEffect, useState } from 'react';
import { getSports, getSportCategories } from '@/lib/api';
import type { Sport, MarketCategory } from '@/lib/types';

export function SportsPanel() {
  const [sports, setSports] = useState<Sport[]>([]);
  const [categories, setCategories] = useState<Record<string, MarketCategory[]>>({});
  const [expandedSport, setExpandedSport] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getSports()
      .then(async (data) => {
        setSports(data.sports);
        const catMap: Record<string, MarketCategory[]> = {};
        for (const sport of data.sports) {
          try {
            const catData = await getSportCategories(sport.id);
            catMap[sport.id] = catData.categories;
          } catch {
            catMap[sport.id] = [];
          }
        }
        setCategories(catMap);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3" data-testid="sports-panel-loading">
        <div className="h-12 bg-surface-input rounded" />
        <div className="h-12 bg-surface-input rounded" />
      </div>
    );
  }

  return (
    <div data-testid="sports-panel">
      <div className="space-y-2">
        {sports.map((sport) => (
          <div key={sport.id} className="bg-surface-raised border border-border rounded-lg overflow-hidden">
            <button
              onClick={() =>
                setExpandedSport(expandedSport === sport.id ? null : sport.id)
              }
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-surface-overlay transition-colors"
              data-testid={`sport-row-${sport.id}`}
            >
              <div>
                <span className="text-text-primary font-medium">{sport.name}</span>
                {sport.description && (
                  <span className="text-text-muted text-sm ml-2">{sport.description}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-text-muted text-sm">
                  {categories[sport.id]?.length ?? 0} categories
                </span>
                <span className="text-text-muted">{expandedSport === sport.id ? '−' : '+'}</span>
              </div>
            </button>

            {expandedSport === sport.id && (
              <div className="px-4 pb-3 border-t border-border" data-testid={`sport-categories-${sport.id}`}>
                {(categories[sport.id] ?? []).map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between py-2 text-sm"
                    data-testid={`category-row-${cat.id}`}
                  >
                    <div>
                      <span className="text-text-secondary capitalize">{cat.name}</span>
                      {cat.description && (
                        <span className="text-text-muted ml-2">{cat.description}</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {cat.outcomes.map((o) => (
                        <span
                          key={o}
                          className="px-2 py-0.5 bg-surface-input rounded text-xs text-text-secondary"
                        >
                          {o}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
