import WebSocket from "ws";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import {
  createGetLedgerBalancesMessage,
  parseGetLedgerBalancesResponse,
  createSubmitAppStateMessage,
  parseSubmitAppStateResponse,
  createCloseAppSessionMessage,
  parseCloseAppSessionResponse,
  createTransferMessage,
  parseTransferResponse,
  createAppSessionMessage,
  parseCreateAppSessionResponse,
  createGetAppSessionsMessage,
  parseGetAppSessionsResponse,
  RPCAppStateIntent,
  RPCProtocolVersion,
  RPCChannelStatus,
  type MessageSigner,
} from "@erc7824/nitrolite";
import { sendAndWait } from "./rpc.js";
import { authenticate } from "./auth.js";
import { requestFaucetQueued } from "./faucet.js";
import type {
  ClearnodeConfig,
  SubmitAppStateParams,
  CloseSessionParams,
  TransferParams,
  CreateAppSessionParams,
  CreateAppSessionResult,
  AppSessionInfo,
} from "./types.js";

const INTENT_MAP: Record<string, RPCAppStateIntent> = {
  operate: RPCAppStateIntent.Operate,
  deposit: RPCAppStateIntent.Deposit,
  withdraw: RPCAppStateIntent.Withdraw,
};

/**
 * Hub-side client for communicating with the Yellow Network Clearnode.
 * Authenticates as the Market Maker (MM) and manages app sessions for bets.
 */
export class ClearnodeClient {
  private config: ClearnodeConfig;
  private ws: WebSocket | null = null;
  private signer: MessageSigner | null = null;
  private mmAddress: string;
  private connectPromise: Promise<void> | null = null;

  constructor(config: ClearnodeConfig) {
    this.config = config;
    this.mmAddress = privateKeyToAccount(config.mmPrivateKey).address;
  }

  /** Open WebSocket and authenticate as the MM wallet. */
  async connect(): Promise<void> {
    const ws = new WebSocket(this.config.url);

    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve());
      ws.addEventListener("error", (e) =>
        reject(new Error(`WebSocket connection failed: ${e.message}`)),
      );
    });

    const account = privateKeyToAccount(this.config.mmPrivateKey);
    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: http(),
    });

    try {
      this.signer = await authenticate(ws, walletClient, {
        application: this.config.application,
        allowances: this.config.allowances,
      });
    } catch (err) {
      ws.close();
      throw err;
    }

    this.ws = ws;
  }

  /** Close WebSocket connection. */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.signer = null;
    }
  }

  /** Whether the client has an active connection and signer. */
  isConnected(): boolean {
    return (
      this.ws !== null &&
      this.ws.readyState === WebSocket.OPEN &&
      this.signer !== null
    );
  }

  /** Get the MM's unified balance for a given asset. */
  async getBalance(asset = "ytest.usd"): Promise<string> {
    await this.ensureConnected();

    const msg = await createGetLedgerBalancesMessage(this.signer!);
    const raw = await sendAndWait(this.ws!, msg, "get_ledger_balances");
    const response = parseGetLedgerBalancesResponse(raw);

    const entry = response.params.ledgerBalances.find(
      (b) => b.asset === asset,
    );
    return entry ? entry.amount : "0";
  }

  /** Request test tokens from the sandbox faucet. */
  async requestFaucet(): Promise<void> {
    await requestFaucetQueued(this.mmAddress, this.config.faucetUrl);
  }

  /** Submit an app state update (reallocate funds within an app session). */
  async submitAppState(
    params: SubmitAppStateParams,
  ): Promise<{ version: number }> {
    await this.ensureConnected();

    const msg = await createSubmitAppStateMessage(this.signer!, {
      app_session_id: params.appSessionId,
      intent: INTENT_MAP[params.intent] ?? RPCAppStateIntent.Operate,
      version: params.version,
      allocations: params.allocations,
      session_data: params.sessionData,
    });

    const raw = await sendAndWait(this.ws!, msg, "submit_app_state");
    const response = parseSubmitAppStateResponse(raw);
    return { version: response.params.version };
  }

  /** Close an app session with final allocations. */
  async closeSession(params: CloseSessionParams): Promise<void> {
    await this.ensureConnected();

    const msg = await createCloseAppSessionMessage(this.signer!, {
      app_session_id: params.appSessionId,
      allocations: params.allocations,
      session_data: params.sessionData,
    });

    const raw = await sendAndWait(this.ws!, msg, "close_app_session");
    parseCloseAppSessionResponse(raw);
  }

  /** Transfer funds from MM's unified balance to another address. */
  async transfer(params: TransferParams): Promise<void> {
    await this.ensureConnected();

    const msg = await createTransferMessage(this.signer!, {
      destination: params.destination,
      allocations: [{ asset: params.asset, amount: params.amount }],
    });

    const raw = await sendAndWait(this.ws!, msg, "transfer");
    parseTransferResponse(raw);
  }

  /** Create an app session (e.g. a betting channel between bettor and MM). */
  async createAppSession(
    params: CreateAppSessionParams,
  ): Promise<CreateAppSessionResult> {
    await this.ensureConnected();

    const msg = await createAppSessionMessage(this.signer!, {
      definition: {
        protocol: RPCProtocolVersion.NitroRPC_0_4,
        participants: params.definition.participants,
        weights: params.definition.weights,
        quorum: params.definition.quorum,
        challenge: params.definition.challenge,
        nonce: params.definition.nonce ?? Date.now(),
        application: this.config.application,
      },
      allocations: params.allocations,
      session_data: params.sessionData,
    });

    const raw = await sendAndWait(this.ws!, msg, "create_app_session");
    const response = parseCreateAppSessionResponse(raw);
    return {
      appSessionId: response.params.appSessionId,
      version: response.params.version,
      status: String(response.params.status),
    };
  }

  /** Query app sessions, optionally filtered by participant and status. */
  async getAppSessions(
    participant?: string,
    status?: string,
  ): Promise<AppSessionInfo[]> {
    await this.ensureConnected();

    const addr = (participant ?? this.mmAddress) as `0x${string}`;
    const channelStatus = status
      ? (status as RPCChannelStatus)
      : undefined;

    const msg = await createGetAppSessionsMessage(
      this.signer!,
      addr,
      channelStatus,
    );

    const raw = await sendAndWait(this.ws!, msg, "get_app_sessions");
    const response = parseGetAppSessionsResponse(raw);

    return response.params.appSessions.map((s: any) => ({
      appSessionId: s.appSessionId,
      application: s.application,
      status: String(s.status),
      participants: s.participants,
      version: s.version,
      sessionData: s.sessionData,
    }));
  }

  /** Get the MM wallet address. */
  getAddress(): string {
    return this.mmAddress;
  }

  /** Lazily connect: reuse if alive, otherwise connect transparently. */
  private async ensureConnected(): Promise<void> {
    if (this.isConnected()) return;
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = this.connect().finally(() => {
      this.connectPromise = null;
    });
    return this.connectPromise;
  }
}
