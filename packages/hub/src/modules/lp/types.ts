export interface LPShare {
  address: string;
  shares: number;
  totalDeposited: number;
  totalWithdrawn: number;
  firstDepositAt: number;
  lastActionAt: number;
}

export type LPEventType = 'DEPOSIT' | 'WITHDRAWAL';

export interface LPEvent {
  id: number;
  address: string;
  type: LPEventType;
  amount: number;
  shares: number;
  sharePrice: number;
  poolValueBefore: number;
  poolValueAfter: number;
  timestamp: number;
}

export interface PoolStats {
  poolValue: number;
  totalShares: number;
  sharePrice: number;
  lpCount: number;
  canWithdraw: boolean;
  withdrawLockReason?: string;
}

export interface DepositResult {
  shares: number;
  sharePrice: number;
  poolValueBefore: number;
  poolValueAfter: number;
}

export interface WithdrawalResult {
  amount: number;
  sharePrice: number;
  poolValueBefore: number;
  poolValueAfter: number;
}
