'use client';

import { useClearnode } from '@/providers/ClearnodeProvider';

interface SessionCardProps {
  className?: string;
}

function getStatusBadge(
  status: string,
  isSessionValid: boolean,
  expiresAt: number,
): { label: string; color: string } {
  if (status === 'connecting' || status === 'authenticating') {
    const label = status === 'connecting' ? 'Connecting...' : 'Authenticating...';
    return { label, color: 'bg-yellow-500/20 text-yellow-400' };
  }
  if (status === 'error') {
    return { label: 'Error', color: 'bg-red-500/20 text-red-400' };
  }
  if (isSessionValid) {
    return { label: 'Active', color: 'bg-green-500/20 text-green-400' };
  }
  if (expiresAt > 0 && !isSessionValid) {
    return { label: 'Expired', color: 'bg-orange-500/20 text-orange-400' };
  }
  return { label: 'Not Authenticated', color: 'bg-gray-500/20 text-gray-400' };
}

function formatTimeRemaining(expiresAt: number): string {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return 'Expired';

  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) return `${hours}h ${mins}m remaining`;
  if (mins > 0) return `${mins}m remaining`;
  return 'Less than 1m remaining';
}

export function SessionCard({ className = '' }: SessionCardProps) {
  const {
    status,
    isSessionValid,
    expiresAt,
    error,
    allowanceAmount,
    setAllowanceAmount,
    reconnect,
  } = useClearnode();

  const badge = getStatusBadge(status, isSessionValid, expiresAt);
  const isLoading = status === 'connecting' || status === 'authenticating';

  return (
    <div className={`bg-surface-raised border border-border rounded-lg p-6 ${className}`} data-testid="session-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-mono uppercase tracking-wider text-text-secondary">Session</h2>
        <span
          className={`px-3 py-1 rounded text-sm font-medium ${badge.color}`}
          data-testid="session-status-badge"
        >
          {badge.label}
        </span>
      </div>

      <div className="space-y-4">
        {/* Expiry */}
        {expiresAt > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Session Expiry</span>
            <span
              className={isSessionValid ? 'text-text-primary' : 'text-orange-400'}
              data-testid="session-expiry"
            >
              {formatTimeRemaining(expiresAt)}
            </span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div
            className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400"
            data-testid="session-error"
          >
            {error}
          </div>
        )}

        {/* Allowance input */}
        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-2">
            Allowance ($ USD)
          </label>
          <input
            type="number"
            value={allowanceAmount}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (val >= 0) setAllowanceAmount(val);
            }}
            min={0}
            step={100}
            className="w-full bg-surface-input border border-border rounded-lg px-4 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
            data-testid="allowance-input"
          />
          <p className="text-xs text-text-muted mt-1">
            Changing allowance requires re-authentication
          </p>
        </div>

        {/* Re-authenticate button */}
        <button
          onClick={() => reconnect()}
          disabled={isLoading}
          className="w-full py-3 rounded-lg font-medium bg-accent hover:bg-accent-hover text-white disabled:bg-surface-input disabled:text-text-muted disabled:cursor-not-allowed transition-colors"
          data-testid="session-reconnect"
        >
          {isLoading ? 'Authenticating...' : 'Re-authenticate'}
        </button>
      </div>
    </div>
  );
}
