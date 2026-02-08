import type {
  WsMessage,
  Outcome,
  MarketStatus,
  SessionStatus,
  SimEvent,
  ClearnodeConnectionStatus,
} from '../types.js';

// Color cycle for N outcomes
const OUTCOME_COLORS = ['cyan', 'magenta', 'yellow', 'green', 'blue', 'red'];

/** Formats a probability (0-1) as a percentage string. */
export function formatOdds(price: number): string {
  return `${(price * 100).toFixed(1)}%`;
}

/** Formats probability as American odds (+XXX for underdogs, -XXX for favorites). */
export function formatAmericanOdds(price: number): string {
  if (price === 0 || price === 1) return '---';
  if (price >= 0.5) {
    const odds = Math.round((price / (1 - price)) * 100);
    return `-${odds}`;
  } else {
    const odds = Math.round(((1 - price) / price) * 100);
    return `+${odds}`;
  }
}

/** Truncates an Ethereum address for display. */
export function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}..${address.slice(-4)}`;
}

/** Formats a timestamp as HH:MM:SS. */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Formats dollars with 2 decimal places. */
export function formatDollars(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** Formats shares with 2 decimal places. */
export function formatShares(shares: number): string {
  return shares.toFixed(2);
}

/** Returns a color for market status. */
export function getStatusColor(status: MarketStatus): string {
  switch (status) {
    case 'PENDING': return 'yellow';
    case 'OPEN': return 'green';
    case 'CLOSED': return 'gray';
    case 'RESOLVED': return 'blue';
    default: return 'white';
  }
}

/** Returns a color for outcome using a cycle array. */
export function getOutcomeColor(outcome: Outcome, index?: number): string {
  if (index !== undefined) {
    return OUTCOME_COLORS[index % OUTCOME_COLORS.length];
  }
  const known: Record<string, string> = {
    BALL: 'cyan', MAKE: 'cyan', GOAL: 'cyan', HIT: 'cyan',
    STRIKE: 'magenta', MISS: 'magenta', NO_GOAL: 'magenta', OUT: 'magenta',
  };
  return known[outcome] ?? 'cyan';
}

/** Returns a color for session status. */
export function getSessionStatusColor(status: SessionStatus): string {
  switch (status) {
    case 'open': return 'green';
    case 'settling': return 'yellow';
    case 'settled': return 'blue';
    default: return 'white';
  }
}

/** Computes filled/empty character counts for an ASCII price bar. */
export function renderPriceBar(probability: number, width: number): { filled: number; empty: number } {
  const clamped = Math.max(0, Math.min(1, probability));
  const filled = Math.round(clamped * width);
  return { filled, empty: width - filled };
}

/** Formats a 1-based wallet index as "#N". */
export function formatWalletIndex(index: number): string {
  return `#${index}`;
}

/** Returns a colored symbol for clearnode connection status. */
export function getClearnodeStatusIcon(status: ClearnodeConnectionStatus): { icon: string; color: string } {
  switch (status) {
    case 'idle': return { icon: '○', color: 'gray' };
    case 'connecting': return { icon: '◎', color: 'yellow' };
    case 'connected': return { icon: '●', color: 'green' };
    case 'error': return { icon: '✗', color: 'red' };
    default: return { icon: '?', color: 'white' };
  }
}

/** Formats a SimEvent into a human-readable string. */
export function formatSimEvent(event: SimEvent): string {
  return event.message;
}

/** Returns a color for a SimEvent type. */
export function getSimEventColor(type: SimEvent['type']): string {
  switch (type) {
    case 'bet-placed': return 'green';
    case 'bet-failed': return 'red';
    case 'bet-rejected': return 'yellow';
    case 'session-error': return 'red';
    case 'sim-started': return 'cyan';
    case 'sim-stopped': return 'cyan';
    case 'wallet-funded': return 'green';
    case 'fund-error': return 'red';
    case 'p2p-order-placed': return 'green';
    case 'p2p-order-filled': return 'cyan';
    case 'p2p-order-failed': return 'red';
    default: return 'white';
  }
}

