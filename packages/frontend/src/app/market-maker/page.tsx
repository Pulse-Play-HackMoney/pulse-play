'use client';

import { useState, useCallback } from 'react';
import { MMFaucetCard, MMBalanceCard, MMFeeCard } from '@/components/market-maker';

export default function MarketMakerPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleFunded = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-mono uppercase tracking-wide text-text-primary">Market Maker</h1>
        <p className="text-text-secondary mt-2">
          View market maker status and manage funds
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <MMFaucetCard onFunded={handleFunded} />
        </div>
        <div className="space-y-6">
          <MMBalanceCard refreshKey={refreshKey} />
          <MMFeeCard />
        </div>
      </div>
    </div>
  );
}
