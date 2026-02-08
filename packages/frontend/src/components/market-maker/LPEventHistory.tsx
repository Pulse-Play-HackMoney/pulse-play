'use client';

import { useState, useEffect, useCallback } from 'react';
import { getLPEvents } from '@/lib/api';
import { useWebSocket } from '@/providers/WebSocketProvider';
import type { LPEvent, WsMessage } from '@/lib/types';

interface LPEventHistoryProps {
  address?: string;
  className?: string;
  refreshKey?: number;
}

function formatUsd(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

export function LPEventHistory({ address, className = '', refreshKey }: LPEventHistoryProps) {
  const [events, setEvents] = useState<LPEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { subscribe } = useWebSocket();

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getLPEvents(address);
      setEvents(data.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch LP events');
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents, refreshKey]);

  // Re-fetch when new LP events arrive
  useEffect(() => {
    return subscribe((message: WsMessage) => {
      if (message.type === 'LP_DEPOSIT' || message.type === 'LP_WITHDRAWAL') {
        fetchEvents();
      }
    });
  }, [subscribe, fetchEvents]);

  if (isLoading && events.length === 0) {
    return (
      <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="lp-events-loading">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">LP Activity</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-surface-input rounded w-full" />
          <div className="h-4 bg-surface-input rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (error && events.length === 0) {
    return (
      <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="lp-events-error">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">LP Activity</h2>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-sm text-red-400">
          {error}
        </div>
        <button
          onClick={fetchEvents}
          className="w-full py-2 rounded-lg font-medium bg-surface-input hover:bg-surface-overlay text-text-primary transition-colors"
          data-testid="lp-events-retry"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="lp-events-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary">LP Activity</h2>
        <button
          onClick={fetchEvents}
          disabled={isLoading}
          className="text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          data-testid="lp-events-refresh"
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {events.length === 0 ? (
        <p className="text-text-muted text-sm" data-testid="lp-events-empty">No LP events yet</p>
      ) : (
        <div className="space-y-2" data-testid="lp-events-list">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm"
              data-testid={`lp-event-${event.id}`}
            >
              <div className="flex flex-col">
                <span
                  className={event.type === 'DEPOSIT' ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}
                  data-testid={`lp-event-type-${event.id}`}
                >
                  {event.type}
                </span>
                <span className="text-text-muted text-xs" data-testid={`lp-event-time-${event.id}`}>
                  {formatTimestamp(event.timestamp)}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-text-primary" data-testid={`lp-event-amount-${event.id}`}>
                  ${formatUsd(event.amount)}
                </span>
                <span className="text-text-muted text-xs" data-testid={`lp-event-shares-${event.id}`}>
                  {formatUsd(event.shares)} shares @ ${formatUsd(event.sharePrice)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
