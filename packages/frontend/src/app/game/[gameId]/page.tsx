'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { getGame } from '@/lib/api';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { SelectedMarketProvider } from '@/providers/SelectedMarketProvider';
import { GameHeader, MarketSelector } from '@/components/games';
import { OddsDisplay, BetForm, PositionList } from '@/components/bettor';
import { AccountBalanceCard } from '@/components/account';
import type { Game, MarketData, WsMessage } from '@/lib/types';

export default function GameDetailPage() {
  const params = useParams();
  const gameId = params.gameId as string;

  const [game, setGame] = useState<Game | null>(null);
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { subscribe } = useWebSocket();

  const fetchGame = useCallback(async () => {
    try {
      const data = await getGame(gameId);
      setGame(data.game);
      setMarkets((data.markets ?? []) as MarketData[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load game');
    } finally {
      setIsLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    fetchGame();
  }, [fetchGame]);

  // Listen for game/market changes
  useEffect(() => {
    const handleMessage = (message: WsMessage) => {
      if (message.type === 'GAME_STATE' || message.type === 'MARKET_STATUS') {
        fetchGame();
      }
    };
    return subscribe(handleMessage);
  }, [subscribe, fetchGame]);

  // Find latest non-RESOLVED market for selected category
  const activeMarket = selectedCategory
    ? markets.find(
        (m) => m.categoryId === selectedCategory && m.status !== 'RESOLVED'
      ) ?? markets.find((m) => m.categoryId === selectedCategory) ?? null
    : null;

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="game-detail-loading">
        <div className="animate-pulse">
          <div className="h-4 w-32 bg-surface-input rounded mb-4" />
          <div className="h-8 w-64 bg-surface-input rounded mb-2" />
          <div className="h-12 w-96 bg-surface-input rounded" />
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="space-y-6" data-testid="game-detail-error">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          {error || 'Game not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GameHeader game={game} />

      <MarketSelector
        sportId={game.sportId}
        markets={markets}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />

      {activeMarket ? (
        <SelectedMarketProvider marketId={activeMarket.id}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <OddsDisplay />
              <BetForm />
            </div>
            <div className="space-y-6">
              <AccountBalanceCard />
              <PositionList />
            </div>
          </div>
        </SelectedMarketProvider>
      ) : selectedCategory ? (
        <div className="bg-surface-raised border border-border rounded-lg p-8 text-center" data-testid="no-market-message">
          <p className="text-text-secondary text-lg">No market open for this category</p>
          <p className="text-text-muted text-sm mt-2">
            Visit the <a href="/oracle" className="text-accent hover:underline">Oracle page</a> to open one.
          </p>
        </div>
      ) : null}
    </div>
  );
}
