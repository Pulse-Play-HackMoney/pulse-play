import React from 'react';
import { Box, Text } from 'ink';
import type { MarketSummary } from '../types.js';
import { getStatusColor } from '../utils/formatters.js';

interface MarketsOverlayProps {
  markets: MarketSummary[];
  selectedIndex: number;
  height: number;
}

function truncateId(id: string, len = 40): string {
  return id.length > len ? id.slice(0, len) + '..' : id;
}

export function MarketsOverlay({ markets, selectedIndex, height }: MarketsOverlayProps) {
  const headerLines = 5; // title + separator + header + separator + footer hint
  const visibleCount = Math.max(height - headerLines, 3);

  // Auto-scroll to keep selection visible
  let scrollOffset = 0;
  if (selectedIndex >= visibleCount) {
    scrollOffset = selectedIndex - visibleCount + 1;
  }

  const displayMarkets = markets.slice(scrollOffset, scrollOffset + visibleCount);

  return (
    <Box flexDirection="column" flexGrow={1} paddingX={2}>
      <Box alignSelf="center">
        <Text bold color="cyan">MARKETS ({markets.length})</Text>
      </Box>
      <Box alignSelf="center">
        <Text color="gray">{'─'.repeat(86)}</Text>
      </Box>

      {/* Column headers */}
      <Box>
        <Text color="gray" bold>
          {'  '}
          {'GAME'.padEnd(40)}
          {'ID'.padEnd(50)}
          {'CATEGORY'.padEnd(14)}
          {'STATUS'.padEnd(12)}
          {'OUTCOME'}
        </Text>
      </Box>

      {markets.length > 0 ? (
        displayMarkets.map((m, idx) => {
          const absoluteIndex = scrollOffset + idx;
          const isSelected = absoluteIndex === selectedIndex;
          return (
            <Box key={m.id}>
              <Text color="cyan" bold>{isSelected ? '> ' : '  '}</Text>
              <Text color="gray" inverse={isSelected}>
                {truncateId(m.gameId).padEnd(40)}
              </Text>
              <Text color="white" inverse={isSelected}>
                {truncateId(m.id, 46).padEnd(50)}
              </Text>
              <Text color="gray" inverse={isSelected}>
                {m.categoryId.padEnd(14)}
              </Text>
              <Text color={getStatusColor(m.status)} bold inverse={isSelected}>
                {m.status.padEnd(12)}
              </Text>
              <Text color="yellow" inverse={isSelected}>
                {m.outcome ?? '-'}
              </Text>
            </Box>
          );
        })
      ) : (
        <Box justifyContent="center" marginTop={1}>
          <Text color="gray" dimColor>No markets found</Text>
        </Box>
      )}

      <Box alignSelf="center" marginTop={1}>
        <Text color="gray" dimColor>
          j/k: navigate  Enter: load market  Escape: dismiss
        </Text>
      </Box>
    </Box>
  );
}
