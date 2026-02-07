import React from 'react';
import { Box, Text } from 'ink';
import type { Position } from '../types.js';
import {
  truncateAddress,
  formatDollars,
  formatOutcomeShort,
  formatVersion,
  formatStatusBadge,
  getOutcomeColor,
  getSessionStatusColor,
} from '../utils/formatters.js';

interface PositionsPanelProps {
  positions: Position[];
  scrollOffset: number;
  visibleCount: number;
  isActive: boolean;
  panelWidth: number;
  selectedIndex?: number;
  expandedIndex?: number;
}

// Alignment constants for session data display
const LABEL_WIDTH = 12;  // accommodates longest label "resolution:" (11 chars)
const VALUE_WIDTH = 44;  // accommodates "$1,234.56" and "3.4521" etc.

/** Parse sessionData JSON and render key fields. */
function SessionDataExpanded({ sessionData }: { sessionData?: string }) {
  if (!sessionData) {
    return <Text color="gray" dimColor>  No session data available</Text>;
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(sessionData);
  } catch {
    return <Text color="gray" dimColor>  Invalid session data</Text>;
  }

  const v = data.v as number;

  if (v === 2) {
    const amount = Number(data.amount) || 0;
    const shares = Number(data.shares) || 0;
    const price = Number(data.effectivePricePerShare) || 0;
    const fee = Number(data.fee) || 0;
    const feePct = Number(data.feePercent) || 0;
    const preBetOdds = data.preBetOdds as Record<string, number>;
    const postBetOdds = data.postBetOdds as Record<string, number>;

    const feeStr = `${formatDollars(fee)} (${feePct}%)`;

    return (
      <Box flexDirection="column" paddingLeft={2} flexGrow={1}>
        <Text color="gray" dimColor>{'─ V2 Session Data ─'}</Text>
        <Box>
          <Text color="gray">{'market:'.padEnd(LABEL_WIDTH)}</Text>
          <Text color="white">{String(data.marketId ?? '-').padStart(VALUE_WIDTH)}</Text>
        </Box>
        <Box>
          <Text color="gray">{'outcome:'.padEnd(LABEL_WIDTH)}</Text>
          <Text color="cyan">{String(data.outcome ?? '-').padStart(VALUE_WIDTH)}</Text>
        </Box>
        <Box>
          <Text color="gray">{'amount:'.padEnd(LABEL_WIDTH)}</Text>
          <Text color={amount > 0 ? 'green' : 'red'}>{formatDollars(amount).padStart(VALUE_WIDTH)}</Text>
        </Box>
        <Box>
          <Text color="gray">{'shares:'.padEnd(LABEL_WIDTH)}</Text>
          <Text color="white">{shares.toFixed(4).padStart(VALUE_WIDTH)}</Text>
        </Box>
        <Box>
          <Text color="gray">{'price/sh:'.padEnd(LABEL_WIDTH)}</Text>
          <Text color="white">{price.toFixed(4).padStart(VALUE_WIDTH)}</Text>
        </Box>
        <Box>
          <Text color="gray">{'pre-bet odds:'.padEnd(LABEL_WIDTH)}</Text>
          <Text color="yellow">{preBetOdds[String(data.outcome).toLowerCase()]?.toFixed(2).padStart(VALUE_WIDTH - 1)}</Text>
        </Box>
        <Box>
          <Text color="gray">{'post-bet odds:'.padEnd(LABEL_WIDTH)}</Text>
          <Text color="yellow">{postBetOdds[String(data.outcome).toLowerCase()]?.toFixed(2).padStart(VALUE_WIDTH - 2)}</Text>
        </Box>
        <Box>
          <Text color="gray">{'fee:'.padEnd(LABEL_WIDTH)}</Text>
          <Text color="yellow">{feeStr.padStart(VALUE_WIDTH)}</Text>
        </Box>
      </Box>
    );
  }

  if (v === 3) {
    const result = String(data.result ?? '-');
    const resultColor = result === 'WIN' ? 'green' : 'red';
    const payout = Number(data.payout) || 0;
    const profit = Number(data.profit) || 0;
    const shares = Number(data.shares) || 0;
    const costPaid = Number(data.costPaid) || 0;

    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color="gray" dimColor>{'─ V3 Session Data ─'}</Text>
        <Box>
          <Text color="gray">{'resolution:'.padEnd(LABEL_WIDTH)}</Text>
          <Text color="cyan">{String(data.resolution ?? '-').padStart(VALUE_WIDTH)}</Text>
        </Box>
        <Box>
          <Text color="gray">{'result:'.padEnd(LABEL_WIDTH)}</Text>
          <Text color={resultColor} bold>{result.padStart(VALUE_WIDTH)}</Text>
        </Box>
        <Box>
          <Text color="gray">{'payout:'.padEnd(LABEL_WIDTH)}</Text>
          <Text color="green">{formatDollars(payout).padStart(VALUE_WIDTH)}</Text>
        </Box>
        <Box>
          <Text color="gray">{'profit:'.padEnd(LABEL_WIDTH)}</Text>
          <Text color={profit >= 0 ? 'green' : 'red'}>
            {formatDollars(profit).padStart(VALUE_WIDTH)}
          </Text>
        </Box>
        <Box>
          <Text color="gray">{'shares:'.padEnd(LABEL_WIDTH)}</Text>
          <Text color="white">{shares.toFixed(4).padStart(VALUE_WIDTH)}</Text>
        </Box>
        <Box>
          <Text color="gray">{'costPaid:'.padEnd(LABEL_WIDTH)}</Text>
          <Text color="white">{formatDollars(costPaid).padStart(VALUE_WIDTH)}</Text>
        </Box>
      </Box>
    );
  }

  // Generic fallback
  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text color="gray" dimColor>{'─ Session Data (v' + v + ') ─'}</Text>
      <Text color="white">{JSON.stringify(data, null, 2).slice(0, 200)}</Text>
    </Box>
  );
}

