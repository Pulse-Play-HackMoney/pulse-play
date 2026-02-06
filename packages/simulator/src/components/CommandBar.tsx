import React from 'react';
import { Box, Text } from 'ink';
import type { SimStatus } from '../types.js';

export type CommandBarMode = 'normal' | 'command';

interface CommandBarProps {
  mode: CommandBarMode;
  commandBuffer: string;
  statusMessage: string | null;
  simStatus: SimStatus;
  wsConnected: boolean;
}

export function CommandBar({ mode, commandBuffer, statusMessage, simStatus, wsConnected }: CommandBarProps) {
  const simColor = simStatus === 'running' ? 'green' : simStatus === 'stopping' ? 'yellow' : 'gray';

  if (statusMessage) {
    return (
      <Box paddingX={1} justifyContent="space-between">
        <Text color="green" bold>{statusMessage}</Text>
        <Text color={simColor}>SIM: {simStatus.toUpperCase()}</Text>
      </Box>
    );
  }

  if (mode === 'command') {
    return (
      <Box paddingX={1} justifyContent="space-between">
        <Box>
          <Text color="yellow" bold>:</Text>
          <Text color="yellow">{commandBuffer}</Text>
          <Text color="yellow">█</Text>
        </Box>
        <Text color={simColor}>SIM: {simStatus.toUpperCase()}</Text>
      </Box>
    );
  }

  return (
    <Box paddingX={1} justifyContent="space-between">
      <Box gap={1}>
        <Text color="gray">Tab</Text>
        <Text dimColor>panel</Text>
        <Text color="gray">j/k</Text>
        <Text dimColor>scroll</Text>
        <Text color="gray">?</Text>
        <Text dimColor>help</Text>
        <Text color="gray">:</Text>
        <Text dimColor>cmd</Text>
      </Box>
      <Box gap={1}>
        <Text color={wsConnected ? 'green' : 'red'}>
          {wsConnected ? 'WS' : 'WS:OFF'}
        </Text>
        <Text color={simColor}>SIM: {simStatus.toUpperCase()}</Text>
      </Box>
    </Box>
  );
}
