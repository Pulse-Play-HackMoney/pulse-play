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
  MarketCloseResponse,
  OutcomeRequest,
  OutcomeResponse,
  AdminStateResponse,
  MMInfoResponse,
  MMFaucetResponse,
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

export async function getPositions(address: string): Promise<PositionsResponse> {
  const response = await fetch(`${HUB_REST_URL}/api/positions/${address}`);
  return handleResponse<PositionsResponse>(response);
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
  request: MarketOpenRequest = {}
): Promise<MarketOpenResponse> {
  const response = await fetch(`${HUB_REST_URL}/api/oracle/market/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  return handleResponse<MarketOpenResponse>(response);
}

export async function closeMarket(): Promise<MarketCloseResponse> {
  const response = await fetch(`${HUB_REST_URL}/api/oracle/market/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
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
