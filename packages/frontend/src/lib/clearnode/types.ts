import type { MessageSigner } from '@erc7824/nitrolite';
import type {
  CreateAppSessionParams,
  CreateAppSessionResult,
  CloseAppSessionParams,
  SubmitAppStateParams,
  TransferParams,
  AppSessionInfo,
  ClearnodeConfigInfo,
} from './methods';

export type ClearnodeStatus = 'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'error';

export interface ClearnodeContextValue {
  status: ClearnodeStatus;
  error: string | null;
  isSessionValid: boolean;
  expiresAt: number;
  signer: MessageSigner | null;
  ws: WebSocket | null;
  balance: string | null;
  allowanceAmount: number;
  setAllowanceAmount: (amount: number) => void;
  refreshBalance: () => Promise<void>;
  reconnect: () => Promise<void>;
  disconnect: () => void;
  createAppSession: (params: CreateAppSessionParams) => Promise<CreateAppSessionResult>;
  closeAppSession: (params: CloseAppSessionParams) => Promise<void>;
  submitAppState: (params: SubmitAppStateParams) => Promise<{ version: number }>;
  transfer: (params: TransferParams) => Promise<void>;
  getAppSessions: (status?: string) => Promise<AppSessionInfo[]>;
  getConfig: () => Promise<ClearnodeConfigInfo>;
}

export interface AuthResult {
  signer: MessageSigner;
  sessionAddress: `0x${string}`;
  expiresAt: number;
}
