import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MarketProvider, useMarket } from './MarketProvider';
import { WebSocketProvider } from './WebSocketProvider';
import * as api from '@/lib/api';
import {
  MockWebSocket,
  installMockWebSocket,
  flushPromises,
} from '@/test/mocks/websocket';

// Mock the API module
jest.mock('@/lib/api');
const mockGetMarket = api.getMarket as jest.MockedFunction<typeof api.getMarket>;

// Consumer component for testing
function MarketConsumer() {
  const {
    market,
    priceBall,
    priceStrike,
    gameActive,
    positionCount,
    connectionCount,
    isLoading,
    error,
  } = useMarket();
  return (
    <div>
      <span data-testid="loading">{isLoading ? 'yes' : 'no'}</span>
      <span data-testid="error">{error || 'none'}</span>
      <span data-testid="market-id">{market?.id || 'no-market'}</span>
      <span data-testid="market-status">{market?.status || 'none'}</span>
      <span data-testid="price-ball">{priceBall}</span>
      <span data-testid="price-strike">{priceStrike}</span>
      <span data-testid="game-active">{gameActive ? 'yes' : 'no'}</span>
      <span data-testid="position-count">{positionCount}</span>
      <span data-testid="connection-count">{connectionCount}</span>
    </div>
  );
}

// Wrapper with WebSocket provider
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <WebSocketProvider address="0x123">{children}</WebSocketProvider>
  );
}

