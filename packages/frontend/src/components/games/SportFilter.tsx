'use client';

import { useEffect, useState } from 'react';
import { getSports } from '@/lib/api';
import type { Sport } from '@/lib/types';

interface SportFilterProps {
  className?: string;
  selected: string | null;
  onSelect: (sportId: string | null) => void;
}

export function SportFilter({ className = '', selected, onSelect }: SportFilterProps) {
  const [sports, setSports] = useState<Sport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getSports()
      .then((data) => {
        if (!cancelled) {
          setSports(data.sports);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className={`flex gap-2 ${className}`} data-testid="sport-filter-loading">
        <div className="h-9 w-16 bg-surface-input rounded-lg animate-pulse" />
        <div className="h-9 w-20 bg-surface-input rounded-lg animate-pulse" />
        <div className="h-9 w-24 bg-surface-input rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className={`flex gap-2 flex-wrap ${className}`} data-testid="sport-filter">
      <button
        onClick={() => onSelect(null)}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          selected === null
            ? 'bg-white text-gray-900'
            : 'bg-surface-raised border border-border text-text-secondary hover:text-text-primary'
        }`}
        data-testid="sport-filter-all"
      >
        All
      </button>
      {sports.map((sport) => (
        <button
          key={sport.id}
          onClick={() => onSelect(sport.id)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
            selected === sport.id
              ? 'bg-white text-gray-900'
              : 'bg-surface-raised border border-border text-text-secondary hover:text-text-primary'
          }`}
          data-testid={`sport-filter-${sport.id}`}
        >
          {sport.name}
        </button>
      ))}
    </div>
  );
}
