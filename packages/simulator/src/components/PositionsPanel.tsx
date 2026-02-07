import React from 'react';
import { Box, Text } from 'ink';
import type { Position } from '../types.js';
import {
  truncateAddress,
  formatDollars,
  formatOutcomeShort,
  formatVersion,
  formatStatusBadge,
  getOutcomeColor,
  getSessionStatusColor,
} from '../utils/formatters.js';

interface PositionsPanelProps {
  positions: Position[];
  scrollOffset: number;
  visibleCount: number;
  isActive: boolean;
  panelWidth: number;
}

export function PositionsPanel({ positions, scrollOffset, visibleCount, isActive, panelWidth }: PositionsPanelProps) {
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
      {/* Title */}
      <Box justifyContent="center" gap={1} marginBottom={1}>
        <Text bold color="yellow">
          APP SESSIONS ({positions.length})
        </Text>
        {showIndicator && (
          <Text color="gray" dimColor>
            {scrollOffset + 1}-{endIndex} of {positions.length}
          </Text>
        )}
      </Box>

      {/* Column headers */}
      <Box>
        <Text color="gray" bold>
          {'SESSION'.padEnd(14)}
          {'BETTOR'.padEnd(14)}
          {'BET'.padEnd(6)}
          {'ALLOC'.padEnd(8)}
          {'VERSION'.padEnd(9)}
          {'STATUS'}
        </Text>
      </Box>

      {/* Separator */}
      <Text color="gray" dimColor>
        {'─'.repeat(panelWidth)}
      </Text>

      {/* Data rows */}
      {displayPositions.length > 0 ? (
        displayPositions.map((pos, idx) => (
          <Box key={`${pos.appSessionId}-${scrollOffset + idx}`}>
            <Text color="yellow">
              {truncateAddress(pos.appSessionId).padEnd(14)}
            </Text>
            <Text color="gray">
              {truncateAddress(pos.address).padEnd(14)}
            </Text>
            <Text color={getOutcomeColor(pos.outcome)} bold>
              {formatOutcomeShort(pos.outcome).padEnd(6)}
            </Text>
            <Text color="green">
              {formatDollars(pos.appSessionVersion === 1 ? pos.costPaid :
                pos.appSessionVersion === 2 ? pos.costPaid - (pos.fee ?? 0) : 0).padStart(6).padEnd(8)}
            </Text>
            <Text color="white" dimColor>
              {formatVersion(pos.appSessionVersion).padStart(4).padEnd(9)}
            </Text>
            <Text color={getSessionStatusColor(pos.sessionStatus ?? 'open')} bold>
              {formatStatusBadge(pos.sessionStatus ?? 'open')}
            </Text>
          </Box>
        ))
      ) : (
        <Box justifyContent="center" marginTop={1}>
          <Text color="gray" dimColor>
            Awaiting state channel activity...
          </Text>
        </Box>
      )}
    </Box>
  );
}