describe('MarketProvider', () => {
  beforeEach(() => {
    installMockWebSocket();
    mockGetMarket.mockReset();
  });

  afterEach(() => {
    MockWebSocket.clearInstances();
  });

  it('fetches market data on mount', async () => {
    mockGetMarket.mockResolvedValueOnce({
      market: {
        id: 'market-1',
        status: 'OPEN',
        outcome: null,
        qBall: 0,
        qStrike: 0,
        b: 100,
      },
      priceBall: 0.5,
      priceStrike: 0.5,
    });

    render(
      <TestWrapper>
        <MarketProvider>
          <MarketConsumer />
        </MarketProvider>
      </TestWrapper>
    );

    // Initially loading
    expect(screen.getByTestId('loading')).toHaveTextContent('yes');

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('no');
    });

    expect(screen.getByTestId('market-id')).toHaveTextContent('market-1');
    expect(screen.getByTestId('market-status')).toHaveTextContent('OPEN');
  });

  it('handles fetch error', async () => {
    mockGetMarket.mockRejectedValueOnce(new Error('Network error'));

    render(
      <TestWrapper>
        <MarketProvider>
          <MarketConsumer />
        </MarketProvider>
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Network error');
    });
  });

  it('updates prices from ODDS_UPDATE message', async () => {
    mockGetMarket.mockResolvedValueOnce({
      market: null,
      priceBall: 0.5,
      priceStrike: 0.5,
    });

    render(
      <TestWrapper>
        <MarketProvider>
          <MarketConsumer />
        </MarketProvider>
      </TestWrapper>
    );

    const ws = MockWebSocket.getLastInstance()!;

    await act(async () => {
      ws.simulateOpen();
      await flushPromises();
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('no');
    });

    // Send odds update
    await act(async () => {
      ws.simulateMessage({
        type: 'ODDS_UPDATE',
        priceBall: 0.65,
        priceStrike: 0.35,
        marketId: 'market-1',
      });
      await flushPromises();
    });

    await waitFor(() => {
      expect(screen.getByTestId('price-ball')).toHaveTextContent('0.65');
      expect(screen.getByTestId('price-strike')).toHaveTextContent('0.35');
    });
  });

  it('updates game active state from GAME_STATE message', async () => {
    mockGetMarket.mockResolvedValueOnce({
      market: null,
      priceBall: 0.5,
      priceStrike: 0.5,
    });

    render(
      <TestWrapper>
        <MarketProvider>
          <MarketConsumer />
        </MarketProvider>
      </TestWrapper>
    );

    const ws = MockWebSocket.getLastInstance()!;

    await act(async () => {
      ws.simulateOpen();
      await flushPromises();
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('no');
    });

    expect(screen.getByTestId('game-active')).toHaveTextContent('no');

    // Send game state update
    await act(async () => {
      ws.simulateMessage({
        type: 'GAME_STATE',
        active: true,
      });
      await flushPromises();
    });

    await waitFor(() => {
      expect(screen.getByTestId('game-active')).toHaveTextContent('yes');
    });
  });

  it('updates market status from MARKET_STATUS message', async () => {
    mockGetMarket
      .mockResolvedValueOnce({
        market: {
          id: 'market-1',
          status: 'OPEN',
          outcome: null,
          qBall: 0,
          qStrike: 0,
          b: 100,
        },
        priceBall: 0.5,
        priceStrike: 0.5,
      })
      .mockResolvedValueOnce({
        market: {
          id: 'market-1',
          status: 'RESOLVED',
          outcome: 'BALL',
          qBall: 10,
          qStrike: 5,
          b: 100,
        },
        priceBall: 0.6,
        priceStrike: 0.4,
      });

    render(
      <TestWrapper>
        <MarketProvider>
          <MarketConsumer />
        </MarketProvider>
      </TestWrapper>
    );

    const ws = MockWebSocket.getLastInstance()!;

    await act(async () => {
      ws.simulateOpen();
      await flushPromises();
    });

    await waitFor(() => {
      expect(screen.getByTestId('market-status')).toHaveTextContent('OPEN');
    });

    // Send market status update to CLOSED (doesn't trigger refetch)
    await act(async () => {
      ws.simulateMessage({
        type: 'MARKET_STATUS',
        status: 'CLOSED',
        marketId: 'market-1',
      });
      await flushPromises();
    });

    await waitFor(() => {
      expect(screen.getByTestId('market-status')).toHaveTextContent('CLOSED');
    });
  });

  it('updates market ID when MARKET_STATUS arrives with new marketId', async () => {
    mockGetMarket
      .mockResolvedValueOnce({
        market: {
          id: 'market-1',
          status: 'OPEN',
          outcome: null,
          qBall: 10,
          qStrike: 5,
          b: 100,
        },
        priceBall: 0.55,
        priceStrike: 0.45,
      })
      .mockResolvedValueOnce({
        market: {
          id: 'market-2',
          status: 'OPEN',
          outcome: null,
          qBall: 0,
          qStrike: 0,
          b: 100,
        },
        priceBall: 0.5,
        priceStrike: 0.5,
      });

    render(
      <TestWrapper>
        <MarketProvider>
          <MarketConsumer />
        </MarketProvider>
      </TestWrapper>
    );

    const ws = MockWebSocket.getLastInstance()!;

    await act(async () => {
      ws.simulateOpen();
      await flushPromises();
    });

    await waitFor(() => {
      expect(screen.getByTestId('market-id')).toHaveTextContent('market-1');
    });

    // New market opens with different ID
    await act(async () => {
      ws.simulateMessage({
        type: 'MARKET_STATUS',
        status: 'OPEN',
        marketId: 'market-2',
      });
      await flushPromises();
    });

    await waitFor(() => {
      expect(screen.getByTestId('market-id')).toHaveTextContent('market-2');
    });
  });

  it('resets prices and positionCount for new market', async () => {
    mockGetMarket
      .mockResolvedValueOnce({
        market: {
          id: 'market-1',
          status: 'OPEN',
          outcome: null,
          qBall: 10,
          qStrike: 5,
          b: 100,
        },
        priceBall: 0.55,
        priceStrike: 0.45,
      })
      .mockResolvedValueOnce({
        market: {
          id: 'market-2',
          status: 'OPEN',
          outcome: null,
          qBall: 0,
          qStrike: 0,
          b: 100,
        },
        priceBall: 0.5,
        priceStrike: 0.5,
      });

    render(
      <TestWrapper>
        <MarketProvider>
          <MarketConsumer />
        </MarketProvider>
      </TestWrapper>
    );

    const ws = MockWebSocket.getLastInstance()!;

    await act(async () => {
      ws.simulateOpen();
      await flushPromises();
    });

    await waitFor(() => {
      expect(screen.getByTestId('market-id')).toHaveTextContent('market-1');
    });

    // Simulate position count update
    await act(async () => {
      ws.simulateMessage({
        type: 'POSITION_ADDED',
        position: {
          address: '0x123',
          marketId: 'market-1',
          outcome: 'BALL',
          shares: 10,
          costPaid: 5,
          appSessionId: 'sess-1',
          timestamp: Date.now(),
        },
        positionCount: 3,
      });
      await flushPromises();
    });

    await waitFor(() => {
      expect(screen.getByTestId('position-count')).toHaveTextContent('3');
    });

    // New market opens — should reset prices and positionCount
    await act(async () => {
      ws.simulateMessage({
        type: 'MARKET_STATUS',
        status: 'OPEN',
        marketId: 'market-2',
      });
      await flushPromises();
    });

    await waitFor(() => {
      expect(screen.getByTestId('market-id')).toHaveTextContent('market-2');
      expect(screen.getByTestId('price-ball')).toHaveTextContent('0.5');
      expect(screen.getByTestId('price-strike')).toHaveTextContent('0.5');
      expect(screen.getByTestId('position-count')).toHaveTextContent('0');
    });
  });

  it('handles STATE_SYNC message on connect', async () => {
    mockGetMarket.mockResolvedValueOnce({
      market: null,
      priceBall: 0.5,
      priceStrike: 0.5,
    });

    render(
      <TestWrapper>
        <MarketProvider>
          <MarketConsumer />
        </MarketProvider>
      </TestWrapper>
    );

    const ws = MockWebSocket.getLastInstance()!;

    await act(async () => {
      ws.simulateOpen();
      await flushPromises();
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('no');
    });

    // Send STATE_SYNC
    await act(async () => {
      ws.simulateMessage({
        type: 'STATE_SYNC',
        state: {
          market: {
            id: 'market-2',
            status: 'OPEN',
            outcome: null,
            qBall: 10,
            qStrike: 10,
            b: 100,
          },
          gameState: { active: true },
          positionCount: 5,
          connectionCount: 3,
        },
        positions: [],
      });
      await flushPromises();
    });

    await waitFor(() => {
      expect(screen.getByTestId('market-id')).toHaveTextContent('market-2');
      expect(screen.getByTestId('game-active')).toHaveTextContent('yes');
      expect(screen.getByTestId('position-count')).toHaveTextContent('5');
      expect(screen.getByTestId('connection-count')).toHaveTextContent('3');
    });
  });

  it('updates connection count from CONNECTION_COUNT message', async () => {
    mockGetMarket.mockResolvedValueOnce({
      market: null,
      priceBall: 0.5,
      priceStrike: 0.5,
    });

    render(
      <TestWrapper>
        <MarketProvider>
          <MarketConsumer />
        </MarketProvider>
      </TestWrapper>
    );

    const ws = MockWebSocket.getLastInstance()!;

    await act(async () => {
      ws.simulateOpen();
      await flushPromises();
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('no');
    });

    expect(screen.getByTestId('connection-count')).toHaveTextContent('0');

    // Send CONNECTION_COUNT
    await act(async () => {
      ws.simulateMessage({
        type: 'CONNECTION_COUNT',
        count: 7,
      });
      await flushPromises();
    });

    await waitFor(() => {
      expect(screen.getByTestId('connection-count')).toHaveTextContent('7');
    });
  });

  it('updates position count from POSITION_ADDED message', async () => {
    mockGetMarket.mockResolvedValueOnce({
      market: null,
      priceBall: 0.5,
      priceStrike: 0.5,
    });

    render(
      <TestWrapper>
        <MarketProvider>
          <MarketConsumer />
        </MarketProvider>
      </TestWrapper>
    );

    const ws = MockWebSocket.getLastInstance()!;

    await act(async () => {
      ws.simulateOpen();
      await flushPromises();
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('no');
    });

    expect(screen.getByTestId('position-count')).toHaveTextContent('0');

    // Send POSITION_ADDED
    await act(async () => {
      ws.simulateMessage({
        type: 'POSITION_ADDED',
        position: {
          address: '0x123',
          marketId: 'market-1',
          outcome: 'BALL',
          shares: 10,
          costPaid: 5,
          appSessionId: 'sess-1',
          timestamp: Date.now(),
        },
        positionCount: 4,
      });
      await flushPromises();
    });

    await waitFor(() => {
      expect(screen.getByTestId('position-count')).toHaveTextContent('4');
    });
  });
});
