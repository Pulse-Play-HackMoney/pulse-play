import { render, screen } from '@testing-library/react';
import { Header } from './Header';
import * as WagmiProvider from '@/providers/WagmiProvider';
import * as WebSocketProvider from '@/providers/WebSocketProvider';

// Mock the providers
jest.mock('@/providers/WagmiProvider', () => ({
  useWallet: jest.fn(),
}));

jest.mock('@/providers/WebSocketProvider', () => ({
  useWebSocket: jest.fn(),
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/'),
}));

const mockUseWallet = WagmiProvider.useWallet as jest.Mock;
const mockUseWebSocket = WebSocketProvider.useWebSocket as jest.Mock;

describe('Header', () => {
  beforeEach(() => {
    mockUseWallet.mockReturnValue({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      isConfigured: true,
    });
    mockUseWebSocket.mockReturnValue({
      isConnected: true,
      lastMessage: null,
      subscribe: jest.fn(),
    });
  });

  it('renders logo and navigation', () => {
    render(<Header />);

    expect(screen.getByTestId('logo')).toHaveTextContent('PulsePlay');
    expect(screen.getByTestId('nav-bettor')).toHaveTextContent('Bettor');
    expect(screen.getByTestId('nav-oracle')).toHaveTextContent('Oracle');
    expect(screen.getByTestId('nav-market-maker')).toHaveTextContent('Market Maker');
  });

  it('shows WebSocket connection status', () => {
    render(<Header />);

    expect(screen.getByTestId('ws-status')).toHaveTextContent('Live');
  });

  it('shows offline status when not connected', () => {
    mockUseWebSocket.mockReturnValue({
      isConnected: false,
      lastMessage: null,
      subscribe: jest.fn(),
    });

    render(<Header />);

    expect(screen.getByTestId('ws-status')).toHaveTextContent('Offline');
  });
});
