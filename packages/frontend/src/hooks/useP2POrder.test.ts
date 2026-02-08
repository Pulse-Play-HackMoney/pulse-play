import { renderHook, act, waitFor } from '@testing-library/react';
import { useP2POrder } from './useP2POrder';
import * as api from '@/lib/api';

const testGlobals = globalThis as typeof globalThis & { __TEST_MM_ADDRESS__?: string };

jest.mock('@/lib/api');
jest.mock('@/hooks/useClearnode');
jest.mock('@/lib/config', () => ({
  get MM_ADDRESS() { return testGlobals.__TEST_MM_ADDRESS__; },
}));

const mockPlaceP2POrder = api.placeP2POrder as jest.MockedFunction<typeof api.placeP2POrder>;
const mockCancelP2POrder = api.cancelP2POrder as jest.MockedFunction<typeof api.cancelP2POrder>;

import { useClearnode } from '@/hooks/useClearnode';
const mockUseClearnode = useClearnode as jest.MockedFunction<typeof useClearnode>;
const mockCreateAppSession = jest.fn();

function setupClearnodeMock(overrides: Partial<ReturnType<typeof useClearnode>> = {}) {
  mockUseClearnode.mockReturnValue({
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
    createAppSession: mockCreateAppSession,
    closeAppSession: jest.fn(),
    submitAppState: jest.fn(),
    transfer: jest.fn(),
    getAppSessions: jest.fn(),
    getConfig: jest.fn(),
    ...overrides,
  } as ReturnType<typeof useClearnode>);
}