/** Formats a WsMessage into a human-readable log entry. */
export function formatWsMessage(msg: WsMessage): string {
  switch (msg.type) {
    case 'ODDS_UPDATE': {
      const parts = msg.outcomes.map((o, i) => `${o}: ${formatOdds(msg.prices[i])}`);
      return parts.join(', ');
    }
    case 'MARKET_STATUS':
      return msg.outcome ? `${msg.status} (${msg.outcome})` : msg.status;
    case 'GAME_STATE':
      return msg.active ? 'ACTIVE' : 'INACTIVE';
    case 'BET_RESULT':
      return msg.result === 'WIN'
        ? `WIN $${msg.payout?.toFixed(2)}`
        : `LOSS $${msg.loss?.toFixed(2)}`;
    case 'POSITION_ADDED':
      return `${truncateAddress(msg.position.address)} ${msg.position.outcome} ${formatShares(msg.position.shares)} ${formatDollars(msg.position.costPaid)}`;
    case 'CONNECTION_COUNT':
      return `${msg.count} clients`;
    case 'STATE_SYNC':
      return `Synced (${msg.positions.length} positions)`;
    case 'SESSION_SETTLED':
      return `${truncateAddress(msg.address)} session ${truncateAddress(msg.appSessionId)} settled`;
    case 'SESSION_VERSION_UPDATED':
      return `${truncateAddress(msg.appSessionId)} → v${msg.version}`;
    case 'ORDER_PLACED':
      return `${msg.outcome} @${msg.mcps.toFixed(2)} ${formatDollars(msg.amount)} (${msg.status})`;
    case 'ORDER_FILLED':
      return `Fill ${msg.shares.toFixed(2)} shares @${msg.effectivePrice.toFixed(2)}`;
    case 'ORDERBOOK_UPDATE': {
      const sides = Object.entries(msg.outcomes).map(
        ([outcome, levels]) => `${outcome}: ${levels.length} levels`,
      );
      return sides.join(', ');
    }
    case 'ORDER_CANCELLED':
      return `Order ${truncateAddress(msg.orderId)} cancelled`;
    case 'P2P_BET_RESULT':
      return msg.result === 'WIN'
        ? `P2P WIN $${msg.payout?.toFixed(2)}`
        : `P2P LOSS $${msg.loss?.toFixed(2)}`;
    case 'LP_DEPOSIT':
      return `${truncateAddress(msg.address)} deposited ${formatDollars(msg.amount)} (${formatShares(msg.shares)} shares @ ${formatDollars(msg.sharePrice)})`;
    case 'LP_WITHDRAWAL':
      return `${truncateAddress(msg.address)} withdrew ${formatDollars(msg.amount)} (${formatShares(msg.shares)} shares @ ${formatDollars(msg.sharePrice)})`;
    case 'POOL_UPDATE':
      return `Pool: ${formatDollars(msg.poolValue)} | ${formatShares(msg.totalShares)} shares | ${formatDollars(msg.sharePrice)}/share`;
    case 'VOLUME_UPDATE':
      return `Market: ${formatDollars(msg.marketVolume)} | Game: ${formatDollars(msg.gameVolume)}`;
    default:
      return JSON.stringify(msg);
  }
}

/** Formats balance from microunits string to dollar display. */
export function formatBalance(microunits: string): string {
  const amount = Number(microunits) / 1_000_000;
  return `$${amount.toFixed(2)}`;
}

/** Formats state channel version compactly. */
export function formatVersion(version: number): string {
  return `v${version}`;
}

/** Formats session status as a Unicode badge. */
export function formatStatusBadge(status: SessionStatus): string {
  switch (status) {
    case 'open': return '● OPEN';
    case 'settling': return '◌ SETTLING';
    case 'settled': return '◉ SETTLED';
    default: return '○ UNKNOWN';
  }
}

/** Formats outcome as a 4-char abbreviation. */
export function formatOutcomeShort(outcome: Outcome): string {
  if (outcome.length <= 4) return outcome;
  return outcome.slice(0, 4).toUpperCase();
}

/** Calculate N-outcome prices from market quantities using LMSR softmax (log-sum-exp trick). */
export function calculatePrices(quantities: number[], b: number): number[] {
  if (quantities.length === 0) return [];
  const maxQ = Math.max(...quantities);
  const exps = quantities.map((q) => Math.exp((q - maxQ) / b));
  const sumExp = exps.reduce((a, v) => a + v, 0);
  return exps.map((e) => e / sumExp);
}
