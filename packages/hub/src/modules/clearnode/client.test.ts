import { ClearnodeClient } from "./client";
import type { ClearnodeConfig } from "./types";

// ── Mocks ────────────────────────────────────────────────────────────────

// Mock the MM private key → address resolution
const MM_ADDRESS = "0xMM00000000000000000000000000000000000001";
const MM_PRIVATE_KEY =
  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as const;

jest.mock("viem/accounts", () => ({
  privateKeyToAccount: () => ({ address: MM_ADDRESS }),
  generatePrivateKey: () =>
    "0xaabbccdd00000000000000000000000000000000000000000000000000000000",
}));

jest.mock("viem", () => ({
  createWalletClient: () => ({
    account: { address: MM_ADDRESS },
  }),
  http: () => "http-transport",
}));

jest.mock("viem/chains", () => ({
  sepolia: { id: 11155111, name: "sepolia" },
}));

// Mock the auth module — use __mockSigner on global to avoid hoisting issues
const mockSigner = jest.fn().mockResolvedValue("signed_message");
(global as any).__mockSigner = mockSigner;
jest.mock("./auth.js", () => ({
  authenticate: jest.fn().mockResolvedValue((global as any).__mockSigner),
}));

// Mock the faucet module
jest.mock("./faucet.js", () => ({
  requestFaucetQueued: jest.fn().mockResolvedValue(undefined),
}));

function getMockRequestFaucet() {
  return require("./faucet.js").requestFaucetQueued as jest.Mock;
}

// Mock WebSocket
class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = MockWebSocket.OPEN;
  private listeners: Record<string, ((...args: any[]) => void)[]> = {};

  addEventListener(event: string, handler: (...args: any[]) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
    // Auto-fire 'open' event
    if (event === "open") {
      setTimeout(() => handler(), 0);
    }
  }

  removeEventListener(event: string, handler: (...args: any[]) => void) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((h) => h !== handler);
    }
  }

  send(_msg: string) {
    // Captured by sendAndWait mock
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
  }

  emit(event: string, data: any) {
    if (this.listeners[event]) {
      for (const h of this.listeners[event]) h(data);
    }
  }
}

let mockWsInstance: MockWebSocket;

jest.mock("ws", () => {
  const Mock = function (this: any) {
    mockWsInstance = new MockWebSocket();
    Object.assign(this, mockWsInstance);
    // Copy prototype methods
    this.addEventListener = mockWsInstance.addEventListener.bind(mockWsInstance);
    this.removeEventListener =
      mockWsInstance.removeEventListener.bind(mockWsInstance);
    this.send = mockWsInstance.send.bind(mockWsInstance);
    this.close = mockWsInstance.close.bind(mockWsInstance);
    Object.defineProperty(this, "readyState", {
      get: () => mockWsInstance.readyState,
    });
  } as any;
  Mock.OPEN = 1;
  Mock.CLOSED = 3;
  return Mock;
});

// Mock @erc7824/nitrolite SDK functions
const mockCreateGetLedgerBalances = jest
  .fn()
  .mockResolvedValue("get_balance_msg");
const mockParseGetLedgerBalances = jest.fn();
const mockCreateSubmitAppState = jest
  .fn()
  .mockResolvedValue("submit_app_state_msg");
const mockParseSubmitAppState = jest.fn();
const mockCreateCloseAppSession = jest
  .fn()
  .mockResolvedValue("close_app_session_msg");
const mockParseCloseAppSession = jest.fn();
const mockCreateTransfer = jest.fn().mockResolvedValue("transfer_msg");
const mockParseTransfer = jest.fn();
const mockCreateAppSession = jest
  .fn()
  .mockResolvedValue("create_app_session_msg");
const mockParseCreateAppSession = jest.fn();
const mockCreateGetAppSessions = jest
  .fn()
  .mockResolvedValue("get_app_sessions_msg");
const mockParseGetAppSessions = jest.fn();

