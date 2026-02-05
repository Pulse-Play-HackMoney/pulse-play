// Mock viem module
export function createPublicClient() {
  return {
    chain: { id: 11155111 },
    transport: {},
  };
}

export function createWalletClient(options?: { account?: unknown; chain?: unknown; transport?: unknown }) {
  return {
    chain: options?.chain || { id: 11155111 },
    transport: options?.transport || {},
    account: options?.account || undefined,
    signTypedData: jest.fn().mockResolvedValue('0x' + '0'.repeat(130)),
  };
}

export function http() {
  return { type: 'http' };
}

export function custom() {
  return { type: 'custom' };
}

export const formatEther = (wei: bigint) => String(Number(wei) / 1e18);
export const parseEther = (ether: string) => BigInt(Math.floor(Number(ether) * 1e18));
