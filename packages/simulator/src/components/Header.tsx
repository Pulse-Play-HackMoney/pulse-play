import React from 'react';
import { Box, Text } from 'ink';
import type { MarketStatus, SimStatus } from '../types.js';
import { getStatusColor } from '../utils/formatters.js';

interface HeaderProps {
  marketId: string | null;
  marketStatus: MarketStatus | null;
  simStatus: SimStatus;
}

export function Header({ marketId, marketStatus, simStatus }: HeaderProps) {
  const simColor = simStatus === 'running' ? 'green' : simStatus === 'stopping' ? 'yellow' : 'gray';

  return (
    <Box
      borderStyle="double"
      paddingX={2}
      justifyContent="space-between"
      flexShrink={0}
    >
      <Box gap={1}>
        <Text bold color="cyan">PULSEPLAY SIMULATOR</Text>
        <Text color={simColor} bold>[{simStatus.toUpperCase()}]</Text>
      </Box>
      <Box gap={1}>
        {marketId ? (
          <>
            <Text color="gray">{marketId}</Text>
            <Text color={getStatusColor(marketStatus!)} bold>{marketStatus}</Text>
          </>
        ) : (
          <Text color="gray">No market</Text>
        )}
      </Box>
    </Box>
  );
}
