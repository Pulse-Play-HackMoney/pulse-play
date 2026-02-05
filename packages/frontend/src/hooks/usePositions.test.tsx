import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePositions } from './usePositions';
import { WebSocketProvider } from '@/providers/WebSocketProvider';
import * as api from '@/lib/api';
import {
  MockWebSocket,
  installMockWebSocket,
  flushPromises,
} from '@/test/mocks/websocket';

jest.mock('@/lib/api');
const mockGetPositions = api.getPositions as jest.MockedFunction<
  typeof api.getPositions
>;

// Wrapper with WebSocket provider
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <WebSocketProvider address="0x123">{children}</WebSocketProvider>;
}

describe('usePositions', () => {
  beforeEach(() => {
    installMockWebSocket();
    mockGetPositions.mockReset();
  });

  afterEach(() => {
    MockWebSocket.clearInstances();
  });

  it('returns empty positions without address', async () => {
    const { result } = renderHook(() => usePositions({}), {
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.positions).toEqual([]);
  });

  it('fetches positions for address', async () => {
    mockGetPositions.mockResolvedValueOnce({
      positions: [
        {
          address: '0xabc',
          marketId: 'market-1',
          outcome: 'BALL',
          shares: 10,
          costPaid: 5,
          appSessionId: 'session-1',
          timestamp: Date.now(),
        },
      ],
    });

    const { result } = renderHook(() => usePositions({ address: '0xabc' }), {
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetPositions).toHaveBeenCalledWith('0xabc');
    expect(result.current.positions).toHaveLength(1);
    expect(result.current.positions[0].outcome).toBe('BALL');
  });

  it('filters positions by marketId', async () => {
    mockGetPositions.mockResolvedValueOnce({
      positions: [
        {
          address: '0xabc',
          marketId: 'market-1',
          outcome: 'BALL',
          shares: 10,
          costPaid: 5,
          appSessionId: 'session-1',
          timestamp: Date.now(),
        },
        {
          address: '0xabc',
          marketId: 'market-2',
          outcome: 'STRIKE',
          shares: 5,
          costPaid: 2.5,
          appSessionId: 'session-2',
          timestamp: Date.now(),
        },
      ],
    });

    const { result } = renderHook(
      () => usePositions({ address: '0xabc', marketId: 'market-1' }),
      { wrapper: TestWrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.positions).toHaveLength(1);
    expect(result.current.positions[0].marketId).toBe('market-1');
  });

  it('handles fetch error', async () => {
    mockGetPositions.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => usePositions({ address: '0xabc' }), {
      wrapper: TestWrapper,
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Network error');
    });
  });

  it('refetches on market resolution', async () => {
    mockGetPositions
      .mockResolvedValueOnce({ positions: [] })
      .mockResolvedValueOnce({
        positions: [
          {
            address: '0xabc',
            marketId: 'market-1',
            outcome: 'BALL',
            shares: 10,
            costPaid: 5,
            appSessionId: 'session-1',
            timestamp: Date.now(),
          },
        ],
      });

    const { result } = renderHook(() => usePositions({ address: '0xabc' }), {
      wrapper: TestWrapper,
    });

    const ws = MockWebSocket.getLastInstance()!;

    await act(async () => {
      ws.simulateOpen();
      await flushPromises();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.positions).toHaveLength(0);

    // Simulate market resolution
    await act(async () => {
      ws.simulateMessage({
        type: 'MARKET_STATUS',
        status: 'RESOLVED',
        marketId: 'market-1',
        outcome: 'BALL',
      });
      await flushPromises();
    });

    await waitFor(() => {
      expect(mockGetPositions).toHaveBeenCalledTimes(2);
    });
  });

  it('appends position on POSITION_ADDED for current user', async () => {
    mockGetPositions.mockResolvedValueOnce({ positions: [] });

    const { result } = renderHook(
      () => usePositions({ address: '0xabc' }),
      { wrapper: TestWrapper }
    );

    const ws = MockWebSocket.getLastInstance()!;

    await act(async () => {
      ws.simulateOpen();
      await flushPromises();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.positions).toHaveLength(0);

    const newPosition = {
      address: '0xabc',
      marketId: 'market-1',
      outcome: 'BALL' as const,
      shares: 10,
      costPaid: 5,
      appSessionId: 'session-1',
      timestamp: Date.now(),
    };

    await act(async () => {
      ws.simulateMessage({
        type: 'POSITION_ADDED',
        position: newPosition,
        positionCount: 1,
      });
      await flushPromises();
    });

    await waitFor(() => {
      expect(result.current.positions).toHaveLength(1);
    });

    expect(result.current.positions[0]).toEqual(newPosition);
  });

  it('ignores POSITION_ADDED for a different user', async () => {
    mockGetPositions.mockResolvedValueOnce({ positions: [] });

    const { result } = renderHook(
      () => usePositions({ address: '0xabc' }),
      { wrapper: TestWrapper }
    );

    const ws = MockWebSocket.getLastInstance()!;

    await act(async () => {
      ws.simulateOpen();
      await flushPromises();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      ws.simulateMessage({
        type: 'POSITION_ADDED',
        position: {
          address: '0xOTHER',
          marketId: 'market-1',
          outcome: 'BALL' as const,
          shares: 10,
          costPaid: 5,
          appSessionId: 'session-1',
          timestamp: Date.now(),
        },
        positionCount: 1,
      });
      await flushPromises();
    });

    expect(result.current.positions).toHaveLength(0);
  });

  it('ignores POSITION_ADDED for a different market when marketId filter is set', async () => {
    mockGetPositions.mockResolvedValueOnce({ positions: [] });

    const { result } = renderHook(
      () => usePositions({ address: '0xabc', marketId: 'market-1' }),
      { wrapper: TestWrapper }
    );

    const ws = MockWebSocket.getLastInstance()!;

    await act(async () => {
      ws.simulateOpen();
      await flushPromises();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      ws.simulateMessage({
        type: 'POSITION_ADDED',
        position: {
          address: '0xabc',
          marketId: 'market-2',
          outcome: 'STRIKE' as const,
          shares: 5,
          costPaid: 2.5,
          appSessionId: 'session-2',
          timestamp: Date.now(),
        },
        positionCount: 1,
      });
      await flushPromises();
    });

    expect(result.current.positions).toHaveLength(0);
  });
});
