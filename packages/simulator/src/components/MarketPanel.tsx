import React from 'react';
import { Box, Text } from 'ink';
import type { AdminStateResponse } from '../types.js';
import { getStatusColor, formatDollars } from '../utils/formatters.js';
import { PriceBar } from './PriceBar.js';

interface MarketPanelProps {
  state: AdminStateResponse | null;
  priceBall: number;
  priceStrike: number;
  barWidth?: number;
  betCount?: number;
}

export function MarketPanel({ state, priceBall, priceStrike, barWidth = 20, betCount = 0 }: MarketPanelProps) {
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

          <Box marginTop={1} flexDirection="column">
            <PriceBar label="BALL" probability={priceBall} color="cyan" width={barWidth} />
          </Box>
          <Box marginTop={1} flexDirection="column">
            <PriceBar label="STRIKE" probability={priceStrike} color="magenta" width={barWidth} />
          </Box>

          <Box marginTop={1} gap={2}>
            <Text color="gray" dimColor>
              q: {(market.qBall ?? 0).toFixed(1)}/{(market.qStrike ?? 0).toFixed(1)}
            </Text>
            <Text color="gray" dimColor>
              bets: {betCount}
            </Text>
            <Text color="gray" dimColor>
              positions: {state?.positionCount ?? 0}
            </Text>
          </Box>
        </>
      ) : (
        <Box>
          <Text color="gray" dimColor>No active market</Text>
        </Box>
      )}
    </Box>
  );
}
