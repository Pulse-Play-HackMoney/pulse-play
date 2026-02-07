'use client';

import { useEffect, useState, useCallback } from 'react';
import { getGames, getGame, getAdminPositions } from '@/lib/api';
import type { Game, MarketData, Position } from '@/lib/types';

export function MarketsPanel() {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [positions, setPositions] = useState<Record<string, Position[]>>({});
  const [expandedMarket, setExpandedMarket] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getGames()
      .then((data) => {
        setGames(data.games);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  const fetchMarkets = useCallback(async (gameId: string) => {
    try {
      const data = await getGame(gameId);
      setMarkets((data.markets ?? []) as MarketData[]);
    } catch {
      setMarkets([]);
    }
  }, []);

  useEffect(() => {
    if (selectedGameId) {
      fetchMarkets(selectedGameId);
    } else {
      setMarkets([]);
    }
  }, [selectedGameId, fetchMarkets]);

  const handleExpandMarket = async (marketId: string) => {
    if (expandedMarket === marketId) {
      setExpandedMarket(null);
      return;
    }
    setExpandedMarket(marketId);
    if (!positions[marketId]) {
      try {
        const data = await getAdminPositions(marketId);
        setPositions((prev) => ({ ...prev, [marketId]: data.positions }));
      } catch {
        setPositions((prev) => ({ ...prev, [marketId]: [] }));
      }
    }
  };

  const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div data-testid="markets-panel">
      <div className="mb-4">
        <select
          value={selectedGameId}
          onChange={(e) => setSelectedGameId(e.target.value)}
          className="w-full bg-surface-input text-text-primary rounded-lg px-3 py-2 text-sm"
          data-testid="market-game-select"
        >
          <option value="">Select a game...</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.homeTeam} vs {g.awayTeam} ({g.sportId})
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-2" data-testid="markets-loading">
          <div className="h-10 bg-surface-input rounded" />
        </div>
      ) : !selectedGameId ? (
        <p className="text-text-muted text-sm text-center py-8" data-testid="markets-empty">
          Select a game to view its markets.
        </p>
      ) : markets.length === 0 ? (
        <p className="text-text-muted text-sm text-center py-8" data-testid="markets-no-markets">
          No markets for this game.
        </p>
      ) : (
        <div className="space-y-2" data-testid="markets-list">
          {markets.map((market) => (
            <div key={market.id} className="bg-surface-raised border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => handleExpandMarket(market.id)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-surface-overlay transition-colors"
                data-testid={`market-row-${market.id}`}
              >
                <div>
                  <span className="text-text-primary text-sm font-mono">{market.id}</span>
                  <span className="text-text-muted text-xs ml-2 capitalize">{market.categoryId}</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    market.status === 'OPEN'
                      ? 'bg-green-500/20 text-green-400'
                      : market.status === 'CLOSED'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : market.status === 'RESOLVED'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-gray-600/50 text-gray-400'
                  }`}
                >
                  {market.status}
                </span>
              </button>

              {expandedMarket === market.id && (
                <div className="px-4 pb-3 border-t border-border" data-testid={`positions-${market.id}`}>
                  {(positions[market.id] ?? []).length === 0 ? (
                    <p className="text-text-muted text-sm py-2">No positions.</p>
                  ) : (
                    <div className="space-y-1 mt-2">
                      {(positions[market.id] ?? []).map((pos, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs py-1"
                          data-testid={`position-row-${idx}`}
                        >
                          <span className="text-text-secondary font-mono">{truncate(pos.address)}</span>
                          <span className="text-text-primary">{pos.outcome}</span>
                          <span className="text-text-secondary">{pos.shares.toFixed(2)} shares</span>
                          <span className="text-text-secondary">${pos.costPaid.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
