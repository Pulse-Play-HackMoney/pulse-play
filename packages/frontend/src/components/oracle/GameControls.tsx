'use client';

import { useState } from 'react';
import { activateGame, completeGame } from '@/lib/api';
import type { Game } from '@/lib/types';

interface GameControlsProps {
  className?: string;
  game: Game | null;
  onStateChanged?: () => void;
}

export function GameControls({
  className = '',
  game,
  onStateChanged,
}: GameControlsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleActivate = async () => {
    if (!game) return;
    setIsLoading(true);
    setError(null);
    try {
      await activateGame(game.id);
      onStateChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate game');
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!game) return;
    setIsLoading(true);
    setError(null);
    try {
      await completeGame(game.id);
      onStateChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete game');
    } finally {
      setIsLoading(false);
    }
  };

  const gameActive = game?.status === 'ACTIVE';
  const canActivate = game?.status === 'SCHEDULED';
  const canComplete = game?.status === 'ACTIVE';

  return (
    <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="game-controls">
      <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary mb-4">Game State</h2>

      <div className="flex items-center justify-between mb-4">
        <span className="text-text-secondary">Current Status</span>
        <span
          className={`px-3 py-1 rounded text-sm font-medium ${
            gameActive
              ? 'bg-green-500/20 text-green-400'
              : game?.status === 'COMPLETED'
              ? 'bg-blue-500/20 text-blue-400'
              : 'bg-gray-600/50 text-gray-400'
          }`}
          data-testid="game-status"
        >
          {game?.status ?? 'NO GAME'}
        </span>
      </div>

      {error && (
        <div
          className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-sm text-red-400"
          data-testid="game-error"
        >
          {error}
        </div>
      )}

      <div className="space-y-3">
        {canActivate && (
          <button
            onClick={handleActivate}
            disabled={isLoading}
            className="w-full py-3 rounded-lg font-medium bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="game-activate-button"
          >
            {isLoading ? 'Updating...' : 'Activate Game'}
          </button>
        )}

        {canComplete && (
          <button
            onClick={handleComplete}
            disabled={isLoading}
            className="w-full py-3 rounded-lg font-medium bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="game-complete-button"
          >
            {isLoading ? 'Updating...' : 'Complete Game'}
          </button>
        )}

        {game?.status === 'COMPLETED' && (
          <p className="text-text-muted text-sm text-center">Game has been completed.</p>
        )}

        {!game && (
          <p className="text-text-muted text-sm text-center">Select a game above.</p>
        )}
      </div>
    </div>
  );
}
