'use client';

export type AdminTab = 'sports' | 'games' | 'markets' | 'users' | 'leaderboard';

interface AdminTabsProps {
  selected: AdminTab;
  onSelect: (tab: AdminTab) => void;
  className?: string;
}

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'sports', label: 'Sports' },
  { id: 'games', label: 'Games' },
  { id: 'markets', label: 'Markets' },
  { id: 'users', label: 'Users' },
  { id: 'leaderboard', label: 'Leaderboard' },
];

export function AdminTabs({ selected, onSelect, className = '' }: AdminTabsProps) {
  return (
    <div className={`flex gap-1 bg-surface-overlay border border-border rounded-lg p-1 ${className}`} data-testid="admin-tabs">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            selected === tab.id
              ? 'bg-gray-700 text-white'
              : 'text-text-secondary hover:text-text-primary'
          }`}
          data-testid={`admin-tab-${tab.id}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
