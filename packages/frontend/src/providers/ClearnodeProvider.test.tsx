import React, { createContext, useContext } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClearnodeProvider, useClearnode } from './ClearnodeProvider';
import type { WalletMode } from '@/lib/config';

// Mock the clearnode lib
const mockOpenClearnodeWs = jest.fn();
const mockAuthenticateBrowser = jest.fn();
const mockSendAndWaitBrowser = jest.fn();

jest.mock('@/lib/clearnode', () => ({
  openClearnodeWs: (...args: unknown[]) => mockOpenClearnodeWs(...args),
  authenticateBrowser: (...args: unknown[]) => mockAuthenticateBrowser(...args),
  sendAndWaitBrowser: (...args: unknown[]) => mockSendAndWaitBrowser(...args),
}));

// Mock config
jest.mock('@/lib/config', () => ({
  CLEARNODE_URL: 'wss://test-clearnode.com/ws',
  PRIVATE_KEY: '0x' + 'ab'.repeat(32),
  WALLET_MODE: 'private-key',
  HUB_REST_URL: 'http://localhost:3001',
  HUB_WS_URL: 'ws://localhost:3001/ws',
  CHAIN_ID: 11155111,
}));

// Instead of using the real WagmiProvider (which has complex internal logic),
// we create a minimal WalletContext wrapper that lets us control the wallet state directly.
// This mirrors the interface from WagmiProvider.
interface WalletContextValue {
  address: `0x${string}` | undefined;
  isConfigured: boolean;
  mode: WalletMode;
  isConnecting: boolean;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue>({
  address: undefined,
  isConfigured: false,
  mode: 'private-key',
  isConnecting: false,
  isConnected: false,
  connect: () => {},
  disconnect: () => {},
});

// ClearnodeProvider uses useWallet() from WagmiProvider. We need to mock it.
jest.mock('./WagmiProvider', () => ({
  useWallet: () => useContext(WalletContext),
  WagmiProvider: ({ children }: { children: React.ReactNode }) => children,
}));

function TestWalletProvider({ children, value }: { children: React.ReactNode; value: Partial<WalletContextValue> }) {
  const defaultValue: WalletContextValue = {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    isConfigured: true,
    mode: 'private-key',
    isConnecting: false,
    isConnected: true,
    connect: () => {},
    disconnect: () => {},
    ...value,
  };
  return (
    <WalletContext.Provider value={defaultValue}>
      {children}
    </WalletContext.Provider>
  );
}

// Consumer component for testing
function ClearnodeConsumer() {
  const { status, error, isSessionValid, signer, balance, ws } = useClearnode();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="error">{error || 'none'}</span>
      <span data-testid="session-valid">{isSessionValid ? 'yes' : 'no'}</span>
      <span data-testid="has-signer">{signer ? 'yes' : 'no'}</span>
      <span data-testid="balance">{balance || 'none'}</span>
      <span data-testid="has-ws">{ws ? 'yes' : 'no'}</span>
    </div>
  );
}

function ClearnodeConsumerWithActions() {
  const { status, error, balance, reconnect, disconnect } = useClearnode();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="error">{error || 'none'}</span>
      <span data-testid="balance">{balance || 'none'}</span>
      <button data-testid="reconnect" onClick={() => reconnect()}>Reconnect</button>
      <button data-testid="disconnect" onClick={() => disconnect()}>Disconnect</button>
    </div>
  );
}

function renderWithProviders(
  ui: React.ReactElement,
  walletOverrides: Partial<WalletContextValue> = {},
) {
  return render(
    <TestWalletProvider value={walletOverrides}>
      <ClearnodeProvider>
        {ui}
      </ClearnodeProvider>
    </TestWalletProvider>
  );
}

// Create a mock WebSocket object
function createMockWs() {
  return {
    readyState: WebSocket.OPEN,
    close: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    send: jest.fn(),
  };
}

