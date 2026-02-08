'use client';

import { useState, useCallback } from 'react';
import { placeBet } from '@/lib/api';
import { useClearnode } from '@/hooks/useClearnode';
import { MM_ADDRESS } from '@/lib/config';
import { toMicroUnits, ASSET } from '@/lib/units';
import { encodeSessionData, type SessionDataV1 } from '@/lib/clearnode/session-data';
import type { BetResponse, Outcome } from '@/lib/types';

export type BetStep = 'idle' | 'creating-session' | 'notifying-hub';

interface UseBetOptions {
  address?: string;
  marketId?: string;
  onSuccess?: (response: BetResponse) => void;
  onError?: (error: Error) => void;
}

interface UseBetReturn {
  bet: (outcome: Outcome, amount: number) => Promise<BetResponse | null>;
  isLoading: boolean;
  step: BetStep;
  error: string | null;
  lastResponse: BetResponse | null;
}

export function useBet(options: UseBetOptions = {}): UseBetReturn {
  const { address, marketId, onSuccess, onError } = options;
  const { createAppSession, status: clearnodeStatus, refreshBalance, reconnect } = useClearnode();

  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<BetStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<BetResponse | null>(null);

  const bet = useCallback(
    async (outcome: Outcome, amount: number): Promise<BetResponse | null> => {
      if (!address || !marketId) {
        const err = new Error('Missing required bet parameters');
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
        // Step 1: Create a real app session on Clearnode with V1 sessionData
        setStep('creating-session');
        const v1Data: SessionDataV1 = {
          v: 1,
          mode: 'lmsr',
          marketId,
          outcome,
          amount,
          timestamp: Date.now(),
        };
        const sessionParams = {
          counterparty: MM_ADDRESS,
          allocations: [
            { asset: ASSET, amount: toMicroUnits(amount), participant: address as `0x${string}` },
            { asset: ASSET, amount: '0', participant: MM_ADDRESS },
          ],
          sessionData: encodeSessionData(v1Data),
        };
        let session;
        try {
          session = await createAppSession(sessionParams);
        } catch (err) {
          if ((err as Error).message?.includes('participant signature')) {
            await reconnect();
            session = await createAppSession(sessionParams);
          } else {
            throw err;
          }
        }

        // Step 2: Notify hub with the real session ID
        setStep('notifying-hub');
        const response = await placeBet({
          address,
          marketId,
          outcome,
          amount,
          appSessionId: session.appSessionId,
          appSessionVersion: session.version,
        });

        setLastResponse(response);

        if (!response.accepted) {
          const err = new Error(response.reason || 'Bet rejected');
          setError(err.message);
          onError?.(err);
        } else {
          onSuccess?.(response);
          refreshBalance();
        }

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
    [address, marketId, clearnodeStatus, createAppSession, reconnect, refreshBalance, onSuccess, onError]
  );

  return {
    bet,
    isLoading,
    step,
    error,
    lastResponse,
  };
}
