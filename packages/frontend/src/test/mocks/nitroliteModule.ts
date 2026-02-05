// Mock @erc7824/nitrolite for Jest
// Provides stub implementations for all SDK functions used in the frontend

export const createAuthRequestMessage = jest.fn().mockResolvedValue('{"req":[1,"auth_request",{}]}');
export const parseAuthChallengeResponse = jest.fn().mockReturnValue({
  params: { challengeMessage: 'mock-challenge' },
});
export const createEIP712AuthMessageSigner = jest.fn().mockReturnValue('mock-eip712-signer');
export const createAuthVerifyMessageFromChallenge = jest.fn().mockResolvedValue('{"req":[2,"auth_verify",{}]}');
export const parseAuthVerifyResponse = jest.fn().mockReturnValue({
  params: { success: true },
});
export const createECDSAMessageSigner = jest.fn().mockReturnValue('mock-ecdsa-signer');
export const createGetLedgerBalancesMessage = jest.fn().mockResolvedValue('{"req":[3,"get_ledger_balances",{}]}');
export const parseGetLedgerBalancesResponse = jest.fn().mockReturnValue({
  params: {
    ledgerBalances: [{ asset: 'ytest.usd', amount: '1000000' }],
  },
});
