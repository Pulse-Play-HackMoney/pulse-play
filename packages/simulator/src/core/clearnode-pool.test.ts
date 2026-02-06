import { ClearnodePool } from './clearnode-pool.js';
import type { Address, Hex } from 'viem';

// ── Mocks ──

// Mock ws module
const mockWsSend = jest.fn();
const mockWsClose = jest.fn();
const mockWsAddEventListener = jest.fn();
const mockWsRemoveEventListener = jest.fn();

let wsOpenCallback: (() => void) | null = null;
let wsCloseCallback: (() => void) | null = null;

jest.mock('ws', () => {
  const MockWebSocket = jest.fn().mockImplementation(() => {
    const instance = {
      send: mockWsSend,
      close: mockWsClose,
      readyState: 1, // OPEN
      addEventListener: mockWsAddEventListener.mockImplementation(
        (event: string, handler: (...args: unknown[]) => void) => {
          if (event === 'open') {
            wsOpenCallback = handler;
            // Auto-fire open event
            setTimeout(() => handler(), 0);
          }
          if (event === 'close') {
            wsCloseCallback = handler;
          }
        },
      ),
      removeEventListener: mockWsRemoveEventListener,
    };
    return instance;
  });
  (MockWebSocket as any).OPEN = 1;
  return { __esModule: true, default: MockWebSocket };
});

// Mock auth
const mockAuthenticate = jest.fn().mockResolvedValue('mock-signer');
jest.mock('./clearnode/auth.js', () => ({
  authenticate: (...args: unknown[]) => mockAuthenticate(...args),
}));

// Mock sendAndWait
const mockSendAndWait = jest.fn().mockResolvedValue('{"res":[1,"create_app_session",{}]}');
jest.mock('./clearnode/rpc.js', () => ({
  sendAndWait: (...args: unknown[]) => mockSendAndWait(...args),
}));

// Mock viem
jest.mock('viem', () => ({
  createWalletClient: jest.fn().mockReturnValue({ account: { address: '0xACCOUNT' } }),
  http: jest.fn().mockReturnValue('http-transport'),
}));

jest.mock('viem/accounts', () => ({
  privateKeyToAccount: jest.fn().mockReturnValue({ address: '0xACCOUNT' }),
}));

jest.mock('viem/chains', () => ({
  sepolia: { id: 11155111, name: 'Sepolia' },
}));

// ── Tests ──

const WALLET_1_KEY = '0x1111111111111111111111111111111111111111111111111111111111111111' as Hex;
const WALLET_1_ADDR = '0x1111111111111111111111111111111111111111' as Address;
const WALLET_2_KEY = '0x2222222222222222222222222222222222222222222222222222222222222222' as Hex;
const WALLET_2_ADDR = '0x2222222222222222222222222222222222222222' as Address;
const MM_ADDR = '0xMM00000000000000000000000000000000000000' as Address;