// Extra rendered lines when a position is expanded (header + 6 data fields + spacing)
export const EXPANDED_LINES = 10;

export function PositionsPanel({ positions, scrollOffset, visibleCount, isActive, panelWidth, selectedIndex, expandedIndex }: PositionsPanelProps) {
  // Reduce displayed positions when one is expanded within the visible range
  const expandedInRange = expandedIndex !== undefined &&
    expandedIndex >= scrollOffset &&
    expandedIndex < scrollOffset + visibleCount;
  const effectiveCount = expandedInRange
    ? Math.max(visibleCount - EXPANDED_LINES, 1)
    : visibleCount;

  const displayPositions = positions.slice(scrollOffset, scrollOffset + effectiveCount);
  const endIndex = Math.min(scrollOffset + effectiveCount, positions.length);
  const showIndicator = positions.length > effectiveCount;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={isActive ? 'cyan' : undefined}
      paddingX={1}
      flexGrow={1}
    >
      {/* Title */}
      <Box justifyContent="center" gap={1} marginBottom={1}>
        <Text bold color="yellow">
          APP SESSIONS ({positions.length})
        </Text>
        {showIndicator && (
          <Text color="gray" dimColor>
            {scrollOffset + 1}-{endIndex} of {positions.length}
          </Text>
        )}
      </Box>

      {/* Column headers */}
      <Box>
        <Text color="gray" bold>
          {'SESSION'.padEnd(14)}
          {'BETTOR'.padEnd(14)}
          {'BET'.padEnd(6)}
          {'ALLOC'.padEnd(8)}
          {'VERSION'.padEnd(10)}
          {'STATUS'}
        </Text>
      </Box>

      {/* Separator */}
      <Text color="gray" dimColor>
        {'─'.repeat(panelWidth)}
      </Text>

      {/* Data rows */}
      {displayPositions.length > 0 ? (
        displayPositions.map((pos, idx) => {
          const absoluteIndex = scrollOffset + idx;
          const isSelected = isActive && selectedIndex === absoluteIndex;
          const isExpanded = expandedIndex === absoluteIndex;

          return (
            <React.Fragment key={`${pos.appSessionId}-${absoluteIndex}`}>
              <Box>
                {/* Selection indicator */}
                <Text color="cyan" bold>
                  {isSelected ? '>' : ' '}
                </Text>
                <Text color="yellow" inverse={isSelected}>
                  {truncateAddress(pos.appSessionId).padEnd(13)}
                </Text>
                <Text color="gray" inverse={isSelected}>
                  {truncateAddress(pos.address).padEnd(14)}
                </Text>
                <Text color={getOutcomeColor(pos.outcome)} bold inverse={isSelected}>
                  {formatOutcomeShort(pos.outcome).padEnd(6)}
                </Text>
                <Text color="green" inverse={isSelected}>
                  {formatDollars(pos.appSessionVersion === 1 ? pos.costPaid :
                    pos.appSessionVersion === 2 ? pos.costPaid - (pos.fee ?? 0) : 0).padStart(6).padEnd(8)}
                </Text>
                <Text color="white" dimColor inverse={isSelected}>
                  {formatVersion(pos.appSessionVersion).padStart(4).padEnd(10)}
                </Text>
                <Text color={getSessionStatusColor(pos.sessionStatus ?? 'open')} bold inverse={isSelected}>
                  {formatStatusBadge(pos.sessionStatus ?? 'open')}
                </Text>
              </Box>
              {/* Expanded session data */}
              {isExpanded && (
                <SessionDataExpanded sessionData={pos.sessionData} />
              )}
            </React.Fragment>
          );
        })
      ) : (
        <Box justifyContent="center" marginTop={1}>
          <Text color="gray" dimColor>
            Awaiting state channel activity...
          </Text>
        </Box>
      )}
    </Box>
  );
}
