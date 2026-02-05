'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  WagmiProvider as WagmiProviderBase,
  createConfig,
  http,
  useAccount,
  useConnect,
  useDisconnect,
  injected,
} from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { privateKeyToAccount } from 'viem/accounts';
import { PRIVATE_KEY, WALLET_MODE, type WalletMode } from '@/lib/config';

// Create account from private key if provided (for private-key mode)
const privateKeyAccount = PRIVATE_KEY ? privateKeyToAccount(PRIVATE_KEY) : undefined;

// Configure wagmi - include injected connector for MetaMask mode
export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: WALLET_MODE === 'metamask' ? [injected()] : [],
  transports: {
    [sepolia.id]: http(),
  },
});

// Query client for react-query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      retry: false,
    },
  },
});

// Extended wallet context with connect/disconnect support
interface WalletContextValue {
  address: `0x${string}` | undefined;
  isConfigured: boolean;
  mode: WalletMode;
  isConnecting: boolean;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue>({
  address: undefined,
  isConfigured: false,
  mode: 'private-key',
  isConnecting: false,
  isConnected: false,
  connect: () => {},
  disconnect: () => {},
});

export function useWallet() {
  return useContext(WalletContext);
}

// Inner provider that uses wagmi hooks (must be inside WagmiProviderBase)
function WalletContextProviderInner({ children }: { children: ReactNode }) {
  const { address: wagmiAddress, isConnected: wagmiConnected, isConnecting: wagmiConnecting } = useAccount();
  const { connect: wagmiConnect, connectors } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();

  const walletValue = useMemo<WalletContextValue>(() => {
    if (WALLET_MODE === 'metamask') {
      // MetaMask mode: use wagmi hooks for wallet state
      return {
        address: wagmiAddress,
        isConfigured: wagmiConnected,
        mode: 'metamask',
        isConnecting: wagmiConnecting,
        isConnected: wagmiConnected,
        connect: () => {
          const injectedConnector = connectors.find(c => c.id === 'injected' || c.type === 'injected');
          if (injectedConnector) {
            wagmiConnect({ connector: injectedConnector });
          }
        },
        disconnect: () => wagmiDisconnect(),
      };
    }

    // Private-key mode: use static account from private key
    return {
      address: privateKeyAccount?.address,
      isConfigured: !!privateKeyAccount,
      mode: 'private-key',
      isConnecting: false,
      isConnected: !!privateKeyAccount,
      connect: () => {}, // No-op in private-key mode
      disconnect: () => {}, // No-op in private-key mode
    };
  }, [wagmiAddress, wagmiConnected, wagmiConnecting, wagmiConnect, wagmiDisconnect, connectors]);

  return (
    <WalletContext.Provider value={walletValue}>
      {children}
    </WalletContext.Provider>
  );
}

interface WagmiProviderProps {
  children: ReactNode;
}

export function WagmiProvider({ children }: WagmiProviderProps) {
  return (
    <WagmiProviderBase config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <WalletContextProviderInner>{children}</WalletContextProviderInner>
      </QueryClientProvider>
    </WagmiProviderBase>
  );
}