jest.mock("@erc7824/nitrolite", () => ({
  createGetLedgerBalancesMessage: (...args: any[]) =>
    mockCreateGetLedgerBalances(...args),
  parseGetLedgerBalancesResponse: (...args: any[]) =>
    mockParseGetLedgerBalances(...args),
  createSubmitAppStateMessage: (...args: any[]) =>
    mockCreateSubmitAppState(...args),
  parseSubmitAppStateResponse: (...args: any[]) =>
    mockParseSubmitAppState(...args),
  createCloseAppSessionMessage: (...args: any[]) =>
    mockCreateCloseAppSession(...args),
  parseCloseAppSessionResponse: (...args: any[]) =>
    mockParseCloseAppSession(...args),
  createTransferMessage: (...args: any[]) => mockCreateTransfer(...args),
  parseTransferResponse: (...args: any[]) => mockParseTransfer(...args),
  createAppSessionMessage: (...args: any[]) => mockCreateAppSession(...args),
  parseCreateAppSessionResponse: (...args: any[]) =>
    mockParseCreateAppSession(...args),
  createGetAppSessionsMessage: (...args: any[]) =>
    mockCreateGetAppSessions(...args),
  parseGetAppSessionsResponse: (...args: any[]) =>
    mockParseGetAppSessions(...args),
  RPCAppStateIntent: {
    Operate: "operate",
    Deposit: "deposit",
    Withdraw: "withdraw",
  },
  RPCProtocolVersion: {
    NitroRPC_0_2: "NitroRPC/0.2",
    NitroRPC_0_4: "NitroRPC/0.4",
  },
  RPCChannelStatus: {
    Open: "open",
    Closed: "closed",
    Resizing: "resizing",
    Challenged: "challenged",
  },
  createAuthRequestMessage: jest.fn(),
  createAuthVerifyMessageFromChallenge: jest.fn(),
  createEIP712AuthMessageSigner: jest.fn(),
  createECDSAMessageSigner: jest.fn(),
  parseAuthChallengeResponse: jest.fn(),
  parseAuthVerifyResponse: jest.fn(),
}));

// Mock sendAndWait to return controlled responses
const mockSendAndWait = jest.fn();
jest.mock("./rpc.js", () => ({
  sendAndWait: (...args: any[]) => mockSendAndWait(...args),
}));

// ── Config ───────────────────────────────────────────────────────────────

const TEST_CONFIG: ClearnodeConfig = {
  url: "wss://clearnet-sandbox.yellow.com/ws",
  mmPrivateKey: MM_PRIVATE_KEY,
  application: "pulse-play",
  allowances: [{ asset: "ytest.usd", amount: "1000000000" }],
  faucetUrl: "https://clearnet-sandbox.yellow.com/faucet/requestTokens",
};

// ── Tests ────────────────────────────────────────────────────────────────

