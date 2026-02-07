'use client';

import { useEffect, useState, useCallback } from 'react';
import { getGames, getSports, createGame, activateGame } from '@/lib/api';
import type { Game, Sport } from '@/lib/types';

interface GameSelectorProps {
  className?: string;
  selected: Game | null;
  onSelect: (game: Game) => void;
}

export function GameSelector({ className = '', selected, onSelect }: GameSelectorProps) {
  const [games, setGames] = useState<Game[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Create form fields
  const [newSportId, setNewSportId] = useState('');
  const [newHomeTeam, setNewHomeTeam] = useState('');
  const [newAwayTeam, setNewAwayTeam] = useState('');

  const fetchGames = useCallback(async () => {
    try {
      const data = await getGames();
      setGames(data.games);
    } catch {
      // Silent fail — games list will be empty
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGames();
    getSports()
      .then((data) => {
        setSports(data.sports);
        if (data.sports.length > 0) setNewSportId(data.sports[0].id);
      })
      .catch(() => {});
  }, [fetchGames]);

  const handleCreateGame = async () => {
    if (!newSportId || !newHomeTeam.trim() || !newAwayTeam.trim()) {
      setCreateError('All fields are required');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const result = await createGame(newSportId, newHomeTeam.trim(), newAwayTeam.trim());
      const activateResult = await activateGame(result.game.id);
      onSelect(activateResult.game);
      setShowCreate(false);
      setNewHomeTeam('');
      setNewAwayTeam('');
      await fetchGames();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create game');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="game-selector">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary">Select Game</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="text-sm text-accent hover:text-accent-hover transition-colors"
          data-testid="toggle-create-form"
        >
          {showCreate ? 'Cancel' : '+ New Game'}
        </button>
      </div>

      {showCreate && (
        <div className="mb-4 p-4 bg-surface-overlay rounded-lg space-y-3" data-testid="create-game-form">
          <select
            value={newSportId}
            onChange={(e) => setNewSportId(e.target.value)}
            className="w-full bg-surface-input text-text-primary rounded-lg px-3 py-2 text-sm"
            data-testid="create-game-sport"
          >
            {sports.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Home Team"
            value={newHomeTeam}
            onChange={(e) => setNewHomeTeam(e.target.value)}
            className="w-full bg-surface-input text-text-primary rounded-lg px-3 py-2 text-sm placeholder-text-muted"
            data-testid="create-game-home"
          />
          <input
            type="text"
            placeholder="Away Team"
            value={newAwayTeam}
            onChange={(e) => setNewAwayTeam(e.target.value)}
            className="w-full bg-surface-input text-text-primary rounded-lg px-3 py-2 text-sm placeholder-text-muted"
            data-testid="create-game-away"
          />
          {createError && (
            <p className="text-red-400 text-sm" data-testid="create-game-error">
              {createError}
            </p>
          )}
          <button
            onClick={handleCreateGame}
            disabled={isCreating}
            className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            data-testid="create-game-submit"
          >
            {isCreating ? 'Creating...' : 'Create & Activate'}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="animate-pulse space-y-2" data-testid="game-selector-loading">
          <div className="h-10 bg-surface-input rounded" />
        </div>
      ) : games.length === 0 ? (
        <p className="text-text-muted text-sm" data-testid="game-selector-empty">
          No games yet. Create one above.
        </p>
      ) : (
        <div className="space-y-2" data-testid="game-selector-list">
          {games.map((game) => (
            <button
              key={game.id}
              onClick={() => onSelect(game)}
              className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-colors ${
                selected?.id === game.id
                  ? 'bg-blue-600/20 border border-blue-500/30 text-white'
                  : 'bg-surface-overlay text-text-secondary hover:text-text-primary hover:bg-surface-input'
              }`}
              data-testid={`game-option-${game.id}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {game.homeTeam} vs {game.awayTeam}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    game.status === 'ACTIVE'
                      ? 'bg-green-500/20 text-green-400'
                      : game.status === 'COMPLETED'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-gray-600/50 text-gray-400'
                  }`}
                >
                  {game.status}
                </span>
              </div>
              <div className="text-xs text-text-muted mt-1 capitalize">{game.sportId}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
