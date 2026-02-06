import React from 'react';
import { Box, Text } from 'ink';
import { formatOdds, formatAmericanOdds, renderPriceBar } from '../utils/formatters.js';

interface PriceBarProps {
  label: string;
  probability: number;
  color: string;
  width?: number;
}

export function PriceBar({ label, probability, color, width = 20 }: PriceBarProps) {
  const americanOdds = formatAmericanOdds(probability);
  const { filled, empty } = renderPriceBar(probability, width);

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text color={color} bold>
          {label.padEnd(7)}
        </Text>
        <Text color={color}>{formatOdds(probability)}</Text>
        <Text color="gray">({americanOdds})</Text>
      </Box>
      <Box>
        <Text color={color}>{'█'.repeat(filled)}</Text>
        <Text color="gray">{'░'.repeat(empty)}</Text>
      </Box>
    </Box>
  );
}
