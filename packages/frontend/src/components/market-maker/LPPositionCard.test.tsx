import { render, screen, waitFor, act } from '@testing-library/react';
import { LPPositionCard } from './LPPositionCard';
import * as api from '@/lib/api';
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

jest.mock('@/lib/api', () => ({
  getLPShare: jest.fn(),
  ApiError: class MockApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = 'ApiError';
    }
  },
}));

const mockGetLPShare = api.getLPShare as jest.MockedFunction<typeof api.getLPShare>;

describe('LPPositionCard', () => {
  beforeEach(() => {
    mockGetLPShare.mockReset();
    subscribeHandler = null;
  });

  it('shows "Connect wallet" when address is null', () => {
    render(<LPPositionCard address={null} />);

    expect(screen.getByTestId('lp-connect-wallet')).toHaveTextContent('Connect wallet');
  });

  it('shows "No LP position" when getLPShare returns 404', async () => {
    mockGetLPShare.mockRejectedValueOnce(new api.ApiError(404, 'Not found'));

    render(<LPPositionCard address="0x1234" />);

    await waitFor(() => {
      expect(screen.getByTestId('lp-no-position')).toBeInTheDocument();
    });

    expect(screen.getByTestId('lp-no-position')).toHaveTextContent('No LP position found');
  });

  it('displays share data after fetch', async () => {
    mockGetLPShare.mockResolvedValueOnce({
      address: '0x1234',
      shares: 100,
      totalDeposited: 1000,
      totalWithdrawn: 0,
      firstDepositAt: Date.now(),
      lastActionAt: Date.now(),
      currentValue: 1050,
      pnl: 50,
      sharePrice: 10.5,
    });

    render(<LPPositionCard address="0x1234" />);

    await waitFor(() => {
      expect(screen.getByTestId('lp-position-card')).toBeInTheDocument();
    });

    expect(screen.getByTestId('lp-shares')).toHaveTextContent('100.00');
    expect(screen.getByTestId('lp-current-value')).toHaveTextContent('$1,050.00');
    expect(screen.getByTestId('lp-total-deposited')).toHaveTextContent('$1,000.00');
    expect(screen.getByTestId('lp-pnl')).toHaveTextContent('+$50.00');
  });

  it('shows positive PnL in green', async () => {
    mockGetLPShare.mockResolvedValueOnce({
      address: '0x1234',
      shares: 100,
      totalDeposited: 1000,
      totalWithdrawn: 0,
      firstDepositAt: Date.now(),
      lastActionAt: Date.now(),
      currentValue: 1200,
      pnl: 200,
      sharePrice: 12,
    });

    render(<LPPositionCard address="0x1234" />);

    await waitFor(() => {
      expect(screen.getByTestId('lp-pnl')).toBeInTheDocument();
    });

    expect(screen.getByTestId('lp-pnl')).toHaveTextContent('+$200.00');
    expect(screen.getByTestId('lp-pnl')).toHaveClass('text-green-400');
  });

  it('shows negative PnL in red', async () => {
    mockGetLPShare.mockResolvedValueOnce({
      address: '0x1234',
      shares: 100,
      totalDeposited: 1000,
      totalWithdrawn: 0,
      firstDepositAt: Date.now(),
      lastActionAt: Date.now(),
      currentValue: 800,
      pnl: -200,
      sharePrice: 8,
    });

    render(<LPPositionCard address="0x1234" />);

    await waitFor(() => {
      expect(screen.getByTestId('lp-pnl')).toBeInTheDocument();
    });

    expect(screen.getByTestId('lp-pnl')).toHaveTextContent('$200.00');
    expect(screen.getByTestId('lp-pnl')).toHaveClass('text-red-400');
  });

  it('handles fetch error', async () => {
    mockGetLPShare.mockRejectedValueOnce(new Error('Server error'));

    render(<LPPositionCard address="0x1234" />);

    await waitFor(() => {
      expect(screen.getByTestId('lp-position-error')).toBeInTheDocument();
    });

    expect(screen.getByText('Server error')).toBeInTheDocument();
  });

  it('re-fetches on LP_DEPOSIT WS message for this address', async () => {
    mockGetLPShare
      .mockResolvedValueOnce({
        address: '0x1234',
        shares: 100,
        totalDeposited: 1000,
        totalWithdrawn: 0,
        firstDepositAt: Date.now(),
        lastActionAt: Date.now(),
        currentValue: 1000,
        pnl: 0,
        sharePrice: 10,
      })
      .mockResolvedValueOnce({
        address: '0x1234',
        shares: 200,
        totalDeposited: 2000,
        totalWithdrawn: 0,
        firstDepositAt: Date.now(),
        lastActionAt: Date.now(),
        currentValue: 2000,
        pnl: 0,
        sharePrice: 10,
      });

    render(<LPPositionCard address="0x1234" />);

    await waitFor(() => {
      expect(screen.getByTestId('lp-shares')).toHaveTextContent('100.00');
    });

    // Simulate LP_DEPOSIT for this user
    await act(async () => {
      subscribeHandler?.({
        type: 'LP_DEPOSIT',
        address: '0x1234',
        amount: 1000,
        shares: 100,
        sharePrice: 10,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('lp-shares')).toHaveTextContent('200.00');
    });

    expect(mockGetLPShare).toHaveBeenCalledTimes(2);
  });

  it('re-fetches on POOL_UPDATE message', async () => {
    mockGetLPShare
      .mockResolvedValueOnce({
        address: '0x1234',
        shares: 100,
        totalDeposited: 1000,
        totalWithdrawn: 0,
        firstDepositAt: Date.now(),
        lastActionAt: Date.now(),
        currentValue: 1000,
        pnl: 0,
        sharePrice: 10,
      })
      .mockResolvedValueOnce({
        address: '0x1234',
        shares: 100,
        totalDeposited: 1000,
        totalWithdrawn: 0,
        firstDepositAt: Date.now(),
        lastActionAt: Date.now(),
        currentValue: 1100,
        pnl: 100,
        sharePrice: 11,
      });

    render(<LPPositionCard address="0x1234" />);

    await waitFor(() => {
      expect(screen.getByTestId('lp-current-value')).toHaveTextContent('$1,000.00');
    });

    // Simulate POOL_UPDATE (e.g. after market resolution)
    await act(async () => {
      subscribeHandler?.({
        type: 'POOL_UPDATE',
        poolValue: 1100,
        totalShares: 100,
        sharePrice: 11,
        lpCount: 1,
        canWithdraw: true,
      } as unknown as WsMessage);
    });

    await waitFor(() => {
      expect(screen.getByTestId('lp-current-value')).toHaveTextContent('$1,100.00');
    });

    expect(mockGetLPShare).toHaveBeenCalledTimes(2);
  });

  it('ignores LP_DEPOSIT for different address', async () => {
    mockGetLPShare.mockResolvedValueOnce({
      address: '0x1234',
      shares: 100,
      totalDeposited: 1000,
      totalWithdrawn: 0,
      firstDepositAt: Date.now(),
      lastActionAt: Date.now(),
      currentValue: 1000,
      pnl: 0,
      sharePrice: 10,
    });

    render(<LPPositionCard address="0x1234" />);

    await waitFor(() => {
      expect(screen.getByTestId('lp-shares')).toHaveTextContent('100.00');
    });

    // Simulate LP_DEPOSIT for a different user
    act(() => {
      subscribeHandler?.({
        type: 'LP_DEPOSIT',
        address: '0x9999',
        amount: 500,
        shares: 50,
        sharePrice: 10,
      });
    });

    // Should not trigger a re-fetch
    expect(mockGetLPShare).toHaveBeenCalledTimes(1);
  });
});
