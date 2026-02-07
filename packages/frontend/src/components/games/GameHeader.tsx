'use client';

import Link from 'next/link';
import type { Game } from '@/lib/types';

interface GameHeaderProps {
  game: Game;
  className?: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  SCHEDULED: { bg: 'bg-gray-600/50', text: 'text-gray-400' },
  ACTIVE: { bg: 'bg-green-500/20', text: 'text-green-400' },
  COMPLETED: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
};

export function GameHeader({ game, className = '' }: GameHeaderProps) {
  const statusStyle = STATUS_STYLES[game.status] ?? STATUS_STYLES.SCHEDULED;

  return (
    <div className={className} data-testid="game-header">
      <Link
        href="/"
        className="text-sm text-text-secondary hover:text-text-primary transition-colors mb-4 inline-block"
        data-testid="back-link"
      >
        &larr; Back to Games
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <span
          className="px-2 py-0.5 rounded text-xs font-medium capitalize bg-surface-input text-text-secondary"
          data-testid="game-header-sport"
        >
          {game.sportId}
        </span>
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}
          data-testid="game-header-status"
        >
          {game.status}
        </span>
      </div>

      <h1 className="text-2xl font-bold font-mono uppercase tracking-wide text-text-primary" data-testid="game-header-matchup">
        {game.homeTeam} vs {game.awayTeam}
      </h1>
    </div>
  );
}
