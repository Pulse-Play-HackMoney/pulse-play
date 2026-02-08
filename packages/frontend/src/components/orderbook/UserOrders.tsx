'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { useClearnode } from '@/providers/ClearnodeProvider';
import { getUserP2POrders, cancelP2POrder } from '@/lib/api';
import type { P2POrder } from '@/lib/types';

interface UserOrdersProps {
  address: string;
  marketId?: string;
  className?: string;
}

const STATUS_BADGES: Record<string, { bg: string; text: string }> = {
  OPEN: { bg: 'bg-green-500/20', text: 'text-green-400' },
  PARTIALLY_FILLED: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  FILLED: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  CANCELLED: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
  EXPIRED: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
  SETTLED: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
};

function canCancel(status: string): boolean {
  return status === 'OPEN' || status === 'PARTIALLY_FILLED';
}

export function UserOrders({ address, marketId, className = '' }: UserOrdersProps) {
  const { subscribe } = useWebSocket();
  const { refreshBalance } = useClearnode();
  const [orders, setOrders] = useState<P2POrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const data = await getUserP2POrders(address, marketId);
      setOrders(data.orders);
    } catch {
      // Silently handle fetch errors
    } finally {
      setLoading(false);
    }
  }, [address, marketId]);

  // Initial fetch
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Subscribe to real-time updates
  useEffect(() => {
    return subscribe((message) => {
      if (
        message.type === 'ORDER_FILLED' ||
        message.type === 'ORDER_CANCELLED' ||
        message.type === 'ORDER_PLACED' ||
        message.type === 'MARKET_STATUS'
      ) {
        fetchOrders();
      }
    });
  }, [subscribe, fetchOrders]);

  const handleCancel = async (orderId: string) => {
    setCancellingId(orderId);
    try {
      await cancelP2POrder(orderId);
      await fetchOrders();
      refreshBalance();
    } catch {
      // Error handled silently
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) {
    return (
      <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="user-orders-loading">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">Your Orders</h2>
        <div className="animate-pulse space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 bg-surface-input rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="user-orders">
      <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">Your Orders</h2>

      {orders.length === 0 ? (
        <p className="text-text-muted text-sm" data-testid="no-orders">No orders placed</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const badge = STATUS_BADGES[order.status] ?? STATUS_BADGES.OPEN;
            const fillPercent = order.maxShares > 0
              ? (order.filledShares / order.maxShares) * 100
              : 0;

            return (
              <div
                key={order.orderId}
                className="bg-surface-overlay border border-border-muted rounded-lg p-3"
                data-testid={`order-row-${order.orderId}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-text-primary font-medium">{order.outcome}</span>
                    <span className="text-xs text-text-muted font-mono">@{order.mcps.toFixed(2)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`} data-testid={`order-status-${order.orderId}`}>
                      {order.status}
                    </span>
                  </div>

                  {canCancel(order.status) && (
                    <button
                      onClick={() => handleCancel(order.orderId)}
                      disabled={cancellingId === order.orderId}
                      className="text-xs text-red-400 hover:text-red-300 disabled:text-text-muted transition-colors"
                      data-testid={`cancel-order-${order.orderId}`}
                    >
                      {cancellingId === order.orderId ? 'Cancelling...' : 'Cancel'}
                    </button>
                  )}
                </div>

                {/* Fill progress bar */}
                <div className="mb-1">
                  <div className="h-1.5 bg-surface-input rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${fillPercent}%` }}
                      data-testid={`fill-bar-${order.orderId}`}
                    />
                  </div>
                </div>

                <div className="flex justify-between text-xs text-text-muted">
                  <span>
                    {order.filledShares.toFixed(1)} / {order.maxShares.toFixed(1)} shares filled
                  </span>
                  <span>${order.amount.toFixed(2)} locked</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
