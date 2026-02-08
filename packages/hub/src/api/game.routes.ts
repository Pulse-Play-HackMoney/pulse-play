import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../context.js';
import type { Game, GameStatus } from '../modules/game/types.js';
import { saveUpload } from './upload.js';

export function registerGameRoutes(app: FastifyInstance, ctx: AppContext): void {
  // Helper to enrich a game with team objects and volume
  function enrichGame(game: Game) {
    const homeTeam = ctx.teamManager.getTeam(game.homeTeamId);
    const awayTeam = ctx.teamManager.getTeam(game.awayTeamId);
    const volume = ctx.marketManager.getGameVolume(game.id);
    return { ...game, homeTeam, awayTeam, volume };
  }

  app.get<{ Querystring: { sportId?: string; status?: string } }>('/api/games', async (req) => {
    const { sportId, status } = req.query;

    let games;
    if (sportId) {
      games = ctx.gameManager.getGamesBySport(sportId);
    } else if (status) {
      games = ctx.gameManager.getAllGames(status as GameStatus);
    } else {
      games = ctx.gameManager.getAllGames();
    }

    return {
      games: games.map(g => ({
        ...enrichGame(g),
        marketCount: ctx.marketManager.getMarketsByGame(g.id).length,
      })),
    };
  });

  app.post<{ Body: { sportId?: string; homeTeamId?: string; awayTeamId?: string; id?: string } }>(
    '/api/games',
    async (req, reply) => {
      const { sportId, homeTeamId, awayTeamId, id } = req.body ?? {} as any;
      if (!sportId || !homeTeamId || !awayTeamId) {
        return reply.status(400).send({ error: 'sportId, homeTeamId, and awayTeamId are required' });
      }

      try {
        const game = ctx.gameManager.createGame(sportId, homeTeamId, awayTeamId, id);
        ctx.ws.broadcast({
          type: 'GAME_CREATED',
          game: { id: game.id, sportId: game.sportId, status: game.status },
        });
        return { success: true, game: enrichGame(game) };
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    },
  );

  app.get<{ Params: { gameId: string } }>('/api/games/:gameId', async (req, reply) => {
    const game = ctx.gameManager.getGame(req.params.gameId);
    if (!game) {
      return reply.status(404).send({ error: 'Game not found' });
    }

    const markets = ctx.marketManager.getMarketsByGame(game.id);
    return { game: enrichGame(game), markets };
  });

  app.post<{ Params: { gameId: string } }>('/api/games/:gameId/activate', async (req, reply) => {
    try {
      const game = ctx.gameManager.activateGame(req.params.gameId);
      ctx.ws.broadcast({
        type: 'GAME_CREATED',
        game: { id: game.id, sportId: game.sportId, status: game.status },
      });
      ctx.ws.broadcast({ type: 'GAME_STATE', active: true });
      return { success: true, game: enrichGame(game) };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  app.post<{ Params: { gameId: string } }>('/api/games/:gameId/complete', async (req, reply) => {
    try {
      const game = ctx.gameManager.completeGame(req.params.gameId);
      ctx.ws.broadcast({
        type: 'GAME_CREATED',
        game: { id: game.id, sportId: game.sportId, status: game.status },
      });
      // Broadcast GAME_STATE inactive if no other active games remain
      const activeGames = ctx.gameManager.getActiveGames();
      if (activeGames.length === 0) {
        ctx.ws.broadcast({ type: 'GAME_STATE', active: false });
      }
      return { success: true, game: enrichGame(game) };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  app.get<{ Params: { gameId: string } }>('/api/games/:gameId/volume', async (req, reply) => {
    const game = ctx.gameManager.getGame(req.params.gameId);
    if (!game) {
      return reply.status(404).send({ error: 'Game not found' });
    }

    const gameVolume = ctx.marketManager.getGameVolume(game.id);
    const markets = ctx.marketManager.getMarketsByGame(game.id);

    // Group by category
    const categoryVolumes: Record<string, number> = {};
    for (const m of markets) {
      categoryVolumes[m.categoryId] = (categoryVolumes[m.categoryId] ?? 0) + m.volume;
    }

    return {
      gameId: game.id,
      gameVolume,
      categories: categoryVolumes,
      markets: markets.map((m) => ({ id: m.id, categoryId: m.categoryId, volume: m.volume })),
    };
  });

  app.post<{ Params: { gameId: string } }>('/api/games/:gameId/image', async (req, reply) => {
    const { gameId } = req.params;
    const game = ctx.gameManager.getGame(gameId);
    if (!game) {
      return reply.status(404).send({ error: 'Game not found' });
    }

    const file = await req.file();
    if (!file) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    try {
      const imagePath = await saveUpload(file, 'games', gameId, ctx.uploadsDir);
      const updated = ctx.gameManager.setImagePath(gameId, imagePath);
      return { success: true, game: enrichGame(updated) };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });
}
