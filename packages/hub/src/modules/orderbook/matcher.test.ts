import { matchOrder } from './matcher';
import type { RestingOrder, MatchResult } from './types';

function makeResting(overrides: Partial<RestingOrder> & { orderId: string }): RestingOrder {
  return {
    mcps: 0.50,
    unfilledShares: 10,
    ...overrides,
  };
}

describe('matchOrder', () => {
  // ── Basic matching ──────────────────────────────────────────────────────

  it('returns no fills when resting book is empty', () => {
    const result = matchOrder(0.60, 10, []);
    expect(result.fills).toEqual([]);
    expect(result.remainingShares).toBe(10);
  });

  it('returns no fills when MCPS values do not sum to 1.00', () => {
    const resting = [makeResting({ orderId: 'r1', mcps: 0.30 })];
    const result = matchOrder(0.60, 10, resting);
    // 0.60 + 0.30 = 0.90 < 1.00 → no match
    expect(result.fills).toEqual([]);
    expect(result.remainingShares).toBe(10);
  });

  it('matches when MCPS values sum to exactly 1.00', () => {
    const resting = [makeResting({ orderId: 'r1', mcps: 0.40 })];
    const result = matchOrder(0.60, 5, resting);
    expect(result.fills).toHaveLength(1);
    expect(result.fills[0].restingOrderId).toBe('r1');
    expect(result.fills[0].shares).toBe(5);
    // No surplus → prices equal MCPS
    expect(result.fills[0].incomingPrice).toBeCloseTo(0.60);
    expect(result.fills[0].restingPrice).toBeCloseTo(0.40);
    expect(result.remainingShares).toBe(0);
  });

  it('matches exact shares on both sides', () => {
    const resting = [makeResting({ orderId: 'r1', mcps: 0.50, unfilledShares: 10 })];
    const result = matchOrder(0.50, 10, resting);
    expect(result.fills).toHaveLength(1);
    expect(result.fills[0].shares).toBe(10);
    expect(result.remainingShares).toBe(0);
  });

  // ── Partial fills ───────────────────────────────────────────────────────

  it('partially fills incoming when resting has fewer shares', () => {
    const resting = [makeResting({ orderId: 'r1', mcps: 0.50, unfilledShares: 3 })];
    const result = matchOrder(0.50, 10, resting);
    expect(result.fills).toHaveLength(1);
    expect(result.fills[0].shares).toBe(3);
    expect(result.remainingShares).toBe(7);
  });

  it('partially fills resting when incoming has fewer shares', () => {
    const resting = [makeResting({ orderId: 'r1', mcps: 0.50, unfilledShares: 20 })];
    const result = matchOrder(0.50, 5, resting);
    expect(result.fills).toHaveLength(1);
    expect(result.fills[0].shares).toBe(5);
    expect(result.remainingShares).toBe(0);
  });

  // ── Price improvement ─────────────────────────────────────────────────

  it('splits surplus evenly as price improvement', () => {
    // Incoming willing to pay 0.70, resting willing to pay 0.50
    // Combined = 1.20, surplus = 0.20, improvement = 0.10 each
    const resting = [makeResting({ orderId: 'r1', mcps: 0.50 })];
    const result = matchOrder(0.70, 5, resting);
    expect(result.fills).toHaveLength(1);
    expect(result.fills[0].incomingPrice).toBeCloseTo(0.60); // 0.70 - 0.10
    expect(result.fills[0].restingPrice).toBeCloseTo(0.40);  // 0.50 - 0.10
  });

  it('handles large surplus correctly', () => {
    // Incoming: 0.90, Resting: 0.90 → combined 1.80, surplus 0.80, improvement 0.40
    const resting = [makeResting({ orderId: 'r1', mcps: 0.90 })];
    const result = matchOrder(0.90, 5, resting);
    expect(result.fills[0].incomingPrice).toBeCloseTo(0.50); // 0.90 - 0.40
    expect(result.fills[0].restingPrice).toBeCloseTo(0.50);  // 0.90 - 0.40
    // Both pay 0.50 → total 1.00 per share
  });

  it('prices always sum to 1.00 per share', () => {
    const resting = [makeResting({ orderId: 'r1', mcps: 0.65 })];
    const result = matchOrder(0.55, 5, resting);
    const fill = result.fills[0];
    expect(fill.incomingPrice + fill.restingPrice).toBeCloseTo(1.00);
  });

  // ── Multiple fills ────────────────────────────────────────────────────

  it('fills across multiple resting orders', () => {
    const resting = [
      makeResting({ orderId: 'r1', mcps: 0.60, unfilledShares: 3 }),
      makeResting({ orderId: 'r2', mcps: 0.55, unfilledShares: 4 }),
      makeResting({ orderId: 'r3', mcps: 0.50, unfilledShares: 5 }),
    ];
    const result = matchOrder(0.50, 10, resting);

    expect(result.fills).toHaveLength(3);
    expect(result.fills[0]).toMatchObject({ restingOrderId: 'r1', shares: 3 });
    expect(result.fills[1]).toMatchObject({ restingOrderId: 'r2', shares: 4 });
    expect(result.fills[2]).toMatchObject({ restingOrderId: 'r3', shares: 3 });
    expect(result.remainingShares).toBe(0);
  });

  it('stops matching when remaining resting MCPS is too low', () => {
    const resting = [
      makeResting({ orderId: 'r1', mcps: 0.60, unfilledShares: 5 }),
      makeResting({ orderId: 'r2', mcps: 0.30, unfilledShares: 5 }), // 0.50 + 0.30 < 1.00
    ];
    const result = matchOrder(0.50, 10, resting);

    expect(result.fills).toHaveLength(1);
    expect(result.fills[0].restingOrderId).toBe('r1');
    expect(result.fills[0].shares).toBe(5);
    expect(result.remainingShares).toBe(5);
  });

  it('stops matching when incoming shares are exhausted', () => {
    const resting = [
      makeResting({ orderId: 'r1', mcps: 0.60, unfilledShares: 5 }),
      makeResting({ orderId: 'r2', mcps: 0.55, unfilledShares: 5 }),
    ];
    const result = matchOrder(0.50, 3, resting);

    expect(result.fills).toHaveLength(1);
    expect(result.fills[0].shares).toBe(3);
    expect(result.remainingShares).toBe(0);
  });

  // ── Edge cases ────────────────────────────────────────────────────────

  it('handles minimum MCPS value (0.01)', () => {
    const resting = [makeResting({ orderId: 'r1', mcps: 0.99, unfilledShares: 10 })];
    const result = matchOrder(0.01, 5, resting);
    // 0.01 + 0.99 = 1.00 → exact match
    expect(result.fills).toHaveLength(1);
    expect(result.fills[0].incomingPrice).toBeCloseTo(0.01);
    expect(result.fills[0].restingPrice).toBeCloseTo(0.99);
  });

  it('handles maximum MCPS value (0.99)', () => {
    const resting = [makeResting({ orderId: 'r1', mcps: 0.01, unfilledShares: 10 })];
    const result = matchOrder(0.99, 5, resting);
    expect(result.fills).toHaveLength(1);
    expect(result.fills[0].incomingPrice).toBeCloseTo(0.99);
    expect(result.fills[0].restingPrice).toBeCloseTo(0.01);
  });

  it('handles zero incoming shares', () => {
    const resting = [makeResting({ orderId: 'r1', mcps: 0.60 })];
    const result = matchOrder(0.50, 0, resting);
    expect(result.fills).toEqual([]);
    expect(result.remainingShares).toBe(0);
  });

  it('handles fractional shares', () => {
    const resting = [makeResting({ orderId: 'r1', mcps: 0.50, unfilledShares: 2.5 })];
    const result = matchOrder(0.50, 1.5, resting);
    expect(result.fills).toHaveLength(1);
    expect(result.fills[0].shares).toBe(1.5);
    expect(result.remainingShares).toBe(0);
  });

  it('each fill in a multi-fill has correct price improvement', () => {
    const resting = [
      makeResting({ orderId: 'r1', mcps: 0.70, unfilledShares: 3 }), // surplus 0.30, improvement 0.15
      makeResting({ orderId: 'r2', mcps: 0.55, unfilledShares: 3 }), // surplus 0.15, improvement 0.075
    ];
    const result = matchOrder(0.60, 6, resting);

    // First fill: 0.60 + 0.70 = 1.30, surplus 0.30, improvement 0.15
    expect(result.fills[0].incomingPrice).toBeCloseTo(0.45);  // 0.60 - 0.15
    expect(result.fills[0].restingPrice).toBeCloseTo(0.55);   // 0.70 - 0.15

    // Second fill: 0.60 + 0.55 = 1.15, surplus 0.15, improvement 0.075
    expect(result.fills[1].incomingPrice).toBeCloseTo(0.525);  // 0.60 - 0.075
    expect(result.fills[1].restingPrice).toBeCloseTo(0.475);   // 0.55 - 0.075
  });

  it('all fills sum to exactly $1.00 per share', () => {
    const resting = [
      makeResting({ orderId: 'r1', mcps: 0.73, unfilledShares: 4 }),
      makeResting({ orderId: 'r2', mcps: 0.61, unfilledShares: 4 }),
      makeResting({ orderId: 'r3', mcps: 0.52, unfilledShares: 4 }),
    ];
    const result = matchOrder(0.48, 10, resting);

    for (const fill of result.fills) {
      expect(fill.incomingPrice + fill.restingPrice).toBeCloseTo(1.00);
    }
  });

  it('respects resting order priority (processes in order)', () => {
    // Simulates best-price-first then time-priority
    const resting = [
      makeResting({ orderId: 'r1', mcps: 0.70, unfilledShares: 2 }),
      makeResting({ orderId: 'r2', mcps: 0.70, unfilledShares: 2 }),
      makeResting({ orderId: 'r3', mcps: 0.60, unfilledShares: 2 }),
    ];
    const result = matchOrder(0.40, 5, resting);

    expect(result.fills).toHaveLength(3);
    expect(result.fills[0].restingOrderId).toBe('r1');
    expect(result.fills[1].restingOrderId).toBe('r2');
    expect(result.fills[2].restingOrderId).toBe('r3');
    expect(result.fills[0].shares).toBe(2);
    expect(result.fills[1].shares).toBe(2);
    expect(result.fills[2].shares).toBe(1);
    expect(result.remainingShares).toBe(0);
  });

  it('skips resting orders with zero unfilled shares', () => {
    const resting = [
      makeResting({ orderId: 'r1', mcps: 0.60, unfilledShares: 0 }),
      makeResting({ orderId: 'r2', mcps: 0.55, unfilledShares: 5 }),
    ];
    const result = matchOrder(0.50, 3, resting);

    // r1 has 0 shares → skipped entirely
    expect(result.fills).toHaveLength(1);
    expect(result.fills[0].restingOrderId).toBe('r2');
    expect(result.fills[0].shares).toBe(3);
    expect(result.remainingShares).toBe(0);
  });
});
