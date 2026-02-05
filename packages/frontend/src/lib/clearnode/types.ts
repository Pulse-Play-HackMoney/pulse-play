import type { MessageSigner } from '@erc7824/nitrolite';

export type ClearnodeStatus = 'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'error';

export interface ClearnodeContextValue {
  status: ClearnodeStatus;
  error: string | null;
  isSessionValid: boolean;
  signer: MessageSigner | null;
  ws: WebSocket | null;
  balance: string | null;
  refreshBalance: () => Promise<void>;
  reconnect: () => Promise<void>;
  disconnect: () => void;
}

export interface AuthResult {
  signer: MessageSigner;
  sessionAddress: `0x${string}`;
  expiresAt: number;
}
