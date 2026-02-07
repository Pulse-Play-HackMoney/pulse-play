'use client';

import { useState } from 'react';
import {
  AdminTabs,
  SportsPanel,
  GamesPanel,
  MarketsPanel,
  UsersPanel,
  LeaderboardPanel,
  type AdminTab,
} from '@/components/admin';

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('sports');

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-mono uppercase tracking-wide text-text-primary">Admin Dashboard</h1>
        <p className="text-text-secondary mt-2">
          Manage sports, games, markets, and users
        </p>
      </div>

      <AdminTabs selected={tab} onSelect={setTab} />

      <div className="bg-surface-raised border border-border rounded-lg p-6">
        {tab === 'sports' && <SportsPanel />}
        {tab === 'games' && <GamesPanel />}
        {tab === 'markets' && <MarketsPanel />}
        {tab === 'users' && <UsersPanel />}
        {tab === 'leaderboard' && <LeaderboardPanel />}
      </div>
    </div>
  );
}
