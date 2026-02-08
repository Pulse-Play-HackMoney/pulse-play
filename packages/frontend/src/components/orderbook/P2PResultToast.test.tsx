import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { P2PResultToast } from './P2PResultToast';
import type { WsMessage } from '@/lib/types';

let subscribeHandler: ((message: WsMessage) => void) | null = null;

jest.mock('@/providers/WebSocketProvider', () => ({
  useWebSocket: jest.fn(() => ({
    subscribe: jest.fn((handler) => {
      subscribeHandler = handler;
      return () => { subscribeHandler = null; };
    }),
  })),
}));

const mockRefreshBalance = jest.fn();
jest.mock('@/providers/ClearnodeProvider', () => ({
  useClearnode: jest.fn(() => ({
    refreshBalance: mockRefreshBalance,
  })),
}));

describe('P2PResultToast', () => {
  beforeEach(() => {
    subscribeHandler = null;
    mockRefreshBalance.mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders nothing when no toasts', () => {
    const { container } = render(<P2PResultToast />);
    expect(container.firstChild).toBeNull();
  });

  it('shows win toast on P2P_BET_RESULT WIN message', async () => {
    render(<P2PResultToast />);

    await act(async () => {
      subscribeHandler?.({
        type: 'P2P_BET_RESULT',
        result: 'WIN',
        orderId: 'order-1',
        marketId: 'market-1',
        payout: 12.50,
        profit: 6.50,
      });
    });

    expect(screen.getByTestId('p2p-toast-win')).toBeInTheDocument();
    expect(screen.getByTestId('p2p-toast-title')).toHaveTextContent('P2P Order Won!');
    expect(screen.getByTestId('p2p-toast-amount')).toHaveTextContent('+$12.50');
  });

  it('shows loss toast on P2P_BET_RESULT LOSS message', async () => {
    render(<P2PResultToast />);

    await act(async () => {
      subscribeHandler?.({
        type: 'P2P_BET_RESULT',
        result: 'LOSS',
        orderId: 'order-2',
        marketId: 'market-1',
        loss: 8.00,
        refunded: 2.00,
      });
    });

    expect(screen.getByTestId('p2p-toast-loss')).toBeInTheDocument();
    expect(screen.getByTestId('p2p-toast-title')).toHaveTextContent('P2P Order Lost');
    expect(screen.getByTestId('p2p-toast-amount')).toHaveTextContent('-$8.00');
  });

  it('calls refreshBalance on P2P_BET_RESULT', async () => {
    render(<P2PResultToast />);

    await act(async () => {
      subscribeHandler?.({
        type: 'P2P_BET_RESULT',
        result: 'WIN',
        orderId: 'order-1',
        marketId: 'market-1',
        payout: 10,
      });
    });

    expect(mockRefreshBalance).toHaveBeenCalledTimes(1);
  });

  it('auto-removes toast after duration', async () => {
    render(<P2PResultToast duration={1000} />);

    await act(async () => {
      subscribeHandler?.({
        type: 'P2P_BET_RESULT',
        result: 'WIN',
        orderId: 'order-1',
        marketId: 'market-1',
        payout: 10,
      });
    });

    expect(screen.getByTestId('p2p-toast-win')).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.queryByTestId('p2p-toast-win')).not.toBeInTheDocument();
  });

  it('ignores non-P2P_BET_RESULT messages', async () => {
    render(<P2PResultToast />);

    await act(async () => {
      subscribeHandler?.({
        type: 'BET_RESULT',
        result: 'WIN',
        marketId: 'market-1',
        payout: 10,
      });
    });

    expect(screen.queryByTestId('p2p-toast-container')).not.toBeInTheDocument();
  });

  it('shows multiple toasts simultaneously', async () => {
    render(<P2PResultToast />);

    await act(async () => {
      subscribeHandler?.({
        type: 'P2P_BET_RESULT',
        result: 'WIN',
        orderId: 'order-1',
        marketId: 'market-1',
        payout: 10,
      });
    });

    await act(async () => {
      subscribeHandler?.({
        type: 'P2P_BET_RESULT',
        result: 'LOSS',
        orderId: 'order-2',
        marketId: 'market-1',
        loss: 5,
      });
    });

    expect(screen.getByTestId('p2p-toast-win')).toBeInTheDocument();
    expect(screen.getByTestId('p2p-toast-loss')).toBeInTheDocument();
  });
});
