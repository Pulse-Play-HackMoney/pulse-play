import type { WsMessage, Outcome, MarketStatus } from '../types.js';

/**
 * Formats a probability (0-1) as a percentage string
 */
export function formatOdds(price: number): string {
  return `${(price * 100).toFixed(1)}%`;
}

/**
 * Formats probability as American odds
 * Returns "+XXX" for underdogs, "-XXX" for favorites
 */
export function formatAmericanOdds(price: number): string {
  if (price === 0 || price === 1) return '---';
  if (price >= 0.5) {
    // Favorite: negative odds
    const odds = Math.round((price / (1 - price)) * 100);
    return `-${odds}`;
  } else {
    // Underdog: positive odds
    const odds = Math.round(((1 - price) / price) * 100);
    return `+${odds}`;
  }
}

/**
 * Truncates an Ethereum address for display
 */
export function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}..${address.slice(-4)}`;
}

/**
 * Formats a timestamp as HH:MM:SS
 */
export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Formats a WsMessage into a human-readable log entry
 */
export function formatWsMessage(msg: WsMessage): string {
  switch (msg.type) {
    case 'ODDS_UPDATE':
      return `Ball: ${formatOdds(msg.priceBall)}, Strike: ${formatOdds(msg.priceStrike)}`;
    case 'MARKET_STATUS':
      return msg.outcome
        ? `${msg.status} (${msg.outcome})`
        : msg.status;
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
    default:
      return JSON.stringify(msg);
  }
}

/**
 * Returns a color for market status
 */
export function getStatusColor(status: MarketStatus): string {
  switch (status) {
    case 'PENDING':
      return 'yellow';
    case 'OPEN':
      return 'green';
    case 'CLOSED':
      return 'gray';
    case 'RESOLVED':
      return 'blue';
    default:
      return 'white';
  }
}

/**
 * Returns a color for outcome
 */
export function getOutcomeColor(outcome: Outcome): string {
  return outcome === 'BALL' ? 'cyan' : 'magenta';
}

/**
 * Formats dollars with 2 decimal places
 */
export function formatDollars(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Formats shares with 2 decimal places
 */
export function formatShares(shares: number): string {
  return shares.toFixed(2);
}

/**
 * Computes the number of filled and empty characters for an ASCII price bar.
 * Pure function — rendering logic stays testable without React.
 */
export function renderPriceBar(probability: number, width: number): { filled: number; empty: number } {
  const clamped = Math.max(0, Math.min(1, probability));
  const filled = Math.round(clamped * width);
  return { filled, empty: width - filled };
}
