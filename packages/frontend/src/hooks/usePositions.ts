'use client';

import { useState, useCallback, useEffect } from 'react';
import { getPositions } from '@/lib/api';
import { useWebSocket } from '@/providers/WebSocketProvider';
import type { Position } from '@/lib/types';

interface UsePositionsOptions {
  address?: string;
  marketId?: string;
}

interface UsePositionsReturn {
  positions: Position[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePositions(options: UsePositionsOptions = {}): UsePositionsReturn {
  const { address, marketId } = options;
  const { subscribe } = useWebSocket();

  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!address) {
      setPositions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await getPositions(address);
      let filteredPositions = response.positions;

      // Filter out P2P positions (shown in Order Book tab instead)
      filteredPositions = filteredPositions.filter(
        (p) => (p.mode ?? 'lmsr') !== 'p2p'
      );

      // Filter by marketId if specified
      if (marketId) {
        filteredPositions = filteredPositions.filter(
          (p) => p.marketId === marketId
        );
      }

      setPositions(filteredPositions);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [address, marketId]);

  // Initial fetch
  useEffect(() => {
    refetch();
  }, [refetch]);

  // Handle real-time position and market updates
  useEffect(() => {
    return subscribe((message) => {
      if (
        message.type === 'MARKET_STATUS' &&
        message.status === 'RESOLVED' &&
        (!marketId || message.marketId === marketId)
      ) {
        refetch();
      }

      if (
        message.type === 'POSITION_ADDED' &&
        message.position.address === address &&
        (!marketId || message.position.marketId === marketId) &&
        (message.position.mode ?? 'lmsr') !== 'p2p'
      ) {
        setPositions((prev) => [...prev, message.position]);
      }
    });
  }, [subscribe, marketId, address, refetch]);

  return {
    positions,
    isLoading,
    error,
    refetch,
  };
}
