import React from 'react';
import { Box, Text } from 'ink';
import type { SimResults } from '../types.js';
import { truncateAddress, formatDollars, getOutcomeColor } from '../utils/formatters.js';

interface ResultsPanelProps {
  results: SimResults | null;
}

export function ResultsPanel({ results }: ResultsPanelProps) {
  if (!results) return null;

  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1} flexShrink={0}>
      <Box justifyContent="center" gap={1}>
        <Text bold color="white">RESULTS</Text>
        <Text color={getOutcomeColor(results.outcome)} bold>
          {results.outcome}
        </Text>
      </Box>

      {/* Winners */}
      {results.winners.length > 0 && (
        <>
          <Text color="green" bold>Winners:</Text>
          {results.winners.map((w) => (
            <Box key={w.walletIndex} gap={1}>
              <Text color="green">  #{w.walletIndex}</Text>
              <Text color="gray">{truncateAddress(w.address)}</Text>
              <Text color="green">+{formatDollars(w.profit)}</Text>
              <Text color="gray">(payout: {formatDollars(w.payout)})</Text>
            </Box>
          ))}
        </>
      )}

      {/* Losers */}
      {results.losers.length > 0 && (
        <>
          <Text color="red" bold>Losers:</Text>
          {results.losers.map((l) => (
            <Box key={l.walletIndex} gap={1}>
              <Text color="red">  #{l.walletIndex}</Text>
              <Text color="gray">{truncateAddress(l.address)}</Text>
              <Text color="red">-{formatDollars(l.loss)}</Text>
            </Box>
          ))}
        </>
      )}

      {/* Totals */}
      <Box marginTop={1} gap={2}>
        <Text color="green">Total payout: {formatDollars(results.totalPayout)}</Text>
        <Text color="red">Total loss: {formatDollars(results.totalLoss)}</Text>
      </Box>
    </Box>
  );
}
