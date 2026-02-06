import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { useWebSocket } from './hooks/useWebSocket.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { MarketPanel } from './components/MarketPanel.js';
import { PositionsPanel } from './components/PositionsPanel.js';
import { EventLog } from './components/EventLog.js';
import { SystemInfo } from './components/SystemInfo.js';
import { CommandBar } from './components/CommandBar.js';
import { HelpOverlay } from './components/HelpOverlay.js';
import { formatWsMessage } from './utils/formatters.js';
import type {
  EventLogEntry,
  WsMessage,
  AdminStateResponse,
  Position,
} from './types.js';

interface AppProps {
  wsUrl: string;
  hubUrl: string;
}

type UIMode = 'normal' | 'command' | 'help';
type ActivePanel = 'positions' | 'eventLog';

const MAX_EVENT_LOG_SIZE = 100;

// Calculate prices from market quantities
function calculatePrices(market: { qBall: number; qStrike: number; b: number } | null) {
  if (!market) {
    return { priceBall: 0.5, priceStrike: 0.5 };
  }

  const { qBall, qStrike, b } = market;
  const maxQ = Math.max(qBall, qStrike);
  const expBall = Math.exp((qBall - maxQ) / b);
  const expStrike = Math.exp((qStrike - maxQ) / b);
  const sumExp = expBall + expStrike;

  return {
    priceBall: expBall / sumExp,
    priceStrike: expStrike / sumExp,
  };
}

