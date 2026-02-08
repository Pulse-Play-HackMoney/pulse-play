import type {
  BetRequest,
  BetResponse,
  AdminStateResponse,
  MMInfoResponse,
  Outcome,
  Position,
  MarketSummary,
  GameSummary,
  P2POrderRequest,
  P2POrderResponse,
  P2POrder,
  OrderBookDepth,
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

  /** Close a market. Passes optional gameId/categoryId to target a specific market. */
  async closeMarket(gameId?: string, categoryId?: string): Promise<{ success: boolean; marketId: string }> {
    const body: Record<string, string> = {};
    if (gameId) body.gameId = gameId;
    if (categoryId) body.categoryId = categoryId;
    return this.post('/api/oracle/market/close', body);
  }

  /** Resolve a market with an outcome. Passes optional gameId/categoryId to target a specific market. */
  async resolveMarket(outcome: Outcome, gameId?: string, categoryId?: string): Promise<{ success: boolean; marketId: string; outcome: string; winners: number; losers: number; totalPayout: number }> {
    const body: Record<string, string> = { outcome };
    if (gameId) body.gameId = gameId;
    if (categoryId) body.categoryId = categoryId;
    return this.post('/api/oracle/outcome', body);
  }

  /** Create a game. */
  async createGame(sportId: string, homeTeamId: string, awayTeamId: string): Promise<{ success: boolean; game: { id: string; status: string } }> {
    return this.post('/api/games', { sportId, homeTeamId, awayTeamId });
  }

  /** Activate a game. */
  async activateGame(gameId: string): Promise<{ success: boolean; game: { id: string; status: string } }> {
    return this.post(`/api/games/${gameId}/activate`, {});
  }

  /** Complete a game. */
  async completeGame(gameId: string): Promise<{ success: boolean; game: { id: string; status: string } }> {
    return this.post(`/api/games/${gameId}/complete`, {});
  }

  /** Get all sports. */
  async getSports(): Promise<{ sports: Array<{ id: string; name: string; categories?: Array<{ id: string; outcomes: string[] }> }> }> {
    return this.get('/api/sports');
  }

  /** Get categories for a sport. */
  async getSportCategories(sportId: string): Promise<{ categories: Array<{ id: string; name: string; outcomes: string[] }> }> {
    return this.get(`/api/sports/${sportId}/categories`);
  }

  /** Get all games, with optional filters. */
  async getGames(filters?: { sportId?: string; status?: string }): Promise<{ games: GameSummary[] }> {
    const params = new URLSearchParams();
    if (filters?.sportId) params.set('sportId', filters.sportId);
    if (filters?.status) params.set('status', filters.status);
    const qs = params.toString();
    return this.get(`/api/games${qs ? '?' + qs : ''}`);
  }

  /** Get teams, optionally filtered by sport. */
  async getTeams(sportId?: string): Promise<{ teams: Array<{ id: string; name: string; abbreviation: string; sportId: string }> }> {
    const qs = sportId ? `?sportId=${sportId}` : '';
    return this.get(`/api/teams${qs}`);
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

  // ── P2P Order Book ──

  /** Place a P2P order. */
  async placeP2POrder(params: P2POrderRequest): Promise<P2POrderResponse> {
    return this.post<P2POrderResponse>('/api/orderbook/order', params);
  }

  /** Cancel a P2P order. */
  async cancelP2POrder(orderId: string): Promise<{ order: P2POrder }> {
    return this.delete(`/api/orderbook/order/${orderId}`);
  }

  /** Get order book depth for a market. */
  async getOrderBookDepth(marketId: string): Promise<OrderBookDepth> {
    return this.get<OrderBookDepth>(`/api/orderbook/depth/${marketId}`);
  }

  /** Get user's P2P orders. */
  async getUserP2POrders(address: string, marketId?: string): Promise<{ orders: P2POrder[] }> {
    const qs = marketId ? `?marketId=${marketId}` : '';
    return this.get(`/api/orderbook/orders/${address}${qs}`);
  }

  // ── Internal helpers ──

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.restUrl}${path}`);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(this.extractErrorMessage(path, response.status, text));
    }
    return response.json() as Promise<T>;
  }

  private async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${this.restUrl}${path}`, { method: 'DELETE' });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(this.extractErrorMessage(path, response.status, text));
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
      throw new Error(this.extractErrorMessage(path, response.status, text));
    }
    return response.json() as Promise<T>;
  }

  private extractErrorMessage(path: string, status: number, text: string): string {
    try {
      const json = JSON.parse(text);
      if (json.error) return json.error;
      if (json.reason) return json.reason;
    } catch { /* not JSON */ }
    return `Hub ${path} failed (${status}): ${text}`;
  }
}
