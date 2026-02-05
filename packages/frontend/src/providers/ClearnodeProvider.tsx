'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { useWalletClient } from 'wagmi';
import {
  createGetLedgerBalancesMessage,
  parseGetLedgerBalancesResponse,
  type MessageSigner,
} from '@erc7824/nitrolite';
import { useWallet } from './WagmiProvider';
import { openClearnodeWs, authenticateBrowser, sendAndWaitBrowser } from '@/lib/clearnode';
import {
  createAppSession as createAppSessionFn,
  closeAppSession as closeAppSessionFn,
  submitAppState as submitAppStateFn,
  transfer as transferFn,
  getAppSessions as getAppSessionsFn,
  getConfig as getConfigFn,
} from '@/lib/clearnode/methods';
import type { ClearnodeStatus, ClearnodeContextValue } from '@/lib/clearnode/types';
import { CLEARNODE_URL, PRIVATE_KEY } from '@/lib/config';

const notConnectedError = () => { throw new Error('Clearnode is not connected'); };

const ClearnodeContext = createContext<ClearnodeContextValue>({
  status: 'disconnected',
  error: null,
  isSessionValid: false,
  expiresAt: 0,
  signer: null,
  ws: null,
  balance: null,
  allowanceAmount: 1000,
  setAllowanceAmount: () => {},
  refreshBalance: async () => {},
  reconnect: async () => {},
  disconnect: () => {},
  createAppSession: notConnectedError,
  closeAppSession: notConnectedError,
  submitAppState: notConnectedError,
  transfer: notConnectedError,
  getAppSessions: notConnectedError,
  getConfig: notConnectedError,
});

export function useClearnode() {
  return useContext(ClearnodeContext);
}

interface ClearnodeProviderProps {
  children: ReactNode;
  url?: string;
}

