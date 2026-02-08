import {
  formatOdds,
  formatAmericanOdds,
  truncateAddress,
  formatDollars,
  formatShares,
  formatWalletIndex,
  getClearnodeStatusIcon,
  formatSimEvent,
  getSimEventColor,
  formatWsMessage,
  formatBalance,
  renderPriceBar,
  getStatusColor,
  getOutcomeColor,
  getSessionStatusColor,
  formatVersion,
  formatStatusBadge,
  formatOutcomeShort,
  calculatePrices,
} from './formatters.js';
import type { SimEvent, WsMessage } from '../types.js';

describe('formatters', () => {
  describe('formatOdds', () => {
    it('formats 50% odds', () => expect(formatOdds(0.5)).toBe('50.0%'));
    it('formats high odds', () => expect(formatOdds(0.85)).toBe('85.0%'));
    it('formats low odds', () => expect(formatOdds(0.15)).toBe('15.0%'));
  });

  describe('formatAmericanOdds', () => {
    it('formats favorites as negative', () => expect(formatAmericanOdds(0.7)).toBe('-233'));
    it('formats underdogs as positive', () => expect(formatAmericanOdds(0.3)).toBe('+233'));
    it('returns --- for 0', () => expect(formatAmericanOdds(0)).toBe('---'));
    it('returns --- for 1', () => expect(formatAmericanOdds(1)).toBe('---'));
  });

  describe('truncateAddress', () => {
    it('truncates long addresses', () => {
      expect(truncateAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x1234..5678');
    });
    it('leaves short strings alone', () => {
      expect(truncateAddress('0x1234')).toBe('0x1234');
    });
  });

  describe('formatDollars', () => {
    it('formats with 2 decimal places', () => expect(formatDollars(3.5)).toBe('$3.50'));
    it('formats zero', () => expect(formatDollars(0)).toBe('$0.00'));
  });

  describe('formatShares', () => {
    it('formats with 2 decimal places', () => expect(formatShares(2.567)).toBe('2.57'));
  });

  describe('formatWalletIndex', () => {
    it('formats 1-based index', () => expect(formatWalletIndex(3)).toBe('#3'));
  });

  describe('getClearnodeStatusIcon', () => {
    it('returns gray circle for idle', () => {
      expect(getClearnodeStatusIcon('idle')).toEqual({ icon: '○', color: 'gray' });
    });
    it('returns yellow for connecting', () => {
      expect(getClearnodeStatusIcon('connecting')).toEqual({ icon: '◎', color: 'yellow' });
    });
    it('returns green for connected', () => {
      expect(getClearnodeStatusIcon('connected')).toEqual({ icon: '●', color: 'green' });
    });
    it('returns red for error', () => {
      expect(getClearnodeStatusIcon('error')).toEqual({ icon: '✗', color: 'red' });
    });
  });

  describe('formatSimEvent', () => {
    it('returns event message', () => {
      const event: SimEvent = {
        type: 'bet-placed',
        walletIndex: 1,
        message: 'Wallet #1 bet $2.00 on BALL',
        timestamp: new Date(),
      };
      expect(formatSimEvent(event)).toBe('Wallet #1 bet $2.00 on BALL');
    });
  });

  describe('getSimEventColor', () => {
    it('returns green for bet-placed', () => expect(getSimEventColor('bet-placed')).toBe('green'));
    it('returns red for bet-failed', () => expect(getSimEventColor('bet-failed')).toBe('red'));
    it('returns yellow for bet-rejected', () => expect(getSimEventColor('bet-rejected')).toBe('yellow'));
    it('returns cyan for sim-started', () => expect(getSimEventColor('sim-started')).toBe('cyan'));
  });

  describe('formatWsMessage', () => {
    it('formats ODDS_UPDATE with array fields', () => {
      const msg: WsMessage = {
        type: 'ODDS_UPDATE',
        prices: [0.6, 0.4],
        quantities: [10, 5],
        outcomes: ['BALL', 'STRIKE'],
        marketId: 'm1',
      };
      expect(formatWsMessage(msg)).toBe('BALL: 60.0%, STRIKE: 40.0%');
    });

    it('formats ODDS_UPDATE with 3 outcomes', () => {
      const msg: WsMessage = {
        type: 'ODDS_UPDATE',
        prices: [0.5, 0.3, 0.2],
        quantities: [10, 5, 2],
        outcomes: ['WIN', 'DRAW', 'LOSE'],
        marketId: 'm1',
      };
      expect(formatWsMessage(msg)).toBe('WIN: 50.0%, DRAW: 30.0%, LOSE: 20.0%');
    });

    it('formats MARKET_STATUS with outcome', () => {
      const msg: WsMessage = { type: 'MARKET_STATUS', status: 'RESOLVED', marketId: 'm1', outcome: 'BALL' };
      expect(formatWsMessage(msg)).toBe('RESOLVED (BALL)');
    });

    it('formats GAME_STATE', () => {
      expect(formatWsMessage({ type: 'GAME_STATE', active: true })).toBe('ACTIVE');
      expect(formatWsMessage({ type: 'GAME_STATE', active: false })).toBe('INACTIVE');
    });

    it('formats BET_RESULT win', () => {
      const msg: WsMessage = { type: 'BET_RESULT', result: 'WIN', marketId: 'm1', payout: 5.5 };
      expect(formatWsMessage(msg)).toBe('WIN $5.50');
    });

    it('formats BET_RESULT loss', () => {
      const msg: WsMessage = { type: 'BET_RESULT', result: 'LOSS', marketId: 'm1', loss: 2.0 };
      expect(formatWsMessage(msg)).toBe('LOSS $2.00');
    });
  });

  describe('formatBalance', () => {
    it('converts microunits to dollars', () => {
      expect(formatBalance('5000000')).toBe('$5.00');
      expect(formatBalance('10500000')).toBe('$10.50');
    });
    it('handles zero', () => {
      expect(formatBalance('0')).toBe('$0.00');
    });
  });

  describe('renderPriceBar', () => {
    it('renders full bar at 100%', () => {
      expect(renderPriceBar(1.0, 20)).toEqual({ filled: 20, empty: 0 });
    });
    it('renders empty bar at 0%', () => {
      expect(renderPriceBar(0, 20)).toEqual({ filled: 0, empty: 20 });
    });
    it('renders half bar at 50%', () => {
      expect(renderPriceBar(0.5, 20)).toEqual({ filled: 10, empty: 10 });
    });
    it('clamps above 1', () => {
      expect(renderPriceBar(1.5, 20)).toEqual({ filled: 20, empty: 0 });
    });
  });

  describe('getStatusColor', () => {
    it('returns correct colors', () => {
      expect(getStatusColor('OPEN')).toBe('green');
      expect(getStatusColor('PENDING')).toBe('yellow');
      expect(getStatusColor('CLOSED')).toBe('gray');
      expect(getStatusColor('RESOLVED')).toBe('blue');
    });
  });

  describe('getOutcomeColor', () => {
    it('returns cyan for BALL (no index)', () => expect(getOutcomeColor('BALL')).toBe('cyan'));
    it('returns magenta for STRIKE (no index)', () => expect(getOutcomeColor('STRIKE')).toBe('magenta'));
    it('cycles colors by index', () => {
      expect(getOutcomeColor('X', 0)).toBe('cyan');
      expect(getOutcomeColor('Y', 1)).toBe('magenta');
      expect(getOutcomeColor('Z', 2)).toBe('yellow');
    });
  });

  describe('getSessionStatusColor', () => {
    it('returns green for open', () => expect(getSessionStatusColor('open')).toBe('green'));
    it('returns yellow for settling', () => expect(getSessionStatusColor('settling')).toBe('yellow'));
    it('returns blue for settled', () => expect(getSessionStatusColor('settled')).toBe('blue'));
    it('returns white for unknown', () => expect(getSessionStatusColor('unknown' as any)).toBe('white'));
  });

  describe('formatVersion', () => {
    it('formats version 1 as v1', () => expect(formatVersion(1)).toBe('v1'));
    it('formats version 12 as v12', () => expect(formatVersion(12)).toBe('v12'));
    it('formats version 0 as v0', () => expect(formatVersion(0)).toBe('v0'));
  });

  describe('formatStatusBadge', () => {
    it('returns ● OPEN for open', () => expect(formatStatusBadge('open')).toBe('● OPEN'));
    it('returns ◌ SETTLING for settling', () => expect(formatStatusBadge('settling')).toBe('◌ SETTLING'));
    it('returns ◉ SETTLED for settled', () => expect(formatStatusBadge('settled')).toBe('◉ SETTLED'));
    it('returns ○ UNKNOWN for unknown', () => expect(formatStatusBadge('invalid' as any)).toBe('○ UNKNOWN'));
  });

  describe('formatOutcomeShort', () => {
    it('returns BALL for BALL', () => expect(formatOutcomeShort('BALL')).toBe('BALL'));
    it('returns STRI for STRIKE', () => expect(formatOutcomeShort('STRIKE')).toBe('STRI'));
  });

  describe('calculatePrices', () => {
    it('returns empty array for empty quantities', () => {
      expect(calculatePrices([], 100)).toEqual([]);
    });
    it('returns equal prices for equal quantities', () => {
      const prices = calculatePrices([0, 0], 100);
      expect(prices[0]).toBeCloseTo(0.5);
      expect(prices[1]).toBeCloseTo(0.5);
    });
    it('returns equal prices for 3 equal quantities', () => {
      const prices = calculatePrices([0, 0, 0], 100);
      prices.forEach((p) => expect(p).toBeCloseTo(1 / 3));
    });
    it('prices sum to 1', () => {
      const prices = calculatePrices([10, 20, 5], 50);
      const sum = prices.reduce((a, v) => a + v, 0);
      expect(sum).toBeCloseTo(1);
    });
    it('higher quantity yields higher price', () => {
      const prices = calculatePrices([10, 20], 100);
      expect(prices[1]).toBeGreaterThan(prices[0]);
    });
    it('handles large quantities without overflow', () => {
      const prices = calculatePrices([1000, 1000], 1);
      expect(prices[0]).toBeCloseTo(0.5);
      expect(prices[1]).toBeCloseTo(0.5);
    });
  });

  describe('formatWsMessage — LP messages', () => {
    it('formats LP_DEPOSIT', () => {
      const msg: WsMessage = {
        type: 'LP_DEPOSIT',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        amount: 500,
        shares: 476.19,
        sharePrice: 1.05,
      };
      expect(formatWsMessage(msg)).toBe('0x1234..5678 deposited $500.00 (476.19 shares @ $1.05)');
    });

    it('formats LP_WITHDRAWAL', () => {
      const msg: WsMessage = {
        type: 'LP_WITHDRAWAL',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        amount: 525,
        shares: 500,
        sharePrice: 1.05,
      };
      expect(formatWsMessage(msg)).toBe('0x1234..5678 withdrew $525.00 (500.00 shares @ $1.05)');
    });

    it('formats POOL_UPDATE', () => {
      const msg: WsMessage = {
        type: 'POOL_UPDATE',
        poolValue: 5000,
        totalShares: 4800,
        sharePrice: 1.0417,
        lpCount: 3,
        canWithdraw: true,
      };
      expect(formatWsMessage(msg)).toBe('Pool: $5000.00 | 4800.00 shares | $1.04/share');
    });
  });

  describe('formatWsMessage — session messages', () => {
    it('formats SESSION_VERSION_UPDATED', () => {
      const msg: WsMessage = {
        type: 'SESSION_VERSION_UPDATED',
        appSessionId: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
        version: 2,
      };
      expect(formatWsMessage(msg)).toBe('0xABCD..EF12 → v2');
    });
    it('formats SESSION_SETTLED', () => {
      const msg: WsMessage = {
        type: 'SESSION_SETTLED',
        appSessionId: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
        status: 'settled',
        address: '0x1234567890abcdef1234567890abcdef12345678',
      };
      expect(formatWsMessage(msg)).toBe('0x1234..5678 session 0xABCD..EF12 settled');
    });

    it('formats ORDER_PLACED', () => {
      const msg: WsMessage = {
        type: 'ORDER_PLACED',
        orderId: 'order-1',
        marketId: 'market-1',
        outcome: 'BALL',
        mcps: 0.60,
        amount: 6,
        maxShares: 10,
        status: 'OPEN',
      };
      expect(formatWsMessage(msg)).toBe('BALL @0.60 $6.00 (OPEN)');
    });

    it('formats ORDER_FILLED', () => {
      const msg: WsMessage = {
        type: 'ORDER_FILLED',
        orderId: 'order-1',
        fillId: 'fill-1',
        counterpartyOrderId: 'order-2',
        shares: 5,
        effectivePrice: 0.55,
        cost: 2.75,
      };
      expect(formatWsMessage(msg)).toBe('Fill 5.00 shares @0.55');
    });

    it('formats ORDERBOOK_UPDATE', () => {
      const msg: WsMessage = {
        type: 'ORDERBOOK_UPDATE',
        marketId: 'market-1',
        outcomes: {
          BALL: [{ price: 0.60, shares: 10, orderCount: 2 }],
          STRIKE: [],
        },
      };
      expect(formatWsMessage(msg)).toBe('BALL: 1 levels, STRIKE: 0 levels');
    });

    it('formats ORDER_CANCELLED', () => {
      const msg: WsMessage = {
        type: 'ORDER_CANCELLED',
        orderId: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
        marketId: 'market-1',
      };
      expect(formatWsMessage(msg)).toBe('Order 0xABCD..EF12 cancelled');
    });

    it('formats P2P_BET_RESULT WIN', () => {
      const msg: WsMessage = {
        type: 'P2P_BET_RESULT',
        result: 'WIN',
        orderId: 'order-1',
        marketId: 'market-1',
        payout: 12.50,
        profit: 6.50,
      };
      expect(formatWsMessage(msg)).toBe('P2P WIN $12.50');
    });

    it('formats P2P_BET_RESULT LOSS', () => {
      const msg: WsMessage = {
        type: 'P2P_BET_RESULT',
        result: 'LOSS',
        orderId: 'order-1',
        marketId: 'market-1',
        loss: 8.00,
      };
      expect(formatWsMessage(msg)).toBe('P2P LOSS $8.00');
    });
  });

  describe('getSimEventColor - P2P events', () => {
    it('returns green for p2p-order-placed', () => {
      expect(getSimEventColor('p2p-order-placed')).toBe('green');
    });

    it('returns cyan for p2p-order-filled', () => {
      expect(getSimEventColor('p2p-order-filled')).toBe('cyan');
    });

    it('returns red for p2p-order-failed', () => {
      expect(getSimEventColor('p2p-order-failed')).toBe('red');
    });
  });
});
