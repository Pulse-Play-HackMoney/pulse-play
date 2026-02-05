const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

/** @type {import('jest').Config} */
const config = {
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Mock wagmi and viem to avoid ESM issues
    '^wagmi$': '<rootDir>/src/test/mocks/wagmiModule.ts',
    '^wagmi/chains$': '<rootDir>/src/test/mocks/wagmiChains.ts',
    '^viem$': '<rootDir>/src/test/mocks/viemModule.ts',
    '^viem/accounts$': '<rootDir>/src/test/mocks/viemAccounts.ts',
    '^viem/chains$': '<rootDir>/src/test/mocks/wagmiChains.ts',
    '^@tanstack/react-query$': '<rootDir>/src/test/mocks/reactQuery.ts',
    '^@erc7824/nitrolite$': '<rootDir>/src/test/mocks/nitroliteModule.ts',
  },
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/test/**/*',
  ],
};

module.exports = createJestConfig(config);
