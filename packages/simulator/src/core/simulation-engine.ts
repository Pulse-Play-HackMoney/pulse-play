import type { WalletManager } from './wallet-manager.js';
import type { HubClient } from './hub-client.js';
import type { ClearnodePool } from './clearnode-pool.js';
import type { SimConfig, SimStatus, SimEvent, Outcome } from '../types.js';
import { DEFAULT_SIM_CONFIG } from '../types.js';
import { toMicroUnits } from '../utils/units.js';
import type { Address } from 'viem';

export type SimEventHandler = (event: SimEvent) => void;

export interface SimulationEngineDeps {
  walletManager: WalletManager;
  hubClient: HubClient;
  clearnodePool: ClearnodePool;
}

/**
 * Orchestrates randomized betting across wallets.
 * Manages staggered timers, profiles, and bet execution.
 */
export class SimulationEngine {
  private deps: SimulationEngineDeps;
  private config: SimConfig;
  private status: SimStatus = 'idle';
  private timers: Map<number, NodeJS.Timeout> = new Map();
  private betCounts: Map<number, number> = new Map();
  private onEvent: SimEventHandler;

  constructor(deps: SimulationEngineDeps, onEvent: SimEventHandler = () => {}) {
    this.deps = deps;
    this.config = { ...DEFAULT_SIM_CONFIG };
    this.onEvent = onEvent;
  }

  /** Update config (partial merge). */
  setConfig(partial: Partial<SimConfig>): void {
    Object.assign(this.config, partial);
  }

  /** Get current config. */
  getConfig(): SimConfig {
    return { ...this.config };
  }

  /** Get current simulation status. */
  getStatus(): SimStatus {
    return this.status;
  }

  /** Get bet counts per wallet index. */
  getBetCounts(): Map<number, number> {
    return new Map(this.betCounts);
  }

  /** Set event handler. */
  setOnEvent(handler: SimEventHandler): void {
    this.onEvent = handler;
  }

  /**
   * Start the simulation: generate profiles, start staggered bets.
   * Requires wallets to already be generated and funded.
   */
  start(marketId: string, mmAddress: string): void {
    if (this.status === 'running') return;

    this.status = 'running';
    this.betCounts.clear();

    // Generate profiles based on current config
    this.deps.walletManager.generateProfiles(this.config);

    this.emit({
      type: 'sim-started',
      walletIndex: 0,
      message: `Simulation started for market ${marketId}`,
      timestamp: new Date(),
    });

    // Schedule first bet for each wallet with staggered initial delay
    const wallets = this.deps.walletManager.getAll();
    for (const wallet of wallets) {
      if (!wallet.side) continue;
      this.betCounts.set(wallet.index, 0);
      const initialDelay = Math.random() * (this.config.delayMaxMs - this.config.delayMinMs);
      this.scheduleNextBet(wallet.index, marketId, mmAddress, initialDelay);
    }
  }

  /** Stop the simulation: clear all timers. */
  stop(): void {
    if (this.status !== 'running') return;

    this.status = 'stopping';

    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    this.status = 'idle';

    this.emit({
      type: 'sim-stopped',
      walletIndex: 0,
      message: 'Simulation stopped',
      timestamp: new Date(),
    });
  }

  // ── Internal ──

  private scheduleNextBet(walletIndex: number, marketId: string, mmAddress: string, delayMs: number): void {
    if (this.status !== 'running') return;

    const timer = setTimeout(() => {
      this.timers.delete(walletIndex);
      this.executeBet(walletIndex, marketId, mmAddress);
    }, delayMs);

    this.timers.set(walletIndex, timer);
  }

  private async executeBet(walletIndex: number, marketId: string, mmAddress: string): Promise<void> {
    if (this.status !== 'running') return;

    const wallet = this.deps.walletManager.get(walletIndex);
    if (!wallet || !wallet.side) return;

    const currentBets = this.betCounts.get(walletIndex) ?? 0;
    if (currentBets >= wallet.maxBets) return;

    // Random bet amount within config range
    const amount = this.config.betAmountMin + Math.random() * (this.config.betAmountMax - this.config.betAmountMin);
    const roundedAmount = Math.round(amount * 100) / 100;

    try {
      // Step 1: Create app session
      const session = await this.deps.clearnodePool.createAppSession(
        wallet.address as Address,
        mmAddress as Address,
        toMicroUnits(roundedAmount),
      );

      // Step 2: Notify hub
      const result = await this.deps.hubClient.placeBet({
        address: wallet.address,
        marketId,
        outcome: wallet.side as Outcome,
        amount: roundedAmount,
        appSessionId: session.appSessionId,
        appSessionVersion: session.version,
      });

      if (result.accepted) {
        this.betCounts.set(walletIndex, currentBets + 1);
        this.deps.walletManager.incrementBetCount(walletIndex);

        this.emit({
          type: 'bet-placed',
          walletIndex,
          message: `Wallet #${walletIndex} bet $${roundedAmount.toFixed(2)} on ${wallet.side} (${result.shares?.toFixed(2)} shares)`,
          timestamp: new Date(),
        });

        // Refresh wallet balance from Clearnode (non-critical)
        try {
          const balance = await this.deps.clearnodePool.getBalance(wallet.address as Address);
          this.deps.walletManager.updateBalance(walletIndex, balance);
        } catch {
          // Balance refresh is non-critical; silently ignore
        }
      } else {
        this.emit({
          type: 'bet-rejected',
          walletIndex,
          message: `Wallet #${walletIndex} bet rejected: ${result.reason ?? 'unknown'}`,
          timestamp: new Date(),
        });
      }
    } catch (err) {
      const isSessionError = (err as Error).message?.includes('app_session') ||
        (err as Error).message?.includes('WebSocket') ||
        (err as Error).message?.includes('Auth');

      this.emit({
        type: isSessionError ? 'session-error' : 'bet-failed',
        walletIndex,
        message: `Wallet #${walletIndex} error: ${(err as Error).message}`,
        timestamp: new Date(),
      });
    }

    // Schedule next bet if under limit and still running
    const updatedBets = this.betCounts.get(walletIndex) ?? 0;
    if (updatedBets < wallet.maxBets && this.status === 'running') {
      const delay = this.config.delayMinMs + Math.random() * (this.config.delayMaxMs - this.config.delayMinMs);
      this.scheduleNextBet(walletIndex, marketId, mmAddress, delay);
    }
  }

  private emit(event: SimEvent): void {
    this.onEvent(event);
  }
}
