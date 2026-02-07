'use client';

import { useEffect, useState, useCallback } from 'react';
import { getGames, createGame, activateGame, completeGame } from '@/lib/api';
import type { Game } from '@/lib/types';

export function GamesPanel() {
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [sportId, setSportId] = useState('baseball');
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchGames = useCallback(async () => {
    try {
      const filters: { status?: string } = {};
      if (statusFilter) filters.status = statusFilter;
      const data = await getGames(filters);
      setGames(data.games);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    setIsLoading(true);
    fetchGames();
  }, [fetchGames]);

  const handleCreate = async () => {
    if (!homeTeam.trim() || !awayTeam.trim()) {
      setCreateError('All fields are required');
      return;
    }
    setCreateError(null);
    try {
      await createGame(sportId, homeTeam.trim(), awayTeam.trim());
      setHomeTeam('');
      setAwayTeam('');
      setShowCreate(false);
      await fetchGames();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create game');
    }
  };

  const handleActivate = async (gameId: string) => {
    setActionError(null);
    try {
      await activateGame(gameId);
      await fetchGames();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to activate');
    }
  };

  const handleComplete = async (gameId: string) => {
    setActionError(null);
    try {
      await completeGame(gameId);
      await fetchGames();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to complete');
    }
  };

  return (
    <div data-testid="games-panel">
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {['', 'SCHEDULED', 'ACTIVE', 'COMPLETED'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-surface-input text-text-primary'
                  : 'bg-surface-raised text-text-secondary hover:text-text-primary'
              }`}
              data-testid={`filter-${s || 'all'}`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="text-sm text-accent hover:text-accent-hover"
          data-testid="toggle-create"
        >
          {showCreate ? 'Cancel' : '+ New Game'}
        </button>
      </div>

      {showCreate && (
        <div className="bg-surface-overlay rounded-lg p-4 mb-4 space-y-2" data-testid="create-form">
          <select
            value={sportId}
            onChange={(e) => setSportId(e.target.value)}
            className="w-full bg-surface-input text-text-primary rounded px-3 py-2 text-sm"
            data-testid="create-sport"
          >
            <option value="baseball">Baseball</option>
            <option value="basketball">Basketball</option>
            <option value="soccer">Soccer</option>
          </select>
          <input
            placeholder="Home Team"
            value={homeTeam}
            onChange={(e) => setHomeTeam(e.target.value)}
            className="w-full bg-surface-input text-text-primary rounded px-3 py-2 text-sm placeholder-text-muted"
            data-testid="create-home"
          />
          <input
            placeholder="Away Team"
            value={awayTeam}
            onChange={(e) => setAwayTeam(e.target.value)}
            className="w-full bg-surface-input text-text-primary rounded px-3 py-2 text-sm placeholder-text-muted"
            data-testid="create-away"
          />
          {createError && <p className="text-red-400 text-sm" data-testid="create-error">{createError}</p>}
          <button
            onClick={handleCreate}
            className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium"
            data-testid="create-submit"
          >
            Create Game
          </button>
        </div>
      )}

      {actionError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded p-2 mb-4 text-sm text-red-400" data-testid="action-error">
          {actionError}
        </div>
      )}

      {isLoading ? (
        <div className="animate-pulse space-y-2" data-testid="games-loading">
          <div className="h-16 bg-surface-input rounded" />
          <div className="h-16 bg-surface-input rounded" />
        </div>
      ) : games.length === 0 ? (
        <p className="text-text-muted text-sm text-center py-8" data-testid="games-empty">
          No games found.
        </p>
      ) : (
        <div className="space-y-2" data-testid="games-list">
          {games.map((game) => (
            <div
              key={game.id}
              className="bg-surface-raised border border-border rounded-lg px-4 py-3 flex items-center justify-between"
              data-testid={`admin-game-${game.id}`}
            >
              <div>
                <span className="text-text-primary font-medium">
                  {game.homeTeam} vs {game.awayTeam}
                </span>
                <span className="text-text-muted text-xs ml-2 capitalize">{game.sportId}</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    game.status === 'ACTIVE'
                      ? 'bg-green-500/20 text-green-400'
                      : game.status === 'COMPLETED'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-gray-600/50 text-gray-400'
                  }`}
                >
                  {game.status}
                </span>
                {game.status === 'SCHEDULED' && (
                  <button
                    onClick={() => handleActivate(game.id)}
                    className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs"
                    data-testid={`activate-${game.id}`}
                  >
                    Activate
                  </button>
                )}
                {game.status === 'ACTIVE' && (
                  <button
                    onClick={() => handleComplete(game.id)}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                    data-testid={`complete-${game.id}`}
                  >
                    Complete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
