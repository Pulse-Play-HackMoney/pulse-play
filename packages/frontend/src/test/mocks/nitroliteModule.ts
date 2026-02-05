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

// App session methods
export const createAppSessionMessage = jest.fn().mockResolvedValue('{"req":[4,"create_app_session",{}]}');
export const parseCreateAppSessionResponse = jest.fn().mockReturnValue({
  params: { appSessionId: '0xSESSION1', version: 1, status: 'open' },
});
export const createCloseAppSessionMessage = jest.fn().mockResolvedValue('{"req":[5,"close_app_session",{}]}');
export const parseCloseAppSessionResponse = jest.fn().mockReturnValue({
  params: { appSessionId: '0xSESSION1', version: 1, status: 'closed' },
});
export const createSubmitAppStateMessage = jest.fn().mockResolvedValue('{"req":[6,"submit_app_state",{}]}');
export const parseSubmitAppStateResponse = jest.fn().mockReturnValue({
  params: { appSessionId: '0xSESSION1', version: 2, status: 'open' },
});
export const createTransferMessage = jest.fn().mockResolvedValue('{"req":[7,"transfer",{}]}');
export const parseTransferResponse = jest.fn().mockReturnValue({
  params: { transactions: [] },
});
export const createGetAppSessionsMessage = jest.fn().mockResolvedValue('{"req":[8,"get_app_sessions",{}]}');
export const parseGetAppSessionsResponse = jest.fn().mockReturnValue({
  params: { appSessions: [] },
});
export const createGetConfigMessageV2 = jest.fn().mockReturnValue('{"req":[9,"get_config",{}]}');
export const parseGetConfigResponse = jest.fn().mockReturnValue({
  params: { brokerAddress: '0xBROKER', networks: [] },
});

// Enums
export const RPCAppStateIntent = {
  Operate: 'operate',
  Deposit: 'deposit',
  Withdraw: 'withdraw',
};
export const RPCProtocolVersion = {
  NitroRPC_0_2: 'NitroRPC/0.2',
  NitroRPC_0_4: 'NitroRPC/0.4',
};
