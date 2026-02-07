'use client';

import { useEffect, useState, useCallback } from 'react';
import { getGames } from '@/lib/api';
import { useWebSocket } from '@/providers/WebSocketProvider';
import type { Game, WsMessage } from '@/lib/types';
import { GameCard } from './GameCard';

interface GameListProps {
  className?: string;
  sportId?: string | null;
}

export function GameList({ className = '', sportId }: GameListProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { subscribe } = useWebSocket();

  const fetchGames = useCallback(async () => {
    try {
      const filters: { sportId?: string; status?: string } = {};
      if (sportId) filters.sportId = sportId;
      const data = await getGames(filters);
      setGames(data.games);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load games');
    } finally {
      setIsLoading(false);
    }
  }, [sportId]);

  useEffect(() => {
    setIsLoading(true);
    fetchGames();
  }, [fetchGames]);

  // Re-fetch on game/market state changes via WebSocket
  useEffect(() => {
    const handleMessage = (message: WsMessage) => {
      if (message.type === 'GAME_STATE' || message.type === 'MARKET_STATUS') {
        fetchGames();
      }
    };
    return subscribe(handleMessage);
  }, [subscribe, fetchGames]);

  if (isLoading) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`} data-testid="game-list-loading">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-surface-raised border border-border rounded-lg p-5 animate-pulse">
            <div className="flex justify-between mb-3">
              <div className="h-5 w-16 bg-surface-input rounded" />
              <div className="h-5 w-14 bg-surface-input rounded" />
            </div>
            <div className="h-6 w-3/4 bg-surface-input rounded mb-2" />
            <div className="h-4 w-1/2 bg-surface-input rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={className} data-testid="game-list-error">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className={className} data-testid="game-list-empty">
        <div className="bg-surface-raised border border-border rounded-lg p-8 text-center">
          <p className="text-text-secondary text-lg">No active games</p>
          <p className="text-text-muted text-sm mt-2">
            Visit the <a href="/oracle" className="text-accent hover:underline">Oracle page</a> to create one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}
      data-testid="game-list"
    >
      {games.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  );
}
