import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { AdminStateResponse } from '../types.js';

interface SystemInfoProps {
  wsConnected: boolean;
  wsError: string | null;
  state: AdminStateResponse | null;
}

export function SystemInfo({
  wsConnected,
  wsError,
  state,
}: SystemInfoProps) {
  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1} flexShrink={0}>
      <Box justifyContent="center">
        <Text bold color="white">
          SYSTEM
        </Text>
      </Box>

      {/* WebSocket status */}
      <Box gap={1}>
        <Text>WS:</Text>
        {wsConnected ? (
          <Text color="green" bold>
            Connected
          </Text>
        ) : wsError ? (
          <Text color="red">Error: {wsError}</Text>
        ) : (
          <>
            <Text color="yellow">
              <Spinner type="dots" />
            </Text>
            <Text color="yellow">Connecting...</Text>
          </>
        )}
      </Box>

      {/* Client count */}
      <Box gap={1}>
        <Text>Clients:</Text>
        <Text>{state?.connectionCount ?? 0}</Text>
      </Box>

      {/* Game state */}
      <Box gap={1}>
        <Text>Game:</Text>
        {state?.gameState.active ? (
          <Text color="green" bold>
            ACTIVE
          </Text>
        ) : (
          <Text color="gray">INACTIVE</Text>
        )}
      </Box>

      {/* Game / Category context */}
      {state?.market?.gameId && (
        <Box gap={1}>
          <Text>Game ID:</Text>
          <Text color="white">{state.market.gameId}</Text>
        </Box>
      )}
      {state?.market?.categoryId && (
        <Box gap={1}>
          <Text>Category:</Text>
          <Text color="white">{state.market.categoryId}</Text>
        </Box>
      )}

      {/* Position count */}
      <Box gap={1}>
        <Text>Positions:</Text>
        <Text>{state?.positionCount ?? 0}</Text>
      </Box>

      {/* Session counts */}
      <Box gap={1}>
        <Text>Sessions:</Text>
        <Text color="green">{state?.sessionCounts?.open ?? 0}</Text>
        <Text color="gray">/</Text>
        <Text color="blue">{state?.sessionCounts?.settled ?? 0}</Text>
        <Text color="gray" dimColor>(bets open/ bets settled)</Text>
      </Box>
    </Box>
  );
}
