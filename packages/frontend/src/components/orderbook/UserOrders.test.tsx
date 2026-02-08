import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserOrders } from './UserOrders';
import * as api from '@/lib/api';
import type { WsMessage, P2POrder } from '@/lib/types';

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

const mockGetUserP2POrders = api.getUserP2POrders as jest.MockedFunction<typeof api.getUserP2POrders>;
const mockCancelP2POrder = api.cancelP2POrder as jest.MockedFunction<typeof api.cancelP2POrder>;

function makeOrder(overrides: Partial<P2POrder> = {}): P2POrder {
  return {
    orderId: 'order-1',
    marketId: 'market-1',
    gameId: 'game-1',
    userAddress: '0x123',
    outcome: 'BALL',
    mcps: 0.60,
    amount: 6,
    filledAmount: 0,
    unfilledAmount: 6,
    maxShares: 10,
    filledShares: 0,
    unfilledShares: 10,
    appSessionId: '0xSESSION',
    appSessionVersion: 1,
    status: 'OPEN',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('UserOrders', () => {
  beforeEach(() => {
    subscribeHandler = null;
    mockGetUserP2POrders.mockReset();
    mockCancelP2POrder.mockReset();
  });

  it('shows loading state initially', () => {
    mockGetUserP2POrders.mockImplementation(() => new Promise(() => {}));
    render(<UserOrders address="0x123" />);
    expect(screen.getByTestId('user-orders-loading')).toBeInTheDocument();
  });

  it('shows empty state when no orders', async () => {
    mockGetUserP2POrders.mockResolvedValueOnce({ orders: [] });

    render(<UserOrders address="0x123" />);

    await waitFor(() => {
      expect(screen.getByTestId('no-orders')).toBeInTheDocument();
    });
  });

  it('renders order list', async () => {
    mockGetUserP2POrders.mockResolvedValueOnce({
      orders: [
        makeOrder({ orderId: 'order-1', outcome: 'BALL', status: 'OPEN' }),
        makeOrder({ orderId: 'order-2', outcome: 'STRIKE', status: 'FILLED' }),
      ],
    });

    render(<UserOrders address="0x123" />);

    await waitFor(() => {
      expect(screen.getByTestId('order-row-order-1')).toBeInTheDocument();
      expect(screen.getByTestId('order-row-order-2')).toBeInTheDocument();
    });
  });

  it('shows correct status badges', async () => {
    mockGetUserP2POrders.mockResolvedValueOnce({
      orders: [
        makeOrder({ orderId: 'order-1', status: 'OPEN' }),
        makeOrder({ orderId: 'order-2', status: 'FILLED' }),
      ],
    });

    render(<UserOrders address="0x123" />);

    await waitFor(() => {
      expect(screen.getByTestId('order-status-order-1')).toHaveTextContent('OPEN');
      expect(screen.getByTestId('order-status-order-2')).toHaveTextContent('FILLED');
    });
  });

  it('shows cancel button only for cancellable orders', async () => {
    mockGetUserP2POrders.mockResolvedValueOnce({
      orders: [
        makeOrder({ orderId: 'order-open', status: 'OPEN' }),
        makeOrder({ orderId: 'order-partial', status: 'PARTIALLY_FILLED' }),
        makeOrder({ orderId: 'order-filled', status: 'FILLED' }),
      ],
    });

    render(<UserOrders address="0x123" />);

    await waitFor(() => {
      expect(screen.getByTestId('cancel-order-order-open')).toBeInTheDocument();
      expect(screen.getByTestId('cancel-order-order-partial')).toBeInTheDocument();
      expect(screen.queryByTestId('cancel-order-order-filled')).not.toBeInTheDocument();
    });
  });

  it('calls cancelP2POrder when cancel is clicked', async () => {
    const user = userEvent.setup();
    mockGetUserP2POrders.mockResolvedValue({
      orders: [makeOrder({ orderId: 'order-1', status: 'OPEN' })],
    });
    mockCancelP2POrder.mockResolvedValueOnce({
      order: makeOrder({ orderId: 'order-1', status: 'CANCELLED' }),
    });

    render(<UserOrders address="0x123" />);

    await waitFor(() => {
      expect(screen.getByTestId('cancel-order-order-1')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('cancel-order-order-1'));

    await waitFor(() => {
      expect(mockCancelP2POrder).toHaveBeenCalledWith('order-1');
    });
  });

  it('refreshes orders on ORDER_FILLED WebSocket message', async () => {
    mockGetUserP2POrders.mockResolvedValue({
      orders: [makeOrder({ orderId: 'order-1', status: 'OPEN' })],
    });

    render(<UserOrders address="0x123" />);

    await waitFor(() => {
      expect(screen.getByTestId('order-row-order-1')).toBeInTheDocument();
    });

    // Reset call count after initial fetch
    mockGetUserP2POrders.mockClear();
    mockGetUserP2POrders.mockResolvedValue({
      orders: [makeOrder({ orderId: 'order-1', status: 'PARTIALLY_FILLED' })],
    });

    await act(async () => {
      subscribeHandler?.({
        type: 'ORDER_FILLED',
        orderId: 'order-1',
        fillId: 'fill-1',
        counterpartyOrderId: 'order-2',
        shares: 5,
        effectivePrice: 0.55,
        cost: 2.75,
      });
    });

    await waitFor(() => {
      expect(mockGetUserP2POrders).toHaveBeenCalled();
    });
  });

  it('displays fill progress bar', async () => {
    mockGetUserP2POrders.mockResolvedValueOnce({
      orders: [
        makeOrder({
          orderId: 'order-1',
          maxShares: 10,
          filledShares: 5,
        }),
      ],
    });

    render(<UserOrders address="0x123" />);

    await waitFor(() => {
      const fillBar = screen.getByTestId('fill-bar-order-1');
      expect(fillBar).toHaveStyle({ width: '50%' });
    });
  });

  it('fetches orders with marketId filter', async () => {
    mockGetUserP2POrders.mockResolvedValueOnce({ orders: [] });

    render(<UserOrders address="0x123" marketId="market-5" />);

    await waitFor(() => {
      expect(mockGetUserP2POrders).toHaveBeenCalledWith('0x123', 'market-5');
    });
  });
});
