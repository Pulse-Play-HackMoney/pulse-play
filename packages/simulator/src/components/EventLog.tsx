import React from 'react';
import { Box, Text } from 'ink';
import type { EventLogEntry } from '../types.js';
import { formatTime, getSimEventColor } from '../utils/formatters.js';

interface EventLogProps {
  events: EventLogEntry[];
  scrollOffset: number;
  visibleCount: number;
  isActive: boolean;
}

function getEventColor(type: string): string {
  // Hub WS event colors
  switch (type) {
    case 'ODDS_UPDATE': return 'cyan';
    case 'MARKET_STATUS': return 'yellow';
    case 'GAME_STATE': return 'green';
    case 'BET_RESULT': return 'magenta';
    case 'POSITION_ADDED': return 'white';
    case 'SESSION_SETTLED': return 'blue';
    default: break;
  }
  // Sim event colors
  return getSimEventColor(type as any) || 'white';
}

export function EventLog({ events, scrollOffset, visibleCount, isActive }: EventLogProps) {
  const displayEvents = events.slice(scrollOffset, scrollOffset + visibleCount);
  const endIndex = Math.min(scrollOffset + visibleCount, events.length);
  const showIndicator = events.length > visibleCount;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={isActive ? 'cyan' : undefined}
      paddingX={1}
      paddingBottom={1}
      flexGrow={1}
    >
      <Box justifyContent="center" gap={1}>
        <Text bold color="white">EVENT LOG</Text>
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
            <Text color={getEventColor(event.type)}>[{event.type}]</Text>
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
