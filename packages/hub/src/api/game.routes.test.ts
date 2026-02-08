import { buildApp } from '../app.js';
import { createTestContext, DEFAULT_TEST_GAME_ID } from '../context.js';
import type { AppContext } from '../context.js';
import type { FastifyInstance } from 'fastify';

describe('Game Routes', () => {
  let app: FastifyInstance;
  let ctx: AppContext;

  beforeEach(async () => {
    ctx = createTestContext();
    app = await buildApp(ctx);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/games', () => {
    test('returns all games including the default test game with enriched teams', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/games' });
      const body = res.json();

      expect(res.statusCode).toBe(200);
      expect(body.games).toBeInstanceOf(Array);
      expect(body.games.length).toBeGreaterThanOrEqual(1);

      const testGame = body.games.find((g: any) => g.id === DEFAULT_TEST_GAME_ID);
      expect(testGame).toBeDefined();
      expect(testGame.sportId).toBe('baseball');
      expect(testGame.homeTeamId).toBe('nyy');
      expect(testGame.awayTeamId).toBe('bos');
      expect(testGame.status).toBe('ACTIVE');
      // Enriched team objects
      expect(testGame.homeTeam).toBeDefined();
      expect(testGame.homeTeam.abbreviation).toBe('NYY');
      expect(testGame.awayTeam).toBeDefined();
      expect(testGame.awayTeam.abbreviation).toBe('BOS');
      // Volume included
      expect(testGame.volume).toBe(0);
    });

    test('includes marketCount for each game', async () => {
      // Create markets for the default test game
      ctx.marketManager.createMarket(DEFAULT_TEST_GAME_ID, 'pitching');
      ctx.marketManager.createMarket(DEFAULT_TEST_GAME_ID, 'batting');

      const res = await app.inject({ method: 'GET', url: '/api/games' });
      const body = res.json();

      expect(res.statusCode).toBe(200);
      const testGame = body.games.find((g: any) => g.id === DEFAULT_TEST_GAME_ID);
      expect(testGame).toBeDefined();
      expect(testGame.marketCount).toBe(2);
    });

    test('returns marketCount 0 for games with no markets', async () => {
      const game = ctx.gameManager.createGame('soccer', 'fcb', 'rma', 'no-markets-game');

      const res = await app.inject({ method: 'GET', url: '/api/games' });
      const body = res.json();

      const noMarketsGame = body.games.find((g: any) => g.id === game.id);
      expect(noMarketsGame).toBeDefined();
      expect(noMarketsGame.marketCount).toBe(0);
    });

    test('filters games by sportId', async () => {
      ctx.gameManager.createGame('basketball', 'lal', 'gsw', 'bball-1');
      ctx.gameManager.createGame('baseball', 'lad', 'chc', 'baseball-1');

      const res = await app.inject({
        method: 'GET',
        url: '/api/games?sportId=baseball'
      });
      const body = res.json();

      expect(res.statusCode).toBe(200);
      expect(body.games).toBeInstanceOf(Array);

      body.games.forEach((game: any) => {
        expect(game.sportId).toBe('baseball');
      });

      expect(body.games.length).toBeGreaterThanOrEqual(2);
    });

    test('filters games by status', async () => {
      const scheduled = ctx.gameManager.createGame('baseball', 'lad', 'chc', 'scheduled-1');
      const active = ctx.gameManager.createGame('baseball', 'atl', 'hou', 'active-1');
      ctx.gameManager.activateGame(active.id);

      const res = await app.inject({
        method: 'GET',
        url: '/api/games?status=SCHEDULED'
      });
      const body = res.json();

      expect(res.statusCode).toBe(200);
      expect(body.games).toBeInstanceOf(Array);

      body.games.forEach((game: any) => {
        expect(game.status).toBe('SCHEDULED');
      });

      const foundScheduled = body.games.find((g: any) => g.id === scheduled.id);
      expect(foundScheduled).toBeDefined();
    });
  });

  describe('POST /api/games', () => {
    test('creates a new game with auto-generated ID', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: {
          sportId: 'basketball',
          homeTeamId: 'lal',
          awayTeamId: 'gsw',
        },
      });
      const body = res.json();

      expect(res.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.game).toBeDefined();
      expect(body.game.sportId).toBe('basketball');
      expect(body.game.homeTeamId).toBe('lal');
      expect(body.game.awayTeamId).toBe('gsw');
      expect(body.game.status).toBe('SCHEDULED');
      expect(body.game.id).toBeDefined();
      expect(body.game.createdAt).toBeDefined();
      // Enriched team
      expect(body.game.homeTeam.name).toBe('Los Angeles Lakers');
      expect(body.game.awayTeam.name).toBe('Golden State Warriors');
    });

    test('creates a new game with custom ID', async () => {
      const customId = 'my-custom-game-id';
      const res = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: {
          sportId: 'soccer',
          homeTeamId: 'fcb',
          awayTeamId: 'rma',
          id: customId,
        },
      });
      const body = res.json();

      expect(res.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.game.id).toBe(customId);
      expect(body.game.sportId).toBe('soccer');
      expect(body.game.homeTeamId).toBe('fcb');
      expect(body.game.awayTeamId).toBe('rma');
      expect(body.game.status).toBe('SCHEDULED');
    });

    test('returns 400 when sportId is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: {
          homeTeamId: 'nyy',
          awayTeamId: 'bos',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('sportId, homeTeamId, and awayTeamId are required');
    });

    test('returns 400 when homeTeamId is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: {
          sportId: 'basketball',
          awayTeamId: 'gsw',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('sportId, homeTeamId, and awayTeamId are required');
    });

    test('returns 400 when awayTeamId is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: {
          sportId: 'basketball',
          homeTeamId: 'lal',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('sportId, homeTeamId, and awayTeamId are required');
    });

    test('returns 400 when body is empty', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: {},
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('sportId, homeTeamId, and awayTeamId are required');
    });

    test('returns 400 when team does not belong to sport', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: {
          sportId: 'basketball',
          homeTeamId: 'nyy', // baseball team
          awayTeamId: 'lal',
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("does not belong to sport");
    });
  });

  describe('GET /api/games/:gameId', () => {
    test('returns game with markets and enriched teams when game exists', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/games/${DEFAULT_TEST_GAME_ID}`
      });
      const body = res.json();

      expect(res.statusCode).toBe(200);
      expect(body.game).toBeDefined();
      expect(body.game.id).toBe(DEFAULT_TEST_GAME_ID);
      expect(body.game.sportId).toBe('baseball');
      expect(body.game.homeTeamId).toBe('nyy');
      expect(body.game.awayTeamId).toBe('bos');
      expect(body.game.homeTeam.name).toBe('New York Yankees');
      expect(body.game.awayTeam.name).toBe('Boston Red Sox');
      expect(body.markets).toBeDefined();
      expect(body.markets).toBeInstanceOf(Array);
    });

    test('returns 404 for non-existent game', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/games/non-existent-game-id'
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe('Game not found');
    });

    test('includes markets when they exist for the game', async () => {
      const market1 = ctx.marketManager.createMarket(DEFAULT_TEST_GAME_ID, 'pitching');
      const market2 = ctx.marketManager.createMarket(DEFAULT_TEST_GAME_ID, 'batting');

      const res = await app.inject({
        method: 'GET',
        url: `/api/games/${DEFAULT_TEST_GAME_ID}`
      });
      const body = res.json();

      expect(res.statusCode).toBe(200);
      expect(body.markets).toBeInstanceOf(Array);
      expect(body.markets.length).toBeGreaterThanOrEqual(2);

      const foundMarket1 = body.markets.find((m: any) => m.id === market1.id);
      const foundMarket2 = body.markets.find((m: any) => m.id === market2.id);
      expect(foundMarket1).toBeDefined();
      expect(foundMarket2).toBeDefined();
    });

    test('returns empty markets array when game has no markets', async () => {
      const game = ctx.gameManager.createGame('soccer', 'fcb', 'rma', 'soccer-1');

      const res = await app.inject({
        method: 'GET',
        url: `/api/games/${game.id}`
      });
      const body = res.json();

      expect(res.statusCode).toBe(200);
      expect(body.game.id).toBe(game.id);
      expect(body.markets).toBeInstanceOf(Array);
      expect(body.markets.length).toBe(0);
    });
  });

  describe('GAME_CREATED broadcast', () => {
    test('broadcasts GAME_CREATED on POST /api/games', async () => {
      const spy = jest.spyOn(ctx.ws, 'broadcast');

      await app.inject({
        method: 'POST',
        url: '/api/games',
        payload: {
          sportId: 'basketball',
          homeTeamId: 'lal',
          awayTeamId: 'gsw',
        },
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'GAME_CREATED',
          game: expect.objectContaining({
            sportId: 'basketball',
            status: 'SCHEDULED',
          }),
        }),
      );
    });

    test('broadcasts GAME_CREATED on activate', async () => {
      const game = ctx.gameManager.createGame('baseball', 'lad', 'hou', 'broadcast-activate');
      const spy = jest.spyOn(ctx.ws, 'broadcast');

      await app.inject({
        method: 'POST',
        url: `/api/games/${game.id}/activate`,
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'GAME_CREATED',
          game: expect.objectContaining({
            id: game.id,
            status: 'ACTIVE',
          }),
        }),
      );
    });

    test('broadcasts GAME_CREATED on complete', async () => {
      const game = ctx.gameManager.createGame('baseball', 'lad', 'atl', 'broadcast-complete');
      ctx.gameManager.activateGame(game.id);
      const spy = jest.spyOn(ctx.ws, 'broadcast');

      await app.inject({
        method: 'POST',
        url: `/api/games/${game.id}/complete`,
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'GAME_CREATED',
          game: expect.objectContaining({
            id: game.id,
            status: 'COMPLETED',
          }),
        }),
      );
    });
  });

  describe('POST /api/games/:gameId/activate', () => {
    test('activates a SCHEDULED game', async () => {
      const game = ctx.gameManager.createGame('baseball', 'lad', 'hou', 'scheduled-game');

      expect(game.status).toBe('SCHEDULED');
      expect(game.startedAt).toBeNull();

      const res = await app.inject({
        method: 'POST',
        url: `/api/games/${game.id}/activate`,
      });
      const body = res.json();

      expect(res.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.game.status).toBe('ACTIVE');
      expect(body.game.startedAt).toBeDefined();
      expect(body.game.startedAt).not.toBeNull();
    });

    test('returns 400 when trying to activate an already active game', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/games/${DEFAULT_TEST_GAME_ID}/activate`,
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('Cannot activate game');
      expect(res.json().error).toContain('ACTIVE');
    });

    test('returns 400 when trying to activate a completed game', async () => {
      const game = ctx.gameManager.createGame('baseball', 'atl', 'chc', 'completed-game');
      ctx.gameManager.activateGame(game.id);
      ctx.gameManager.completeGame(game.id);

      const res = await app.inject({
        method: 'POST',
        url: `/api/games/${game.id}/activate`,
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('Cannot activate game');
      expect(res.json().error).toContain('COMPLETED');
    });
  });

  describe('POST /api/games/:gameId/complete', () => {
    test('completes an ACTIVE game', async () => {
      const game = ctx.gameManager.createGame('baseball', 'lad', 'atl', 'active-game');
      ctx.gameManager.activateGame(game.id);

      const activatedGame = ctx.gameManager.getGame(game.id);
      expect(activatedGame?.status).toBe('ACTIVE');
      expect(activatedGame?.completedAt).toBeNull();

      const res = await app.inject({
        method: 'POST',
        url: `/api/games/${game.id}/complete`,
      });
      const body = res.json();

      expect(res.statusCode).toBe(200);
      expect(body.success).toBe(true);
      expect(body.game.status).toBe('COMPLETED');
      expect(body.game.completedAt).toBeDefined();
      expect(body.game.completedAt).not.toBeNull();
    });

    test('returns 400 when trying to complete a SCHEDULED game', async () => {
      const game = ctx.gameManager.createGame('baseball', 'hou', 'chc', 'scheduled-game-2');

      const res = await app.inject({
        method: 'POST',
        url: `/api/games/${game.id}/complete`,
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('Cannot complete game');
      expect(res.json().error).toContain('SCHEDULED');
    });

    test('returns 400 when trying to complete an already completed game', async () => {
      const game = ctx.gameManager.createGame('baseball', 'nyy', 'lad', 'completed-game-2');
      ctx.gameManager.activateGame(game.id);
      ctx.gameManager.completeGame(game.id);

      const res = await app.inject({
        method: 'POST',
        url: `/api/games/${game.id}/complete`,
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('Cannot complete game');
      expect(res.json().error).toContain('COMPLETED');
    });
  });
});
