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
    it('formats ODDS_UPDATE', () => {
      const msg: WsMessage = { type: 'ODDS_UPDATE', priceBall: 0.6, priceStrike: 0.4, qBall: 10, qStrike: 5, marketId: 'm1' };
      expect(formatWsMessage(msg)).toBe('Ball: 60.0%, Strike: 40.0%');
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
    it('returns cyan for BALL', () => expect(getOutcomeColor('BALL')).toBe('cyan'));
    it('returns magenta for STRIKE', () => expect(getOutcomeColor('STRIKE')).toBe('magenta'));
  });
});
