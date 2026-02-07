'use client';

import { useState, useRef } from 'react';
import { openMarket, closeMarket, resolveOutcome, createGame, activateGame } from '@/lib/api';
import { useSelectedMarket } from '@/providers/SelectedMarketProvider';
import type { Outcome } from '@/lib/types';

interface MarketControlsProps {
  className?: string;
  gameId?: string;
  categoryId?: string;
  outcomes?: string[];
  gameActive?: boolean;
  onMarketChanged?: () => void;
}

const DEFAULT_CATEGORY_ID = 'pitching';

const RESOLVE_COLORS = [
  'bg-blue-600 hover:bg-blue-700',
  'bg-red-600 hover:bg-red-700',
  'bg-green-600 hover:bg-green-700',
  'bg-amber-600 hover:bg-amber-700',
  'bg-purple-600 hover:bg-purple-700',
];

export function MarketControls({
  className = '',
  gameId: propGameId,
  categoryId: propCategoryId,
  outcomes: propOutcomes,
  gameActive: propGameActive,
  onMarketChanged,
}: MarketControlsProps) {
  const { market, outcomes: contextOutcomes, refetch } = useSelectedMarket();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolveResult, setResolveResult] = useState<{
    winners: number;
    losers: number;
    payout: number;
  } | null>(null);

  const resolveOutcomes = propOutcomes ?? contextOutcomes;
  const gameActive = propGameActive ?? true;

  const gameIdRef = useRef<string | null>(propGameId ?? null);
  const categoryId = propCategoryId ?? DEFAULT_CATEGORY_ID;

  const ensureGame = async (): Promise<string> => {
    if (gameIdRef.current) return gameIdRef.current;
    const gameRes = await createGame('baseball', 'Demo Home', 'Demo Away');
    await activateGame(gameRes.game.id);
    gameIdRef.current = gameRes.game.id;
    return gameRes.game.id;
  };

  const handleOpenMarket = async () => {
    setIsLoading(true);
    setError(null);
    setResolveResult(null);

    try {
      const gId = await ensureGame();
      await openMarket({ gameId: gId, categoryId });
      onMarketChanged?.();
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open market');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseMarket = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await closeMarket(
        propGameId && propCategoryId
          ? { gameId: propGameId, categoryId: propCategoryId }
          : undefined
      );
      onMarketChanged?.();
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close market');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolve = async (outcome: Outcome) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await resolveOutcome(
        propGameId && propCategoryId
          ? { outcome, gameId: propGameId, categoryId: propCategoryId }
          : { outcome }
      );
      setResolveResult({
        winners: result.winners,
        losers: result.losers,
        payout: result.totalPayout,
      });
      onMarketChanged?.();
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve market');
    } finally {
      setIsLoading(false);
    }
  };

  const canOpenMarket = gameActive && (!market || market.status === 'RESOLVED');
  const canCloseMarket = market?.status === 'OPEN';
  const canResolve = market?.status === 'CLOSED';
  const cols = resolveOutcomes.length <= 2 ? 'grid-cols-2' : resolveOutcomes.length === 3 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="market-controls">
      <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">Market Controls</h2>

      <div className="flex items-center justify-between mb-4">
        <span className="text-text-secondary">Market Status</span>
        <span
          className={`px-3 py-1 rounded text-sm font-medium ${
            market?.status === 'OPEN'
              ? 'bg-green-500/20 text-green-400'
              : market?.status === 'CLOSED'
              ? 'bg-yellow-500/20 text-yellow-400'
              : market?.status === 'RESOLVED'
              ? 'bg-blue-500/20 text-blue-400'
              : 'bg-gray-600/50 text-gray-400'
          }`}
          data-testid="market-status"
        >
          {market?.status || 'NO MARKET'}
        </span>
      </div>

      {error && (
        <div
          className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-sm text-red-400"
          data-testid="market-error"
        >
          {error}
        </div>
      )}

      {resolveResult && (
        <div
          className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4 text-sm text-green-400"
          data-testid="resolve-result"
        >
          Resolved: {resolveResult.winners} winners, {resolveResult.losers} losers.
          Total payout: ${resolveResult.payout.toFixed(2)}
        </div>
      )}

      <div className="space-y-3">
        <button
          onClick={handleOpenMarket}
          disabled={!canOpenMarket || isLoading}
          className="w-full py-3 rounded-lg font-medium bg-green-600 hover:bg-green-700 text-white disabled:bg-surface-input disabled:text-text-muted disabled:cursor-not-allowed transition-colors"
          data-testid="open-market-button"
        >
          {isLoading ? 'Loading...' : 'Open Market'}
        </button>

        <button
          onClick={handleCloseMarket}
          disabled={!canCloseMarket || isLoading}
          className="w-full py-3 rounded-lg font-medium bg-yellow-600 hover:bg-yellow-700 text-white disabled:bg-surface-input disabled:text-text-muted disabled:cursor-not-allowed transition-colors"
          data-testid="close-market-button"
        >
          Close Market
        </button>

        <div className={`grid ${cols} gap-3`}>
          {resolveOutcomes.map((outcome, i) => (
            <button
              key={outcome}
              onClick={() => handleResolve(outcome)}
              disabled={!canResolve || isLoading}
              className={`py-3 rounded-lg font-medium ${RESOLVE_COLORS[i % RESOLVE_COLORS.length]} text-white disabled:bg-surface-input disabled:text-text-muted disabled:cursor-not-allowed transition-colors`}
              data-testid={`resolve-${outcome.toLowerCase()}-button`}
            >
              Resolve: {outcome}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