const mockOrderResponse = {
  orderId: 'order-123',
  status: 'OPEN' as const,
  fills: [],
  order: {
    orderId: 'order-123',
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
    status: 'OPEN' as const,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
};

describe('useP2POrder', () => {
  beforeEach(() => {
    mockPlaceP2POrder.mockReset();
    mockCancelP2POrder.mockReset();
    mockCreateAppSession.mockReset();
    mockCreateAppSession.mockResolvedValue({
      appSessionId: '0xSESSION',
      version: 1,
      status: 'open',
    });
    testGlobals.__TEST_MM_ADDRESS__ = '0xMM';
    setupClearnodeMock();
  });

  it('returns error when required params are missing', async () => {
    const { result } = renderHook(() => useP2POrder({}));

    let response: unknown;
    await act(async () => {
      response = await result.current.placeOrder('BALL', 0.60, 6);
    });

    expect(response).toBeNull();
    expect(result.current.error).toBe('Missing required order parameters');
  });

  it('returns error when MM_ADDRESS is not configured', async () => {
    testGlobals.__TEST_MM_ADDRESS__ = undefined;

    const { result } = renderHook(() =>
      useP2POrder({ address: '0x123', marketId: 'market-1', gameId: 'game-1' })
    );

    await act(async () => {
      await result.current.placeOrder('BALL', 0.60, 6);
    });

    expect(result.current.error).toBe('MM_ADDRESS not configured');
    expect(mockCreateAppSession).not.toHaveBeenCalled();
  });

  it('full success flow: creates session then submits order', async () => {
    mockPlaceP2POrder.mockResolvedValueOnce(mockOrderResponse);

    const onSuccess = jest.fn();
    const { result } = renderHook(() =>
      useP2POrder({
        address: '0x123',
        marketId: 'market-1',
        gameId: 'game-1',
        onSuccess,
      })
    );

    let response: unknown;
    await act(async () => {
      response = await result.current.placeOrder('BALL', 0.60, 6);
    });

    expect(mockCreateAppSession).toHaveBeenCalledWith(
      expect.objectContaining({
        counterparty: '0xMM',
        allocations: [
          { asset: 'ytest.usd', amount: '6000000', participant: '0x123' },
          { asset: 'ytest.usd', amount: '0', participant: '0xMM' },
        ],
      }),
    );

    expect(mockPlaceP2POrder).toHaveBeenCalledWith({
      marketId: 'market-1',
      gameId: 'game-1',
      userAddress: '0x123',
      outcome: 'BALL',
      mcps: 0.60,
      amount: 6,
      appSessionId: '0xSESSION',
      appSessionVersion: 1,
    });

    expect(response).toEqual(expect.objectContaining({ orderId: 'order-123' }));
    expect(onSuccess).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('calls refreshBalance after successful order', async () => {
    const mockRefreshBalance = jest.fn();
    setupClearnodeMock({ refreshBalance: mockRefreshBalance });
    mockPlaceP2POrder.mockResolvedValueOnce(mockOrderResponse);

    const { result } = renderHook(() =>
      useP2POrder({ address: '0x123', marketId: 'market-1', gameId: 'game-1' })
    );

    await act(async () => {
      await result.current.placeOrder('BALL', 0.60, 6);
    });

    expect(mockRefreshBalance).toHaveBeenCalledTimes(1);
  });

  it('shows error when session creation fails', async () => {
    mockCreateAppSession.mockRejectedValueOnce(new Error('Session creation failed'));

    const onError = jest.fn();
    const { result } = renderHook(() =>
      useP2POrder({
        address: '0x123',
        marketId: 'market-1',
        gameId: 'game-1',
        onError,
      })
    );

    await act(async () => {
      await result.current.placeOrder('BALL', 0.60, 6);
    });

    expect(result.current.error).toBe('Session creation failed');
    expect(onError).toHaveBeenCalled();
    expect(mockPlaceP2POrder).not.toHaveBeenCalled();
  });

  it('step transitions correctly during order flow', async () => {
    let resolveSession: (value: unknown) => void;
    let resolveOrder: (value: unknown) => void;

    mockCreateAppSession.mockImplementationOnce(
      () => new Promise((resolve) => { resolveSession = resolve as (value: unknown) => void; })
    );
    mockPlaceP2POrder.mockImplementationOnce(
      () => new Promise((resolve) => { resolveOrder = resolve as (value: unknown) => void; })
    );

    const { result } = renderHook(() =>
      useP2POrder({ address: '0x123', marketId: 'market-1', gameId: 'game-1' })
    );

    expect(result.current.step).toBe('idle');

    let orderPromise: Promise<unknown>;
    act(() => {
      orderPromise = result.current.placeOrder('BALL', 0.60, 6);
    });

    await waitFor(() => {
      expect(result.current.step).toBe('creating-session');
    });

    await act(async () => {
      resolveSession!({ appSessionId: '0xSESSION', version: 1, status: 'open' });
    });

    await waitFor(() => {
      expect(result.current.step).toBe('submitting-order');
    });

    await act(async () => {
      resolveOrder!(mockOrderResponse);
      await orderPromise;
    });

    expect(result.current.step).toBe('idle');
  });

  it('cancelOrder calls cancelP2POrder API', async () => {
    mockCancelP2POrder.mockResolvedValueOnce({
      order: { ...mockOrderResponse.order, status: 'CANCELLED' as const },
    });

    const { result } = renderHook(() =>
      useP2POrder({ address: '0x123', marketId: 'market-1', gameId: 'game-1' })
    );

    await act(async () => {
      await result.current.cancelOrder('order-123');
    });

    expect(mockCancelP2POrder).toHaveBeenCalledWith('order-123');
    expect(result.current.error).toBeNull();
  });

  it('cancelOrder handles errors', async () => {
    mockCancelP2POrder.mockRejectedValueOnce(new Error('Cancel failed'));

    const onError = jest.fn();
    const { result } = renderHook(() =>
      useP2POrder({
        address: '0x123',
        marketId: 'market-1',
        gameId: 'game-1',
        onError,
      })
    );

    await act(async () => {
      await result.current.cancelOrder('order-123');
    });

    expect(result.current.error).toBe('Cancel failed');
    expect(onError).toHaveBeenCalled();
  });

  it('sets isLoading during request', async () => {
    let resolveSession: (value: unknown) => void;
    mockCreateAppSession.mockImplementationOnce(
      () => new Promise((resolve) => { resolveSession = resolve as (value: unknown) => void; })
    );

    const { result } = renderHook(() =>
      useP2POrder({ address: '0x123', marketId: 'market-1', gameId: 'game-1' })
    );

    expect(result.current.isLoading).toBe(false);

    let orderPromise: Promise<unknown>;
    act(() => {
      orderPromise = result.current.placeOrder('BALL', 0.60, 6);
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    mockPlaceP2POrder.mockResolvedValueOnce(mockOrderResponse);

    await act(async () => {
      resolveSession!({ appSessionId: '0xSESSION', version: 1, status: 'open' });
      await orderPromise;
    });

    expect(result.current.isLoading).toBe(false);
  });
});
