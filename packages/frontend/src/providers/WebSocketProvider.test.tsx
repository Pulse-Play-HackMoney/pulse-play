import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { WebSocketProvider, useWebSocket } from './WebSocketProvider';
import {
  MockWebSocket,
  installMockWebSocket,
  flushPromises,
} from '@/test/mocks/websocket';

// Consumer component for testing
function WebSocketConsumer() {
  const { isConnected, lastMessage } = useWebSocket();
  return (
    <div>
      <span data-testid="connected">{isConnected ? 'yes' : 'no'}</span>
      <span data-testid="last-message">
        {lastMessage ? JSON.stringify(lastMessage) : 'none'}
      </span>
    </div>
  );
}

describe('WebSocketProvider', () => {
  beforeEach(() => {
    installMockWebSocket();
  });

  afterEach(() => {
    MockWebSocket.clearInstances();
  });

  it('does not connect without address', () => {
    render(
      <WebSocketProvider>
        <WebSocketConsumer />
      </WebSocketProvider>
    );

    expect(MockWebSocket.instances).toHaveLength(0);
    expect(screen.getByTestId('connected')).toHaveTextContent('no');
  });

  it('connects when address is provided', async () => {
    render(
      <WebSocketProvider address="0x123">
        <WebSocketConsumer />
      </WebSocketProvider>
    );

    // WebSocket should be created
    expect(MockWebSocket.instances).toHaveLength(1);
    const ws = MockWebSocket.getLastInstance()!;
    expect(ws.url).toContain('address=0x123');

    // Simulate connection open
    await act(async () => {
      ws.simulateOpen();
      await flushPromises();
    });

    expect(screen.getByTestId('connected')).toHaveTextContent('yes');
  });

  it('receives and distributes messages', async () => {
    render(
      <WebSocketProvider address="0x123">
        <WebSocketConsumer />
      </WebSocketProvider>
    );

    const ws = MockWebSocket.getLastInstance()!;

    await act(async () => {
      ws.simulateOpen();
      await flushPromises();
    });

    // Send a message
    await act(async () => {
      ws.simulateMessage({
        type: 'ODDS_UPDATE',
        priceBall: 0.55,
        priceStrike: 0.45,
        marketId: 'market-1',
      });
      await flushPromises();
    });

    await waitFor(() => {
      expect(screen.getByTestId('last-message')).toHaveTextContent('ODDS_UPDATE');
    });
  });

  it('calls subscribe handlers on message', async () => {
    const handler = jest.fn();

    function SubscriberComponent() {
      const { subscribe } = useWebSocket();
      React.useEffect(() => {
        return subscribe(handler);
      }, [subscribe]);
      return null;
    }

    render(
      <WebSocketProvider address="0x123">
        <SubscriberComponent />
      </WebSocketProvider>
    );

    const ws = MockWebSocket.getLastInstance()!;

    await act(async () => {
      ws.simulateOpen();
      await flushPromises();
    });

    await act(async () => {
      ws.simulateMessage({
        type: 'GAME_STATE',
        active: true,
      });
      await flushPromises();
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'GAME_STATE', active: true })
    );
  });

  it('does not reconnect after intentional cleanup', () => {
    jest.useFakeTimers();

    const { unmount } = render(
      <WebSocketProvider address="0x123">
        <WebSocketConsumer />
      </WebSocketProvider>
    );

    const ws = MockWebSocket.getLastInstance()!;
    act(() => {
      ws.simulateOpen();
    });

    const instancesBefore = MockWebSocket.instances.length;
    unmount();

    // Advance past reconnect delay — no new connection should be created
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(MockWebSocket.instances).toHaveLength(instancesBefore);

    jest.useRealTimers();
  });
});