describe('ClearnodePool', () => {
  let pool: ClearnodePool;

  beforeEach(() => {
    pool = new ClearnodePool({ clearnodeUrl: 'wss://test.clearnode.com/ws' });
    jest.clearAllMocks();
    wsOpenCallback = null;
    wsCloseCallback = null;
    mockAuthenticate.mockResolvedValue('mock-signer');
    mockSendAndWait.mockResolvedValue('{"res":[1,"create_app_session",{}]}');
  });

  describe('addWallet / removeWallet', () => {
    it('registers a wallet with idle status', () => {
      pool.addWallet(WALLET_1_KEY, WALLET_1_ADDR);
      expect(pool.getStatus(WALLET_1_ADDR)).toBe('idle');
    });

    it('removes a wallet and closes WS if open', async () => {
      pool.addWallet(WALLET_1_KEY, WALLET_1_ADDR);
      await pool.ensureConnected(WALLET_1_ADDR);
      pool.removeWallet(WALLET_1_ADDR);
      expect(mockWsClose).toHaveBeenCalled();
      expect(pool.getStatus(WALLET_1_ADDR)).toBe('idle'); // default for unknown
    });
  });

  describe('getStatus', () => {
    it('returns idle for unknown address', () => {
      expect(pool.getStatus('0xUNKNOWN' as Address)).toBe('idle');
    });
  });

  describe('getStats', () => {
    it('counts connected and error wallets', async () => {
      pool.addWallet(WALLET_1_KEY, WALLET_1_ADDR);
      pool.addWallet(WALLET_2_KEY, WALLET_2_ADDR);

      // Connect wallet 1
      await pool.ensureConnected(WALLET_1_ADDR);

      const stats = pool.getStats();
      expect(stats.total).toBe(2);
      expect(stats.connected).toBe(1);
      expect(stats.error).toBe(0);
    });
  });

  describe('ensureConnected', () => {
    it('connects and authenticates lazily', async () => {
      pool.addWallet(WALLET_1_KEY, WALLET_1_ADDR);
      await pool.ensureConnected(WALLET_1_ADDR);
      expect(pool.getStatus(WALLET_1_ADDR)).toBe('connected');
      expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    });

    it('reuses existing connection on subsequent calls', async () => {
      pool.addWallet(WALLET_1_KEY, WALLET_1_ADDR);
      await pool.ensureConnected(WALLET_1_ADDR);
      await pool.ensureConnected(WALLET_1_ADDR);
      expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    });

    it('deduplicates concurrent connect attempts', async () => {
      pool.addWallet(WALLET_1_KEY, WALLET_1_ADDR);
      const p1 = pool.ensureConnected(WALLET_1_ADDR);
      const p2 = pool.ensureConnected(WALLET_1_ADDR);
      await Promise.all([p1, p2]);
      expect(mockAuthenticate).toHaveBeenCalledTimes(1);
    });

    it('throws for unregistered wallet', async () => {
      await expect(pool.ensureConnected('0xUNKNOWN' as Address))
        .rejects.toThrow('Wallet 0xUNKNOWN not registered in pool');
    });

    it('sets error status on connect failure', async () => {
      mockAuthenticate.mockRejectedValue(new Error('Auth failed'));
      pool.addWallet(WALLET_1_KEY, WALLET_1_ADDR);
      await expect(pool.ensureConnected(WALLET_1_ADDR)).rejects.toThrow('Auth failed');
      expect(pool.getStatus(WALLET_1_ADDR)).toBe('error');
    });

    it('re-connects after previous error', async () => {
      pool.addWallet(WALLET_1_KEY, WALLET_1_ADDR);

      // First attempt fails
      mockAuthenticate.mockRejectedValueOnce(new Error('Auth failed'));
      await expect(pool.ensureConnected(WALLET_1_ADDR)).rejects.toThrow('Auth failed');

      // Second attempt succeeds
      mockAuthenticate.mockResolvedValue('mock-signer');
      await pool.ensureConnected(WALLET_1_ADDR);
      expect(pool.getStatus(WALLET_1_ADDR)).toBe('connected');
    });
  });

  describe('createAppSession', () => {
    it('auto-connects then creates session', async () => {
      pool.addWallet(WALLET_1_KEY, WALLET_1_ADDR);
      const result = await pool.createAppSession(WALLET_1_ADDR, MM_ADDR, '5000000');
      expect(mockAuthenticate).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
      expect(result.appSessionId).toBeDefined();
    });

    it('propagates sendAndWait errors', async () => {
      mockSendAndWait.mockRejectedValue(new Error('RPC timeout'));
      pool.addWallet(WALLET_1_KEY, WALLET_1_ADDR);
      await expect(pool.createAppSession(WALLET_1_ADDR, MM_ADDR, '5000000'))
        .rejects.toThrow('RPC timeout');
    });
  });

  describe('getBalance', () => {
    it('auto-connects then fetches balance', async () => {
      pool.addWallet(WALLET_1_KEY, WALLET_1_ADDR);
      const balance = await pool.getBalance(WALLET_1_ADDR);
      expect(mockAuthenticate).toHaveBeenCalledTimes(1);
      expect(mockSendAndWait).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        'get_ledger_balances',
      );
      expect(balance).toBe('1000000');
    });

    it('returns 0 when asset not found', async () => {
      const { parseGetLedgerBalancesResponse } = require('@erc7824/nitrolite');
      parseGetLedgerBalancesResponse.mockReturnValueOnce({
        params: { ledgerBalances: [{ asset: 'other.token', amount: '999' }] },
      });
      pool.addWallet(WALLET_1_KEY, WALLET_1_ADDR);
      const balance = await pool.getBalance(WALLET_1_ADDR);
      expect(balance).toBe('0');
    });
  });

  describe('disconnectAll', () => {
    it('closes all connections and resets to idle', async () => {
      pool.addWallet(WALLET_1_KEY, WALLET_1_ADDR);
      pool.addWallet(WALLET_2_KEY, WALLET_2_ADDR);
      await pool.ensureConnected(WALLET_1_ADDR);
      await pool.ensureConnected(WALLET_2_ADDR);

      pool.disconnectAll();

      expect(pool.getStatus(WALLET_1_ADDR)).toBe('idle');
      expect(pool.getStatus(WALLET_2_ADDR)).toBe('idle');
      expect(pool.getStats().connected).toBe(0);
    });
  });

  describe('clear', () => {
    it('disconnects all and removes all wallets', async () => {
      pool.addWallet(WALLET_1_KEY, WALLET_1_ADDR);
      await pool.ensureConnected(WALLET_1_ADDR);

      pool.clear();

      expect(pool.getStats().total).toBe(0);
    });
  });
});
