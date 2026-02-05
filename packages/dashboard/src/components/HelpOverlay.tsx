import React from 'react';
import { Box, Text } from 'ink';

interface HelpOverlayProps {
  height: number;
}

export function HelpOverlay({ height }: HelpOverlayProps) {
  const lines = [
    { header: 'Navigation' },
    { key: 'Tab', desc: 'Switch active panel' },
    { key: 'j / ↓', desc: 'Scroll down' },
    { key: 'k / ↑', desc: 'Scroll up' },
    { key: 'g', desc: 'Scroll to top' },
    { key: 'G', desc: 'Scroll to bottom' },
    { header: 'Commands' },
    { key: ':clear', desc: 'Clear event log' },
    { key: ':reset', desc: 'Reset backend state' },
    { key: ':reconnect', desc: 'Reconnect WebSocket' },
    { key: ':quit / :q', desc: 'Quit dashboard' },
    { header: 'General' },
    { key: 'q', desc: 'Quit' },
    { key: '?', desc: 'Toggle this help' },
    { key: 'Escape', desc: 'Dismiss help / cancel command' },
  ];

  const contentHeight = lines.length + 4; // title + border padding
  const topPad = Math.max(0, Math.floor((height - contentHeight) / 2));

  return (
    <Box flexDirection="column" flexGrow={1}>
      {topPad > 0 && <Box height={topPad} />}
      <Box flexDirection="column" alignItems="center" flexGrow={1}>
        <Text bold color="cyan">KEYBINDINGS</Text>
        <Text color="gray">{'─'.repeat(30)}</Text>
        {lines.map((line, idx) => {
          if ('header' in line && line.header) {
            return (
              <Box key={idx} marginTop={idx > 0 ? 1 : 0}>
                <Text bold color="yellow">{line.header}</Text>
              </Box>
            );
          }
          return (
            <Box key={idx} gap={2}>
              <Text color="cyan">{(line.key ?? '').padEnd(14)}</Text>
              <Text>{line.desc ?? ''}</Text>
            </Box>
          );
        })}
        <Text color="gray" dimColor>{'\n'}Press ? or Escape to dismiss</Text>
      </Box>
    </Box>
  );
}
