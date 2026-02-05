import { render, screen, fireEvent } from '@testing-library/react';
import { WalletStatus } from './WalletStatus';
import * as WagmiProvider from '@/providers/WagmiProvider';

// Mock the useWallet hook
jest.mock('@/providers/WagmiProvider', () => ({
  useWallet: jest.fn(),
}));

const mockUseWallet = WagmiProvider.useWallet as jest.Mock;

describe('WalletStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('private-key mode', () => {
    it('shows not configured when wallet is not set up', () => {
      mockUseWallet.mockReturnValue({
        address: undefined,
        isConfigured: false,
        mode: 'private-key',
        isConnecting: false,
        isConnected: false,
        connect: jest.fn(),
        disconnect: jest.fn(),
      });

      render(<WalletStatus />);

      expect(screen.getByTestId('wallet-not-configured')).toHaveTextContent(
        'Wallet not configured'
      );
    });

    it('shows truncated address when wallet is configured', () => {
      mockUseWallet.mockReturnValue({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        isConfigured: true,
        mode: 'private-key',
        isConnecting: false,
        isConnected: true,
        connect: jest.fn(),
        disconnect: jest.fn(),
      });

      render(<WalletStatus />);

      expect(screen.getByTestId('wallet-status')).toBeInTheDocument();
      expect(screen.getByTestId('wallet-address')).toHaveTextContent(
        '0x1234...5678'
      );
    });

    it('does not show disconnect button in private-key mode', () => {
      mockUseWallet.mockReturnValue({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        isConfigured: true,
        mode: 'private-key',
        isConnecting: false,
        isConnected: true,
        connect: jest.fn(),
        disconnect: jest.fn(),
      });

      render(<WalletStatus />);

      expect(screen.queryByTestId('disconnect-wallet-button')).not.toBeInTheDocument();
    });

    it('applies custom className', () => {
      mockUseWallet.mockReturnValue({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        isConfigured: true,
        mode: 'private-key',
        isConnecting: false,
        isConnected: true,
        connect: jest.fn(),
        disconnect: jest.fn(),
      });

      render(<WalletStatus className="custom-class" />);

      expect(screen.getByTestId('wallet-status')).toHaveClass('custom-class');
    });
  });

  describe('metamask mode', () => {
    it('shows connect button when not connected', () => {
      mockUseWallet.mockReturnValue({
        address: undefined,
        isConfigured: false,
        mode: 'metamask',
        isConnecting: false,
        isConnected: false,
        connect: jest.fn(),
        disconnect: jest.fn(),
      });

      render(<WalletStatus />);

      const connectButton = screen.getByTestId('connect-wallet-button');
      expect(connectButton).toHaveTextContent('Connect Wallet');
      expect(connectButton).not.toBeDisabled();
    });

    it('shows "Connecting..." when connecting', () => {
      mockUseWallet.mockReturnValue({
        address: undefined,
        isConfigured: false,
        mode: 'metamask',
        isConnecting: true,
        isConnected: false,
        connect: jest.fn(),
        disconnect: jest.fn(),
      });

      render(<WalletStatus />);

      const connectButton = screen.getByTestId('connect-wallet-button');
      expect(connectButton).toHaveTextContent('Connecting...');
      expect(connectButton).toBeDisabled();
    });

    it('calls connect on button click', () => {
      const mockConnect = jest.fn();
      mockUseWallet.mockReturnValue({
        address: undefined,
        isConfigured: false,
        mode: 'metamask',
        isConnecting: false,
        isConnected: false,
        connect: mockConnect,
        disconnect: jest.fn(),
      });

      render(<WalletStatus />);

      fireEvent.click(screen.getByTestId('connect-wallet-button'));
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('shows address and disconnect button when connected', () => {
      mockUseWallet.mockReturnValue({
        address: '0xabcdef1234567890abcdef1234567890abcdef12',
        isConfigured: true,
        mode: 'metamask',
        isConnecting: false,
        isConnected: true,
        connect: jest.fn(),
        disconnect: jest.fn(),
      });

      render(<WalletStatus />);

      expect(screen.getByTestId('wallet-status')).toBeInTheDocument();
      expect(screen.getByTestId('wallet-address')).toHaveTextContent('0xabcd...ef12');
      expect(screen.getByTestId('disconnect-wallet-button')).toBeInTheDocument();
    });

    it('calls disconnect on button click', () => {
      const mockDisconnect = jest.fn();
      mockUseWallet.mockReturnValue({
        address: '0xabcdef1234567890abcdef1234567890abcdef12',
        isConfigured: true,
        mode: 'metamask',
        isConnecting: false,
        isConnected: true,
        connect: jest.fn(),
        disconnect: mockDisconnect,
      });

      render(<WalletStatus />);

      fireEvent.click(screen.getByTestId('disconnect-wallet-button'));
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    it('applies custom className in disconnected state', () => {
      mockUseWallet.mockReturnValue({
        address: undefined,
        isConfigured: false,
        mode: 'metamask',
        isConnecting: false,
        isConnected: false,
        connect: jest.fn(),
        disconnect: jest.fn(),
      });

      render(<WalletStatus className="custom-class" />);

      // The wrapper div should have the custom class
      expect(screen.getByTestId('connect-wallet-button').parentElement).toHaveClass('custom-class');
    });
  });
});
