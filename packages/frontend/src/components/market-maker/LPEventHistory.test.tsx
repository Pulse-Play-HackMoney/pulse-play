import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LPEventHistory } from './LPEventHistory';
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
  getLPEvents: jest.fn(),
}));

const mockGetLPEvents = api.getLPEvents as jest.MockedFunction<typeof api.getLPEvents>;

describe('LPEventHistory', () => {
  beforeEach(() => {
    mockGetLPEvents.mockReset();
    subscribeHandler = null;
  });

  it('shows "No LP events yet" when empty', async () => {
    mockGetLPEvents.mockResolvedValueOnce({ events: [] });

    render(<LPEventHistory />);

    await waitFor(() => {
      expect(screen.getByTestId('lp-events-empty')).toBeInTheDocument();
    });

    expect(screen.getByTestId('lp-events-empty')).toHaveTextContent('No LP events yet');
  });

  it('displays event rows with correct data', async () => {
    mockGetLPEvents.mockResolvedValueOnce({
      events: [
        {
          id: 1,
          address: '0xABC',
          type: 'DEPOSIT' as const,
          amount: 500,
          shares: 50,
          sharePrice: 10,
          poolValueBefore: 1000,
          poolValueAfter: 1500,
          timestamp: 1700000000000,
        },
        {
          id: 2,
          address: '0xDEF',
          type: 'WITHDRAWAL' as const,
          amount: 200,
          shares: 20,
          sharePrice: 10,
          poolValueBefore: 1500,
          poolValueAfter: 1300,
          timestamp: 1700001000000,
        },
      ],
    });

    render(<LPEventHistory />);

    await waitFor(() => {
      expect(screen.getByTestId('lp-events-list')).toBeInTheDocument();
    });

    // Check first event
    expect(screen.getByTestId('lp-event-type-1')).toHaveTextContent('DEPOSIT');
    expect(screen.getByTestId('lp-event-amount-1')).toHaveTextContent('$500.00');
    expect(screen.getByTestId('lp-event-shares-1')).toHaveTextContent('50.00 shares @ $10.00');

    // Check second event
    expect(screen.getByTestId('lp-event-type-2')).toHaveTextContent('WITHDRAWAL');
    expect(screen.getByTestId('lp-event-amount-2')).toHaveTextContent('$200.00');
  });

  it('handles fetch error', async () => {
    mockGetLPEvents.mockRejectedValueOnce(new Error('Network error'));

    render(<LPEventHistory />);

    await waitFor(() => {
      expect(screen.getByTestId('lp-events-error')).toBeInTheDocument();
    });

    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('refresh button re-fetches', async () => {
    const user = userEvent.setup();
    mockGetLPEvents
      .mockResolvedValueOnce({ events: [] })
      .mockResolvedValueOnce({
        events: [
          {
            id: 1,
            address: '0xABC',
            type: 'DEPOSIT' as const,
            amount: 100,
            shares: 10,
            sharePrice: 10,
            poolValueBefore: 0,
            poolValueAfter: 100,
            timestamp: Date.now(),
          },
        ],
      });

    render(<LPEventHistory />);

    await waitFor(() => {
      expect(screen.getByTestId('lp-events-empty')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('lp-events-refresh'));

    await waitFor(() => {
      expect(screen.getByTestId('lp-events-list')).toBeInTheDocument();
    });

    expect(mockGetLPEvents).toHaveBeenCalledTimes(2);
  });

  it('re-fetches events on LP_DEPOSIT WS message', async () => {
    mockGetLPEvents
      .mockResolvedValueOnce({ events: [] })
      .mockResolvedValueOnce({
        events: [
          {
            id: 1,
            address: '0xABC',
            type: 'DEPOSIT' as const,
            amount: 500,
            shares: 50,
            sharePrice: 10,
            poolValueBefore: 0,
            poolValueAfter: 500,
            timestamp: Date.now(),
          },
        ],
      });

    render(<LPEventHistory />);

    await waitFor(() => {
      expect(screen.getByTestId('lp-events-empty')).toBeInTheDocument();
    });

    // Simulate LP_DEPOSIT WS message
    await act(async () => {
      subscribeHandler?.({
        type: 'LP_DEPOSIT',
        address: '0xABC',
        amount: 500,
        shares: 50,
        sharePrice: 10,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('lp-events-list')).toBeInTheDocument();
    });

    expect(mockGetLPEvents).toHaveBeenCalledTimes(2);
  });
});
