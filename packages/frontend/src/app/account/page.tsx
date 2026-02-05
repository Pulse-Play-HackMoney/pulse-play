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
        <h1 className="text-3xl font-bold text-white">Account</h1>
        <p className="text-gray-400 mt-2">
          Manage your Yellow Network session and funds
        </p>
      </div>

      <SessionCard />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AccountFaucetCard onFunded={handleFunded} />
        </div>
        <div>
          <AccountBalanceCard refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  );
}
