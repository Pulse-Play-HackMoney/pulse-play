import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PoolStatsCard } from './PoolStatsCard';
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
  getLPStats: jest.fn(),
}));

const mockGetLPStats = api.getLPStats as jest.MockedFunction<typeof api.getLPStats>;

describe('PoolStatsCard', () => {
  beforeEach(() => {
    mockGetLPStats.mockReset();
    subscribeHandler = null;
  });

  it('renders loading state initially', () => {
    mockGetLPStats.mockReturnValue(new Promise(() => {})); // never resolves
    render(<PoolStatsCard />);

    expect(screen.getByTestId('pool-stats-loading')).toBeInTheDocument();
  });

  it('displays pool stats after fetch', async () => {
    mockGetLPStats.mockResolvedValueOnce({
      poolValue: 5000,
      totalShares: 500,
      sharePrice: 10,
      lpCount: 3,
      canWithdraw: true,
    });

    render(<PoolStatsCard />);

    await waitFor(() => {
      expect(screen.getByTestId('pool-stats-card')).toBeInTheDocument();
    });

    expect(screen.getByTestId('pool-value')).toHaveTextContent('$5,000.00');
    expect(screen.getByTestId('pool-total-shares')).toHaveTextContent('500.00');
    expect(screen.getByTestId('pool-share-price')).toHaveTextContent('$10.00');
    expect(screen.getByTestId('pool-lp-count')).toHaveTextContent('3');
  });

  it('shows withdrawal status Enabled when canWithdraw is true', async () => {
    mockGetLPStats.mockResolvedValueOnce({
      poolValue: 1000,
      totalShares: 100,
      sharePrice: 10,
      lpCount: 1,
      canWithdraw: true,
    });

    render(<PoolStatsCard />);

    await waitFor(() => {
      expect(screen.getByTestId('pool-withdraw-status')).toHaveTextContent('Enabled');
    });
  });

  it('shows withdrawal status Locked when canWithdraw is false', async () => {
    mockGetLPStats.mockResolvedValueOnce({
      poolValue: 1000,
      totalShares: 100,
      sharePrice: 10,
      lpCount: 1,
      canWithdraw: false,
    });

    render(<PoolStatsCard />);

    await waitFor(() => {
      expect(screen.getByTestId('pool-withdraw-status')).toHaveTextContent('Locked');
    });
  });

  it('handles fetch error with error message', async () => {
    mockGetLPStats.mockRejectedValueOnce(new Error('Server error'));

    render(<PoolStatsCard />);

    await waitFor(() => {
      expect(screen.getByTestId('pool-stats-error')).toBeInTheDocument();
    });

    expect(screen.getByText('Server error')).toBeInTheDocument();
  });

  it('refresh button re-fetches', async () => {
    const user = userEvent.setup();
    mockGetLPStats
      .mockResolvedValueOnce({
        poolValue: 1000,
        totalShares: 100,
        sharePrice: 10,
        lpCount: 1,
        canWithdraw: true,
      })
      .mockResolvedValueOnce({
        poolValue: 2000,
        totalShares: 200,
        sharePrice: 10,
        lpCount: 2,
        canWithdraw: true,
      });

    render(<PoolStatsCard />);

    await waitFor(() => {
      expect(screen.getByTestId('pool-stats-card')).toBeInTheDocument();
    });

    expect(screen.getByTestId('pool-value')).toHaveTextContent('$1,000.00');

    await user.click(screen.getByTestId('pool-stats-refresh'));

    await waitFor(() => {
      expect(screen.getByTestId('pool-value')).toHaveTextContent('$2,000.00');
    });

    expect(mockGetLPStats).toHaveBeenCalledTimes(2);
  });

  it('updates stats on POOL_UPDATE WS message', async () => {
    mockGetLPStats.mockResolvedValueOnce({
      poolValue: 1000,
      totalShares: 100,
      sharePrice: 10,
      lpCount: 1,
      canWithdraw: true,
    });

    render(<PoolStatsCard />);

    await waitFor(() => {
      expect(screen.getByTestId('pool-stats-card')).toBeInTheDocument();
    });

    expect(screen.getByTestId('pool-value')).toHaveTextContent('$1,000.00');

    // Simulate POOL_UPDATE WS message
    act(() => {
      subscribeHandler?.({
        type: 'POOL_UPDATE',
        poolValue: 3000,
        totalShares: 250,
        sharePrice: 12,
        lpCount: 5,
        canWithdraw: false,
      });
    });

    expect(screen.getByTestId('pool-value')).toHaveTextContent('$3,000.00');
    expect(screen.getByTestId('pool-total-shares')).toHaveTextContent('250.00');
    expect(screen.getByTestId('pool-share-price')).toHaveTextContent('$12.00');
    expect(screen.getByTestId('pool-lp-count')).toHaveTextContent('5');
    expect(screen.getByTestId('pool-withdraw-status')).toHaveTextContent('Locked');
  });
});
