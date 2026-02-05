/**
 * Pure async RPC functions for Clearnode operations.
 * Each function takes (ws, signer) — testable without React.
 */
import {
  createAppSessionMessage,
  parseCreateAppSessionResponse,
  createCloseAppSessionMessage,
  parseCloseAppSessionResponse,
  createSubmitAppStateMessage,
  parseSubmitAppStateResponse,
  createTransferMessage,
  parseTransferResponse,
  createGetAppSessionsMessage,
  parseGetAppSessionsResponse,
  createGetConfigMessageV2,
  parseGetConfigResponse,
  RPCAppStateIntent,
  RPCProtocolVersion,
  type MessageSigner,
} from '@erc7824/nitrolite';
import type { Address, Hex } from 'viem';
import { sendAndWaitBrowser } from './rpc';

// ── Param / result types ──────────────────────────────────────────────

export interface CreateAppSessionParams {
  counterparty: Address;
  application?: string;
  allocations: { asset: string; amount: string; participant: Address }[];
  sessionData?: string;
  challenge?: number;
}

export interface CreateAppSessionResult {
  appSessionId: Hex;
  version: number;
  status: string;
}

export interface CloseAppSessionParams {
  appSessionId: Hex;
  allocations: { asset: string; amount: string; participant: Address }[];
  sessionData?: string;
}

export interface SubmitAppStateParams {
  appSessionId: Hex;
  intent: 'operate' | 'deposit' | 'withdraw';
  version: number;
  allocations: { asset: string; amount: string; participant: Address }[];
  sessionData?: string;
}

export interface TransferParams {
  destination: Address;
  asset: string;
  amount: string;
}

export interface AppSessionInfo {
  appSessionId: Hex;
  application: string;
  status: string;
  participants: Address[];
  version: number;
  sessionData?: string;
}

export interface ClearnodeConfigInfo {
  brokerAddress: Address;
  networks: { chainId: number; name: string; custodyAddress: Address; adjudicatorAddress: Address }[];
}

// ── Helpers ───────────────────────────────────────────────────────────

const INTENT_MAP: Record<string, typeof RPCAppStateIntent[keyof typeof RPCAppStateIntent]> = {
  operate: RPCAppStateIntent.Operate,
  deposit: RPCAppStateIntent.Deposit,
  withdraw: RPCAppStateIntent.Withdraw,
};

function assertReady(ws: WebSocket | null, signer: MessageSigner | null): asserts ws is WebSocket {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('Clearnode WebSocket is not connected');
  }
  if (!signer) {
    throw new Error('No Clearnode signer available');
  }
}

// ── Public API ────────────────────────────────────────────────────────

export async function createAppSession(
  ws: WebSocket | null,
  signer: MessageSigner | null,
  userAddress: Address,
  params: CreateAppSessionParams,
): Promise<CreateAppSessionResult> {
  assertReady(ws, signer);

  const msg = await createAppSessionMessage(signer!, {
    definition: {
      protocol: RPCProtocolVersion.NitroRPC_0_4,
      participants: [userAddress, params.counterparty],
      weights: [0, 100],
      quorum: 100,
      challenge: params.challenge ?? 3600,
      nonce: Date.now(),
      application: params.application ?? 'pulse-play',
    },
    allocations: params.allocations,
    session_data: params.sessionData,
  });

  const raw = await sendAndWaitBrowser(ws, msg, 'create_app_session');
  const response = parseCreateAppSessionResponse(raw);
  return {
    appSessionId: response.params.appSessionId,
    version: response.params.version,
    status: String(response.params.status),
  };
}

export async function closeAppSession(
  ws: WebSocket | null,
  signer: MessageSigner | null,
  params: CloseAppSessionParams,
): Promise<void> {
  assertReady(ws, signer);

  const msg = await createCloseAppSessionMessage(signer!, {
    app_session_id: params.appSessionId,
    allocations: params.allocations,
    session_data: params.sessionData,
  });

  const raw = await sendAndWaitBrowser(ws, msg, 'close_app_session');
  parseCloseAppSessionResponse(raw);
}

export async function submitAppState(
  ws: WebSocket | null,
  signer: MessageSigner | null,
  params: SubmitAppStateParams,
): Promise<{ version: number }> {
  assertReady(ws, signer);

  const msg = await createSubmitAppStateMessage(signer!, {
    app_session_id: params.appSessionId,
    intent: INTENT_MAP[params.intent] ?? RPCAppStateIntent.Operate,
    version: params.version,
    allocations: params.allocations,
    session_data: params.sessionData,
  });

  const raw = await sendAndWaitBrowser(ws, msg, 'submit_app_state');
  const response = parseSubmitAppStateResponse(raw);
  return { version: response.params.version };
}

export async function transfer(
  ws: WebSocket | null,
  signer: MessageSigner | null,
  params: TransferParams,
): Promise<void> {
  assertReady(ws, signer);

  const msg = await createTransferMessage(signer!, {
    destination: params.destination,
    allocations: [{ asset: params.asset, amount: params.amount }],
  });

  const raw = await sendAndWaitBrowser(ws, msg, 'transfer');
  parseTransferResponse(raw);
}

export async function getAppSessions(
  ws: WebSocket | null,
  signer: MessageSigner | null,
  participant: Address,
  status?: string,
): Promise<AppSessionInfo[]> {
  assertReady(ws, signer);

  const msg = await createGetAppSessionsMessage(
    signer!,
    participant,
    status as Parameters<typeof createGetAppSessionsMessage>[2],
  );

  const raw = await sendAndWaitBrowser(ws, msg, 'get_app_sessions');
  const response = parseGetAppSessionsResponse(raw);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return response.params.appSessions.map((s: Record<string, any>) => ({
    appSessionId: s.appSessionId,
    application: s.application,
    status: String(s.status),
    participants: s.participants,
    version: s.version,
    sessionData: s.sessionData,
  }));
}

export async function getConfig(
  ws: WebSocket | null,
): Promise<ClearnodeConfigInfo> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('Clearnode WebSocket is not connected');
  }

  // V2 — no signer needed, synchronous message creation
  const msg = createGetConfigMessageV2();

  const raw = await sendAndWaitBrowser(ws, msg, 'get_config');
  const response = parseGetConfigResponse(raw);

  return {
    brokerAddress: response.params.brokerAddress,
    networks: response.params.networks,
  };
}
