import React from 'react';
import { Box, Text } from 'ink';
import type { AdminStateResponse, SimResults } from '../types.js';
import { getStatusColor, getOutcomeColor, formatDollars, formatBalance } from '../utils/formatters.js';
import { PriceBar } from './PriceBar.js';

interface MarketPanelProps {
  state: AdminStateResponse | null;
  prices: number[];
  outcomes: string[];
  quantities: number[];
  barWidth?: number;
  betCount?: number;
  mmBalance?: string | null;
  results?: SimResults | null;
}

export function MarketPanel({ state, prices, outcomes, quantities, barWidth = 20, betCount = 0, mmBalance, results }: MarketPanelProps) {
  const market = state?.market;
  const statusColor = market ? getStatusColor(market.status) : 'gray';

  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1} flexShrink={0}>
      <Box justifyContent="center">
        <Text bold color="white">
          {market ? `MARKET: ${market.id}` : 'NO MARKET'}
        </Text>
      </Box>

      {market ? (
        <>
          <Box gap={1}>
            <Text>Status: </Text>
            <Text color={statusColor} bold>{market.status}</Text>
            {market.outcome && (
              <Text color="yellow"> ({market.outcome})</Text>
            )}
          </Box>

          {outcomes.map((outcome, i) => (
            <Box key={outcome} marginTop={i === 0 ? 1 : 0} flexDirection="column">
              <PriceBar
                label={outcome}
                probability={prices[i] ?? 0}
                color={getOutcomeColor(outcome, i)}
                width={barWidth}
              />
            </Box>
          ))}

          <Box marginTop={1} gap={2}>
            <Text color="gray" dimColor>
              q: {quantities.map((q) => (q ?? 0).toFixed(1)).join('/')}
            </Text>
            <Text color="gray" dimColor>
              bets: {betCount}
            </Text>
            <Text color="gray" dimColor>
              positions: {state?.positionCount ?? 0}
            </Text>
            <Text color="green" dimColor>
              MM: {mmBalance ? formatBalance(mmBalance) : '--'}
            </Text>
          </Box>

          {/* Results summary (shown after resolution) */}
          {results && market.status === 'RESOLVED' && (
            <Box marginTop={1} gap={2}>
              <Text color={getOutcomeColor(results.outcome)} bold>
                {results.outcome}
              </Text>
              <Text color="green">
                W:{results.winners.length} +{formatDollars(results.totalPayout)}
              </Text>
              <Text color="red">
                L:{results.losers.length} -{formatDollars(results.totalLoss)}
              </Text>
            </Box>
          )}
        </>
      ) : (
        <Box>
          <Text color="gray" dimColor>No active market</Text>
        </Box>
      )}
    </Box>
  );
}
