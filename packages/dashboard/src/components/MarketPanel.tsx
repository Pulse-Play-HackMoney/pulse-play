import React from 'react';
import { Box, Text } from 'ink';
import type { AdminStateResponse } from '../types.js';
import { getStatusColor, getOutcomeColor } from '../utils/formatters.js';
import { PriceBar } from './PriceBar.js';

interface MarketPanelProps {
  state: AdminStateResponse | null;
  prices: number[];
  outcomes: string[];
  quantities: number[];
  barWidth?: number;
}

export function MarketPanel({ state, prices, outcomes, quantities, barWidth = 20 }: MarketPanelProps) {
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

          <Box marginTop={1}>
            <Text color="gray" dimColor>
              q: {quantities.map((q) => (q ?? 0).toFixed(2)).join(', ')}
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
