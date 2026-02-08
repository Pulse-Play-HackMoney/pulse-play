import { HUB_REST_URL } from './config';
import type {
  BetRequest,
  BetResponse,
  MarketResponse,
  PositionsResponse,
  GameStateRequest,
  GameStateResponse,
  MarketOpenRequest,
  MarketOpenResponse,
  MarketCloseRequest,
  MarketCloseResponse,
  OutcomeRequest,
  OutcomeResponse,
  AdminStateResponse,
  MMInfoResponse,
  MMFaucetResponse,
  UserFaucetResponse,
  Sport,
  MarketCategory,
  Team,
  Game,
  UserStats,
  Settlement,
  Position,
  P2POrderRequest,
  P2POrderResponse,
  P2POrder,
  OrderBookDepth,
} from './types';

// API Error class
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Helper to handle responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(response.status, text || response.statusText);
  }
  return response.json() as Promise<T>;
}

// ── Bettor Endpoints ──

export async function placeBet(request: BetRequest): Promise<BetResponse> {
  const response = await fetch(`${HUB_REST_URL}/api/bet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return handleResponse<BetResponse>(response);
}

export async function getMarket(): Promise<MarketResponse> {
  const response = await fetch(`${HUB_REST_URL}/api/market`);
  return handleResponse<MarketResponse>(response);
}

export async function getMarketById(marketId: string): Promise<MarketResponse> {
  const response = await fetch(`${HUB_REST_URL}/api/market/${marketId}`);
  return handleResponse<MarketResponse>(response);
}

export async function getPositions(address: string): Promise<PositionsResponse> {
  const response = await fetch(`${HUB_REST_URL}/api/positions/${address}`);
  return handleResponse<PositionsResponse>(response);
}

// ── Sport & Category Endpoints ──

export async function getSports(): Promise<{ sports: Sport[] }> {
  const response = await fetch(`${HUB_REST_URL}/api/sports`);
  return handleResponse(response);
}

export async function getSportCategories(sportId: string): Promise<{ sportId: string; categories: MarketCategory[] }> {
  const response = await fetch(`${HUB_REST_URL}/api/sports/${sportId}/categories`);
  return handleResponse(response);
}

export async function createSport(name: string, description?: string, id?: string): Promise<{ success: boolean; sport: Sport }> {
  const response = await fetch(`${HUB_REST_URL}/api/sports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, id }),
  });
  return handleResponse(response);
}

export async function updateSport(sportId: string, updates: { name?: string; description?: string }): Promise<{ success: boolean; sport: Sport }> {
  const response = await fetch(`${HUB_REST_URL}/api/sports/${sportId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return handleResponse(response);
}

export async function deleteSport(sportId: string): Promise<{ success: boolean }> {
  const response = await fetch(`${HUB_REST_URL}/api/sports/${sportId}`, { method: 'DELETE' });
  return handleResponse(response);
}

export async function createCategory(
  sportId: string, name: string, outcomes: string[], description?: string,
): Promise<{ success: boolean; category: MarketCategory }> {
  const response = await fetch(`${HUB_REST_URL}/api/sports/${sportId}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, outcomes, description }),
  });
  return handleResponse(response);
}

export async function updateCategory(
  sportId: string, categoryId: string, updates: { name?: string; outcomes?: string[]; description?: string },
): Promise<{ success: boolean; category: MarketCategory }> {
  const response = await fetch(`${HUB_REST_URL}/api/sports/${sportId}/categories/${categoryId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return handleResponse(response);
}

export async function deleteCategory(sportId: string, categoryId: string): Promise<{ success: boolean }> {
  const response = await fetch(`${HUB_REST_URL}/api/sports/${sportId}/categories/${categoryId}`, { method: 'DELETE' });
  return handleResponse(response);
}

// ── Team Endpoints ──

export async function getTeams(sportId?: string): Promise<{ teams: Team[] }> {
  const qs = sportId ? `?sportId=${sportId}` : '';
  const response = await fetch(`${HUB_REST_URL}/api/teams${qs}`);
  return handleResponse(response);
}

export async function getTeam(teamId: string): Promise<{ team: Team }> {
  const response = await fetch(`${HUB_REST_URL}/api/teams/${teamId}`);
  return handleResponse(response);
}

export async function createTeam(
  sportId: string, name: string, abbreviation: string, id?: string,
): Promise<{ success: boolean; team: Team }> {
  const response = await fetch(`${HUB_REST_URL}/api/teams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sportId, name, abbreviation, id }),
  });
  return handleResponse(response);
}

export async function updateTeam(teamId: string, updates: { name?: string; abbreviation?: string }): Promise<{ success: boolean; team: Team }> {
  const response = await fetch(`${HUB_REST_URL}/api/teams/${teamId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return handleResponse(response);
}

export async function deleteTeam(teamId: string): Promise<{ success: boolean }> {
  const response = await fetch(`${HUB_REST_URL}/api/teams/${teamId}`, { method: 'DELETE' });
  return handleResponse(response);
}

export async function uploadTeamLogo(teamId: string, file: File): Promise<{ success: boolean; team: Team }> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${HUB_REST_URL}/api/teams/${teamId}/logo`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse(response);
}

export async function uploadGameImage(gameId: string, file: File): Promise<{ success: boolean; game: Game }> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${HUB_REST_URL}/api/games/${gameId}/image`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse(response);
}

// ── Game Endpoints ──

export async function getGames(filters?: { sportId?: string; status?: string }): Promise<{ games: Game[] }> {
  const params = new URLSearchParams();
  if (filters?.sportId) params.set('sportId', filters.sportId);
  if (filters?.status) params.set('status', filters.status);
  const qs = params.toString();
  const response = await fetch(`${HUB_REST_URL}/api/games${qs ? `?${qs}` : ''}`);
  return handleResponse(response);
}

export async function getGame(gameId: string): Promise<{ game: Game; markets: MarketResponse['market'][] }> {
  const response = await fetch(`${HUB_REST_URL}/api/games/${gameId}`);
  return handleResponse(response);
}

export async function createGame(
  sportId: string,
  homeTeamId: string,
  awayTeamId: string,
  id?: string
): Promise<{ success: boolean; game: Game }> {
  const response = await fetch(`${HUB_REST_URL}/api/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sportId, homeTeamId, awayTeamId, id }),
  });
  return handleResponse(response);
}

