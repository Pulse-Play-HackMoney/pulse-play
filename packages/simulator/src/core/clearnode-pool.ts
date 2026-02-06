import WebSocket from 'ws';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import {
  createAppSessionMessage,
  parseCreateAppSessionResponse,
  createGetLedgerBalancesMessage,
  parseGetLedgerBalancesResponse,
  RPCProtocolVersion,
  type MessageSigner,
} from '@erc7824/nitrolite';
import type { Address, Hex } from 'viem';
import type { ClearnodeConnectionStatus } from '../types.js';
import { authenticate } from './clearnode/auth.js';
import { sendAndWait } from './clearnode/rpc.js';

export interface ClearnodePoolConfig {
  clearnodeUrl: string;
  application?: string;
}

interface PooledConnection {
  address: Address;
  privateKey: Hex;
  ws: WebSocket | null;
  signer: MessageSigner | null;
  status: ClearnodeConnectionStatus;
  connectPromise: Promise<void> | null;
}

export interface CreateAppSessionResult {
  appSessionId: string;
  version: number;
  status: string;
}

/**
 * Manages one lazy Clearnode WebSocket connection per wallet.
 * Connections are established on-demand (ensureConnected) and reused.
 */
export class ClearnodePool {
  private config: ClearnodePoolConfig;
  private connections: Map<string, PooledConnection> = new Map();

  constructor(config: ClearnodePoolConfig) {
    this.config = config;
  }

  /** Register a wallet in the pool (status = idle, no WS connection yet). */
  addWallet(privateKey: Hex, address: Address): void {
    const key = address.toLowerCase();
    this.connections.set(key, {
      address,
      privateKey,
      ws: null,
      signer: null,
      status: 'idle',
      connectPromise: null,
    });
  }

  /** Remove a wallet from the pool, closing its WS if open. */
  removeWallet(address: Address): void {
    const key = address.toLowerCase();
    const conn = this.connections.get(key);
    if (conn?.ws) {
      conn.ws.close();
    }
    this.connections.delete(key);
  }

  /** Get the connection status for a wallet. */
  getStatus(address: Address): ClearnodeConnectionStatus {
    const conn = this.connections.get(address.toLowerCase());
    return conn?.status ?? 'idle';
  }

  /** Get aggregate stats for the pool. */
  getStats(): { total: number; connected: number; error: number } {
    let connected = 0;
    let error = 0;
    for (const conn of this.connections.values()) {
      if (conn.status === 'connected') connected++;
      if (conn.status === 'error') error++;
    }
    return { total: this.connections.size, connected, error };
  }

  /**
   * Lazily connect and authenticate a wallet with Clearnode.
   * If already connected, returns immediately.
   * Deduplicates concurrent connect attempts via shared promise.
   */
  async ensureConnected(address: Address): Promise<void> {
    const key = address.toLowerCase();
    const conn = this.connections.get(key);
    if (!conn) {
      throw new Error(`Wallet ${address} not registered in pool`);
    }

    // Fast path: already connected
    if (conn.status === 'connected' && conn.ws && conn.ws.readyState === WebSocket.OPEN && conn.signer) {
      return;
    }

    // Dedup concurrent connects
    if (conn.connectPromise) {
      return conn.connectPromise;
    }

    conn.connectPromise = this.doConnect(conn).finally(() => {
      conn.connectPromise = null;
    });

    return conn.connectPromise;
  }

  /**
   * Create an app session between the bettor wallet and the MM.
   * Auto-connects the bettor wallet if not already connected.
   */
  async createAppSession(
    bettorAddress: Address,
    mmAddress: Address,
    amount: string,
  ): Promise<CreateAppSessionResult> {
    await this.ensureConnected(bettorAddress);

    const conn = this.connections.get(bettorAddress.toLowerCase())!;

    const msg = await createAppSessionMessage(conn.signer!, {
      definition: {
        protocol: RPCProtocolVersion.NitroRPC_0_4,
        participants: [bettorAddress, mmAddress],
        weights: [0, 100],
        quorum: 100,
        challenge: 3600,
        nonce: Date.now(),
        application: this.config.application ?? 'pulse-play',
      },
      allocations: [
        { asset: 'ytest.usd', amount, participant: bettorAddress },
      ],
    });

    const raw = await sendAndWait(conn.ws!, msg, 'create_app_session');
    const response = parseCreateAppSessionResponse(raw);

    return {
      appSessionId: response.params.appSessionId,
      version: response.params.version,
      status: String(response.params.status),
    };
  }

  /**
   * Fetch the Clearnode ledger balance for a wallet.
   * Auto-connects the wallet if not already connected.
   */
  async getBalance(address: Address, asset = 'ytest.usd'): Promise<string> {
    await this.ensureConnected(address);

    const conn = this.connections.get(address.toLowerCase())!;

    const msg = await createGetLedgerBalancesMessage(conn.signer!);
    const raw = await sendAndWait(conn.ws!, msg, 'get_ledger_balances');
    const response = parseGetLedgerBalancesResponse(raw);

    const entry = response.params.ledgerBalances.find(
      (b: { asset: string; amount: string }) => b.asset === asset,
    );
    return entry ? entry.amount : '0';
  }

  /** Disconnect all wallets and close all WebSocket connections. */
  disconnectAll(): void {
    for (const conn of this.connections.values()) {
      if (conn.ws) {
        conn.ws.close();
        conn.ws = null;
        conn.signer = null;
      }
      conn.status = 'idle';
      conn.connectPromise = null;
    }
  }

  /** Clear the pool entirely (disconnect + remove all). */
  clear(): void {
    this.disconnectAll();
    this.connections.clear();
  }

  // ── Internal ──

  private async doConnect(conn: PooledConnection): Promise<void> {
    conn.status = 'connecting';

    // Close any stale connection
    if (conn.ws) {
      conn.ws.close();
      conn.ws = null;
      conn.signer = null;
    }

    try {
      const ws = new WebSocket(this.config.clearnodeUrl);

      await new Promise<void>((resolve, reject) => {
        ws.addEventListener('open', () => resolve());
        ws.addEventListener('error', (e) =>
          reject(new Error(`WebSocket connection failed: ${(e as { message?: string }).message ?? 'unknown'}`)),
        );
      });

      const account = privateKeyToAccount(conn.privateKey);
      const walletClient = createWalletClient({
        account,
        chain: sepolia,
        transport: http(),
      });

      const signer = await authenticate(ws, walletClient, {
        application: this.config.application ?? 'pulse-play',
      });

      conn.ws = ws;
      conn.signer = signer;
      conn.status = 'connected';

      // Handle unexpected close → mark as idle for re-auth on next use
      ws.addEventListener('close', () => {
        conn.ws = null;
        conn.signer = null;
        conn.status = 'idle';
      });
    } catch (err) {
      conn.status = 'error';
      throw err;
    }
  }
}
