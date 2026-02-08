import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { OrderBookTable } from './OrderBookTable';
import * as api from '@/lib/api';
import type { WsMessage, OrderBookDepth } from '@/lib/types';

let subscribeHandler: ((message: WsMessage) => void) | null = null;

jest.mock('@/providers/WebSocketProvider', () => ({
  useWebSocket: jest.fn(() => ({
    subscribe: jest.fn((handler) => {
      subscribeHandler = handler;
      return () => { subscribeHandler = null; };
    }),
  })),
}));

jest.mock('@/lib/api');

const mockGetOrderBookDepth = api.getOrderBookDepth as jest.MockedFunction<typeof api.getOrderBookDepth>;

const mockDepth: OrderBookDepth = {
  marketId: 'market-1',
  outcomes: {
    BALL: [
      { price: 0.60, shares: 10, orderCount: 2 },
      { price: 0.55, shares: 5, orderCount: 1 },
    ],
    STRIKE: [
      { price: 0.45, shares: 8, orderCount: 1 },
    ],
  },
  updatedAt: Date.now(),
};

describe('OrderBookTable', () => {
  beforeEach(() => {
    subscribeHandler = null;
    mockGetOrderBookDepth.mockReset();
  });

  it('shows loading state initially', () => {
    mockGetOrderBookDepth.mockImplementation(() => new Promise(() => {}));
    render(<OrderBookTable marketId="market-1" outcomes={['BALL', 'STRIKE']} />);
    expect(screen.getByTestId('orderbook-loading')).toBeInTheDocument();
  });

  it('renders depth levels after loading', async () => {
    mockGetOrderBookDepth.mockResolvedValueOnce(mockDepth);

    render(<OrderBookTable marketId="market-1" outcomes={['BALL', 'STRIKE']} />);

    await waitFor(() => {
      expect(screen.getByTestId('orderbook-table')).toBeInTheDocument();
    });

    expect(screen.getByTestId('orderbook-side-ball')).toBeInTheDocument();
    expect(screen.getByTestId('orderbook-side-strike')).toBeInTheDocument();
    expect(screen.getByTestId('depth-level-ball-0')).toBeInTheDocument();
    expect(screen.getByTestId('depth-level-ball-1')).toBeInTheDocument();
    expect(screen.getByTestId('depth-level-strike-0')).toBeInTheDocument();
  });

  it('shows empty state when no depth data', async () => {
    mockGetOrderBookDepth.mockResolvedValueOnce({
      marketId: 'market-1',
      outcomes: {},
      updatedAt: Date.now(),
    });

    render(<OrderBookTable marketId="market-1" outcomes={[]} />);

    await waitFor(() => {
      expect(screen.getByTestId('orderbook-empty')).toBeInTheDocument();
    });
  });

  it('shows per-side empty state when one side has no orders', async () => {
    mockGetOrderBookDepth.mockResolvedValueOnce({
      marketId: 'market-1',
      outcomes: {
        BALL: [{ price: 0.60, shares: 5, orderCount: 1 }],
        STRIKE: [],
      },
      updatedAt: Date.now(),
    });

    render(<OrderBookTable marketId="market-1" outcomes={['BALL', 'STRIKE']} />);

    await waitFor(() => {
      expect(screen.getByTestId('orderbook-table')).toBeInTheDocument();
    });

    expect(screen.getByTestId('depth-level-ball-0')).toBeInTheDocument();
    expect(screen.getByTestId('orderbook-empty-strike')).toBeInTheDocument();
  });

  it('displays correct price and share values', async () => {
    mockGetOrderBookDepth.mockResolvedValueOnce(mockDepth);

    render(<OrderBookTable marketId="market-1" outcomes={['BALL', 'STRIKE']} />);

    await waitFor(() => {
      expect(screen.getByTestId('orderbook-table')).toBeInTheDocument();
    });

    const ballLevel0 = screen.getByTestId('depth-level-ball-0');
    expect(ballLevel0).toHaveTextContent('0.60');
    expect(ballLevel0).toHaveTextContent('10.0');
  });

  it('updates depth from WebSocket ORDERBOOK_UPDATE message', async () => {
    mockGetOrderBookDepth.mockResolvedValueOnce(mockDepth);

    render(<OrderBookTable marketId="market-1" outcomes={['BALL', 'STRIKE']} />);

    await waitFor(() => {
      expect(screen.getByTestId('orderbook-table')).toBeInTheDocument();
    });

    // Simulate WebSocket update
    await act(async () => {
      subscribeHandler?.({
        type: 'ORDERBOOK_UPDATE',
        marketId: 'market-1',
        outcomes: {
          BALL: [{ price: 0.70, shares: 15, orderCount: 3 }],
          STRIKE: [{ price: 0.35, shares: 12, orderCount: 2 }],
        },
      });
    });

    const ballLevel = screen.getByTestId('depth-level-ball-0');
    expect(ballLevel).toHaveTextContent('0.70');
    expect(ballLevel).toHaveTextContent('15.0');
  });

  it('ignores WebSocket updates for different markets', async () => {
    mockGetOrderBookDepth.mockResolvedValueOnce(mockDepth);

    render(<OrderBookTable marketId="market-1" outcomes={['BALL', 'STRIKE']} />);

    await waitFor(() => {
      expect(screen.getByTestId('orderbook-table')).toBeInTheDocument();
    });

    await act(async () => {
      subscribeHandler?.({
        type: 'ORDERBOOK_UPDATE',
        marketId: 'market-999',
        outcomes: {
          BALL: [{ price: 0.99, shares: 100, orderCount: 1 }],
          STRIKE: [],
        },
      });
    });

    // Should still show original data
    const ballLevel = screen.getByTestId('depth-level-ball-0');
    expect(ballLevel).toHaveTextContent('0.60');
  });

  it('fetches depth on mount with correct marketId', async () => {
    mockGetOrderBookDepth.mockResolvedValueOnce(mockDepth);

    render(<OrderBookTable marketId="market-42" outcomes={['BALL', 'STRIKE']} />);

    await waitFor(() => {
      expect(mockGetOrderBookDepth).toHaveBeenCalledWith('market-42');
    });
  });
});
