import { sendAndWaitBrowser, openClearnodeWs } from './rpc';

// Helper to create a mock browser WebSocket
function createMockWebSocket() {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  return {
    addEventListener: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }),
    removeEventListener: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((h) => h !== handler);
      }
    }),
    send: jest.fn(),
    close: jest.fn(),
    // Test helper to fire events
    __fire(event: string, ...args: unknown[]) {
      (listeners[event] || []).forEach((h) => h(...args));
    },
    __listeners: listeners,
  } as unknown as WebSocket & { __fire: (event: string, ...args: unknown[]) => void };
}

describe('sendAndWaitBrowser', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves with raw message when expected method arrives', async () => {
    const ws = createMockWebSocket();
    const promise = sendAndWaitBrowser(ws, '{"req":[1,"test",{}]}', 'test_response');

    // Simulate response
    const responseRaw = JSON.stringify({ res: [1, 'test_response', { data: 'ok' }] });
    ws.__fire('message', { data: responseRaw });

    await expect(promise).resolves.toBe(responseRaw);
    expect(ws.send).toHaveBeenCalledWith('{"req":[1,"test",{}]}');
  });

  it('ignores messages with non-matching methods', async () => {
    const ws = createMockWebSocket();
    const promise = sendAndWaitBrowser(ws, '{"req":[1,"test",{}]}', 'expected_method');

    // Send unrelated message first
    ws.__fire('message', { data: JSON.stringify({ res: [1, 'other_method', {}] }) });

    // Then send the expected one
    const expected = JSON.stringify({ res: [2, 'expected_method', {}] });
    ws.__fire('message', { data: expected });

    await expect(promise).resolves.toBe(expected);
  });

  it('rejects on RPC error method', async () => {
    const ws = createMockWebSocket();
    const promise = sendAndWaitBrowser(ws, '{"req":[1,"test",{}]}', 'test_response');

    const errorMsg = JSON.stringify({ res: [1, 'error', { code: 400, message: 'bad request' }] });
    ws.__fire('message', { data: errorMsg });

    await expect(promise).rejects.toThrow('RPC error');
  });

  it('rejects on timeout', async () => {
    const ws = createMockWebSocket();
    const promise = sendAndWaitBrowser(ws, '{"req":[1,"test",{}]}', 'test_response', 5000);

    jest.advanceTimersByTime(5000);

    await expect(promise).rejects.toThrow("Timed out waiting for 'test_response'");
  });

  it('removes event listener after resolving', async () => {
    const ws = createMockWebSocket();
    const promise = sendAndWaitBrowser(ws, '{"req":[1,"test",{}]}', 'done');

    ws.__fire('message', { data: JSON.stringify({ res: [1, 'done', {}] }) });
    await promise;

    expect(ws.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('ignores unparseable messages', async () => {
    const ws = createMockWebSocket();
    const promise = sendAndWaitBrowser(ws, '{"req":[1,"test",{}]}', 'done');

    // Send garbage
    ws.__fire('message', { data: 'not json' });

    // Then the real response
    const expected = JSON.stringify({ res: [1, 'done', {}] });
    ws.__fire('message', { data: expected });

    await expect(promise).resolves.toBe(expected);
  });
});

describe('openClearnodeWs', () => {
  const OriginalWebSocket = globalThis.WebSocket;

  afterEach(() => {
    globalThis.WebSocket = OriginalWebSocket;
  });

  it('resolves with WebSocket on open', async () => {
    const mockWs = createMockWebSocket();
    globalThis.WebSocket = jest.fn(() => mockWs) as unknown as typeof WebSocket;

    const promise = openClearnodeWs('wss://test.com/ws');

    // Simulate open
    mockWs.__fire('open');

    const result = await promise;
    expect(result).toBe(mockWs);
  });

  it('rejects on connection error', async () => {
    const mockWs = createMockWebSocket();
    globalThis.WebSocket = jest.fn(() => mockWs) as unknown as typeof WebSocket;

    const promise = openClearnodeWs('wss://test.com/ws');

    // Simulate error
    mockWs.__fire('error');

    await expect(promise).rejects.toThrow('WebSocket connection failed');
  });
});
