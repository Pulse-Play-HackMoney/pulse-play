'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletStatus } from './WalletStatus';
import { useWebSocket } from '@/providers/WebSocketProvider';

const NAV_ITEMS = [
  { href: '/', label: 'Games', testId: 'nav-games' },
  { href: '/oracle', label: 'Oracle', testId: 'nav-oracle' },
  { href: '/market-maker', label: 'Liquidity Pool', testId: 'nav-market-maker' },
  { href: '/account', label: 'Account', testId: 'nav-account' },
  { href: '/admin', label: 'Admin', testId: 'nav-admin' },
];

export function Header() {
  const pathname = usePathname();
  const { isConnected } = useWebSocket();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="relative bg-surface-overlay border-b border-border px-6 py-4" data-testid="header">
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

          {/* Desktop nav */}
          <nav className="hidden md:flex gap-1" data-testid="nav">
            {NAV_ITEMS.map(({ href, label, testId }) => {
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

          {/* Hamburger button (mobile) */}
          <button
            className="md:hidden p-2 text-text-secondary hover:text-text-primary"
            onClick={() => setMenuOpen((v) => !v)}
            data-testid="hamburger"
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <nav
          className="md:hidden absolute left-0 right-0 top-full bg-surface-overlay border-b border-border px-6 py-3 z-50"
          data-testid="mobile-nav"
        >
          {NAV_ITEMS.map(({ href, label, testId }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-surface-input text-text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-input/50'
                }`}
                data-testid={`mobile-${testId}`}
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
