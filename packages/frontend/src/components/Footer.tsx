'use client';

import { useWebSocket } from '@/providers/WebSocketProvider';

export function Footer() {
  const { isConnected } = useWebSocket();

  return (
    <footer
      className="border-t border-border bg-surface-overlay px-6 py-3"
      data-testid="footer"
    >
      <div className="flex items-center justify-between max-w-7xl mx-auto text-xs font-mono text-text-muted">
        <div className="flex items-center gap-4">
          <span>PulsePlay v0.1.0</span>
          <span className="text-border">|</span>
          <span>Yellow Network</span>
        </div>
        <div className="flex items-center gap-4">
          <span>{new Date().getFullYear()}</span>
          <span className="text-border">|</span>
          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? 'bg-accent animate-pulse-dot' : 'bg-text-muted'
              }`}
            />
            <span className={isConnected ? 'text-accent' : 'text-text-muted'}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
