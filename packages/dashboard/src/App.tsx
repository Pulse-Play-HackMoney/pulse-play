import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { useWebSocket } from './hooks/useWebSocket.js';
import { MarketPanel } from './components/MarketPanel.js';
import { PositionsPanel } from './components/PositionsPanel.js';
import { EventLog } from './components/EventLog.js';
import { SystemInfo } from './components/SystemInfo.js';
import { formatWsMessage } from './utils/formatters.js';
import type {
  EventLogEntry,
  WsMessage,
  AdminStateResponse,
  Position,
} from './types.js';

interface AppProps {
  wsUrl: string;
}

const MAX_EVENT_LOG_SIZE = 100;

// Calculate prices from market quantities
function calculatePrices(market: { qBall: number; qStrike: number; b: number } | null) {
  if (!market) {
    return { priceBall: 0.5, priceStrike: 0.5 };
  }

  const { qBall, qStrike, b } = market;
  // LMSR price calculation: exp(qi/b) / sum(exp(qj/b))
  const maxQ = Math.max(qBall, qStrike);
  const expBall = Math.exp((qBall - maxQ) / b);
  const expStrike = Math.exp((qStrike - maxQ) / b);
  const sumExp = expBall + expStrike;

  return {
    priceBall: expBall / sumExp,
    priceStrike: expStrike / sumExp,
  };
}

export function App({ wsUrl }: AppProps) {
  const { exit } = useApp();
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [prices, setPrices] = useState({ priceBall: 0.5, priceStrike: 0.5 });

  // State derived from WebSocket messages (no more polling)
  const [state, setState] = useState<AdminStateResponse | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Connect to WebSocket for real-time events
  const { connected, lastMessage, error: wsError, reconnectAttempts } = useWebSocket(wsUrl);

  // Handle keyboard input
  useInput((input) => {
    if (input === 'q') {
      exit();
    }
  });

  // Process WebSocket messages to update state
  const processMessage = useCallback((msg: WsMessage) => {
    switch (msg.type) {
      case 'STATE_SYNC':
        // Full state sync on connect
        setState(msg.state);
        setPositions(msg.positions);
        setInitialized(true);
        // Calculate initial prices from state
        if (msg.state.market) {
          setPrices(calculatePrices(msg.state.market));
        }
        break;

      case 'POSITION_ADDED':
        // Add new position to the list
        setPositions((prev) => [...prev, msg.position]);
        // Update position count in state
        setState((prev) =>
          prev ? { ...prev, positionCount: msg.positionCount } : prev
        );
        break;

      case 'CONNECTION_COUNT':
        // Update connection count
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
        // Update game state
        setState((prev) =>
          prev ? { ...prev, gameState: { active: msg.active } } : prev
        );
        break;

      case 'ODDS_UPDATE':
        // Update prices
        setPrices({
          priceBall: msg.priceBall,
          priceStrike: msg.priceStrike,
        });
        break;

      case 'BET_RESULT':
        // Just logged, no state update needed
        break;
    }
  }, []);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      // Add to event log (except STATE_SYNC which is just initialization)
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
      }

      // Process message to update state
      processMessage(lastMessage);
    }
  }, [lastMessage, processMessage]);

  // Reset state on disconnect
  useEffect(() => {
    if (!connected) {
      setInitialized(false);
    }
  }, [connected]);

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box
        borderStyle="double"
        paddingX={2}
        justifyContent="space-between"
      >
        <Text bold color="cyan">
          PULSEPLAY DEVELOPER DASHBOARD
        </Text>
        <Text color="gray">Press 'q' to quit</Text>
      </Box>

      {/* Main content - two columns */}
      <Box>
        {/* Left column */}
        <Box flexDirection="column" width="50%">
          <MarketPanel
            state={state}
            priceBall={prices.priceBall}
            priceStrike={prices.priceStrike}
          />
          <PositionsPanel positions={positions} />
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
          <EventLog events={events} maxDisplay={8} />
        </Box>
      </Box>

      {/* Footer - connection info */}
      <Box paddingX={1}>
        <Text color="gray" dimColor>
          WS: {wsUrl}
        </Text>
      </Box>
    </Box>
  );
}
