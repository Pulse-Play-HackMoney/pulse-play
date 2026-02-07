import React from 'react';
import { Box, Text } from 'ink';

interface HelpOverlayProps {
  height: number;
}

export function HelpOverlay({ height }: HelpOverlayProps) {
  const lines = [
    { header: 'Simulation' },
    { key: ':wallets <n>', desc: 'Generate N wallets' },
    { key: ':fund', desc: 'Fund all wallets via faucet' },
    { key: ':open [sport] [cat]', desc: 'Open market (default: baseball pitching)' },
    { key: ':close', desc: 'Close current market' },
    { key: ':resolve <outcome>', desc: 'Resolve with outcome' },
    { key: ':sim start', desc: 'Start automated betting' },
    { key: ':sim stop', desc: 'Stop automated betting' },
    { key: ':sim config', desc: 'View config (or set: key=val ...)' },
    { key: ':sim config keys', desc: 'bias, betAmountMin/Max, delayMin/MaxMs, maxBetsPerWallet' },
    { header: 'Admin' },
    { key: ':status', desc: 'Show backend state' },
    { key: ':reset', desc: 'Reset backend + clear wallets' },
    { key: ':fund-mm [n]', desc: 'Fund market maker ($10 x n)' },
    { key: ':games', desc: 'List games in event log' },
    { key: ':sports', desc: 'List sports in event log' },
    { key: ':markets', desc: 'Browse all markets (overlay)' },
    { header: 'Navigation' },
    { key: 'Tab', desc: 'Switch active panel' },
    { key: 'j / k', desc: 'Scroll active panel / move cursor' },
    { key: 'Enter / e', desc: 'Expand/collapse position detail' },
    { key: 'g / G', desc: 'Top / bottom of panel' },
    { header: 'General' },
    { key: ':', desc: 'Enter command mode' },
    { key: '?', desc: 'Toggle this help' },
    { key: 'Escape', desc: 'Dismiss help / cancel cmd' },
    { key: ':quit / :q', desc: 'Quit simulator' },
  ];

  const contentHeight = lines.length + 4;
  const topPad = Math.max(0, Math.floor((height - contentHeight) / 2));

  return (
    <Box flexDirection="column" flexGrow={1}>
      {topPad > 0 && <Box height={topPad} />}
      <Box flexDirection="column" flexGrow={1} paddingLeft={4}>
        <Box alignSelf="center">
          <Text bold color="cyan">COMMAND REFERENCE</Text>
        </Box>
        <Box alignSelf="center">
          <Text color="gray">{'─'.repeat(40)}</Text>
        </Box>
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
              <Text color="cyan">{(line.key ?? '').padEnd(22)}</Text>
              <Text>{line.desc ?? ''}</Text>
            </Box>
          );
        })}
        <Box alignSelf="center" marginTop={1}>
          <Text color="gray" dimColor>Press ? or Escape to dismiss</Text>
        </Box>
      </Box>
    </Box>
  );
}
