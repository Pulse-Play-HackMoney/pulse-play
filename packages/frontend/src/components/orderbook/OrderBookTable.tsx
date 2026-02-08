'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { getOrderBookDepth } from '@/lib/api';
import type { DepthLevel, OrderBookDepth } from '@/lib/types';

interface OrderBookTableProps {
  marketId: string;
  outcomes: string[];
  className?: string;
}

const OUTCOME_COLORS: Record<number, { bar: string; text: string }> = {
  0: { bar: 'bg-blue-500/20', text: 'text-blue-400' },
  1: { bar: 'bg-red-500/20', text: 'text-red-400' },
};

function getColor(index: number) {
  return OUTCOME_COLORS[index] ?? { bar: 'bg-gray-500/20', text: 'text-gray-400' };
}

export function OrderBookTable({ marketId, outcomes, className = '' }: OrderBookTableProps) {
  const { subscribe } = useWebSocket();
  const [depth, setDepth] = useState<OrderBookDepth | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch initial depth
  useEffect(() => {
    let cancelled = false;

    async function fetchDepth() {
      try {
        const data = await getOrderBookDepth(marketId);
        if (!cancelled) {
          setDepth(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDepth();
    return () => { cancelled = true; };
  }, [marketId]);

  // Subscribe to real-time updates
  useEffect(() => {
    return subscribe((message) => {
      if (message.type === 'ORDERBOOK_UPDATE' && message.marketId === marketId) {
        setDepth((prev) => ({
          marketId,
          outcomes: message.outcomes,
          updatedAt: Date.now(),
        }));
      }
      if (message.type === 'MARKET_STATUS' && message.marketId === marketId &&
          (message.status === 'RESOLVED' || message.status === 'CLOSED')) {
        // Clear depth when market resolves or closes
        setDepth((prev) => prev ? { ...prev, outcomes: Object.fromEntries(outcomes.map(o => [o, []])) } : prev);
      }
    });
  }, [subscribe, marketId]);

  if (loading) {
    return (
      <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="orderbook-loading">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">Order Book</h2>
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-6 bg-surface-input rounded" />
          ))}
        </div>
      </div>
    );
  }

  const maxShares = outcomes.reduce((max, outcome) => {
    const levels = depth?.outcomes[outcome] ?? [];
    const outcomeMax = levels.reduce((m, l) => Math.max(m, l.shares), 0);
    return Math.max(max, outcomeMax);
  }, 0);

  return (
    <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="orderbook-table">
      <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">Order Book</h2>

      {outcomes.length === 0 || !depth ? (
        <p className="text-text-muted text-sm" data-testid="orderbook-empty">No orders yet</p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {outcomes.map((outcome, i) => {
            const levels = depth.outcomes[outcome] ?? [];
            const color = getColor(i);

            return (
              <div key={outcome} data-testid={`orderbook-side-${outcome.toLowerCase()}`}>
                <div className={`text-xs font-mono uppercase tracking-wider mb-2 ${color.text}`}>
                  {outcome}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-text-muted px-2">
                    <span>Price</span>
                    <span>Shares</span>
                  </div>

                  {levels.length === 0 ? (
                    <p className="text-text-muted text-xs px-2" data-testid={`orderbook-empty-${outcome.toLowerCase()}`}>
                      No orders
                    </p>
                  ) : (
                    levels.map((level, j) => {
                      const barWidth = maxShares > 0 ? (level.shares / maxShares) * 100 : 0;
                      return (
                        <div
                          key={`${outcome}-${j}`}
                          className="relative flex justify-between items-center text-sm px-2 py-1 rounded"
                          data-testid={`depth-level-${outcome.toLowerCase()}-${j}`}
                        >
                          <div
                            className={`absolute inset-y-0 left-0 rounded ${color.bar}`}
                            style={{ width: `${barWidth}%` }}
                          />
                          <span className="relative text-text-primary font-mono">
                            {level.price.toFixed(2)}
                          </span>
                          <span className="relative text-text-secondary font-mono">
                            {level.shares.toFixed(1)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
