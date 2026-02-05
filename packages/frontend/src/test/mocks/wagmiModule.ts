import React from 'react';

// Mock wagmi config
export function createConfig(options?: { connectors?: unknown[] }) {
  return {
    chains: [],
    connectors: options?.connectors || [],
    transports: {},
  };
}

export function http() {
  return {};
}

// Mock injected connector - defined early so it can be used by useConnect
export function injected() {
  return { id: 'injected', name: 'Injected', type: 'injected' };
}

// Mock WagmiProvider
export function WagmiProvider({ children }: { children: React.ReactNode }) {
  return React.createElement(React.Fragment, null, children);
}

// Mock hooks - these can be overridden in tests
let mockAccountState = {
  address: undefined as `0x${string}` | undefined,
  isConnected: false,
  isConnecting: false,
  isDisconnected: true,
  status: 'disconnected' as const,
};

let mockConnectFn = jest.fn();
let mockDisconnectFn = jest.fn();
let mockConnectPending = false;

export function useAccount() {
  return mockAccountState;
}

export function useConnect() {
  return {
    connect: mockConnectFn,
    connectors: [injected()],
    isPending: mockConnectPending,
    isError: false,
    error: null,
  };
}

export function useDisconnect() {
  return {
    disconnect: mockDisconnectFn,
    isPending: false,
  };
}

// Test utilities to configure mock state
export function __setMockAccountState(state: Partial<typeof mockAccountState>) {
  mockAccountState = { ...mockAccountState, ...state };
}

export function __setMockConnectFn(fn: jest.Mock) {
  mockConnectFn = fn;
}

export function __setMockDisconnectFn(fn: jest.Mock) {
  mockDisconnectFn = fn;
}

export function __setMockConnectPending(pending: boolean) {
  mockConnectPending = pending;
}

export function __resetMocks() {
  mockAccountState = {
    address: undefined,
    isConnected: false,
    isConnecting: false,
    isDisconnected: true,
    status: 'disconnected',
  };
  mockConnectFn = jest.fn();
  mockDisconnectFn = jest.fn();
  mockConnectPending = false;
}
