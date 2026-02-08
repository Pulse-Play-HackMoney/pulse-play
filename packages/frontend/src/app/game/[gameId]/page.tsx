'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { getGame, getGameVolume } from '@/lib/api';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { SelectedMarketProvider } from '@/providers/SelectedMarketProvider';
import { GameHeader, MarketSelector, GameBettingArea } from '@/components/games';
import type { Game, MarketData, WsMessage } from '@/lib/types';

export default function GameDetailPage() {
  const params = useParams();
  const gameId = params.gameId as string;

  const [game, setGame] = useState<Game | null>(null);
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameVolume, setGameVolume] = useState(0);
  const [categoryVolumes, setCategoryVolumes] = useState<Record<string, number>>({});
  const [marketVolumes, setMarketVolumes] = useState<Record<string, number>>({});
  const { subscribe } = useWebSocket();

  const fetchGame = useCallback(async () => {
    try {
      const data = await getGame(gameId);
      setGame(data.game);
      const marketList = (data.markets ?? []) as MarketData[];
      setMarkets(marketList);
      setError(null);

      // Initialize volumes from API response
      if (data.game.volume !== undefined) {
        setGameVolume(data.game.volume);
      }
      // Build category and market volumes from the markets array
      const catVols: Record<string, number> = {};
      const mktVols: Record<string, number> = {};
      for (const m of marketList) {
        if (m.volume !== undefined) {
          mktVols[m.id] = m.volume;
          catVols[m.categoryId] = (catVols[m.categoryId] ?? 0) + m.volume;
        }
      }
      setCategoryVolumes(catVols);
      setMarketVolumes(mktVols);
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
      if (message.type === 'VOLUME_UPDATE' && message.gameId === gameId) {
        setGameVolume(message.gameVolume);
        setCategoryVolumes((prev) => ({ ...prev, [message.categoryId]: message.categoryVolume }));
        setMarketVolumes((prev) => ({ ...prev, [message.marketId]: message.marketVolume }));
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
      <GameHeader game={game} volume={gameVolume} />

      <MarketSelector
        sportId={game.sportId}
        markets={markets}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
        categoryVolumes={categoryVolumes}
      />

      {activeMarket ? (
        <SelectedMarketProvider marketId={activeMarket.id}>
          <GameBettingArea gameId={gameId} />
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
