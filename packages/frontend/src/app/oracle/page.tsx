'use client';

import { useState, useCallback } from 'react';
import {
  GameSelector,
  CategorySelector,
  GameControls,
  MarketControls,
  StateDisplay,
} from '@/components/oracle';
import { OddsDisplay } from '@/components/bettor';
import { SelectedMarketProvider } from '@/providers/SelectedMarketProvider';
import { getGame } from '@/lib/api';
import type { Game, MarketData } from '@/lib/types';

export default function OraclePage() {
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedOutcomes, setSelectedOutcomes] = useState<string[]>([]);

  const refreshGame = useCallback(async () => {
    if (!selectedGame) return;
    try {
      const data = await getGame(selectedGame.id);
      setSelectedGame(data.game);
      setMarkets((data.markets ?? []) as MarketData[]);
    } catch {
      // Silent fail — state persists
    }
  }, [selectedGame]);

  const handleGameSelect = async (game: Game) => {
    setSelectedGame(game);
    setSelectedCategory(null);
    setSelectedOutcomes([]);
    try {
      const data = await getGame(game.id);
      setMarkets((data.markets ?? []) as MarketData[]);
    } catch {
      setMarkets([]);
    }
  };

  const handleCategorySelect = (categoryId: string, outcomes: string[]) => {
    setSelectedCategory(categoryId);
    setSelectedOutcomes(outcomes);
  };

  // Find active market for selected game + category
  const activeMarket = selectedCategory
    ? markets.find(
        (m) => m.categoryId === selectedCategory && m.status !== 'RESOLVED'
      ) ?? markets.find((m) => m.categoryId === selectedCategory) ?? null
    : null;

  const gameActive = selectedGame?.status === 'ACTIVE';

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-mono uppercase tracking-wide text-text-primary">Oracle Control Panel</h1>
        <p className="text-text-secondary mt-2">
          Manage games, markets, and outcomes
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <GameSelector
            selected={selectedGame}
            onSelect={handleGameSelect}
          />

          {selectedGame && (
            <CategorySelector
              sportId={selectedGame.sportId}
              markets={markets}
              selected={selectedCategory}
              onSelect={handleCategorySelect}
            />
          )}

          {selectedGame && (
            <GameControls
              game={selectedGame}
              onStateChanged={refreshGame}
            />
          )}

          {selectedGame && selectedCategory && (
            <SelectedMarketProvider marketId={activeMarket?.id ?? null}>
              <MarketControls
                gameId={selectedGame.id}
                categoryId={selectedCategory}
                outcomes={selectedOutcomes}
                gameActive={gameActive}
                onMarketChanged={refreshGame}
              />
            </SelectedMarketProvider>
          )}
        </div>

        <div className="space-y-6">
          {activeMarket ? (
            <SelectedMarketProvider marketId={activeMarket.id}>
              <OddsDisplay />
              <StateDisplay
                gameActive={gameActive}
                positionCount={0}
                connectionCount={0}
              />
            </SelectedMarketProvider>
          ) : (
            <StateDisplay
              gameActive={gameActive}
              positionCount={0}
              connectionCount={0}
            />
          )}
        </div>
      </div>
    </div>
  );
}
