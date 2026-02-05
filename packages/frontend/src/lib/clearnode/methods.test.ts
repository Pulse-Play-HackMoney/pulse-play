import {
  createAppSession,
  closeAppSession,
  submitAppState,
  transfer,
  getAppSessions,
  getConfig,
} from './methods';

// The nitrolite mock is auto-resolved by jest.config.js moduleNameMapper
import {
  createAppSessionMessage,
  createCloseAppSessionMessage,
  createSubmitAppStateMessage,
  createTransferMessage,
  createGetAppSessionsMessage,
  parseGetAppSessionsResponse,
  createGetConfigMessageV2,
  parseGetConfigResponse,
} from '@erc7824/nitrolite';

// Mock sendAndWaitBrowser
const mockSendAndWait = jest.fn();
jest.mock('./rpc', () => ({
  sendAndWaitBrowser: (...args: unknown[]) => mockSendAndWait(...args),
}));

const mockSigner = jest.fn();

function createMockWs(readyState = WebSocket.OPEN) {
  return { readyState, send: jest.fn(), close: jest.fn() } as unknown as WebSocket;
}

describe('clearnode/methods', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendAndWait.mockResolvedValue('raw-response');
  });

  // ── createAppSession ──

  describe('createAppSession', () => {
    const params = {
      counterparty: '0xMM01' as `0x${string}`,
      allocations: [
        { asset: 'ytest.usd', amount: '500000', participant: '0xUser' as `0x${string}` },
        { asset: 'ytest.usd', amount: '500000', participant: '0xMM01' as `0x${string}` },
      ],
      sessionData: '{"q":"Ball or Strike?"}',
    };

    it('calls createAppSessionMessage with correct definition', async () => {
      const ws = createMockWs();
      await createAppSession(ws, mockSigner, '0xUser' as `0x${string}`, params);

      expect(createAppSessionMessage).toHaveBeenCalledWith(
        mockSigner,
        expect.objectContaining({
          definition: expect.objectContaining({
            participants: ['0xUser', '0xMM01'],
            weights: [0, 100],
            quorum: 100,
          }),
          allocations: params.allocations,
          session_data: params.sessionData,
        }),
      );
    });

    it('returns appSessionId, version, and status', async () => {
      const ws = createMockWs();
      const result = await createAppSession(ws, mockSigner, '0xUser' as `0x${string}`, params);

      expect(result).toEqual({
        appSessionId: '0xSESSION1',
        version: 1,
        status: 'open',
      });
    });

    it('throws when ws is null', async () => {
      await expect(
        createAppSession(null, mockSigner, '0xUser' as `0x${string}`, params),
      ).rejects.toThrow('not connected');
    });
  });

  // ── closeAppSession ──

  describe('closeAppSession', () => {
    const params = {
      appSessionId: '0xSESSION1' as `0x${string}`,
      allocations: [
        { asset: 'ytest.usd', amount: '1000000', participant: '0xUser' as `0x${string}` },
      ],
    };

    it('calls createCloseAppSessionMessage with correct params', async () => {
      const ws = createMockWs();
      await closeAppSession(ws, mockSigner, params);

      expect(createCloseAppSessionMessage).toHaveBeenCalledWith(
        mockSigner,
        expect.objectContaining({
          app_session_id: '0xSESSION1',
          allocations: params.allocations,
        }),
      );
    });

    it('throws when signer is null', async () => {
      const ws = createMockWs();
      await expect(closeAppSession(ws, null, params)).rejects.toThrow('No Clearnode signer');
    });
  });

  // ── submitAppState ──

  describe('submitAppState', () => {
    const params = {
      appSessionId: '0xSESSION1' as `0x${string}`,
      intent: 'operate' as const,
      version: 2,
      allocations: [
        { asset: 'ytest.usd', amount: '1000000', participant: '0xUser' as `0x${string}` },
      ],
    };

    it('calls createSubmitAppStateMessage with mapped intent', async () => {
      const ws = createMockWs();
      await submitAppState(ws, mockSigner, params);

      expect(createSubmitAppStateMessage).toHaveBeenCalledWith(
        mockSigner,
        expect.objectContaining({
          app_session_id: '0xSESSION1',
          intent: 'operate',
          version: 2,
        }),
      );
    });

    it('returns the new version from response', async () => {
      const ws = createMockWs();
      const result = await submitAppState(ws, mockSigner, params);
      expect(result).toEqual({ version: 2 });
    });

    it('throws when not connected', async () => {
      await expect(submitAppState(null, mockSigner, params)).rejects.toThrow('not connected');
    });
  });

  // ── transfer ──

  describe('transfer', () => {
    const params = {
      destination: '0xRecipient' as `0x${string}`,
      asset: 'ytest.usd',
      amount: '1000000',
    };

    it('calls createTransferMessage with allocations array', async () => {
      const ws = createMockWs();
      await transfer(ws, mockSigner, params);

      expect(createTransferMessage).toHaveBeenCalledWith(
        mockSigner,
        expect.objectContaining({
          destination: '0xRecipient',
          allocations: [{ asset: 'ytest.usd', amount: '1000000' }],
        }),
      );
    });

    it('resolves without returning a value', async () => {
      const ws = createMockWs();
      await expect(transfer(ws, mockSigner, params)).resolves.toBeUndefined();
    });

    it('throws when not connected', async () => {
      await expect(transfer(null, mockSigner, params)).rejects.toThrow('not connected');
    });
  });

  // ── getAppSessions ──

  describe('getAppSessions', () => {
    it('calls createGetAppSessionsMessage with participant and status', async () => {
      const ws = createMockWs();
      await getAppSessions(ws, mockSigner, '0xUser' as `0x${string}`, 'open');

      expect(createGetAppSessionsMessage).toHaveBeenCalledWith(
        mockSigner,
        '0xUser',
        'open',
      );
    });

    it('returns mapped array of AppSessionInfo', async () => {
      (parseGetAppSessionsResponse as jest.Mock).mockReturnValueOnce({
        params: {
          appSessions: [
            {
              appSessionId: '0xS1',
              application: 'pulse-play',
              status: 'open',
              participants: ['0xA', '0xB'],
              version: 3,
              sessionData: '{"q":"Test"}',
            },
          ],
        },
      });

      const ws = createMockWs();
      const result = await getAppSessions(ws, mockSigner, '0xA' as `0x${string}`);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        appSessionId: '0xS1',
        application: 'pulse-play',
        status: 'open',
        participants: ['0xA', '0xB'],
        version: 3,
        sessionData: '{"q":"Test"}',
      });
    });

    it('throws when not connected', async () => {
      await expect(
        getAppSessions(null, mockSigner, '0xUser' as `0x${string}`),
      ).rejects.toThrow('not connected');
    });
  });

  // ── getConfig ──

  describe('getConfig', () => {
    it('calls createGetConfigMessageV2 (no signer needed)', async () => {
      const ws = createMockWs();
      await getConfig(ws);

      expect(createGetConfigMessageV2).toHaveBeenCalled();
      expect(mockSendAndWait).toHaveBeenCalledWith(ws, expect.any(String), 'get_config');
    });

    it('returns broker address and networks', async () => {
      (parseGetConfigResponse as jest.Mock).mockReturnValueOnce({
        params: {
          brokerAddress: '0xBROKER',
          networks: [{ chainId: 11155111, name: 'sepolia', custodyAddress: '0xC', adjudicatorAddress: '0xA' }],
        },
      });

      const ws = createMockWs();
      const result = await getConfig(ws);

      expect(result.brokerAddress).toBe('0xBROKER');
      expect(result.networks).toHaveLength(1);
      expect(result.networks[0].chainId).toBe(11155111);
    });

    it('throws when ws is not connected', async () => {
      await expect(getConfig(null)).rejects.toThrow('not connected');
    });
  });
});