describe("ClearnodeClient", () => {
  let client: ClearnodeClient;

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-establish mocks cleared by clearAllMocks
    const { authenticate } = require("./auth.js");
    authenticate.mockResolvedValue(mockSigner);
    getMockRequestFaucet().mockResolvedValue(undefined);
    client = new ClearnodeClient(TEST_CONFIG);
  });

  // ── Connection lifecycle ──

  describe("connect()", () => {
    it("opens WebSocket to configured URL", async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);
    });

    it("authenticates as MM after WebSocket opens", async () => {
      const { authenticate } = require("./auth.js");
      await client.connect();
      expect(authenticate).toHaveBeenCalled();
    });

    it("throws if authentication fails", async () => {
      const { authenticate } = require("./auth.js");
      authenticate.mockRejectedValueOnce(new Error("Auth failed"));

      await expect(client.connect()).rejects.toThrow("Auth failed");
      expect(client.isConnected()).toBe(false);
    });
  });

  describe("disconnect()", () => {
    it("closes WebSocket cleanly", async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);

      client.disconnect();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe("isConnected()", () => {
    it("returns false before connect", () => {
      expect(client.isConnected()).toBe(false);
    });

    it("returns true after connect and false after disconnect", async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);

      client.disconnect();
      expect(client.isConnected()).toBe(false);
    });
  });

  // ── getBalance ──

  describe("getBalance()", () => {
    it("sends get_ledger_balances message via signer", async () => {
      await client.connect();
      mockSendAndWait.mockResolvedValueOnce("balance_response");
      mockParseGetLedgerBalances.mockReturnValueOnce({
        params: {
          ledgerBalances: [{ asset: "ytest.usd", amount: "5000000" }],
        },
      });

      const balance = await client.getBalance();

      expect(mockCreateGetLedgerBalances).toHaveBeenCalledWith(mockSigner);
      expect(balance).toBe("5000000");
    });

    it('returns the ytest.usd balance amount from response', async () => {
      await client.connect();
      mockSendAndWait.mockResolvedValueOnce("raw");
      mockParseGetLedgerBalances.mockReturnValueOnce({
        params: {
          ledgerBalances: [
            { asset: "other.token", amount: "999" },
            { asset: "ytest.usd", amount: "1234567" },
          ],
        },
      });

      expect(await client.getBalance()).toBe("1234567");
    });

    it('returns "0" when no balance entry exists for asset', async () => {
      await client.connect();
      mockSendAndWait.mockResolvedValueOnce("raw");
      mockParseGetLedgerBalances.mockReturnValueOnce({
        params: { ledgerBalances: [] },
      });

      expect(await client.getBalance()).toBe("0");
    });

  });

  // ── requestFaucet ──

  describe("requestFaucet()", () => {
    it("calls faucet with MM address and configured URL", async () => {
      await client.requestFaucet();

      expect(getMockRequestFaucet()).toHaveBeenCalledWith(
        MM_ADDRESS,
        TEST_CONFIG.faucetUrl,
      );
    });

    it("throws on HTTP error", async () => {
      getMockRequestFaucet().mockRejectedValueOnce(new Error("Faucet failed (500)"));

      await expect(client.requestFaucet()).rejects.toThrow("Faucet failed");
    });
  });

  // ── submitAppState ──

  describe("submitAppState()", () => {
    const params = {
      appSessionId: "0xabc123" as `0x${string}`,
      intent: "operate" as const,
      version: 2,
      allocations: [
        {
          asset: "ytest.usd",
          amount: "1000000",
          participant: "0xUser1" as `0x${string}`,
        },
      ],
    };

    it("sends submit_app_state with correct params", async () => {
      await client.connect();
      mockSendAndWait.mockResolvedValueOnce("raw");
      mockParseSubmitAppState.mockReturnValueOnce({
        params: { appSessionId: "0xabc123", version: 2, status: "open" },
      });

      await client.submitAppState(params);

      expect(mockCreateSubmitAppState).toHaveBeenCalledWith(
        mockSigner,
        expect.objectContaining({
          app_session_id: "0xabc123",
          intent: "operate",
          version: 2,
        }),
      );
    });

    it("returns the new version from response", async () => {
      await client.connect();
      mockSendAndWait.mockResolvedValueOnce("raw");
      mockParseSubmitAppState.mockReturnValueOnce({
        params: { appSessionId: "0xabc123", version: 3, status: "open" },
      });

      const result = await client.submitAppState({ ...params, version: 3 });
      expect(result.version).toBe(3);
    });

    it("throws on error response", async () => {
      await client.connect();
      mockSendAndWait.mockRejectedValueOnce(new Error("RPC error: invalid version"));

      await expect(client.submitAppState(params)).rejects.toThrow(
        "invalid version",
      );
    });

  });

  // ── closeSession ──

  describe("closeSession()", () => {
    const params = {
      appSessionId: "0xabc123" as `0x${string}`,
      allocations: [
        {
          asset: "ytest.usd",
          amount: "500000",
          participant: "0xUser1" as `0x${string}`,
        },
      ],
    };

    it("sends close_app_session with appSessionId and allocations", async () => {
      await client.connect();
      mockSendAndWait.mockResolvedValueOnce("raw");
      mockParseCloseAppSession.mockReturnValueOnce({
        params: { appSessionId: "0xabc123", version: 1, status: "closed" },
      });

      await client.closeSession(params);

      expect(mockCreateCloseAppSession).toHaveBeenCalledWith(
        mockSigner,
        expect.objectContaining({
          app_session_id: "0xabc123",
          allocations: params.allocations,
        }),
      );
    });

    it("resolves on success response", async () => {
      await client.connect();
      mockSendAndWait.mockResolvedValueOnce("raw");
      mockParseCloseAppSession.mockReturnValueOnce({
        params: { appSessionId: "0xabc123", version: 1, status: "closed" },
      });

      await expect(client.closeSession(params)).resolves.toBeUndefined();
    });

    it("throws on error response", async () => {
      await client.connect();
      mockSendAndWait.mockRejectedValueOnce(new Error("RPC error: session not found"));

      await expect(client.closeSession(params)).rejects.toThrow(
        "session not found",
      );
    });

  });

  // ── transfer ──

  describe("transfer()", () => {
    const params = {
      destination: "0xRecipient01" as `0x${string}`,
      asset: "ytest.usd",
      amount: "1000000",
    };

    it("sends transfer message with destination, asset, and amount", async () => {
      await client.connect();
      mockSendAndWait.mockResolvedValueOnce("raw");
      mockParseTransfer.mockReturnValueOnce({
        params: { transactions: [] },
      });

      await client.transfer(params);

      expect(mockCreateTransfer).toHaveBeenCalledWith(
        mockSigner,
        expect.objectContaining({
          destination: "0xRecipient01",
          allocations: [{ asset: "ytest.usd", amount: "1000000" }],
        }),
      );
    });

    it("resolves on success response", async () => {
      await client.connect();
      mockSendAndWait.mockResolvedValueOnce("raw");
      mockParseTransfer.mockReturnValueOnce({
        params: { transactions: [{ id: 1 }] },
      });

      await expect(client.transfer(params)).resolves.toBeUndefined();
    });

    it("throws on error response (e.g., insufficient funds)", async () => {
      await client.connect();
      mockSendAndWait.mockRejectedValueOnce(
        new Error("RPC error: insufficient funds"),
      );

      await expect(client.transfer(params)).rejects.toThrow(
        "insufficient funds",
      );
    });

  });

  // ── createAppSession ──

  describe("createAppSession()", () => {
    const params = {
      definition: {
        protocol: "NitroRPC/0.4",
        participants: [
          "0xBettor01" as `0x${string}`,
          MM_ADDRESS as `0x${string}`,
        ],
        weights: [0, 100],
        quorum: 100,
        challenge: 3600,
      },
      allocations: [
        {
          asset: "ytest.usd",
          amount: "500000",
          participant: "0xBettor01" as `0x${string}`,
        },
        {
          asset: "ytest.usd",
          amount: "500000",
          participant: MM_ADDRESS as `0x${string}`,
        },
      ],
      sessionData: '{"question":"Ball or Strike?"}',
    };

    it("sends create_app_session with correct definition and allocations", async () => {
      await client.connect();
      mockSendAndWait.mockResolvedValueOnce("raw");
      mockParseCreateAppSession.mockReturnValueOnce({
        params: {
          appSessionId: "0xSESSION1",
          version: 1,
          status: "open",
        },
      });

      await client.createAppSession(params);

      expect(mockCreateAppSession).toHaveBeenCalledWith(
        mockSigner,
        expect.objectContaining({
          definition: expect.objectContaining({
            protocol: "NitroRPC/0.4",
            participants: params.definition.participants,
            weights: [0, 100],
            quorum: 100,
            application: "pulse-play",
          }),
          allocations: params.allocations,
          session_data: params.sessionData,
        }),
      );
    });

    it("returns appSessionId, version, and status", async () => {
      await client.connect();
      mockSendAndWait.mockResolvedValueOnce("raw");
      mockParseCreateAppSession.mockReturnValueOnce({
        params: {
          appSessionId: "0xSESSION1",
          version: 1,
          status: "open",
        },
      });

      const result = await client.createAppSession(params);

      expect(result).toEqual({
        appSessionId: "0xSESSION1",
        version: 1,
        status: "open",
      });
    });

    it("throws on error response", async () => {
      await client.connect();
      mockSendAndWait.mockRejectedValueOnce(
        new Error("RPC error: insufficient balance"),
      );

      await expect(client.createAppSession(params)).rejects.toThrow(
        "insufficient balance",
      );
    });

  });

  // ── getAppSessions ──

  describe("getAppSessions()", () => {
    it("defaults participant to MM address when not provided", async () => {
      await client.connect();
      mockSendAndWait.mockResolvedValueOnce("raw");
      mockParseGetAppSessions.mockReturnValueOnce({
        params: { appSessions: [] },
      });

      await client.getAppSessions();

      expect(mockCreateGetAppSessions).toHaveBeenCalledWith(
        mockSigner,
        MM_ADDRESS,
        undefined,
      );
    });

    it("passes explicit participant and status filter", async () => {
      await client.connect();
      mockSendAndWait.mockResolvedValueOnce("raw");
      mockParseGetAppSessions.mockReturnValueOnce({
        params: { appSessions: [] },
      });

      await client.getAppSessions("0xBettor01", "open");

      expect(mockCreateGetAppSessions).toHaveBeenCalledWith(
        mockSigner,
        "0xBettor01",
        "open",
      );
    });

    it("returns mapped array of AppSessionInfo", async () => {
      await client.connect();
      mockSendAndWait.mockResolvedValueOnce("raw");
      mockParseGetAppSessions.mockReturnValueOnce({
        params: {
          appSessions: [
            {
              appSessionId: "0xS1",
              application: "pulse-play",
              status: "open",
              participants: ["0xA", "0xB"],
              version: 2,
              sessionData: '{"q":"Ball?"}',
            },
            {
              appSessionId: "0xS2",
              application: "pulse-play",
              status: "closed",
              participants: ["0xA", "0xC"],
              version: 5,
            },
          ],
        },
      });

      const sessions = await client.getAppSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions[0]).toEqual({
        appSessionId: "0xS1",
        application: "pulse-play",
        status: "open",
        participants: ["0xA", "0xB"],
        version: 2,
        sessionData: '{"q":"Ball?"}',
      });
      expect(sessions[1].sessionData).toBeUndefined();
    });

  });

  // ── Lazy connection ──

  describe("lazy connection", () => {
    it("auto-connects on first RPC call when not connected", async () => {
      const { authenticate } = require("./auth.js");

      mockSendAndWait.mockResolvedValueOnce("balance_response");
      mockParseGetLedgerBalances.mockReturnValueOnce({
        params: {
          ledgerBalances: [{ asset: "ytest.usd", amount: "42000000" }],
        },
      });

      // No explicit connect() call
      const balance = await client.getBalance();

      expect(authenticate).toHaveBeenCalled();
      expect(balance).toBe("42000000");
      expect(client.isConnected()).toBe(true);
    });

    it("reuses existing connection on subsequent calls", async () => {
      const { authenticate } = require("./auth.js");

      await client.connect();
      authenticate.mockClear();

      mockSendAndWait.mockResolvedValueOnce("raw1");
      mockParseGetLedgerBalances.mockReturnValueOnce({
        params: { ledgerBalances: [{ asset: "ytest.usd", amount: "1" }] },
      });

      mockSendAndWait.mockResolvedValueOnce("raw2");
      mockParseGetLedgerBalances.mockReturnValueOnce({
        params: { ledgerBalances: [{ asset: "ytest.usd", amount: "2" }] },
      });

      await client.getBalance();
      await client.getBalance();

      // authenticate should NOT have been called again — reused existing connection
      expect(authenticate).not.toHaveBeenCalled();
    });

    it("reconnects transparently when connection has dropped", async () => {
      const { authenticate } = require("./auth.js");

      await client.connect();
      authenticate.mockClear();

      // Simulate connection drop
      mockWsInstance.readyState = MockWebSocket.CLOSED;
      expect(client.isConnected()).toBe(false);

      mockSendAndWait.mockResolvedValueOnce("raw");
      mockParseGetLedgerBalances.mockReturnValueOnce({
        params: { ledgerBalances: [{ asset: "ytest.usd", amount: "99" }] },
      });

      const balance = await client.getBalance();

      // Should have reconnected (new authenticate call)
      expect(authenticate).toHaveBeenCalledTimes(1);
      expect(balance).toBe("99");
      expect(client.isConnected()).toBe(true);
    });

    it("deduplicates concurrent connect attempts", async () => {
      const { authenticate } = require("./auth.js");

      // Set up mocks for both RPC calls
      mockSendAndWait
        .mockResolvedValueOnce("raw1")
        .mockResolvedValueOnce("raw2");
      mockParseGetLedgerBalances
        .mockReturnValueOnce({
          params: { ledgerBalances: [{ asset: "ytest.usd", amount: "1" }] },
        })
        .mockReturnValueOnce({
          params: { ledgerBalances: [{ asset: "ytest.usd", amount: "2" }] },
        });

      // Fire two RPC calls simultaneously — both should await the same connect()
      const [b1, b2] = await Promise.all([
        client.getBalance(),
        client.getBalance(),
      ]);

      // Only ONE authenticate call should have happened
      expect(authenticate).toHaveBeenCalledTimes(1);
      expect(b1).toBe("1");
      expect(b2).toBe("2");
    });

    it("propagates connect failure to caller", async () => {
      const { authenticate } = require("./auth.js");
      authenticate.mockRejectedValueOnce(new Error("Auth server down"));

      await expect(client.getBalance()).rejects.toThrow("Auth server down");
      expect(client.isConnected()).toBe(false);
    });
  });
});