export function ClearnodeProvider({ children, url = CLEARNODE_URL }: ClearnodeProviderProps) {
  const { address, isConnected: walletConnected, mode } = useWallet();
  const { data: wagmiWalletClient } = useWalletClient();

  const [status, setStatus] = useState<ClearnodeStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [signer, setSigner] = useState<MessageSigner | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [allowanceAmount, setAllowanceAmount] = useState<number>(1000);
  const allowanceAmountRef = useRef<number>(allowanceAmount);

  const wsRef = useRef<WebSocket | null>(null);

  // Keep the ref in sync so authenticate() reads the latest value without depending on it
  useEffect(() => {
    allowanceAmountRef.current = allowanceAmount;
  }, [allowanceAmount]);

  const isSessionValid = signer !== null && expiresAt > Date.now();

  // Fetch balance from Clearnode
  const refreshBalance = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !signer) return;

    try {
      const msg = await createGetLedgerBalancesMessage(signer);
      const raw = await sendAndWaitBrowser(wsRef.current, msg, 'get_ledger_balances');
      const response = parseGetLedgerBalancesResponse(raw);
      const entry = response.params.ledgerBalances.find(
        (b: { asset: string; amount: string }) => b.asset === 'ytest.usd',
      );
      setBalance(entry ? entry.amount : '0');
    } catch {
      // Balance fetch failure is non-fatal
    }
  }, [signer]);

  // Core authentication function
  const authenticate = useCallback(async () => {
    setStatus('connecting');
    setError(null);

    let newWs: WebSocket;
    try {
      newWs = await openClearnodeWs(url);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'WebSocket connection failed');
      return;
    }

    wsRef.current = newWs;
    setWs(newWs);
    setStatus('authenticating');

    try {
      // Get or create the wallet client for signing
      let walletClient;
      if (mode === 'private-key' && PRIVATE_KEY) {
        walletClient = createWalletClient({
          account: privateKeyToAccount(PRIVATE_KEY),
          chain: sepolia,
          transport: http(),
        });
      } else {
        walletClient = wagmiWalletClient;
      }

      if (!walletClient) {
        throw new Error('No wallet client available for signing');
      }

      const result = await authenticateBrowser(newWs, walletClient, {
        allowances: [{ asset: 'ytest.usd', amount: String(allowanceAmountRef.current * 1_000_000) }],
      });
      setSigner(result.signer);
      setExpiresAt(result.expiresAt);
      setStatus('connected');

      // Fetch balance after successful auth
      try {
        const msg = await createGetLedgerBalancesMessage(result.signer);
        const raw = await sendAndWaitBrowser(newWs, msg, 'get_ledger_balances');
        const response = parseGetLedgerBalancesResponse(raw);
        const entry = response.params.ledgerBalances.find(
          (b: { asset: string; amount: string }) => b.asset === 'ytest.usd',
        );
        setBalance(entry ? entry.amount : '0');
      } catch {
        // Balance fetch failure is non-fatal
      }
    } catch (err) {
      newWs.close();
      wsRef.current = null;
      setWs(null);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  }, [url, mode, wagmiWalletClient]);

  // Reconnect (manual re-auth)
  const reconnect = useCallback(async () => {
    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setWs(null);
    }
    setSigner(null);
    setBalance(null);
    setExpiresAt(0);

    await authenticate();
  }, [authenticate]);

  // Disconnect
  const disconnectClearnode = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWs(null);
    setSigner(null);
    setBalance(null);
    setExpiresAt(0);
    setStatus('disconnected');
    setError(null);
  }, []);

  // ── Clearnode RPC method wrappers ──

  const createAppSessionCb = useCallback(
    (params: Parameters<ClearnodeContextValue['createAppSession']>[0]) =>
      createAppSessionFn(wsRef.current, signer, address as `0x${string}`, params),
    [signer, address],
  );

  const closeAppSessionCb = useCallback(
    (params: Parameters<ClearnodeContextValue['closeAppSession']>[0]) =>
      closeAppSessionFn(wsRef.current, signer, params),
    [signer],
  );

  const submitAppStateCb = useCallback(
    (params: Parameters<ClearnodeContextValue['submitAppState']>[0]) =>
      submitAppStateFn(wsRef.current, signer, params),
    [signer],
  );

  const transferCb = useCallback(
    (params: Parameters<ClearnodeContextValue['transfer']>[0]) =>
      transferFn(wsRef.current, signer, params),
    [signer],
  );

  const getAppSessionsCb = useCallback(
    (filterStatus?: string) =>
      getAppSessionsFn(wsRef.current, signer, address as `0x${string}`, filterStatus),
    [signer, address],
  );

  const getConfigCb = useCallback(
    () => getConfigFn(wsRef.current),
    [],
  );

  // Auto-authenticate when wallet connects
  useEffect(() => {
    if (!walletConnected || !address) {
      // Wallet disconnected — clean up Clearnode session
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWs(null);
      setSigner(null);
      setBalance(null);
      setExpiresAt(0);
      setStatus('disconnected');
      setError(null);
      return;
    }

    // In MetaMask mode, wait for wagmiWalletClient to be available
    if (mode === 'metamask' && !wagmiWalletClient) return;

    let intentionalClose = false;

    const connect = async () => {
      if (intentionalClose) return;
      await authenticate();
    };

    connect();

    return () => {
      intentionalClose = true;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [walletConnected, address, mode, wagmiWalletClient, authenticate]);

  const value: ClearnodeContextValue = {
    status,
    error,
    isSessionValid,
    expiresAt,
    signer,
    ws,
    balance,
    allowanceAmount,
    setAllowanceAmount,
    refreshBalance,
    reconnect,
    disconnect: disconnectClearnode,
    createAppSession: createAppSessionCb,
    closeAppSession: closeAppSessionCb,
    submitAppState: submitAppStateCb,
    transfer: transferCb,
    getAppSessions: getAppSessionsCb,
    getConfig: getConfigCb,
  };

  return (
    <ClearnodeContext.Provider value={value}>
      {children}
    </ClearnodeContext.Provider>
  );
}
