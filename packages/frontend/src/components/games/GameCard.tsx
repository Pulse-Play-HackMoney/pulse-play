'use client';

import Link from 'next/link';
import type { Game } from '@/lib/types';

interface GameCardProps {
  game: Game;
  marketCount?: number;
}

const SPORT_COLORS: Record<string, { bg: string; text: string }> = {
  baseball: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  basketball: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
  soccer: { bg: 'bg-green-500/20', text: 'text-green-400' },
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  SCHEDULED: { bg: 'bg-gray-600/50', text: 'text-gray-400' },
  ACTIVE: { bg: 'bg-green-500/20', text: 'text-green-400' },
  COMPLETED: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
};

function getSportStyle(sportId: string) {
  return SPORT_COLORS[sportId] ?? { bg: 'bg-gray-500/20', text: 'text-gray-400' };
}

function getStatusStyle(status: string) {
  return STATUS_STYLES[status] ?? STATUS_STYLES.SCHEDULED;
}

export function GameCard({ game, marketCount = 0 }: GameCardProps) {
  const sportStyle = getSportStyle(game.sportId);
  const statusStyle = getStatusStyle(game.status);

  return (
    <Link href={`/game/${game.id}`} data-testid={`game-card-${game.id}`}>
      <div className="bg-surface-raised border border-border rounded-lg p-5 hover:border-border-emphasis hover:bg-surface-overlay transition-all cursor-pointer">
        <div className="flex items-center justify-between mb-3">
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${sportStyle.bg} ${sportStyle.text}`}
            data-testid="game-sport-badge"
          >
            {game.sportId}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
            data-testid="game-status-badge"
          >
            {game.status}
          </span>
        </div>

        <h3 className="text-text-primary font-semibold text-lg mb-1" data-testid="game-matchup">
          {game.homeTeam} vs {game.awayTeam}
        </h3>

        <div className="flex items-center justify-between mt-3 text-sm">
          <span className="text-text-muted" data-testid="game-market-count">
            {marketCount > 0 ? `${marketCount} market${marketCount !== 1 ? 's' : ''}` : 'No markets'}
          </span>
          <span className="text-text-muted text-xs">
            {new Date(game.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </Link>
  );
}
