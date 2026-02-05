import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { AdminStateResponse } from '../types.js';

interface SystemInfoProps {
  wsConnected: boolean;
  wsError: string | null;
  reconnectAttempts: number;
  state: AdminStateResponse | null;
  adminError: string | null;
  adminLoading: boolean;
}

export function SystemInfo({
  wsConnected,
  wsError,
  reconnectAttempts,
  state,
  adminError,
  adminLoading,
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
        ) : reconnectAttempts > 0 ? (
          <>
            <Text color="yellow">
              <Spinner type="dots" />
            </Text>
            <Text color="yellow">Reconnecting ({reconnectAttempts})</Text>
          </>
        ) : (
          <>
            <Text color="yellow">
              <Spinner type="dots" />
            </Text>
            <Text color="yellow">Connecting...</Text>
          </>
        )}
      </Box>

      {/* Admin API status */}
      <Box gap={1}>
        <Text>API:</Text>
        {adminLoading ? (
          <>
            <Text color="yellow">
              <Spinner type="dots" />
            </Text>
            <Text color="yellow">Loading...</Text>
          </>
        ) : adminError ? (
          <Text color="red">Error: {adminError}</Text>
        ) : (
          <Text color="green" bold>
            OK
          </Text>
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

      {/* Position count */}
      <Box gap={1}>
        <Text>Positions:</Text>
        <Text>{state?.positionCount ?? 0}</Text>
      </Box>
    </Box>
  );
}
