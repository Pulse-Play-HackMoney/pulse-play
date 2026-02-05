import React from 'react';
import { Box, Text } from 'ink';
import type { EventLogEntry } from '../types.js';
import { formatTime } from '../utils/formatters.js';

interface EventLogProps {
  events: EventLogEntry[];
  scrollOffset: number;
  visibleCount: number;
  isActive: boolean;
}

function getEventTypeColor(type: string): string {
  switch (type) {
    case 'ODDS_UPDATE':
      return 'cyan';
    case 'MARKET_STATUS':
      return 'yellow';
    case 'GAME_STATE':
      return 'green';
    case 'BET_RESULT':
      return 'magenta';
    default:
      return 'white';
  }
}

export function EventLog({ events, scrollOffset, visibleCount, isActive }: EventLogProps) {
  // Chronological order (oldest first), sliced to visible window
  const displayEvents = events.slice(scrollOffset, scrollOffset + visibleCount);
  const endIndex = Math.min(scrollOffset + visibleCount, events.length);
  const showIndicator = events.length > visibleCount;

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
          EVENT LOG
        </Text>
        {showIndicator && (
          <Text color="gray" dimColor>
            {scrollOffset + 1}-{endIndex} of {events.length}
          </Text>
        )}
      </Box>

      {displayEvents.length > 0 ? (
        displayEvents.map((event, idx) => (
          <Box key={`${event.timestamp.getTime()}-${scrollOffset + idx}`} gap={1}>
            <Text color="gray">{formatTime(event.timestamp)}</Text>
            <Text color={getEventTypeColor(event.type)}>[{event.type}]</Text>
            <Text>{event.message}</Text>
          </Box>
        ))
      ) : (
        <Box>
          <Text color="gray" dimColor>
            Waiting for events...
          </Text>
        </Box>
      )}
    </Box>
  );
}
