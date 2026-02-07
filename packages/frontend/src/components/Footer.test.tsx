import { render, screen } from '@testing-library/react';
import { Footer } from './Footer';
import * as WebSocketProvider from '@/providers/WebSocketProvider';

jest.mock('@/providers/WebSocketProvider', () => ({
  useWebSocket: jest.fn(),
}));

const mockUseWebSocket = WebSocketProvider.useWebSocket as jest.Mock;

describe('Footer', () => {
  beforeEach(() => {
    mockUseWebSocket.mockReturnValue({
      isConnected: true,
      lastMessage: null,
      subscribe: jest.fn(),
    });
  });

  it('renders version and network info', () => {
    render(<Footer />);

    const footer = screen.getByTestId('footer');
    expect(footer).toHaveTextContent('PulsePlay v0.1.0');
    expect(footer).toHaveTextContent('Yellow Network');
  });

  it('shows connected status when WebSocket is connected', () => {
    render(<Footer />);

    const footer = screen.getByTestId('footer');
    expect(footer).toHaveTextContent('Connected');
  });

  it('shows disconnected status when WebSocket is not connected', () => {
    mockUseWebSocket.mockReturnValue({
      isConnected: false,
      lastMessage: null,
      subscribe: jest.fn(),
    });

    render(<Footer />);

    const footer = screen.getByTestId('footer');
    expect(footer).toHaveTextContent('Disconnected');
  });
});
