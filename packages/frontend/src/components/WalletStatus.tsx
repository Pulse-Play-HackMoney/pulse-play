'use client';

import { useWallet } from '@/providers/WagmiProvider';

interface WalletStatusProps {
  className?: string;
}

export function WalletStatus({ className = '' }: WalletStatusProps) {
  const { address, isConfigured, mode, isConnecting, isConnected, connect, disconnect } = useWallet();

  // MetaMask mode: not connected
  if (mode === 'metamask' && !isConnected) {
    return (
      <div className={`${className}`}>
        <button
          onClick={connect}
          disabled={isConnecting}
          className="px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          data-testid="connect-wallet-button"
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      </div>
    );
  }

  // Private-key mode: not configured
  if (!isConfigured) {
    return (
      <div className={`text-sm text-yellow-500 ${className}`} data-testid="wallet-not-configured">
        Wallet not configured
      </div>
    );
  }

  // Both modes: connected/configured - show address
  return (
    <div className={`flex items-center gap-2 ${className}`} data-testid="wallet-status">
      <div className="w-2 h-2 rounded-full bg-accent" />
      <span className="text-sm font-mono text-text-secondary" data-testid="wallet-address">
        {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Unknown'}
      </span>
      {mode === 'metamask' && (
        <button
          onClick={disconnect}
          className="ml-2 px-2 py-1 text-xs text-text-secondary hover:text-text-primary border border-border rounded hover:border-border-emphasis transition-colors"
          data-testid="disconnect-wallet-button"
        >
          Disconnect
        </button>
      )}
    </div>
  );
}
