import { render, screen, fireEvent } from '@testing-library/react';
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
    expect(screen.getByTestId('nav-games')).toHaveTextContent('Games');
    expect(screen.getByTestId('nav-oracle')).toHaveTextContent('Oracle');
    expect(screen.getByTestId('nav-market-maker')).toHaveTextContent('Liquidity Pool');
    expect(screen.getByTestId('nav-account')).toHaveTextContent('Account');
    expect(screen.getByTestId('nav-admin')).toHaveTextContent('Admin');
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

  it('renders hamburger button', () => {
    render(<Header />);
    expect(screen.getByTestId('hamburger')).toBeInTheDocument();
  });

  it('shows mobile nav when hamburger is clicked', () => {
    render(<Header />);
    expect(screen.queryByTestId('mobile-nav')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('hamburger'));
    expect(screen.getByTestId('mobile-nav')).toBeInTheDocument();
  });

  it('hides mobile nav when hamburger is clicked again', () => {
    render(<Header />);

    fireEvent.click(screen.getByTestId('hamburger'));
    expect(screen.getByTestId('mobile-nav')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('hamburger'));
    expect(screen.queryByTestId('mobile-nav')).not.toBeInTheDocument();
  });
});
