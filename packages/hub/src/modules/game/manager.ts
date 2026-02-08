import { eq } from 'drizzle-orm';
import type { Game, GameStatus } from './types.js';
import type { DrizzleDB } from '../../db/connection.js';
import type { MarketManager } from '../market/manager.js';
import { games, teams } from '../../db/schema.js';

function toGame(row: typeof games.$inferSelect): Game {
  return {
    id: row.id,
    sportId: row.sportId,
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId,
    status: row.status as GameStatus,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    imagePath: row.imagePath,
    metadata: row.metadata,
    createdAt: row.createdAt,
  };
}

export class GameManager {
  private db: DrizzleDB;
  private marketManager: MarketManager | null;

  constructor(db: DrizzleDB, marketManager?: MarketManager) {
    this.db = db;
    this.marketManager = marketManager ?? null;
  }

  createGame(sportId: string, homeTeamId: string, awayTeamId: string, id?: string): Game {
    // Validate both teams exist and belong to the sport
    const homeTeam = this.db.select().from(teams).where(eq(teams.id, homeTeamId)).get();
    if (!homeTeam) {
      throw new Error(`Home team '${homeTeamId}' not found`);
    }
    if (homeTeam.sportId !== sportId) {
      throw new Error(`Home team '${homeTeamId}' does not belong to sport '${sportId}'`);
    }

    const awayTeam = this.db.select().from(teams).where(eq(teams.id, awayTeamId)).get();
    if (!awayTeam) {
      throw new Error(`Away team '${awayTeamId}' not found`);
    }
    if (awayTeam.sportId !== sportId) {
      throw new Error(`Away team '${awayTeamId}' does not belong to sport '${sportId}'`);
    }

    const gameId = id ?? `${homeTeam.abbreviation.toLowerCase()}-${awayTeam.abbreviation.toLowerCase()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = Date.now();

    this.db.insert(games).values({
      id: gameId,
      sportId,
      homeTeamId,
      awayTeamId,
      status: 'SCHEDULED',
      startedAt: null,
      completedAt: null,
      imagePath: null,
      metadata: null,
      createdAt: now,
    }).run();

    return this.getGameOrThrow(gameId);
  }

  activateGame(gameId: string): Game {
    const game = this.getGameOrThrow(gameId);
    if (game.status !== 'SCHEDULED') {
      throw new Error(`Cannot activate game: status is ${game.status}`);
    }

    this.db.update(games)
      .set({ status: 'ACTIVE', startedAt: Date.now() })
      .where(eq(games.id, gameId))
      .run();

    return this.getGameOrThrow(gameId);
  }

  completeGame(gameId: string): Game {
    const game = this.getGameOrThrow(gameId);
    if (game.status !== 'ACTIVE') {
      throw new Error(`Cannot complete game: status is ${game.status}`);
    }

    // Validate all markets are resolved before completing
    if (this.marketManager) {
      const markets = this.marketManager.getMarketsByGame(gameId);
      const unresolved = markets.filter((m) => m.status !== 'RESOLVED');
      if (unresolved.length > 0) {
        throw new Error(`Cannot complete game: ${unresolved.length} market(s) are not resolved`);
      }
    }

    this.db.update(games)
      .set({ status: 'COMPLETED', completedAt: Date.now() })
      .where(eq(games.id, gameId))
      .run();

    return this.getGameOrThrow(gameId);
  }

  setImagePath(gameId: string, imagePath: string): Game {
    this.getGameOrThrow(gameId);
    this.db.update(games).set({ imagePath }).where(eq(games.id, gameId)).run();
    return this.getGameOrThrow(gameId);
  }

  getGame(gameId: string): Game | null {
    const row = this.db.select().from(games).where(eq(games.id, gameId)).get();
    return row ? toGame(row) : null;
  }

  getActiveGames(): Game[] {
    return this.db.select().from(games)
      .where(eq(games.status, 'ACTIVE'))
      .all()
      .map(toGame);
  }

  getGamesBySport(sportId: string): Game[] {
    return this.db.select().from(games)
      .where(eq(games.sportId, sportId))
      .all()
      .map(toGame);
  }

  getAllGames(statusFilter?: GameStatus): Game[] {
    if (statusFilter) {
      return this.db.select().from(games)
        .where(eq(games.status, statusFilter))
        .all()
        .map(toGame);
    }
    return this.db.select().from(games).all().map(toGame);
  }

  private getGameOrThrow(gameId: string): Game {
    const game = this.getGame(gameId);
    if (!game) {
      throw new Error(`Game ${gameId} not found`);
    }
    return game;
  }
}
