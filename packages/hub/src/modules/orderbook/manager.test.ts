import { OrderBookManager } from './manager';
import type { OrderRequest, P2POrder } from './types';
import { createTestDb, seedDefaults, type DrizzleDB } from '../../db';
import { games, markets as marketsTable } from '../../db/schema';

const GAME_ID = 'test-game-1';
const MARKET_ID = `${GAME_ID}-pitching-1`;
const OUTCOMES = ['BALL', 'STRIKE'];

function seedTestMarket(db: DrizzleDB, marketId: string = MARKET_ID): void {
  db.insert(games).values({
    id: GAME_ID,
    sportId: 'baseball',
    homeTeamId: 'nyy',
    awayTeamId: 'bos',
    status: 'ACTIVE',
    createdAt: Date.now(),
  }).onConflictDoNothing().run();

  db.insert(marketsTable).values({
    id: marketId,
    gameId: GAME_ID,
    categoryId: 'pitching',
    sequenceNum: 1,
    status: 'OPEN',
    quantities: JSON.stringify([0, 0]),
    b: 100,
    createdAt: Date.now(),
  }).onConflictDoNothing().run();
}

function makeRequest(overrides: Partial<OrderRequest> = {}): OrderRequest {
  return {
    marketId: MARKET_ID,
    gameId: GAME_ID,
    userAddress: '0xAlice',
    outcome: 'BALL',
    mcps: 0.50,
    amount: 5,
    appSessionId: 'sess-' + Math.random().toString(36).slice(2, 8),
    appSessionVersion: 1,
    ...overrides,
  };
}