export function App({ wsUrl, hubUrl }: AppProps) {
  const { exit } = useApp();
  const { columns, rows } = useTerminalSize();

  // Core state
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [prices, setPrices] = useState({ priceBall: 0.5, priceStrike: 0.5 });
  const [state, setState] = useState<AdminStateResponse | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [initialized, setInitialized] = useState(false);

  // UI state
  const [uiMode, setUiMode] = useState<UIMode>('normal');
  const [activePanel, setActivePanel] = useState<ActivePanel>('eventLog');
  const [positionsScrollOffset, setPositionsScrollOffset] = useState(0);
  const [eventLogScrollOffset, setEventLogScrollOffset] = useState(0);
  const [commandBuffer, setCommandBuffer] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Track whether user has manually scrolled away from bottom (event log auto-scroll)
  const userScrolledRef = useRef(false);
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Connect to WebSocket
  const { connected, lastMessage, error: wsError, reconnectAttempts, reconnect } = useWebSocket(wsUrl);

  // Layout calculations
  // Header: 3 rows (border top + content + border bottom)
  // Footer: 1 row
  // Overhead = 3 (header) + 1 (footer) = 4
  // MarketPanel: ~11 rows (border + title + status + 2 price bars + q values)
  // SystemInfo: ~9 rows (border + title + 5 info lines)
  // Scrollable panel overhead: ~3 rows (border top + title + border bottom)
  const positionsVisibleCount = Math.max(rows - 21, 1);
  const eventLogVisibleCount = Math.max(rows - 17, 1);
  const barWidth = Math.max(Math.floor(columns / 2) - 6, 10);

  // Show status message for 2 seconds
  const showStatus = useCallback((msg: string) => {
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }
    setStatusMessage(msg);
    statusTimeoutRef.current = setTimeout(() => {
      setStatusMessage(null);
    }, 2000);
  }, []);

  // Execute a command
  const executeCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim().toLowerCase();
    switch (trimmed) {
      case 'clear':
      case 'c':
        setEvents([]);
        setEventLogScrollOffset(0);
        showStatus('Event log cleared');
        break;
      case 'reset':
      case 'r':
        fetch(`${hubUrl}/api/admin/reset`, { method: 'POST' })
          .then(() => showStatus('Backend reset sent'))
          .catch((err) => showStatus(`Reset failed: ${err.message}`));
        break;
      case 'reconnect':
        reconnect();
        showStatus('Reconnecting...');
        break;
      case 'quit':
      case 'q':
        exit();
        break;
      default:
        showStatus(`Unknown command: ${cmd}`);
    }
  }, [hubUrl, reconnect, exit, showStatus]);

  // Input routing
  useInput((input, key) => {
    // Help mode: only ? and Escape dismiss
    if (uiMode === 'help') {
      if (input === '?' || key.escape) {
        setUiMode('normal');
      }
      return;
    }

    // Command mode: type into buffer
    if (uiMode === 'command') {
      if (key.escape) {
        setUiMode('normal');
        setCommandBuffer('');
        return;
      }
      if (key.return) {
        executeCommand(commandBuffer);
        setUiMode('normal');
        setCommandBuffer('');
        return;
      }
      if (key.backspace || key.delete) {
        setCommandBuffer((prev) => prev.slice(0, -1));
        return;
      }
      // Append printable character
      if (input && !key.ctrl && !key.meta) {
        setCommandBuffer((prev) => prev + input);
      }
      return;
    }

    // Normal mode
    if (input === 'q') {
      exit();
      return;
    }
    if (input === '?') {
      setUiMode('help');
      return;
    }
    if (input === ':') {
      setUiMode('command');
      setCommandBuffer('');
      return;
    }
    if (key.tab) {
      setActivePanel((prev) => (prev === 'positions' ? 'eventLog' : 'positions'));
      return;
    }

    // Scrolling
    const scrollDown = input === 'j' || key.downArrow;
    const scrollUp = input === 'k' || key.upArrow;
    const goTop = input === 'g';
    const goBottom = input === 'G';

    if (activePanel === 'positions') {
      const maxOffset = Math.max(0, positions.length - positionsVisibleCount);
      if (scrollDown) {
        setPositionsScrollOffset((prev) => Math.min(prev + 1, maxOffset));
      } else if (scrollUp) {
        setPositionsScrollOffset((prev) => Math.max(prev - 1, 0));
      } else if (goTop) {
        setPositionsScrollOffset(0);
      } else if (goBottom) {
        setPositionsScrollOffset(maxOffset);
      }
    } else {
      const maxOffset = Math.max(0, events.length - eventLogVisibleCount);
      if (scrollDown) {
        setEventLogScrollOffset((prev) => Math.min(prev + 1, maxOffset));
        userScrolledRef.current = true;
      } else if (scrollUp) {
        setEventLogScrollOffset((prev) => Math.max(prev - 1, 0));
        userScrolledRef.current = true;
      } else if (goTop) {
        setEventLogScrollOffset(0);
        userScrolledRef.current = true;
      } else if (goBottom) {
        setEventLogScrollOffset(maxOffset);
        userScrolledRef.current = false; // Re-enable auto-scroll
      }
    }
  });

  // Process WebSocket messages to update state
  const processMessage = useCallback((msg: WsMessage) => {
    switch (msg.type) {
      case 'STATE_SYNC':
        setState(msg.state);
        setPositions(msg.positions);
        setInitialized(true);
        if (msg.state.market) {
          setPrices(calculatePrices(msg.state.market));
        }
        break;

      case 'POSITION_ADDED':
        setPositions((prev) => [...prev, msg.position]);
        setState((prev) => {
          if (!prev) return prev;
          const open = (prev.sessionCounts?.open ?? 0) + 1;
          return {
            ...prev,
            positionCount: msg.positionCount,
            sessionCounts: { open, settled: prev.sessionCounts?.settled ?? 0 },
          };
        });
        break;

      case 'CONNECTION_COUNT':
        setState((prev) =>
          prev ? { ...prev, connectionCount: msg.count } : prev
        );
        break;

      case 'MARKET_STATUS':
        setState((prev) => {
          if (!prev) return prev;
          const isNewMarket = !prev.market || prev.market.id !== msg.marketId;
          if (isNewMarket) {
            setPositions([]);
            setPositionsScrollOffset(0);
            setPrices({ priceBall: 0.5, priceStrike: 0.5 });
            return {
              ...prev,
              market: {
                id: msg.marketId,
                status: msg.status,
                outcome: msg.outcome ?? null,
                qBall: 0,
                qStrike: 0,
                b: 100,
              },
              positionCount: 0,
            };
          }
          return {
            ...prev,
            market: {
              ...prev.market!,
              id: msg.marketId,
              status: msg.status,
              outcome: msg.outcome ?? prev.market!.outcome,
            },
          };
        });
        break;

      case 'GAME_STATE':
        setState((prev) =>
          prev ? { ...prev, gameState: { active: msg.active } } : prev
        );
        break;

      case 'ODDS_UPDATE':
        setPrices({
          priceBall: msg.priceBall,
          priceStrike: msg.priceStrike,
        });
        if (msg.qBall !== undefined && msg.qStrike !== undefined) {
          setState((prev) => {
            if (!prev?.market) return prev;
            return {
              ...prev,
              market: {
                ...prev.market,
                qBall: msg.qBall,
                qStrike: msg.qStrike,
              },
            };
          });
        }
        break;

      case 'SESSION_SETTLED':
        setPositions((prev) =>
          prev.map((p) =>
            p.appSessionId === msg.appSessionId
              ? { ...p, sessionStatus: msg.status }
              : p
          )
        );
        setState((prev) => {
          if (!prev) return prev;
          const open = (prev.sessionCounts?.open ?? 0) - 1;
          const settled = (prev.sessionCounts?.settled ?? 0) + 1;
          return {
            ...prev,
            sessionCounts: { open: Math.max(0, open), settled },
          };
        });
        break;

      case 'BET_RESULT':
        break;
    }
  }, []);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      if (lastMessage.type !== 'STATE_SYNC' && lastMessage.type !== 'CONNECTION_COUNT') {
        const entry: EventLogEntry = {
          timestamp: new Date(),
          type: lastMessage.type,
          message: formatWsMessage(lastMessage),
          raw: lastMessage,
        };

        setEvents((prev) => {
          const next = [...prev, entry];
          if (next.length > MAX_EVENT_LOG_SIZE) {
            return next.slice(-MAX_EVENT_LOG_SIZE);
          }
          return next;
        });

        // Auto-scroll event log to bottom if user hasn't manually scrolled
        if (!userScrolledRef.current) {
          setEventLogScrollOffset((prev) => {
            // Will be recalculated on next render, but set to a large value
            // to keep at bottom
            return Number.MAX_SAFE_INTEGER;
          });
        }
      }

      processMessage(lastMessage);
    }
  }, [lastMessage, processMessage]);

  // Clamp event log scroll offset when events change
  useEffect(() => {
    if (!userScrolledRef.current) {
      const maxOffset = Math.max(0, events.length - eventLogVisibleCount);
      setEventLogScrollOffset(maxOffset);
    }
  }, [events.length, eventLogVisibleCount]);

  // Reset state on disconnect
  useEffect(() => {
    if (!connected) {
      setInitialized(false);
    }
  }, [connected]);

  // Cleanup status timeout on unmount
  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, []);

  // Mode indicator for header
  const modeLabel =
    uiMode === 'help' ? ' [HELP]' :
    uiMode === 'command' ? ' [COMMAND]' : '';

  return (
    <Box flexDirection="column" height={rows}>
      {/* Header */}
      <Box
        borderStyle="double"
        paddingX={2}
        justifyContent="space-between"
        flexShrink={0}
      >
        <Text bold color="cyan">
          PULSEPLAY DEVELOPER DASHBOARD{modeLabel}
        </Text>
        <Text color="gray">
          {activePanel === 'positions' ? '[Positions]' : '[Event Log]'}
        </Text>
      </Box>

      {/* Main content */}
      {uiMode === 'help' ? (
        <HelpOverlay height={rows - 4} />
      ) : (
        <Box flexGrow={1}>
          {/* Left column */}
          <Box flexDirection="column" width="50%">
            <MarketPanel
              state={state}
              priceBall={prices.priceBall}
              priceStrike={prices.priceStrike}
              barWidth={barWidth}
            />
            <PositionsPanel
              positions={positions}
              scrollOffset={positionsScrollOffset}
              visibleCount={positionsVisibleCount}
              isActive={activePanel === 'positions'}
            />
          </Box>

          {/* Right column */}
          <Box flexDirection="column" width="50%">
            <SystemInfo
              wsConnected={connected}
              wsError={wsError}
              reconnectAttempts={reconnectAttempts}
              state={state}
              adminError={null}
              adminLoading={!initialized && connected}
            />
            <EventLog
              events={events}
              scrollOffset={eventLogScrollOffset}
              visibleCount={eventLogVisibleCount}
              isActive={activePanel === 'eventLog'}
            />
          </Box>
        </Box>
      )}

      {/* Footer */}
      <Box flexShrink={0}>
        <CommandBar
          mode={uiMode === 'command' ? 'command' : 'normal'}
          commandBuffer={commandBuffer}
          statusMessage={statusMessage}
          wsUrl={wsUrl}
        />
      </Box>
    </Box>
  );
}
