/**
 * Browser-compatible 3-step EIP-712 authentication with the Clearnode.
 * Mirror of packages/hub/src/modules/clearnode/auth.ts adapted for browser WebSocket.
 */

import {
  createAuthRequestMessage,
  parseAuthChallengeResponse,
  createEIP712AuthMessageSigner,
  createAuthVerifyMessageFromChallenge,
  parseAuthVerifyResponse,
  createECDSAMessageSigner,
} from '@erc7824/nitrolite';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { WalletClient } from 'viem';
import { sendAndWaitBrowser } from './rpc';
import type { AuthResult } from './types';

interface AuthConfig {
  scope: string;
  application: string;
  allowances: { asset: string; amount: string }[];
  expireSeconds: number;
}

const DEFAULT_AUTH_CONFIG: AuthConfig = {
  scope: 'console',
  application: 'pulse-play',
  allowances: [{ asset: 'ytest.usd', amount: '1000000000' }],
  expireSeconds: 3600,
};

/**
 * Authenticate a wallet with the Clearnode using the 3-step EIP-712 flow (browser).
 *
 * 1. auth_request  — register session key
 * 2. auth_challenge — Clearnode responds with challenge
 * 3. auth_verify   — sign challenge with main wallet (MetaMask popup or auto-sign)
 *
 * Returns an ECDSA session signer, the session address, and the expiry timestamp.
 */
export async function authenticateBrowser(
  ws: WebSocket,
  walletClient: WalletClient,
  config: Partial<AuthConfig> = {},
): Promise<AuthResult> {
  const opts = { ...DEFAULT_AUTH_CONFIG, ...config };
  const account = walletClient.account;
  if (!account) {
    throw new Error('WalletClient must have an account attached');
  }

  // Step 1: Generate session key and send auth_request
  const sessionPrivateKey = generatePrivateKey();
  const sessionAccount = privateKeyToAccount(sessionPrivateKey);

  const expiresAtBigInt = BigInt(Math.floor(Date.now() / 1000) + opts.expireSeconds);
  const expiresAtMs = Date.now() + opts.expireSeconds * 1000;

  const authRequestMsg = await createAuthRequestMessage({
    address: account.address,
    session_key: sessionAccount.address,
    application: opts.application,
    allowances: opts.allowances,
    expires_at: expiresAtBigInt,
    scope: opts.scope,
  });

  // Step 2: Wait for auth_challenge
  const challengeRaw = await sendAndWaitBrowser(ws, authRequestMsg, 'auth_challenge');
  const challengeResponse = parseAuthChallengeResponse(challengeRaw);
  const challenge = challengeResponse.params.challengeMessage;

  // Step 3: Sign challenge and send auth_verify
  const eip712Signer = createEIP712AuthMessageSigner(
    walletClient,
    {
      scope: opts.scope,
      session_key: sessionAccount.address,
      expires_at: expiresAtBigInt,
      allowances: opts.allowances,
    },
    { name: opts.application },
  );

  const verifyMsg = await createAuthVerifyMessageFromChallenge(eip712Signer, challenge);
  const verifyRaw = await sendAndWaitBrowser(ws, verifyMsg, 'auth_verify');
  const verifyResponse = parseAuthVerifyResponse(verifyRaw);

  if (!verifyResponse.params.success) {
    throw new Error('Authentication failed: auth_verify returned success=false');
  }

  return {
    signer: createECDSAMessageSigner(sessionPrivateKey),
    sessionAddress: sessionAccount.address,
    expiresAt: expiresAtMs,
  };
}
