import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { Address, Hex } from 'viem';
import type { SimConfig, SimWalletRow, Outcome, DEFAULT_SIM_CONFIG } from '../types.js';

export interface WalletInfo {
  index: number;
  address: Address;
  privateKey: Hex;
  balance: string;
  funded: boolean;
}

export interface WalletProfile {
  side: Outcome;
  maxBets: number;
  betAmount: number;
  delayMs: number;
}

/**
 * Manages in-memory generated wallets for simulation.
 * Generates private keys, tracks balances and funded status,
 * and assigns betting profiles.
 */
export class WalletManager {
  private wallets: SimWalletRow[] = [];

  /** Generate N wallets with sequential 1-based indices. */
  generateWallets(count: number): SimWalletRow[] {
    const startIndex = this.wallets.length + 1;
    const newWallets: SimWalletRow[] = [];

    for (let i = 0; i < count; i++) {
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);

      const wallet: SimWalletRow = {
        index: startIndex + i,
        address: account.address,
        privateKey,
        balance: '0',
        funded: false,
        side: null,
        maxBets: 0,
        betAmount: 0,
        delayMs: 0,
        betCount: 0,
        clearnodeStatus: 'idle',
      };

      newWallets.push(wallet);
    }

    this.wallets.push(...newWallets);
    return newWallets;
  }

  /** Get all wallets. */
  getAll(): SimWalletRow[] {
    return [...this.wallets];
  }

  /** Get wallet by 1-based index. */
  get(index: number): SimWalletRow | undefined {
    return this.wallets.find((w) => w.index === index);
  }

  /** Get wallet by address (case-insensitive). */
  getByAddress(address: string): SimWalletRow | undefined {
    const lower = address.toLowerCase();
    return this.wallets.find((w) => w.address.toLowerCase() === lower);
  }

  /** Update balance for a wallet by index. */
  updateBalance(index: number, balance: string): void {
    const wallet = this.get(index);
    if (wallet) {
      wallet.balance = balance;
    }
  }

  /** Mark a wallet as funded. */
  markFunded(index: number): void {
    const wallet = this.get(index);
    if (wallet) {
      wallet.funded = true;
    }
  }

  /** Increment bet count for a wallet. */
  incrementBetCount(index: number): void {
    const wallet = this.get(index);
    if (wallet) {
      wallet.betCount += 1;
    }
  }

  /** Update clearnode connection status for a wallet. */
  updateClearnodeStatus(index: number, status: SimWalletRow['clearnodeStatus']): void {
    const wallet = this.get(index);
    if (wallet) {
      wallet.clearnodeStatus = status;
    }
  }

  /** Reset all wallets. */
  clear(): void {
    this.wallets = [];
  }

  /** Get wallet count. */
  get count(): number {
    return this.wallets.length;
  }

  /**
   * Assign betting profiles to all wallets based on SimConfig.
   * outcomeBias controls what fraction of wallets bet on the first outcome.
   * Remaining wallets are distributed evenly across other outcomes.
   */
  generateProfiles(config: SimConfig): void {
    const outcomes = config.outcomes;
    const bias = config.outcomeBias ?? config.ballBias ?? 0.5;
    const firstOutcomeCount = Math.round(this.wallets.length * bias);

    // Shuffle indices to randomly assign sides
    const indices = this.wallets.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    const firstOutcomeIndices = new Set(indices.slice(0, firstOutcomeCount));

    for (let i = 0; i < this.wallets.length; i++) {
      const wallet = this.wallets[i];
      if (firstOutcomeIndices.has(i)) {
        wallet.side = outcomes[0];
      } else if (outcomes.length === 2) {
        wallet.side = outcomes[1];
      } else {
        // Distribute across remaining outcomes evenly
        const remaining = outcomes.slice(1);
        wallet.side = remaining[i % remaining.length];
      }
      wallet.maxBets = config.maxBetsPerWallet;
      wallet.betAmount = randomBetween(config.betAmountMin, config.betAmountMax);
      wallet.delayMs = randomBetween(config.delayMinMs, config.delayMaxMs);
      wallet.betCount = 0;
    }
  }
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
