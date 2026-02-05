'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletStatus } from './WalletStatus';
import { useWebSocket } from '@/providers/WebSocketProvider';

export function Header() {
  const pathname = usePathname();
  const { isConnected } = useWebSocket();

  return (
    <header className="bg-gray-900 border-b border-gray-800 px-6 py-4" data-testid="header">
      <div className="flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold text-white" data-testid="logo">
            PulsePlay
          </Link>
          <nav className="flex gap-4" data-testid="nav">
            <Link
              href="/"
              className={`text-sm ${
                pathname === '/' ? 'text-white' : 'text-gray-400 hover:text-white'
              }`}
              data-testid="nav-bettor"
            >
              Bettor
            </Link>
            <Link
              href="/oracle"
              className={`text-sm ${
                pathname === '/oracle' ? 'text-white' : 'text-gray-400 hover:text-white'
              }`}
              data-testid="nav-oracle"
            >
              Oracle
            </Link>
            <Link
              href="/market-maker"
              className={`text-sm ${
                pathname === '/market-maker' ? 'text-white' : 'text-gray-400 hover:text-white'
              }`}
              data-testid="nav-market-maker"
            >
              Market Maker
            </Link>
            <Link
              href="/account"
              className={`text-sm ${
                pathname === '/account' ? 'text-white' : 'text-gray-400 hover:text-white'
              }`}
              data-testid="nav-account"
            >
              Account
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div
            className={`flex items-center gap-1 text-xs ${
              isConnected ? 'text-green-400' : 'text-gray-500'
            }`}
            data-testid="ws-status"
          >
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-400' : 'bg-gray-500'
              }`}
            />
            {isConnected ? 'Live' : 'Offline'}
          </div>
          <WalletStatus />
        </div>
      </div>
    </header>
  );
}
