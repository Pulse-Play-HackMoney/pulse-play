import {
  formatOdds,
  formatAmericanOdds,
  truncateAddress,
  formatTime,
  formatWsMessage,
  getStatusColor,
  getOutcomeColor,
  getSessionStatusColor,
  formatStatusBadge,
  formatOutcomeShort,
  formatVersion,
  formatDollars,
  formatShares,
  renderPriceBar,
} from './formatters.js';
import type { WsMessage } from '../types.js';

describe('formatOdds', () => {
  it('formats 0.5 as 50.0%', () => {
    expect(formatOdds(0.5)).toBe('50.0%');
  });

  it('formats 0.75 as 75.0%', () => {
    expect(formatOdds(0.75)).toBe('75.0%');
  });

  it('formats 0.123 as 12.3%', () => {
    expect(formatOdds(0.123)).toBe('12.3%');
  });

  it('formats 0 as 0.0%', () => {
    expect(formatOdds(0)).toBe('0.0%');
  });

  it('formats 1 as 100.0%', () => {
    expect(formatOdds(1)).toBe('100.0%');
  });
});

describe('formatAmericanOdds', () => {
  it('returns --- for edge cases', () => {
    expect(formatAmericanOdds(0)).toBe('---');
    expect(formatAmericanOdds(1)).toBe('---');
  });

  it('returns negative odds for favorites (>50%)', () => {
    expect(formatAmericanOdds(0.6)).toBe('-150');
    expect(formatAmericanOdds(0.75)).toBe('-300');
  });

  it('returns positive odds for underdogs (<50%)', () => {
    expect(formatAmericanOdds(0.4)).toBe('+150');
    expect(formatAmericanOdds(0.25)).toBe('+300');
  });

  it('returns -100 for exactly 50%', () => {
    expect(formatAmericanOdds(0.5)).toBe('-100');
  });
});

