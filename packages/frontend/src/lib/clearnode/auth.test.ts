import { authenticateBrowser } from './auth';
import {
  createAuthRequestMessage,
  parseAuthChallengeResponse,
  createEIP712AuthMessageSigner,
  createAuthVerifyMessageFromChallenge,
  parseAuthVerifyResponse,
  createECDSAMessageSigner,
} from '@erc7824/nitrolite';

// Mock sendAndWaitBrowser
jest.mock('./rpc', () => ({
  sendAndWaitBrowser: jest.fn().mockResolvedValue('{"res":[1,"mock",{}]}'),
}));

import { sendAndWaitBrowser } from './rpc';

const mockSendAndWait = sendAndWaitBrowser as jest.Mock;

// The viemAccounts mock (via jest moduleNameMapper) provides:
// - generatePrivateKey() → '0x' + 'a'.repeat(64)
// - privateKeyToAccount(key) → { address: '0x' + key.slice(2,42).padStart(40,'0') }
// So the session address from generatePrivateKey is '0x' + 'a'.repeat(40)
const MOCK_SESSION_ADDRESS = `0x${'a'.repeat(40)}`;

// Helper to create a mock WalletClient
function createMockWalletClient(address = '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`) {
  return {
    account: {
      address,
      type: 'local' as const,
    },
    signTypedData: jest.fn(),
  } as unknown as import('viem').WalletClient;
}

// Helper to create a mock browser WebSocket
function createMockWebSocket() {
  return {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
  } as unknown as WebSocket;
}

describe('authenticateBrowser', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Re-establish mock implementations after clearAllMocks
    // (viem/accounts mocks are plain functions, not jest.fn — they don't need re-establishing)
    (createAuthRequestMessage as jest.Mock).mockResolvedValue('{"req":[1,"auth_request",{}]}');
    (parseAuthChallengeResponse as jest.Mock).mockReturnValue({
      params: { challengeMessage: 'mock-challenge' },
    });
    (createEIP712AuthMessageSigner as jest.Mock).mockReturnValue('mock-eip712-signer');
    (createAuthVerifyMessageFromChallenge as jest.Mock).mockResolvedValue('{"req":[2,"auth_verify",{}]}');
    (parseAuthVerifyResponse as jest.Mock).mockReturnValue({
      params: { success: true },
    });
    (createECDSAMessageSigner as jest.Mock).mockReturnValue('mock-ecdsa-signer');
    mockSendAndWait.mockResolvedValue('{"res":[1,"mock",{}]}');
  });

  it('completes 3-step auth flow and returns signer + session info', async () => {
    const ws = createMockWebSocket();
    const walletClient = createMockWalletClient();

    const result = await authenticateBrowser(ws, walletClient);

    // Step 1: auth_request
    expect(createAuthRequestMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        session_key: MOCK_SESSION_ADDRESS,
        application: 'pulse-play',
        scope: 'console',
      }),
    );

    // Step 2: sendAndWait for auth_challenge
    expect(mockSendAndWait).toHaveBeenCalledWith(
      ws,
      expect.any(String),
      'auth_challenge',
    );

    // Step 3: EIP-712 sign + auth_verify
    expect(createEIP712AuthMessageSigner).toHaveBeenCalled();
    expect(createAuthVerifyMessageFromChallenge).toHaveBeenCalledWith(
      'mock-eip712-signer',
      'mock-challenge',
    );
    expect(mockSendAndWait).toHaveBeenCalledWith(
      ws,
      expect.any(String),
      'auth_verify',
    );

    expect(result.signer).toBe('mock-ecdsa-signer');
    expect(result.sessionAddress).toBe(MOCK_SESSION_ADDRESS);
    expect(result.expiresAt).toBeGreaterThan(Date.now());
  });

  it('throws if walletClient has no account', async () => {
    const ws = createMockWebSocket();
    const walletClient = { account: undefined } as unknown as import('viem').WalletClient;

    await expect(authenticateBrowser(ws, walletClient)).rejects.toThrow(
      'WalletClient must have an account attached',
    );
  });

  it('throws if auth_verify returns success=false', async () => {
    const ws = createMockWebSocket();
    const walletClient = createMockWalletClient();

    (parseAuthVerifyResponse as jest.Mock).mockReturnValue({
      params: { success: false },
    });

    await expect(authenticateBrowser(ws, walletClient)).rejects.toThrow(
      'Authentication failed: auth_verify returned success=false',
    );
  });

  it('propagates sendAndWaitBrowser errors', async () => {
    const ws = createMockWebSocket();
    const walletClient = createMockWalletClient();

    mockSendAndWait.mockRejectedValueOnce(new Error('WebSocket timeout'));

    await expect(authenticateBrowser(ws, walletClient)).rejects.toThrow('WebSocket timeout');
  });

  it('accepts custom auth config', async () => {
    const ws = createMockWebSocket();
    const walletClient = createMockWalletClient();

    await authenticateBrowser(ws, walletClient, {
      application: 'custom-app',
      scope: 'custom-scope',
    });

    expect(createAuthRequestMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        application: 'custom-app',
        scope: 'custom-scope',
      }),
    );
  });

  it('uses default config values when not overridden', async () => {
    const ws = createMockWebSocket();
    const walletClient = createMockWalletClient();

    await authenticateBrowser(ws, walletClient);

    expect(createAuthRequestMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        application: 'pulse-play',
        scope: 'console',
        allowances: [{ asset: 'ytest.usd', amount: '1000000000' }],
      }),
    );
  });
});