export async function activateGame(
  gameId: string
): Promise<{ success: boolean; game: Game }> {
  const response = await fetch(`${HUB_REST_URL}/api/games/${gameId}/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return handleResponse(response);
}

export async function completeGame(
  gameId: string
): Promise<{ success: boolean; game: Game }> {
  const response = await fetch(`${HUB_REST_URL}/api/games/${gameId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return handleResponse(response);
}

// ── Oracle Endpoints ──

export async function setGameState(
  request: GameStateRequest
): Promise<GameStateResponse> {
  const response = await fetch(`${HUB_REST_URL}/api/oracle/game-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return handleResponse<GameStateResponse>(response);
}

export async function openMarket(
  request: MarketOpenRequest
): Promise<MarketOpenResponse> {
  const response = await fetch(`${HUB_REST_URL}/api/oracle/market/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return handleResponse<MarketOpenResponse>(response);
}

export async function closeMarket(
  request?: MarketCloseRequest
): Promise<MarketCloseResponse> {
  const response = await fetch(`${HUB_REST_URL}/api/oracle/market/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request ?? {}),
  });
  return handleResponse<MarketCloseResponse>(response);
}

export async function resolveOutcome(
  request: OutcomeRequest
): Promise<OutcomeResponse> {
  const response = await fetch(`${HUB_REST_URL}/api/oracle/outcome`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return handleResponse<OutcomeResponse>(response);
}

// ── Admin Endpoints ──

export async function getAdminState(): Promise<AdminStateResponse> {
  const response = await fetch(`${HUB_REST_URL}/api/admin/state`);
  return handleResponse<AdminStateResponse>(response);
}

export async function getAdminPositions(marketId: string): Promise<{ positions: Position[] }> {
  const response = await fetch(`${HUB_REST_URL}/api/admin/positions/${marketId}`);
  return handleResponse(response);
}

// ── User Endpoints ──

export async function getUserStats(address: string): Promise<{ user: UserStats }> {
  const response = await fetch(`${HUB_REST_URL}/api/users/${address}`);
  return handleResponse(response);
}

export async function getUserHistory(address: string): Promise<{ history: Settlement[] }> {
  const response = await fetch(`${HUB_REST_URL}/api/users/${address}/history`);
  return handleResponse(response);
}

export async function getLeaderboard(limit?: number): Promise<{ leaderboard: UserStats[] }> {
  const qs = limit ? `?limit=${limit}` : '';
  const response = await fetch(`${HUB_REST_URL}/api/leaderboard${qs}`);
  return handleResponse(response);
}

// ── Market Maker Endpoints ──

export async function getMMInfo(): Promise<MMInfoResponse> {
  const response = await fetch(`${HUB_REST_URL}/api/mm/info`);
  return handleResponse<MMInfoResponse>(response);
}

export async function requestMMFaucet(count = 1): Promise<MMFaucetResponse> {
  const response = await fetch(`${HUB_REST_URL}/api/faucet/mm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count }),
  });
  return handleResponse<MMFaucetResponse>(response);
}

// ── Admin Config Endpoints ──

export interface AdminConfigResponse {
  transactionFeePercent: number;
}

export async function getAdminConfig(): Promise<AdminConfigResponse> {
  const response = await fetch(`${HUB_REST_URL}/api/admin/config`);
  return handleResponse<AdminConfigResponse>(response);
}

export async function updateAdminConfig(transactionFeePercent: number): Promise<{ success: boolean; transactionFeePercent: number }> {
  const response = await fetch(`${HUB_REST_URL}/api/admin/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactionFeePercent }),
  });
  return handleResponse(response);
}

// ── User Faucet Endpoints ──

export async function requestUserFaucet(address: string, count = 1): Promise<UserFaucetResponse> {
  const response = await fetch(`${HUB_REST_URL}/api/faucet/user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, count }),
  });
  return handleResponse<UserFaucetResponse>(response);
}

// ── P2P Order Book Endpoints ──

export async function placeP2POrder(request: P2POrderRequest): Promise<P2POrderResponse> {
  const response = await fetch(`${HUB_REST_URL}/api/orderbook/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return handleResponse<P2POrderResponse>(response);
}

export async function cancelP2POrder(orderId: string): Promise<{ order: P2POrder }> {
  const response = await fetch(`${HUB_REST_URL}/api/orderbook/order/${orderId}`, {
    method: 'DELETE',
  });
  return handleResponse(response);
}

export async function getOrderBookDepth(marketId: string): Promise<OrderBookDepth> {
  const response = await fetch(`${HUB_REST_URL}/api/orderbook/depth/${marketId}`);
  return handleResponse<OrderBookDepth>(response);
}

export async function getUserP2POrders(address: string, marketId?: string): Promise<{ orders: P2POrder[] }> {
  const qs = marketId ? `?marketId=${marketId}` : '';
  const response = await fetch(`${HUB_REST_URL}/api/orderbook/orders/${address}${qs}`);
  return handleResponse(response);
}
