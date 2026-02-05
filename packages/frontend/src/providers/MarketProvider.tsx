'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { getMarket } from '@/lib/api';
import { useWebSocket } from './WebSocketProvider';
import type { MarketData, MarketStatus, WsMessage } from '@/lib/types';

interface MarketState {
  market: MarketData | null;
  priceBall: number;
  priceStrike: number;
  gameActive: boolean;
  positionCount: number;
  connectionCount: number;
  isLoading: boolean;
  error: string | null;
}

interface MarketContextValue extends MarketState {
  refetch: () => Promise<void>;
}

const initialState: MarketState = {
  market: null,
  priceBall: 0.5,
  priceStrike: 0.5,
  gameActive: false,
  positionCount: 0,
  connectionCount: 0,
  isLoading: true,
  error: null,
};

const MarketContext = createContext<MarketContextValue>({
  ...initialState,
  refetch: async () => {},
});

export function useMarket() {
  return useContext(MarketContext);
}

interface MarketProviderProps {
  children: ReactNode;
}

export function MarketProvider({ children }: MarketProviderProps) {
  const [state, setState] = useState<MarketState>(initialState);
  const { subscribe } = useWebSocket();

  // Fetch market data from REST API
  const refetch = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const data = await getMarket();
      setState((prev) => ({
        ...prev,
        market: data.market,
        priceBall: data.priceBall,
        priceStrike: data.priceStrike,
        isLoading: false,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch market',
      }));
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    refetch();
  }, [refetch]);

  // Subscribe to WebSocket updates
  useEffect(() => {
    const handleMessage = (message: WsMessage) => {
      switch (message.type) {
        case 'ODDS_UPDATE':
          setState((prev) => ({
            ...prev,
            priceBall: message.priceBall,
            priceStrike: message.priceStrike,
          }));
          break;

        case 'MARKET_STATUS':
          setState((prev) => {
            const isNewMarket = prev.market ? prev.market.id !== message.marketId : true;
            const market = prev.market
              ? {
                  ...prev.market,
                  id: message.marketId,
                  status: message.status as MarketStatus,
                  outcome: message.outcome ?? (isNewMarket ? null : prev.market.outcome),
                  ...(isNewMarket ? { qBall: 0, qStrike: 0, b: 100 } : {}),
                }
              : {
                  id: message.marketId,
                  status: message.status as MarketStatus,
                  outcome: message.outcome ?? null,
                  qBall: 0,
                  qStrike: 0,
                  b: 100,
                };
            return {
              ...prev,
              market,
              ...(isNewMarket ? { priceBall: 0.5, priceStrike: 0.5, positionCount: 0 } : {}),
            };
          });
          if (message.status === 'OPEN' || message.status === 'RESOLVED') {
            refetch();
          }
          break;

        case 'GAME_STATE':
          setState((prev) => ({
            ...prev,
            gameActive: message.active,
          }));
          break;

        case 'STATE_SYNC':
          // Full state sync from server on connect
          setState((prev) => ({
            ...prev,
            market: message.state.market,
            gameActive: message.state.gameState.active,
            positionCount: message.state.positionCount,
            connectionCount: message.state.connectionCount,
            isLoading: false,
          }));
          // Calculate prices from market data if available
          if (message.state.market) {
            const { qBall, qStrike, b } = message.state.market;
            const maxQ = Math.max(qBall, qStrike);
            const expBall = Math.exp((qBall - maxQ) / b);
            const expStrike = Math.exp((qStrike - maxQ) / b);
            const sumExp = expBall + expStrike;
            setState((prev) => ({
              ...prev,
              priceBall: expBall / sumExp,
              priceStrike: expStrike / sumExp,
            }));
          }
          break;

        case 'CONNECTION_COUNT':
          setState((prev) => ({
            ...prev,
            connectionCount: message.count,
          }));
          break;

        case 'POSITION_ADDED':
          setState((prev) => ({
            ...prev,
            positionCount: message.positionCount,
          }));
          break;
      }
    };

    return subscribe(handleMessage);
  }, [subscribe, refetch]);

  const value: MarketContextValue = {
    ...state,
    refetch,
  };

  return (
    <MarketContext.Provider value={value}>{children}</MarketContext.Provider>
  );
}
