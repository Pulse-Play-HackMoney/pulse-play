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

export function App({ wsUrl, hubUrl }: AppProps) {
  const { exit } = useApp();
  const { columns, rows } = useTerminalSize();

  // Core state
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [prices, setPrices] = useState<number[]>([0.5, 0.5]);
  const [outcomes, setOutcomes] = useState<string[]>(['BALL', 'STRIKE']);
  const [quantities, setQuantities] = useState<number[]>([0, 0]);
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
  const { connected, messageQueue, queueVersion, error: wsError, reconnectAttempts, reconnect } = useWebSocket(wsUrl);

  // Layout calculations
  const positionsVisibleCount = Math.max(rows - 21, 1);
  const eventLogVisibleCount = Math.max(rows - 17, 1);
  const barWidth = Math.max(Math.floor(columns / 2) - 6, 10);
  const leftPanelWidth = Math.max(Math.floor(columns / 2) - 4, 10);

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
      case 'games':
        fetch(`${hubUrl}/api/games`)
          .then((r) => r.json())
          .then((data: any) => {
            const games = data.games ?? data;
            if (!Array.isArray(games) || games.length === 0) {
              showStatus('No games found');
              return;
            }
            const lines = games.map((g: any) => `${g.id} [${g.status}] ${g.sportId} — ${g.homeTeam} vs ${g.awayTeam}`);
            showStatus(`${games.length} game(s)`);
            for (const line of lines) {
              setEvents((prev) => [...prev, {
                timestamp: new Date(),
                type: 'INFO',
                message: line,
                raw: { type: 'GAME_STATE', active: true } as any,
              }]);
            }
          })
          .catch((err) => showStatus(`Games fetch failed: ${err.message}`));
        break;
      case 'sports':
        fetch(`${hubUrl}/api/sports`)
          .then((r) => r.json())
          .then((data: any) => {
            const sports = data.sports ?? data;
            if (!Array.isArray(sports) || sports.length === 0) {
              showStatus('No sports found');
              return;
            }
            showStatus(`${sports.length} sport(s)`);
            for (const s of sports) {
              setEvents((prev) => [...prev, {
                timestamp: new Date(),
                type: 'INFO',
                message: `${s.id}: ${s.name} — ${(s.categories ?? []).map((c: any) => `${c.id}(${(c.outcomes ?? []).join('/')})`).join(', ')}`,
                raw: { type: 'GAME_STATE', active: true } as any,
              }]);
            }
          })
          .catch((err) => showStatus(`Sports fetch failed: ${err.message}`));
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
        if (msg.state.prices) {
          setPrices(msg.state.prices);
        }
        if (msg.state.outcomes) {
          setOutcomes(msg.state.outcomes);
        }
        if (msg.state.market?.quantities) {
          setQuantities(msg.state.market.quantities);
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
            const n = outcomes.length || 2;
            setPrices(Array(n).fill(1 / n));
            setQuantities(Array(n).fill(0));
            return {
              ...prev,
              market: {
                id: msg.marketId,
                status: msg.status,
                outcome: msg.outcome ?? null,
                quantities: Array(n).fill(0),
                outcomes: outcomes.length ? outcomes : ['BALL', 'STRIKE'],
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
        setPrices(msg.prices);
        setOutcomes(msg.outcomes);
        setQuantities(msg.quantities);
        setState((prev) => {
          if (!prev?.market) return prev;
          return {
            ...prev,
            market: {
              ...prev.market,
              quantities: msg.quantities,
              outcomes: msg.outcomes,
            },
          };
        });
        break;

      case 'SESSION_VERSION_UPDATED':
        setPositions((prev) =>
          prev.map((p) =>
            p.appSessionId === msg.appSessionId
              ? { ...p, appSessionVersion: msg.version }
              : p
          )
        );
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
  }, [outcomes]);

  // Handle incoming WebSocket messages — drain the queue to avoid dropping messages
  useEffect(() => {
    const messages = messageQueue.current!.splice(0);
    for (const msg of messages) {
      if (msg.type !== 'STATE_SYNC' && msg.type !== 'CONNECTION_COUNT') {
        const entry: EventLogEntry = {
          timestamp: new Date(),
          type: msg.type,
          message: formatWsMessage(msg),
          raw: msg,
        };

        setEvents((prev) => {
          const next = [...prev, entry];
          return next.length > MAX_EVENT_LOG_SIZE ? next.slice(-MAX_EVENT_LOG_SIZE) : next;
        });

        if (!userScrolledRef.current) {
          setEventLogScrollOffset(() => Number.MAX_SAFE_INTEGER);
        }
      }

      processMessage(msg);
    }
  }, [queueVersion, processMessage, messageQueue]);

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
              prices={prices}
              outcomes={outcomes}
              quantities={quantities}
              barWidth={barWidth}
            />
            <PositionsPanel
              positions={positions}
              scrollOffset={positionsScrollOffset}
              visibleCount={positionsVisibleCount}
              isActive={activePanel === 'positions'}
              panelWidth={leftPanelWidth}
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
          state={state}
        />
      </Box>
    </Box>
  );
}