describe('truncateAddress', () => {
  it('truncates long addresses', () => {
    expect(truncateAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe(
      '0x1234..5678'
    );
  });

  it('keeps short strings as-is', () => {
    expect(truncateAddress('0x1234')).toBe('0x1234');
    expect(truncateAddress('short')).toBe('short');
  });
});

describe('formatTime', () => {
  it('formats date as HH:MM:SS', () => {
    const date = new Date('2026-02-05T14:32:15');
    const result = formatTime(date);
    // Contains hours:minutes:seconds format
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});

describe('formatWsMessage', () => {
  it('formats ODDS_UPDATE messages', () => {
    const msg: WsMessage = {
      type: 'ODDS_UPDATE',
      priceBall: 0.45,
      priceStrike: 0.55,
      qBall: 5,
      qStrike: 8,
      marketId: 'market-1',
    };
    expect(formatWsMessage(msg)).toBe('Ball: 45.0%, Strike: 55.0%');
  });

  it('formats MARKET_STATUS messages', () => {
    const msg: WsMessage = {
      type: 'MARKET_STATUS',
      status: 'OPEN',
      marketId: 'market-1',
    };
    expect(formatWsMessage(msg)).toBe('OPEN');
  });

  it('formats MARKET_STATUS with outcome', () => {
    const msg: WsMessage = {
      type: 'MARKET_STATUS',
      status: 'RESOLVED',
      marketId: 'market-1',
      outcome: 'BALL',
    };
    expect(formatWsMessage(msg)).toBe('RESOLVED (BALL)');
  });

  it('formats GAME_STATE messages', () => {
    const activeMsg: WsMessage = { type: 'GAME_STATE', active: true };
    expect(formatWsMessage(activeMsg)).toBe('ACTIVE');

    const inactiveMsg: WsMessage = { type: 'GAME_STATE', active: false };
    expect(formatWsMessage(inactiveMsg)).toBe('INACTIVE');
  });

  it('formats BET_RESULT WIN messages', () => {
    const msg: WsMessage = {
      type: 'BET_RESULT',
      result: 'WIN',
      marketId: 'market-1',
      payout: 12.5,
    };
    expect(formatWsMessage(msg)).toBe('WIN $12.50');
  });

  it('formats BET_RESULT LOSS messages', () => {
    const msg: WsMessage = {
      type: 'BET_RESULT',
      result: 'LOSS',
      marketId: 'market-1',
      loss: 5.0,
    };
    expect(formatWsMessage(msg)).toBe('LOSS $5.00');
  });

  it('formats POSITION_ADDED messages', () => {
    const msg: WsMessage = {
      type: 'POSITION_ADDED',
      position: {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        marketId: 'market-1',
        outcome: 'BALL',
        shares: 10.5,
        costPaid: 5.25,
        appSessionId: 'sess-1',
        appSessionVersion: 1,
        sessionStatus: 'open',
        timestamp: 1234567890,
      },
      positionCount: 3,
    };
    expect(formatWsMessage(msg)).toBe('0x1234..5678 BALL 10.50 $5.25');
  });

  it('formats SESSION_SETTLED messages', () => {
    const msg: WsMessage = {
      type: 'SESSION_SETTLED',
      appSessionId: '0xABCDEF1234567890ABCDEF1234567890ABCDEF12',
      status: 'settled',
      address: '0x1234567890abcdef1234567890abcdef12345678',
    };
    expect(formatWsMessage(msg)).toBe('0x1234..5678 session 0xABCD..EF12 settled');
  });

  it('formats CONNECTION_COUNT messages', () => {
    const msg: WsMessage = {
      type: 'CONNECTION_COUNT',
      count: 5,
    };
    expect(formatWsMessage(msg)).toBe('5 clients');
  });

  it('formats STATE_SYNC messages', () => {
    const msg: WsMessage = {
      type: 'STATE_SYNC',
      state: {
        market: null,
        gameState: { active: false },
        positionCount: 0,
        connectionCount: 1,
      },
      positions: [
        {
          address: '0x111',
          marketId: 'm1',
          outcome: 'BALL',
          shares: 1,
          costPaid: 1,
          appSessionId: 's1',
          appSessionVersion: 1,
          sessionStatus: 'open',
          timestamp: 1,
        },
        {
          address: '0x222',
          marketId: 'm1',
          outcome: 'STRIKE',
          shares: 2,
          costPaid: 2,
          appSessionId: 's2',
          appSessionVersion: 1,
          sessionStatus: 'settled',
          timestamp: 2,
        },
      ],
    };
    expect(formatWsMessage(msg)).toBe('Synced (2 positions)');
  });
});

describe('getSessionStatusColor', () => {
  it('returns green for open', () => {
    expect(getSessionStatusColor('open')).toBe('green');
  });

  it('returns yellow for settling', () => {
    expect(getSessionStatusColor('settling')).toBe('yellow');
  });

  it('returns blue for settled', () => {
    expect(getSessionStatusColor('settled')).toBe('blue');
  });

  it('returns white for unknown status', () => {
    expect(getSessionStatusColor('unknown' as any)).toBe('white');
  });
});

describe('getStatusColor', () => {
  it('returns correct colors for each status', () => {
    expect(getStatusColor('PENDING')).toBe('yellow');
    expect(getStatusColor('OPEN')).toBe('green');
    expect(getStatusColor('CLOSED')).toBe('gray');
    expect(getStatusColor('RESOLVED')).toBe('blue');
  });
});

describe('getOutcomeColor', () => {
  it('returns cyan for BALL', () => {
    expect(getOutcomeColor('BALL')).toBe('cyan');
  });

  it('returns magenta for STRIKE', () => {
    expect(getOutcomeColor('STRIKE')).toBe('magenta');
  });
});

describe('formatDollars', () => {
  it('formats with $ prefix and 2 decimals', () => {
    expect(formatDollars(5)).toBe('$5.00');
    expect(formatDollars(12.5)).toBe('$12.50');
    expect(formatDollars(0.99)).toBe('$0.99');
  });
});

describe('formatShares', () => {
  it('formats with 2 decimal places', () => {
    expect(formatShares(10)).toBe('10.00');
    expect(formatShares(12.345)).toBe('12.35');
    expect(formatShares(0.5)).toBe('0.50');
  });
});

describe('formatStatusBadge', () => {
  it('returns filled circle and OPEN for open status', () => {
    expect(formatStatusBadge('open')).toBe('● OPEN');
  });

  it('returns open circle and SETTLING for settling status', () => {
    expect(formatStatusBadge('settling')).toBe('◌ SETTLING');
  });

  it('returns target circle and SETTLED for settled status', () => {
    expect(formatStatusBadge('settled')).toBe('◉ SETTLED');
  });

  it('returns empty circle and UNKNOWN for unrecognized status', () => {
    expect(formatStatusBadge('invalid' as any)).toBe('○ UNKNOWN');
  });
});

describe('formatOutcomeShort', () => {
  it('returns BALL for BALL outcome', () => {
    expect(formatOutcomeShort('BALL')).toBe('BALL');
  });

  it('returns STRK for STRIKE outcome', () => {
    expect(formatOutcomeShort('STRIKE')).toBe('STRK');
  });
});

describe('formatVersion', () => {
  it('formats version 1 as v1', () => {
    expect(formatVersion(1)).toBe('v1');
  });

  it('formats version 12 as v12', () => {
    expect(formatVersion(12)).toBe('v12');
  });

  it('formats version 0 as v0', () => {
    expect(formatVersion(0)).toBe('v0');
  });
});

describe('renderPriceBar', () => {
  it('returns all filled for probability 1', () => {
    expect(renderPriceBar(1, 20)).toEqual({ filled: 20, empty: 0 });
  });

  it('returns all empty for probability 0', () => {
    expect(renderPriceBar(0, 20)).toEqual({ filled: 0, empty: 20 });
  });

  it('returns half and half for probability 0.5', () => {
    expect(renderPriceBar(0.5, 20)).toEqual({ filled: 10, empty: 10 });
  });

  it('rounds correctly', () => {
    // 0.33 * 10 = 3.3 → rounds to 3
    expect(renderPriceBar(0.33, 10)).toEqual({ filled: 3, empty: 7 });
    // 0.67 * 10 = 6.7 → rounds to 7
    expect(renderPriceBar(0.67, 10)).toEqual({ filled: 7, empty: 3 });
  });

  it('clamps probability above 1', () => {
    expect(renderPriceBar(1.5, 10)).toEqual({ filled: 10, empty: 0 });
  });

  it('clamps probability below 0', () => {
    expect(renderPriceBar(-0.5, 10)).toEqual({ filled: 0, empty: 10 });
  });

  it('handles width of 0', () => {
    expect(renderPriceBar(0.5, 0)).toEqual({ filled: 0, empty: 0 });
  });
});
