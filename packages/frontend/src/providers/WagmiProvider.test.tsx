import { render, screen, fireEvent } from '@testing-library/react';
import { WagmiProvider, useWallet } from './WagmiProvider';

// Test component to access wallet context
function WalletConsumer() {
  const wallet = useWallet();
  return (
    <div>
      <span data-testid="address">{wallet.address || 'no-address'}</span>
      <span data-testid="configured">{wallet.isConfigured ? 'yes' : 'no'}</span>
      <span data-testid="mode">{wallet.mode}</span>
      <span data-testid="connecting">{wallet.isConnecting ? 'yes' : 'no'}</span>
      <span data-testid="connected">{wallet.isConnected ? 'yes' : 'no'}</span>
      <button data-testid="connect-btn" onClick={wallet.connect}>Connect</button>
      <button data-testid="disconnect-btn" onClick={wallet.disconnect}>Disconnect</button>
    </div>
  );
}

describe('WagmiProvider', () => {
  // These tests run with the default config (private-key mode, no private key set)
  // Since WALLET_MODE is read at module load time, we can only test the default mode here
  // The MetaMask mode is integration tested separately

  it('renders children', () => {
    render(
      <WagmiProvider>
        <div data-testid="child">Hello</div>
      </WagmiProvider>
    );

    expect(screen.getByTestId('child')).toHaveTextContent('Hello');
  });

  it('provides wallet context with no address when PRIVATE_KEY not set', () => {
    // PRIVATE_KEY is not set in test environment
    render(
      <WagmiProvider>
        <WalletConsumer />
      </WagmiProvider>
    );

    expect(screen.getByTestId('address')).toHaveTextContent('no-address');
    expect(screen.getByTestId('configured')).toHaveTextContent('no');
  });

  it('exposes mode in context', () => {
    render(
      <WagmiProvider>
        <WalletConsumer />
      </WagmiProvider>
    );

    // Default mode from env is private-key
    expect(screen.getByTestId('mode')).toHaveTextContent('private-key');
  });

  it('exposes connect/disconnect functions that can be called', () => {
    render(
      <WagmiProvider>
        <WalletConsumer />
      </WagmiProvider>
    );

    // These should be callable without error (no-ops in private-key mode)
    fireEvent.click(screen.getByTestId('connect-btn'));
    fireEvent.click(screen.getByTestId('disconnect-btn'));

    // No error means success - they're no-ops in private-key mode
    expect(screen.getByTestId('address')).toHaveTextContent('no-address');
  });

  it('exposes isConnecting and isConnected states', () => {
    render(
      <WagmiProvider>
        <WalletConsumer />
      </WagmiProvider>
    );

    // In private-key mode without a key, not connected
    expect(screen.getByTestId('connecting')).toHaveTextContent('no');
    expect(screen.getByTestId('connected')).toHaveTextContent('no');
  });

  it('useWallet returns default values outside provider', () => {
    // Render without provider to test default context
    const TestComponent = () => {
      const wallet = useWallet();
      return (
        <div>
          <span data-testid="default-address">
            {wallet.address || 'undefined'}
          </span>
          <span data-testid="default-mode">{wallet.mode}</span>
          <span data-testid="default-connecting">{wallet.isConnecting ? 'yes' : 'no'}</span>
          <span data-testid="default-connected">{wallet.isConnected ? 'yes' : 'no'}</span>
        </div>
      );
    };

    render(<TestComponent />);
    expect(screen.getByTestId('default-address')).toHaveTextContent('undefined');
    expect(screen.getByTestId('default-mode')).toHaveTextContent('private-key');
    expect(screen.getByTestId('default-connecting')).toHaveTextContent('no');
    expect(screen.getByTestId('default-connected')).toHaveTextContent('no');
  });
});