describe('OrderBookManager', () => {
  let db: DrizzleDB;
  let manager: OrderBookManager;

  beforeEach(() => {
    db = createTestDb();
    seedDefaults(db);
    seedTestMarket(db);
    manager = new OrderBookManager(db);
  });

  // ── Validation ──────────────────────────────────────────────────────────

  describe('placeOrder validation', () => {
    it('rejects non-binary markets', () => {
      expect(() => {
        manager.placeOrder(makeRequest(), ['BALL', 'STRIKE', 'FOUL']);
      }).toThrow('binary markets');
    });

    it('rejects invalid outcome', () => {
      expect(() => {
        manager.placeOrder(makeRequest({ outcome: 'FOUL' }), OUTCOMES);
      }).toThrow('Invalid outcome');
    });

    it('rejects MCPS = 0', () => {
      expect(() => {
        manager.placeOrder(makeRequest({ mcps: 0 }), OUTCOMES);
      }).toThrow('MCPS must be between 0 and 1');
    });

    it('rejects MCPS = 1', () => {
      expect(() => {
        manager.placeOrder(makeRequest({ mcps: 1 }), OUTCOMES);
      }).toThrow('MCPS must be between 0 and 1');
    });

    it('rejects MCPS > 1', () => {
      expect(() => {
        manager.placeOrder(makeRequest({ mcps: 1.5 }), OUTCOMES);
      }).toThrow('MCPS must be between 0 and 1');
    });

    it('rejects negative amount', () => {
      expect(() => {
        manager.placeOrder(makeRequest({ amount: -5 }), OUTCOMES);
      }).toThrow('Amount must be positive');
    });

    it('rejects zero amount', () => {
      expect(() => {
        manager.placeOrder(makeRequest({ amount: 0 }), OUTCOMES);
      }).toThrow('Amount must be positive');
    });
  });

  // ── Order placement into empty book ──────────────────────────────────

  describe('placeOrder into empty book', () => {
    it('creates an OPEN order with no fills', () => {
      const result = manager.placeOrder(makeRequest({
        mcps: 0.60,
        amount: 6,
      }), OUTCOMES);

      expect(result.fills).toHaveLength(0);
      expect(result.order.status).toBe('OPEN');
      expect(result.order.mcps).toBe(0.60);
      expect(result.order.amount).toBe(6);
      expect(result.order.maxShares).toBeCloseTo(10); // 6 / 0.60
      expect(result.order.filledShares).toBe(0);
      expect(result.order.unfilledShares).toBeCloseTo(10);
      expect(result.order.filledAmount).toBe(0);
      expect(result.order.unfilledAmount).toBe(6);
    });

    it('stores the order in the database', () => {
      const result = manager.placeOrder(makeRequest(), OUTCOMES);
      const retrieved = manager.getOrder(result.orderId);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.orderId).toBe(result.orderId);
      expect(retrieved!.userAddress).toBe('0xAlice');
    });
  });

  // ── Order matching ──────────────────────────────────────────────────

  describe('placeOrder with matching', () => {
    it('fully fills when opposite side has exact match', () => {
      // Place BALL order at 0.60
      manager.placeOrder(makeRequest({
        userAddress: '0xAlice',
        outcome: 'BALL',
        mcps: 0.60,
        amount: 6,
      }), OUTCOMES);

      // Place STRIKE order at 0.40 → 0.60 + 0.40 = 1.00, exact match
      const result = manager.placeOrder(makeRequest({
        userAddress: '0xBob',
        outcome: 'STRIKE',
        mcps: 0.40,
        amount: 4,
      }), OUTCOMES);

      // Bob has 4/0.40 = 10 max shares, Alice has 6/0.60 = 10 max shares
      expect(result.fills).toHaveLength(1);
      expect(result.order.status).toBe('FILLED');
      expect(result.fills[0].shares).toBe(10);
      expect(result.fills[0].effectivePrice).toBeCloseTo(0.40);
    });

    it('partially fills incoming when resting has fewer shares', () => {
      // Alice places 3 shares worth on BALL
      manager.placeOrder(makeRequest({
        userAddress: '0xAlice',
        outcome: 'BALL',
        mcps: 0.50,
        amount: 1.5, // 1.5 / 0.50 = 3 shares
      }), OUTCOMES);

      // Bob places 10 shares worth on STRIKE
      const result = manager.placeOrder(makeRequest({
        userAddress: '0xBob',
        outcome: 'STRIKE',
        mcps: 0.50,
        amount: 5, // 5 / 0.50 = 10 shares
      }), OUTCOMES);

      expect(result.fills).toHaveLength(1);
      expect(result.fills[0].shares).toBe(3);
      expect(result.order.status).toBe('PARTIALLY_FILLED');
      expect(result.order.filledShares).toBe(3);
      expect(result.order.unfilledShares).toBeCloseTo(7);
    });

    it('fills with price improvement when surplus exists', () => {
      // Alice: BALL at 0.70 (willing to pay up to $0.70/share)
      manager.placeOrder(makeRequest({
        userAddress: '0xAlice',
        outcome: 'BALL',
        mcps: 0.70,
        amount: 7,
      }), OUTCOMES);

      // Bob: STRIKE at 0.50 → combined 1.20, surplus 0.20, improvement 0.10
      const result = manager.placeOrder(makeRequest({
        userAddress: '0xBob',
        outcome: 'STRIKE',
        mcps: 0.50,
        amount: 5,
      }), OUTCOMES);

      expect(result.fills).toHaveLength(1);
      expect(result.fills[0].effectivePrice).toBeCloseTo(0.40); // Bob pays 0.50 - 0.10
    });

    it('updates resting order status to FILLED when fully consumed', () => {
      const aliceResult = manager.placeOrder(makeRequest({
        userAddress: '0xAlice',
        outcome: 'BALL',
        mcps: 0.60,
        amount: 6,
      }), OUTCOMES);

      manager.placeOrder(makeRequest({
        userAddress: '0xBob',
        outcome: 'STRIKE',
        mcps: 0.40,
        amount: 4,
      }), OUTCOMES);

      const aliceOrder = manager.getOrder(aliceResult.orderId)!;
      expect(aliceOrder.status).toBe('FILLED');
      expect(aliceOrder.filledShares).toBeCloseTo(10);
      expect(aliceOrder.unfilledShares).toBeCloseTo(0);
    });

    it('updates resting order status to PARTIALLY_FILLED', () => {
      const aliceResult = manager.placeOrder(makeRequest({
        userAddress: '0xAlice',
        outcome: 'BALL',
        mcps: 0.50,
        amount: 10, // 20 shares
      }), OUTCOMES);

      manager.placeOrder(makeRequest({
        userAddress: '0xBob',
        outcome: 'STRIKE',
        mcps: 0.50,
        amount: 2.5, // 5 shares
      }), OUTCOMES);

      const aliceOrder = manager.getOrder(aliceResult.orderId)!;
      expect(aliceOrder.status).toBe('PARTIALLY_FILLED');
      expect(aliceOrder.filledShares).toBe(5);
      expect(aliceOrder.unfilledShares).toBeCloseTo(15);
    });

    it('matches across multiple resting orders', () => {
      // Three resting orders on BALL
      manager.placeOrder(makeRequest({
        userAddress: '0xAlice',
        outcome: 'BALL',
        mcps: 0.60,
        amount: 1.2, // 2 shares
      }), OUTCOMES);
      manager.placeOrder(makeRequest({
        userAddress: '0xCharlie',
        outcome: 'BALL',
        mcps: 0.55,
        amount: 1.65, // 3 shares
      }), OUTCOMES);
      manager.placeOrder(makeRequest({
        userAddress: '0xDave',
        outcome: 'BALL',
        mcps: 0.50,
        amount: 2, // 4 shares
      }), OUTCOMES);

      // Bob places STRIKE at 0.50 for 8 shares
      const result = manager.placeOrder(makeRequest({
        userAddress: '0xBob',
        outcome: 'STRIKE',
        mcps: 0.50,
        amount: 4, // 8 shares
      }), OUTCOMES);

      expect(result.fills).toHaveLength(3);
      expect(result.fills[0].shares).toBeCloseTo(2); // From Alice (best price)
      expect(result.fills[1].shares).toBeCloseTo(3); // From Charlie
      expect(result.fills[2].shares).toBeCloseTo(3); // From Dave (partial, only 3 of 4)
      expect(result.order.filledShares).toBeCloseTo(8);
      expect(result.order.status).toBe('FILLED');
    });

    it('records fills for both sides', () => {
      const aliceResult = manager.placeOrder(makeRequest({
        userAddress: '0xAlice',
        outcome: 'BALL',
        mcps: 0.50,
        amount: 5,
      }), OUTCOMES);

      const bobResult = manager.placeOrder(makeRequest({
        userAddress: '0xBob',
        outcome: 'STRIKE',
        mcps: 0.50,
        amount: 5,
      }), OUTCOMES);

      const aliceFills = manager.getFills(aliceResult.orderId);
      const bobFills = manager.getFills(bobResult.orderId);

      expect(aliceFills).toHaveLength(1);
      expect(bobFills).toHaveLength(1);
      expect(aliceFills[0].counterpartyOrderId).toBe(bobResult.orderId);
      expect(bobFills[0].counterpartyOrderId).toBe(aliceResult.orderId);
    });

    it('does not match orders on the same outcome', () => {
      manager.placeOrder(makeRequest({
        userAddress: '0xAlice',
        outcome: 'BALL',
        mcps: 0.60,
        amount: 6,
      }), OUTCOMES);

      // Another BALL order should NOT match against Alice
      const result = manager.placeOrder(makeRequest({
        userAddress: '0xBob',
        outcome: 'BALL',
        mcps: 0.60,
        amount: 6,
      }), OUTCOMES);

      expect(result.fills).toHaveLength(0);
      expect(result.order.status).toBe('OPEN');
    });
  });

  // ── Cancel ──────────────────────────────────────────────────────────

  describe('cancelOrder', () => {
    it('cancels an OPEN order', () => {
      const result = manager.placeOrder(makeRequest(), OUTCOMES);
      const cancelled = manager.cancelOrder(result.orderId);
      expect(cancelled.status).toBe('CANCELLED');
    });

    it('cancels a PARTIALLY_FILLED order', () => {
      // Place a large BALL order, then partially fill it
      const aliceResult = manager.placeOrder(makeRequest({
        userAddress: '0xAlice',
        outcome: 'BALL',
        mcps: 0.50,
        amount: 10, // 20 shares
      }), OUTCOMES);

      manager.placeOrder(makeRequest({
        userAddress: '0xBob',
        outcome: 'STRIKE',
        mcps: 0.50,
        amount: 2.5, // 5 shares — partial fill
      }), OUTCOMES);

      const cancelled = manager.cancelOrder(aliceResult.orderId);
      expect(cancelled.status).toBe('CANCELLED');
      // Filled portion preserved
      expect(cancelled.filledShares).toBe(5);
    });

    it('throws when cancelling a FILLED order', () => {
      const aliceResult = manager.placeOrder(makeRequest({
        userAddress: '0xAlice',
        outcome: 'BALL',
        mcps: 0.50,
        amount: 5,
      }), OUTCOMES);

      manager.placeOrder(makeRequest({
        userAddress: '0xBob',
        outcome: 'STRIKE',
        mcps: 0.50,
        amount: 5,
      }), OUTCOMES);

      expect(() => manager.cancelOrder(aliceResult.orderId)).toThrow('Cannot cancel');
    });

    it('throws for non-existent order', () => {
      expect(() => manager.cancelOrder('nonexistent')).toThrow('not found');
    });
  });

  // ── Depth ─────────────────────────────────────────────────────────

  describe('getDepth', () => {
    it('returns empty depth for empty book', () => {
      const depth = manager.getDepth(MARKET_ID, OUTCOMES);
      expect(depth.outcomes['BALL']).toEqual([]);
      expect(depth.outcomes['STRIKE']).toEqual([]);
    });

    it('aggregates depth by price level', () => {
      manager.placeOrder(makeRequest({
        userAddress: '0xAlice',
        outcome: 'BALL',
        mcps: 0.60,
        amount: 6, // 10 shares
      }), OUTCOMES);
      manager.placeOrder(makeRequest({
        userAddress: '0xBob',
        outcome: 'BALL',
        mcps: 0.60,
        amount: 3, // 5 shares
      }), OUTCOMES);
      manager.placeOrder(makeRequest({
        userAddress: '0xCharlie',
        outcome: 'BALL',
        mcps: 0.50,
        amount: 5, // 10 shares
      }), OUTCOMES);

      const depth = manager.getDepth(MARKET_ID, OUTCOMES);
      const ballDepth = depth.outcomes['BALL'];

      expect(ballDepth).toHaveLength(2);
      // Best price first
      expect(ballDepth[0].price).toBe(0.60);
      expect(ballDepth[0].shares).toBeCloseTo(15); // 10 + 5
      expect(ballDepth[0].orderCount).toBe(2);

      expect(ballDepth[1].price).toBe(0.50);
      expect(ballDepth[1].shares).toBeCloseTo(10);
      expect(ballDepth[1].orderCount).toBe(1);
    });

    it('excludes cancelled and filled orders from depth', () => {
      const r1 = manager.placeOrder(makeRequest({
        userAddress: '0xAlice',
        outcome: 'BALL',
        mcps: 0.50,
        amount: 5,
      }), OUTCOMES);
      manager.cancelOrder(r1.orderId);

      const depth = manager.getDepth(MARKET_ID, OUTCOMES);
      expect(depth.outcomes['BALL']).toEqual([]);
    });
  });

  // ── Query methods ─────────────────────────────────────────────────

  describe('getOrdersByUser', () => {
    it('returns all orders for a user', () => {
      manager.placeOrder(makeRequest({ userAddress: '0xAlice' }), OUTCOMES);
      manager.placeOrder(makeRequest({ userAddress: '0xAlice' }), OUTCOMES);
      manager.placeOrder(makeRequest({ userAddress: '0xBob' }), OUTCOMES);

      const aliceOrders = manager.getOrdersByUser('0xAlice');
      expect(aliceOrders).toHaveLength(2);
    });

    it('filters by marketId when provided', () => {
      const marketId2 = `${GAME_ID}-pitching-2`;
      db.insert(marketsTable).values({
        id: marketId2,
        gameId: GAME_ID,
        categoryId: 'pitching',
        sequenceNum: 2,
        status: 'OPEN',
        quantities: JSON.stringify([0, 0]),
        b: 100,
        createdAt: Date.now(),
      }).run();

      manager.placeOrder(makeRequest({ userAddress: '0xAlice', marketId: MARKET_ID }), OUTCOMES);
      manager.placeOrder(makeRequest({ userAddress: '0xAlice', marketId: marketId2 }), OUTCOMES);

      const filtered = manager.getOrdersByUser('0xAlice', MARKET_ID);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].marketId).toBe(MARKET_ID);
    });
  });

  describe('getOrdersByMarket', () => {
    it('returns all orders for a market', () => {
      manager.placeOrder(makeRequest({ userAddress: '0xAlice' }), OUTCOMES);
      manager.placeOrder(makeRequest({ userAddress: '0xBob' }), OUTCOMES);

      const orders = manager.getOrdersByMarket(MARKET_ID);
      expect(orders).toHaveLength(2);
    });
  });

  // ── Resolution helpers ────────────────────────────────────────────

  describe('getFilledOrdersForResolution', () => {
    it('returns only orders with filledShares > 0', () => {
      // Open order (no fills)
      manager.placeOrder(makeRequest({
        userAddress: '0xAlice',
        outcome: 'BALL',
        mcps: 0.50,
        amount: 5,
      }), OUTCOMES);

      // Fully filled pair
      manager.placeOrder(makeRequest({
        userAddress: '0xBob',
        outcome: 'BALL',
        mcps: 0.60,
        amount: 3,
      }), OUTCOMES);
      manager.placeOrder(makeRequest({
        userAddress: '0xCharlie',
        outcome: 'STRIKE',
        mcps: 0.40,
        amount: 2,
      }), OUTCOMES);

      const filledOrders = manager.getFilledOrdersForResolution(MARKET_ID);
      // Only Bob and Charlie have fills (Alice is still OPEN)
      expect(filledOrders).toHaveLength(2);
      for (const o of filledOrders) {
        expect(o.filledShares).toBeGreaterThan(0);
      }
    });

    it('includes CANCELLED orders that had partial fills', () => {
      const r = manager.placeOrder(makeRequest({
        userAddress: '0xAlice',
        outcome: 'BALL',
        mcps: 0.50,
        amount: 10,
      }), OUTCOMES);

      manager.placeOrder(makeRequest({
        userAddress: '0xBob',
        outcome: 'STRIKE',
        mcps: 0.50,
        amount: 2.5,
      }), OUTCOMES);

      manager.cancelOrder(r.orderId);

      const filledOrders = manager.getFilledOrdersForResolution(MARKET_ID);
      const aliceOrder = filledOrders.find(o => o.userAddress === '0xAlice');
      expect(aliceOrder).toBeDefined();
      expect(aliceOrder!.status).toBe('CANCELLED');
      expect(aliceOrder!.filledShares).toBe(5);
    });
  });

  describe('expireUnfilledOrders', () => {
    it('expires OPEN orders', () => {
      const r = manager.placeOrder(makeRequest(), OUTCOMES);
      const expired = manager.expireUnfilledOrders(MARKET_ID);
      expect(expired).toHaveLength(1);
      expect(expired[0].orderId).toBe(r.orderId);

      const updated = manager.getOrder(r.orderId)!;
      expect(updated.status).toBe('EXPIRED');
    });

    it('expires PARTIALLY_FILLED orders', () => {
      const r = manager.placeOrder(makeRequest({
        userAddress: '0xAlice',
        outcome: 'BALL',
        mcps: 0.50,
        amount: 10,
      }), OUTCOMES);

      manager.placeOrder(makeRequest({
        userAddress: '0xBob',
        outcome: 'STRIKE',
        mcps: 0.50,
        amount: 2.5,
      }), OUTCOMES);

      const expired = manager.expireUnfilledOrders(MARKET_ID);
      // Only Alice's partially filled order should be expired
      const aliceExpired = expired.find(o => o.userAddress === '0xAlice');
      expect(aliceExpired).toBeDefined();

      const updated = manager.getOrder(r.orderId)!;
      expect(updated.status).toBe('EXPIRED');
    });

    it('does not expire FILLED orders', () => {
      manager.placeOrder(makeRequest({
        userAddress: '0xAlice',
        outcome: 'BALL',
        mcps: 0.50,
        amount: 5,
      }), OUTCOMES);
      manager.placeOrder(makeRequest({
        userAddress: '0xBob',
        outcome: 'STRIKE',
        mcps: 0.50,
        amount: 5,
      }), OUTCOMES);

      const expired = manager.expireUnfilledOrders(MARKET_ID);
      expect(expired).toHaveLength(0);
    });
  });

  describe('settleOrder', () => {
    it('marks order as SETTLED', () => {
      manager.placeOrder(makeRequest({
        userAddress: '0xAlice',
        outcome: 'BALL',
        mcps: 0.50,
        amount: 5,
      }), OUTCOMES);

      const bobResult = manager.placeOrder(makeRequest({
        userAddress: '0xBob',
        outcome: 'STRIKE',
        mcps: 0.50,
        amount: 5,
      }), OUTCOMES);

      manager.settleOrder(bobResult.orderId);
      const settled = manager.getOrder(bobResult.orderId)!;
      expect(settled.status).toBe('SETTLED');
    });
  });
});
