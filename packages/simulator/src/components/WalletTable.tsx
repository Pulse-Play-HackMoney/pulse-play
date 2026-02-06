import React from 'react';
import { Box, Text } from 'ink';
import type { SimWalletRow } from '../types.js';
import {
  truncateAddress,
  formatBalance,
  getOutcomeColor,
  getClearnodeStatusIcon,
} from '../utils/formatters.js';

interface WalletTableProps {
  wallets: SimWalletRow[];
  scrollOffset: number;
  visibleCount: number;
  isActive: boolean;
}

export function WalletTable({ wallets, scrollOffset, visibleCount, isActive }: WalletTableProps) {
  const displayWallets = wallets.slice(scrollOffset, scrollOffset + visibleCount);
  const endIndex = Math.min(scrollOffset + visibleCount, wallets.length);
  const showIndicator = wallets.length > visibleCount;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={isActive ? 'cyan' : undefined}
      paddingX={1}
      flexGrow={1}
    >
      <Box justifyContent="center" gap={1}>
        <Text bold color="white">WALLETS</Text>
        {showIndicator && (
          <Text color="gray" dimColor>
            {scrollOffset + 1}-{endIndex} of {wallets.length}
          </Text>
        )}
      </Box>

      {/* Header row */}
      {wallets.length > 0 && (
        <Box>
          <Text color="gray" bold>{'#'.padEnd(4)}</Text>
          <Text color="gray" bold>{'Address'.padEnd(14)}</Text>
          <Text color="gray" bold>{'Balance'.padEnd(10)}</Text>
          <Text color="gray" bold>{'Side'.padEnd(8)}</Text>
          <Text color="gray" bold>{'Bets'.padEnd(6)}</Text>
          <Text color="gray" bold>CN</Text>
        </Box>
      )}

      {displayWallets.length > 0 ? (
        displayWallets.map((wallet) => {
          const { icon, color: cnColor } = getClearnodeStatusIcon(wallet.clearnodeStatus);
          return (
            <Box key={wallet.index}>
              <Text>{String(wallet.index).padEnd(4)}</Text>
              <Text color="gray">{truncateAddress(wallet.address).padEnd(14)}</Text>
              <Text>{formatBalance(wallet.balance).padEnd(10)}</Text>
              <Text color={wallet.side ? getOutcomeColor(wallet.side) : 'gray'}>
                {(wallet.side ?? '-').padEnd(8)}
              </Text>
              <Text>{`${wallet.betCount}/${wallet.maxBets}`.padEnd(6)}</Text>
              <Text color={cnColor}>{icon}</Text>
            </Box>
          );
        })
      ) : (
        <Box>
          <Text color="gray" dimColor>
            No wallets. Use :wallets N to generate.
          </Text>
        </Box>
      )}
    </Box>
  );
}
