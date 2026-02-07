'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletStatus } from './WalletStatus';
import { useWebSocket } from '@/providers/WebSocketProvider';

export function Header() {
  const pathname = usePathname();
  const { isConnected } = useWebSocket();

  return (
    <header className="bg-surface-overlay border-b border-border px-6 py-4" data-testid="header">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2" data-testid="logo">
            <span className="text-xl font-bold font-mono uppercase tracking-wider text-text-primary">
              PulsePlay
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent-muted text-accent">
              Beta
            </span>
          </Link>
          <nav className="flex gap-1" data-testid="nav">
            {[
              { href: '/', label: 'Games', testId: 'nav-games' },
              { href: '/oracle', label: 'Oracle', testId: 'nav-oracle' },
              { href: '/market-maker', label: 'Market Maker', testId: 'nav-market-maker' },
              { href: '/account', label: 'Account', testId: 'nav-account' },
              { href: '/admin', label: 'Admin', testId: 'nav-admin' },
            ].map(({ href, label, testId }) => {
              const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-surface-input text-text-primary'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-input/50'
                  }`}
                  data-testid={testId}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div
            className={`flex items-center gap-1.5 text-xs font-mono ${
              isConnected ? 'text-accent' : 'text-text-muted'
            }`}
            data-testid="ws-status"
          >
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-accent animate-pulse-dot' : 'bg-text-muted'
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
