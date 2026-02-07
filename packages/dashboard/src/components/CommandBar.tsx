import React from 'react';
import { Box, Text } from 'ink';
import type { AdminStateResponse } from '../types.js';

export type CommandBarMode = 'normal' | 'command';

interface CommandBarProps {
  mode: CommandBarMode;
  commandBuffer: string;
  statusMessage: string | null;
  wsUrl: string;
  state?: AdminStateResponse | null;
}

export function CommandBar({ mode, commandBuffer, statusMessage, wsUrl, state }: CommandBarProps) {
  if (mode === 'command') {
    return (
      <Box paddingX={1}>
        <Text color="yellow" bold>:</Text>
        <Text color="yellow">{commandBuffer}</Text>
        <Text color="yellow">█</Text>
      </Box>
    );
  }

  if (statusMessage) {
    return (
      <Box paddingX={1}>
        <Text color="green" bold>{statusMessage}</Text>
      </Box>
    );
  }

  // Normal mode — show keybinding hints
  return (
    <Box paddingX={1} justifyContent="space-between" flexGrow={1}>
      <Box gap={1}>
        <Text color="gray">Tab</Text>
        <Text dimColor>panel</Text>
        <Text color="gray">j/k</Text>
        <Text dimColor>scroll</Text>
        <Text color="gray">?</Text>
        <Text dimColor>help</Text>
        <Text color="gray">:</Text>
        <Text dimColor>cmd</Text>
        <Text color="gray">q</Text>
        <Text dimColor>quit</Text>
      </Box>
      <Box gap={1}>
        {state?.market?.gameId && <Text color="gray" dimColor>{state.market.gameId}</Text>}
        {state?.market?.categoryId && <Text color="gray" dimColor>{state.market.categoryId}</Text>}
        <Text color="gray" dimColor>WS: {wsUrl}</Text>
      </Box>
    </Box>
  );
}
