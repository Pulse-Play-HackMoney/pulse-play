import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameBettingArea } from './GameBettingArea';
import * as SelectedMarketProvider from '@/providers/SelectedMarketProvider';
import * as WagmiProvider from '@/providers/WagmiProvider';

jest.mock('@/providers/SelectedMarketProvider', () => ({
  useSelectedMarket: jest.fn(),
}));

jest.mock('@/providers/WagmiProvider', () => ({
  useWallet: jest.fn(),
}));

jest.mock('@/providers/WebSocketProvider', () => ({
  useWebSocket: jest.fn(() => ({
    subscribe: jest.fn().mockReturnValue(jest.fn()),
    isConnected: true,
  })),
}));

jest.mock('@/providers/ClearnodeProvider', () => ({
  useClearnode: jest.fn(() => ({
    refreshBalance: jest.fn(),
  })),
}));

jest.mock('@/hooks/useClearnode', () => ({
  useClearnode: jest.fn().mockReturnValue({
    status: 'connected',
    error: null,
    isSessionValid: true,
    expiresAt: Date.now() + 3600000,
    signer: null,
    ws: null,
    balance: '1000000',
    allowanceAmount: 1000,
    setAllowanceAmount: jest.fn(),
    refreshBalance: jest.fn(),
    reconnect: jest.fn(),
    disconnect: jest.fn(),
    createAppSession: jest.fn().mockResolvedValue({
      appSessionId: '0xSESSION',
      version: 1,
      status: 'open',
    }),
    closeAppSession: jest.fn(),
    submitAppState: jest.fn(),
    transfer: jest.fn(),
    getAppSessions: jest.fn(),
    getConfig: jest.fn(),
  }),
}));

const testGlobals = globalThis as typeof globalThis & { __TEST_MM_ADDRESS__?: string };
jest.mock('@/lib/config', () => ({
  get MM_ADDRESS() { return testGlobals.__TEST_MM_ADDRESS__; },
}));

jest.mock('@/lib/api');

const mockUseSelectedMarket = SelectedMarketProvider.useSelectedMarket as jest.Mock;
const mockUseWallet = WagmiProvider.useWallet as jest.Mock;

describe('GameBettingArea', () => {
  beforeEach(() => {
    mockUseWallet.mockReturnValue({ address: '0x123', isConfigured: true });
    testGlobals.__TEST_MM_ADDRESS__ = '0xMM';
  });

  it('shows mode toggle for binary markets', () => {
    mockUseSelectedMarket.mockReturnValue({
      market: { id: 'market-1', status: 'OPEN' },
      outcomes: ['BALL', 'STRIKE'],
      prices: [0.5, 0.5],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<GameBettingArea gameId="game-1" />);

    expect(screen.getByTestId('betting-mode-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('mode-lmsr')).toBeInTheDocument();
    expect(screen.getByTestId('mode-orderbook')).toBeInTheDocument();
  });

  it('does not show mode toggle for non-binary markets', () => {
    mockUseSelectedMarket.mockReturnValue({
      market: { id: 'market-1', status: 'OPEN' },
      outcomes: ['MAKE', 'MISS', 'FOUL'],
      prices: [0.33, 0.33, 0.34],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<GameBettingArea gameId="game-1" />);

    expect(screen.queryByTestId('betting-mode-toggle')).not.toBeInTheDocument();
    expect(screen.getByTestId('lmsr-area')).toBeInTheDocument();
  });

  it('defaults to LMSR mode', () => {
    mockUseSelectedMarket.mockReturnValue({
      market: { id: 'market-1', status: 'OPEN' },
      outcomes: ['BALL', 'STRIKE'],
      prices: [0.5, 0.5],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<GameBettingArea gameId="game-1" />);

    expect(screen.getByTestId('lmsr-area')).toBeInTheDocument();
    expect(screen.queryByTestId('orderbook-area')).not.toBeInTheDocument();
  });

  it('switches to orderbook mode when Order Book tab clicked', async () => {
    const user = userEvent.setup();
    mockUseSelectedMarket.mockReturnValue({
      market: { id: 'market-1', status: 'OPEN' },
      outcomes: ['BALL', 'STRIKE'],
      prices: [0.5, 0.5],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    // Mock API for orderbook components
    const api = await import('@/lib/api');
    (api.getOrderBookDepth as jest.Mock).mockResolvedValue({
      marketId: 'market-1',
      outcomes: { BALL: [], STRIKE: [] },
      updatedAt: Date.now(),
    });
    (api.getUserP2POrders as jest.Mock).mockResolvedValue({ orders: [] });

    render(<GameBettingArea gameId="game-1" />);

    await user.click(screen.getByTestId('mode-orderbook'));

    expect(screen.getByTestId('orderbook-area')).toBeInTheDocument();
    expect(screen.queryByTestId('lmsr-area')).not.toBeInTheDocument();
  });

  it('switches back to LMSR mode', async () => {
    const user = userEvent.setup();
    mockUseSelectedMarket.mockReturnValue({
      market: { id: 'market-1', status: 'OPEN' },
      outcomes: ['BALL', 'STRIKE'],
      prices: [0.5, 0.5],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const api = await import('@/lib/api');
    (api.getOrderBookDepth as jest.Mock).mockResolvedValue({
      marketId: 'market-1',
      outcomes: { BALL: [], STRIKE: [] },
      updatedAt: Date.now(),
    });
    (api.getUserP2POrders as jest.Mock).mockResolvedValue({ orders: [] });

    render(<GameBettingArea gameId="game-1" />);

    // Switch to orderbook
    await user.click(screen.getByTestId('mode-orderbook'));
    expect(screen.getByTestId('orderbook-area')).toBeInTheDocument();

    // Switch back to LMSR
    await user.click(screen.getByTestId('mode-lmsr'));
    expect(screen.getByTestId('lmsr-area')).toBeInTheDocument();
    expect(screen.queryByTestId('orderbook-area')).not.toBeInTheDocument();
  });

  it('highlights active mode button with accent color', () => {
    mockUseSelectedMarket.mockReturnValue({
      market: { id: 'market-1', status: 'OPEN' },
      outcomes: ['BALL', 'STRIKE'],
      prices: [0.5, 0.5],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<GameBettingArea gameId="game-1" />);

    // LMSR is default active
    expect(screen.getByTestId('mode-lmsr')).toHaveClass('bg-accent');
    expect(screen.getByTestId('mode-orderbook')).not.toHaveClass('bg-accent');
  });
});
