/**
 * Clearnode uses microunits: 1 USDC = 1,000,000 microunits.
 * These helpers convert between human-readable amounts and Clearnode wire format.
 */

export const MICRO = 1_000_000;
export const ASSET = 'ytest.usd';

/** Convert a human-readable amount (e.g. 10.5) to a microunit string (e.g. "10500000"). */
export function toMicroUnits(amount: number): string {
  return String(Math.round(amount * MICRO));
}

/** Convert a microunit string (e.g. "10500000") to a human-readable number (e.g. 10.5). */
export function fromMicroUnits(micro: string): number {
  return Number(micro) / MICRO;
}
