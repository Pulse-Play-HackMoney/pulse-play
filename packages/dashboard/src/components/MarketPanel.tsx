import React from 'react';
import { Box, Text } from 'ink';
import type { AdminStateResponse } from '../types.js';
import { getStatusColor } from '../utils/formatters.js';
import { PriceBar } from './PriceBar.js';

interface MarketPanelProps {
  state: AdminStateResponse | null;
  priceBall: number;
  priceStrike: number;
  barWidth?: number;
}

export function MarketPanel({ state, priceBall, priceStrike, barWidth = 20 }: MarketPanelProps) {
  const market = state?.market;
  const statusColor = market ? getStatusColor(market.status) : 'gray';

  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1}>
      <Box justifyContent="center">
        <Text bold color="white">
          {market ? `MARKET: ${market.id}` : 'NO MARKET'}
        </Text>
      </Box>

      {market ? (
        <>
          <Box>
            <Text>Status: </Text>
            <Text color={statusColor} bold>
              {market.status}
            </Text>
            {market.outcome && (
              <Text color="yellow"> ({market.outcome})</Text>
            )}
          </Box>

          <Box marginTop={1} flexDirection="column">
            <PriceBar
              label="BALL"
              probability={priceBall}
              color="cyan"
              width={barWidth}
            />
          </Box>
          <Box marginTop={1} flexDirection="column">
            <PriceBar
              label="STRIKE"
              probability={priceStrike}
              color="magenta"
              width={barWidth}
            />
          </Box>

          <Box marginTop={1}>
            <Text color="gray" dimColor>
              qBall: {market.qBall.toFixed(2)}, qStrike: {market.qStrike.toFixed(2)}
            </Text>
          </Box>
        </>
      ) : (
        <Box>
          <Text color="gray" dimColor>
            No active market
          </Text>
        </Box>
      )}
    </Box>
  );
}
