'use client';

import { useState, useCallback } from 'react';
import { SessionCard, AccountFaucetCard, AccountBalanceCard } from '@/components/account';

export default function AccountPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleFunded = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-mono uppercase tracking-wide text-text-primary">Account</h1>
        <p className="text-text-secondary mt-2">
          Manage your Yellow Network session and funds
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <AccountFaucetCard onFunded={handleFunded} />
          <SessionCard />
        </div>
        <div>
          <AccountBalanceCard refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  );
}
