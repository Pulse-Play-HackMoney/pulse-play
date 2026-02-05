import React from 'react';
import { Box, Text } from 'ink';
import type { Position } from '../types.js';
import {
  truncateAddress,
  formatShares,
  formatDollars,
  getOutcomeColor,
} from '../utils/formatters.js';

interface PositionsPanelProps {
  positions: Position[];
  scrollOffset: number;
  visibleCount: number;
  isActive: boolean;
}

export function PositionsPanel({ positions, scrollOffset, visibleCount, isActive }: PositionsPanelProps) {
  const displayPositions = positions.slice(scrollOffset, scrollOffset + visibleCount);
  const endIndex = Math.min(scrollOffset + visibleCount, positions.length);
  const showIndicator = positions.length > visibleCount;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={isActive ? 'cyan' : undefined}
      paddingX={1}
      flexGrow={1}
    >
      <Box justifyContent="center" gap={1}>
        <Text bold color="white">
          POSITIONS ({positions.length})
        </Text>
        {showIndicator && (
          <Text color="gray" dimColor>
            {scrollOffset + 1}-{endIndex} of {positions.length}
          </Text>
        )}
      </Box>

      {displayPositions.length > 0 ? (
        displayPositions.map((pos, idx) => (
          <Box key={`${pos.address}-${pos.timestamp}-${scrollOffset + idx}`} gap={1}>
            <Text color="gray">{truncateAddress(pos.address)}</Text>
            <Text color={getOutcomeColor(pos.outcome)} bold>
              {pos.outcome.padEnd(6)}
            </Text>
            <Text>{formatShares(pos.shares).padStart(6)}</Text>
            <Text color="green">{formatDollars(pos.costPaid)}</Text>
          </Box>
        ))
      ) : (
        <Box>
          <Text color="gray" dimColor>
            No positions
          </Text>
        </Box>
      )}
    </Box>
  );
}
