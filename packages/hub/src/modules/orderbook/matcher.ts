import type { RestingOrder, MatchFill, MatchResult } from './types.js';

/**
 * Matches an incoming order against resting orders on the opposite side.
 *
 * For two orders to match: incomingMcps + restingMcps >= 1.00
 * This means the total willingness-to-pay covers the full $1 payout per share.
 *
 * Any surplus (incomingMcps + restingMcps - 1.00) is split evenly between
 * both sides as price improvement — each pays less than their max.
 *
 * Resting orders MUST be pre-sorted by MCPS descending (best price first),
 * then by createdAt ascending (time priority) for equal MCPS.
 *
 * @param incomingMcps - The incoming order's max cost per share (0 < mcps < 1)
 * @param incomingShares - The incoming order's remaining shares to fill
 * @param restingOrders - Opposite-side resting orders, sorted by MCPS desc, createdAt asc
 * @returns MatchResult with fills and remaining unfilled shares
 */
export function matchOrder(
  incomingMcps: number,
  incomingShares: number,
  restingOrders: RestingOrder[],
): MatchResult {
  const fills: MatchFill[] = [];
  let remainingShares = incomingShares;

  for (const resting of restingOrders) {
    if (remainingShares <= 0) break;

    // Check if orders can match: combined willingness must cover $1/share
    const combinedMcps = incomingMcps + resting.mcps;
    if (combinedMcps < 1.0) {
      // Since resting is sorted by MCPS desc, no further orders can match
      break;
    }

    // Calculate price improvement
    const surplus = combinedMcps - 1.0;
    const improvement = surplus / 2;

    const incomingPrice = incomingMcps - improvement;
    const restingPrice = resting.mcps - improvement;

    // Fill the minimum of remaining shares on both sides
    const fillShares = Math.min(remainingShares, resting.unfilledShares);
    if (fillShares <= 0) continue;

    fills.push({
      restingOrderId: resting.orderId,
      shares: fillShares,
      incomingPrice,
      restingPrice,
    });

    remainingShares -= fillShares;
  }

  return { fills, remainingShares };
}
