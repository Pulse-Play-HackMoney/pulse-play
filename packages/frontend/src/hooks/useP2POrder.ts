'use client';

import { useState, useCallback } from 'react';
import { placeP2POrder, cancelP2POrder } from '@/lib/api';
import { useClearnode } from '@/hooks/useClearnode';
import { MM_ADDRESS } from '@/lib/config';
import { toMicroUnits, ASSET } from '@/lib/units';
import type { P2POrderResponse, Outcome } from '@/lib/types';

export type P2POrderStep = 'idle' | 'creating-session' | 'submitting-order';

interface UseP2POrderOptions {
  address?: string;
  marketId?: string;
  gameId?: string;
  onSuccess?: (response: P2POrderResponse) => void;
  onError?: (error: Error) => void;
}

interface UseP2POrderReturn {
  placeOrder: (outcome: Outcome, mcps: number, amount: number) => Promise<P2POrderResponse | null>;
  cancelOrder: (orderId: string) => Promise<void>;
  isLoading: boolean;
  step: P2POrderStep;
  error: string | null;
  lastResponse: P2POrderResponse | null;
}

export function useP2POrder(options: UseP2POrderOptions = {}): UseP2POrderReturn {
  const { address, marketId, gameId, onSuccess, onError } = options;
  const { createAppSession, status: clearnodeStatus, refreshBalance } = useClearnode();

  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<P2POrderStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<P2POrderResponse | null>(null);

  const placeOrder = useCallback(
    async (outcome: Outcome, mcps: number, amount: number): Promise<P2POrderResponse | null> => {
      if (!address || !marketId || !gameId) {
        const err = new Error('Missing required order parameters');
        setError(err.message);
        onError?.(err);
        return null;
      }

      if (!MM_ADDRESS) {
        const err = new Error('MM_ADDRESS not configured');
        setError(err.message);
        onError?.(err);
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Step 1: Create app session on Clearnode
        setStep('creating-session');
        const session = await createAppSession({
          counterparty: MM_ADDRESS,
          allocations: [
            { asset: ASSET, amount: toMicroUnits(amount), participant: address as `0x${string}` },
            { asset: ASSET, amount: '0', participant: MM_ADDRESS },
          ],
        });

        // Step 2: Submit order to hub
        setStep('submitting-order');
        const response = await placeP2POrder({
          marketId,
          gameId,
          userAddress: address,
          outcome,
          mcps,
          amount,
          appSessionId: session.appSessionId,
          appSessionVersion: session.version,
        });

        setLastResponse(response);
        onSuccess?.(response);
        refreshBalance();

        return response;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error.message);
        onError?.(error);
        return null;
      } finally {
        setIsLoading(false);
        setStep('idle');
      }
    },
    [address, marketId, gameId, clearnodeStatus, createAppSession, refreshBalance, onSuccess, onError]
  );

  const cancelOrderFn = useCallback(
    async (orderId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        await cancelP2POrder(orderId);
        refreshBalance();
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error.message);
        onError?.(error);
      } finally {
        setIsLoading(false);
      }
    },
    [refreshBalance, onError]
  );

  return {
    placeOrder,
    cancelOrder: cancelOrderFn,
    isLoading,
    step,
    error,
    lastResponse,
  };
}
