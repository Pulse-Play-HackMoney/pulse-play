import type {
  BetRequest,
  BetResponse,
  AdminStateResponse,
  MMInfoResponse,
  Outcome,
  Position,
  MarketSummary,
} from '../types.js';

export interface HubClientConfig {
  restUrl: string;
}

/**
 * REST client for communicating with the PulsePlay hub backend.
 * Wraps all hub API endpoints used by the simulator.
 */
export class HubClient {
  private restUrl: string;

  constructor(config: HubClientConfig) {
    this.restUrl = config.restUrl.replace(/\/$/, '');
  }

  /** Place a bet on behalf of a wallet. */
  async placeBet(params: BetRequest): Promise<BetResponse> {
    return this.post<BetResponse>('/api/bet', params);
  }

  /** Fund a user wallet via the hub faucet proxy. */
  async fundUser(address: string, count = 1): Promise<{ success: boolean; funded: number }> {
    return this.post('/api/faucet/user', { address, count });
  }

  /** Fund the market maker via the hub faucet proxy. */
  async fundMM(count = 1): Promise<{ success: boolean; funded: number }> {
    return this.post('/api/faucet/mm', { count });
  }

  /** Set game state (active/inactive). */
  async setGameState(active: boolean): Promise<{ active: boolean }> {
    return this.post('/api/oracle/game-state', { active });
  }

  /** Open a new market (requires game + category). */
  async openMarket(gameId: string, categoryId: string): Promise<{ success: boolean; marketId: string }> {
    return this.post('/api/oracle/market/open', { gameId, categoryId });
  }

  /** Close the current market. */
  async closeMarket(): Promise<{ success: boolean; marketId: string }> {
    return this.post('/api/oracle/market/close', {});
  }

  /** Resolve the market with an outcome. */
  async resolveMarket(outcome: Outcome): Promise<{ success: boolean; marketId: string; outcome: string; winners: number; losers: number; totalPayout: number }> {
    return this.post('/api/oracle/outcome', { outcome });
  }

  /** Create a game. */
  async createGame(sportId: string, homeTeam: string, awayTeam: string): Promise<{ success: boolean; game: { id: string; status: string } }> {
    return this.post('/api/games', { sportId, homeTeam, awayTeam });
  }

  /** Activate a game. */
  async activateGame(gameId: string): Promise<{ success: boolean; game: { id: string; status: string } }> {
    return this.post(`/api/games/${gameId}/activate`, {});
  }

  /** Get all sports. */
  async getSports(): Promise<{ sports: Array<{ id: string; name: string; categories?: Array<{ id: string; outcomes: string[] }> }> }> {
    return this.get('/api/sports');
  }

  /** Get categories for a sport. */
  async getSportCategories(sportId: string): Promise<{ categories: Array<{ id: string; name: string; outcomes: string[] }> }> {
    return this.get(`/api/sports/${sportId}/categories`);
  }

  /** Get all markets. */
  async getMarkets(): Promise<{ markets: MarketSummary[] }> {
    return this.get('/api/markets');
  }

  /** Get a specific market with prices. */
  async getMarket(marketId: string): Promise<{ market: any; prices: number[]; outcomes: string[] }> {
    return this.get(`/api/market/${marketId}`);
  }

  /** Get full admin state. */
  async getState(): Promise<AdminStateResponse> {
    return this.get<AdminStateResponse>('/api/admin/state');
  }

  /** Get market maker info. */
  async getMMInfo(): Promise<MMInfoResponse> {
    return this.get<MMInfoResponse>('/api/mm/info');
  }

  /** Get positions for a market. */
  async getPositions(marketId: string): Promise<{ positions: Position[] }> {
    return this.get(`/api/admin/positions/${marketId}`);
  }

  /** Reset backend state. */
  async resetBackend(): Promise<{ success: boolean }> {
    return this.post('/api/admin/reset', {});
  }

  // ── Internal helpers ──

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.restUrl}${path}`);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Hub ${path} failed (${response.status}): ${text}`);
    }
    return response.json() as Promise<T>;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.restUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Hub ${path} failed (${response.status}): ${text}`);
    }
    return response.json() as Promise<T>;
  }
}
