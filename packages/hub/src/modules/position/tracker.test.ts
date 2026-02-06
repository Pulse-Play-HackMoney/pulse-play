import { PositionTracker } from './tracker';
import type { Position } from './types';

function makePosition(overrides: Partial<Position> = {}): Position {
  return {
    address: '0xAAA',
    marketId: 'm1',
    outcome: 'BALL',
    shares: 10,
    costPaid: 5,
    appSessionId: 's1',
    appSessionVersion: 1,
    sessionStatus: 'open',
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('PositionTracker', () => {
  let tracker: PositionTracker;

  beforeEach(() => {
    tracker = new PositionTracker();
  });

  // ─── Adding positions ──────────────────────────────────────────

  describe('addPosition', () => {
    test('1. addPosition() stores the position', () => {
      const pos = makePosition();
      tracker.addPosition(pos);
      expect(tracker.getPositionsByMarket('m1')).toHaveLength(1);
    });

    test('2. Can add multiple positions for different users', () => {
      tracker.addPosition(makePosition({ address: '0xAAA', appSessionId: 's1' }));
      tracker.addPosition(makePosition({ address: '0xBBB', appSessionId: 's2' }));
      expect(tracker.getPositionsByMarket('m1')).toHaveLength(2);
    });

    test('3. Can add multiple positions for same user on different markets', () => {
      tracker.addPosition(makePosition({ marketId: 'm1', appSessionId: 's1' }));
      tracker.addPosition(makePosition({ marketId: 'm2', appSessionId: 's2' }));
      expect(tracker.getPositionsByUser('0xAAA')).toHaveLength(2);
    });
  });

  // ─── Querying ──────────────────────────────────────────────────

  describe('querying', () => {
    test('4. getPositionsByMarket(id) returns only positions for that market', () => {
      tracker.addPosition(makePosition({ marketId: 'm1', appSessionId: 's1' }));
      tracker.addPosition(makePosition({ marketId: 'm2', appSessionId: 's2' }));
      const result = tracker.getPositionsByMarket('m1');
      expect(result).toHaveLength(1);
      expect(result[0].marketId).toBe('m1');
    });

    test('5. getPositionsByUser(address) returns only positions for that user', () => {
      tracker.addPosition(makePosition({ address: '0xAAA', appSessionId: 's1' }));
      tracker.addPosition(makePosition({ address: '0xBBB', appSessionId: 's2' }));
      const result = tracker.getPositionsByUser('0xAAA');
      expect(result).toHaveLength(1);
      expect(result[0].address).toBe('0xAAA');
    });

    test('6. getPosition(address, marketId) returns specific position or null', () => {
      tracker.addPosition(makePosition({ address: '0xAAA', marketId: 'm1' }));
      expect(tracker.getPosition('0xAAA', 'm1')).not.toBeNull();
      expect(tracker.getPosition('0xAAA', 'm2')).toBeNull();
      expect(tracker.getPosition('0xBBB', 'm1')).toBeNull();
    });

    test('7. Empty queries return empty arrays / null', () => {
      expect(tracker.getPositionsByMarket('m1')).toEqual([]);
      expect(tracker.getPositionsByUser('0xAAA')).toEqual([]);
      expect(tracker.getPosition('0xAAA', 'm1')).toBeNull();
    });
  });

  // ─── Cleanup ───────────────────────────────────────────────────

  describe('clearPositions', () => {
    test('8. clearPositions(marketId) removes all positions for that market', () => {
      tracker.addPosition(makePosition({ address: '0xAAA', marketId: 'm1', appSessionId: 's1' }));
      tracker.addPosition(makePosition({ address: '0xBBB', marketId: 'm1', appSessionId: 's2' }));
      tracker.clearPositions('m1');
      expect(tracker.getPositionsByMarket('m1')).toEqual([]);
    });

    test('9. clearPositions() does not affect other markets', () => {
      tracker.addPosition(makePosition({ marketId: 'm1', appSessionId: 's1' }));
      tracker.addPosition(makePosition({ marketId: 'm2', appSessionId: 's2' }));
      tracker.clearPositions('m1');
      expect(tracker.getPositionsByMarket('m2')).toHaveLength(1);
    });

    test('10. After clearing, queries for that market return empty', () => {
      tracker.addPosition(makePosition({ address: '0xAAA', marketId: 'm1' }));
      tracker.clearPositions('m1');
      expect(tracker.getPositionsByMarket('m1')).toEqual([]);
      expect(tracker.getPosition('0xAAA', 'm1')).toBeNull();
    });
  });

  // ─── Session status ──────────────────────────────────────────

  describe('updateSessionStatus', () => {
    test('11. updates status on existing position', () => {
      tracker.addPosition(makePosition({ appSessionId: 's1' }));
      tracker.updateSessionStatus('s1', 'settled');
      expect(tracker.getPositionsByMarket('m1')[0].sessionStatus).toBe('settled');
    });

    test('12. no-op when session ID not found', () => {
      tracker.addPosition(makePosition({ appSessionId: 's1' }));
      tracker.updateSessionStatus('unknown', 'settled');
      expect(tracker.getPositionsByMarket('m1')[0].sessionStatus).toBe('open');
    });

    test('13. updates correct position among many', () => {
      tracker.addPosition(makePosition({ address: '0xAAA', appSessionId: 's1' }));
      tracker.addPosition(makePosition({ address: '0xBBB', appSessionId: 's2' }));
      tracker.updateSessionStatus('s2', 'settled');
      const positions = tracker.getPositionsByMarket('m1');
      expect(positions[0].sessionStatus).toBe('open');
      expect(positions[1].sessionStatus).toBe('settled');
    });
  });
});