describe('ClearnodeProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks for successful auth flow
    const mockWs = createMockWs();
    mockOpenClearnodeWs.mockResolvedValue(mockWs);
    mockAuthenticateBrowser.mockResolvedValue({
      signer: 'mock-signer',
      sessionAddress: '0xSESSION',
      expiresAt: Date.now() + 3600_000,
    });
    // sendAndWaitBrowser returns raw JSON; parseGetLedgerBalancesResponse from the
    // nitrolite mock returns { params: { ledgerBalances: [{ asset: 'ytest.usd', amount: '1000000' }] } }
    mockSendAndWaitBrowser.mockResolvedValue('{"res":[1,"get_ledger_balances",{}]}');
  });

  it('renders children while disconnected (no wallet)', () => {
    renderWithProviders(<ClearnodeConsumer />, {
      address: undefined,
      isConnected: false,
    });

    expect(screen.getByTestId('status')).toHaveTextContent('disconnected');
    expect(screen.getByTestId('has-signer')).toHaveTextContent('no');
    expect(mockOpenClearnodeWs).not.toHaveBeenCalled();
  });

  it('auto-authenticates when wallet is connected', async () => {
    renderWithProviders(<ClearnodeConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('connected');
    });

    expect(mockOpenClearnodeWs).toHaveBeenCalledWith('wss://test-clearnode.com/ws');
    expect(mockAuthenticateBrowser).toHaveBeenCalled();
    expect(screen.getByTestId('has-signer')).toHaveTextContent('yes');
    expect(screen.getByTestId('session-valid')).toHaveTextContent('yes');
  });

  it('fetches balance after successful auth', async () => {
    renderWithProviders(<ClearnodeConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('connected');
    });

    // parseGetLedgerBalancesResponse (nitrolite mock) returns amount: '1000000'
    await waitFor(() => {
      expect(screen.getByTestId('balance')).toHaveTextContent('1000000');
    });
  });

  it('shows error status when WebSocket connection fails', async () => {
    mockOpenClearnodeWs.mockRejectedValue(new Error('WebSocket connection failed'));

    renderWithProviders(<ClearnodeConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('error');
    });

    expect(screen.getByTestId('error')).toHaveTextContent('WebSocket connection failed');
    expect(screen.getByTestId('has-signer')).toHaveTextContent('no');
  });

  it('shows error status when authentication fails', async () => {
    mockAuthenticateBrowser.mockRejectedValue(new Error('Auth verify failed'));

    renderWithProviders(<ClearnodeConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('error');
    });

    expect(screen.getByTestId('error')).toHaveTextContent('Auth verify failed');
  });

  it('exposes ws reference when connected', async () => {
    renderWithProviders(<ClearnodeConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('has-ws')).toHaveTextContent('yes');
    });
  });

  it('disconnect cleans up state', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClearnodeConsumerWithActions />);

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('connected');
    });

    await user.click(screen.getByTestId('disconnect'));

    expect(screen.getByTestId('status')).toHaveTextContent('disconnected');
    expect(screen.getByTestId('balance')).toHaveTextContent('none');
  });

  it('reconnect re-authenticates', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ClearnodeConsumerWithActions />);

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('connected');
    });

    // Reset and set up for second connection
    const mockWs2 = createMockWs();
    mockOpenClearnodeWs.mockResolvedValue(mockWs2);
    mockAuthenticateBrowser.mockResolvedValue({
      signer: 'mock-signer-2',
      sessionAddress: '0xSESSION2',
      expiresAt: Date.now() + 3600_000,
    });

    await user.click(screen.getByTestId('reconnect'));

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('connected');
    });

    // Should have been called twice (initial + reconnect)
    expect(mockOpenClearnodeWs).toHaveBeenCalledTimes(2);
  });

  it('cleans up WebSocket on unmount', async () => {
    const mockWs = createMockWs();
    mockOpenClearnodeWs.mockResolvedValue(mockWs);

    const { unmount } = renderWithProviders(<ClearnodeConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('connected');
    });

    unmount();

    expect(mockWs.close).toHaveBeenCalled();
  });

  it('balance stays null when balance fetch fails', async () => {
    // Auth succeeds but balance fetch throws
    mockSendAndWaitBrowser.mockRejectedValue(new Error('Balance timeout'));

    renderWithProviders(<ClearnodeConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('connected');
    });

    // Balance should remain null (non-fatal error)
    expect(screen.getByTestId('balance')).toHaveTextContent('none');
  });
});
