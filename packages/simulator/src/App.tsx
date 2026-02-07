import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { useWebSocket } from './hooks/useWebSocket.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { Header } from './components/Header.js';
import { WalletTable } from './components/WalletTable.js';
import { MarketPanel } from './components/MarketPanel.js';
import { EventLog } from './components/EventLog.js';
import { CommandBar } from './components/CommandBar.js';
import { ResultsPanel } from './components/ResultsPanel.js';
import { HelpOverlay } from './components/HelpOverlay.js';
import { WalletManager } from './core/wallet-manager.js';
import { HubClient } from './core/hub-client.js';
import { ClearnodePool } from './core/clearnode-pool.js';
import { SimulationEngine } from './core/simulation-engine.js';
import { formatWsMessage, formatSimEvent } from './utils/formatters.js';
import type {
  EventLogEntry,
  WsMessage,
  AdminStateResponse,
  SimWalletRow,
  SimStatus,
  SimConfig,
  SimResults,
  SimEvent,
  Position,
} from './types.js';
import { DEFAULT_SIM_CONFIG } from './types.js';

interface AppProps {
  wsUrl: string;
  hubRestUrl: string;
  clearnodeUrl: string;
}

type UIMode = 'normal' | 'command' | 'help';
type ActivePanel = 'wallets' | 'eventLog';

const MAX_EVENT_LOG_SIZE = 100;

function calculatePrices(market: { qBall: number; qStrike: number; b: number } | null) {
  if (!market) return { priceBall: 0.5, priceStrike: 0.5 };
  const { qBall, qStrike, b } = market;
  const maxQ = Math.max(qBall, qStrike);
  const expBall = Math.exp((qBall - maxQ) / b);
  const expStrike = Math.exp((qStrike - maxQ) / b);
  const sumExp = expBall + expStrike;
  return { priceBall: expBall / sumExp, priceStrike: expStrike / sumExp };
}

export function App({ wsUrl, hubRestUrl, clearnodeUrl }: AppProps) {
  const { exit } = useApp();
  const { columns, rows } = useTerminalSize();

  // Core modules (stable refs)
  const walletManager = useRef(new WalletManager()).current;
  const hubClient = useRef(new HubClient({ restUrl: hubRestUrl })).current;
  const clearnodePool = useRef(new ClearnodePool({ clearnodeUrl })).current;
  const simEngine = useRef(
    new SimulationEngine({ walletManager, hubClient, clearnodePool }),
  ).current;

  // Core state
  const [wallets, setWallets] = useState<SimWalletRow[]>([]);
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [prices, setPrices] = useState({ priceBall: 0.5, priceStrike: 0.5 });
  const [adminState, setAdminState] = useState<AdminStateResponse | null>(null);
  const [simStatus, setSimStatus] = useState<SimStatus>('idle');
  const [results, setResults] = useState<SimResults | null>(null);
  const [mmBalance, setMmBalance] = useState<string | null>(null);

  // UI state
  const [uiMode, setUiMode] = useState<UIMode>('normal');
  const [activePanel, setActivePanel] = useState<ActivePanel>('wallets');
  const [walletsScrollOffset, setWalletsScrollOffset] = useState(0);
  const [eventLogScrollOffset, setEventLogScrollOffset] = useState(0);
  const [commandBuffer, setCommandBuffer] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);

  const userScrolledRef = useRef(false);
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket connection
  const { connected, lastMessage, error: wsError, reconnect } = useWebSocket(wsUrl);

  // Layout calculations — top/bottom split
  const topHeight = Math.max(Math.floor((rows - 4) * 0.5), 6); // ~50% for wallets+market
  const bottomHeight = Math.max(rows - 4 - topHeight, 4);       // remaining for event log
  const walletsVisibleCount = Math.max(topHeight - 3, 1);        // header + border rows
  const eventLogVisibleCount = Math.max(bottomHeight - 2, 1);
  const barWidth = Math.max(Math.floor(columns * 0.45) - 6, 10);

  // Refresh MM balance from hub
  const refreshMMBalance = useCallback(async () => {
    try {
      const info = await hubClient.getMMInfo();
      setMmBalance(info.balance);
    } catch { /* non-critical */ }
  }, [hubClient]);

  // Show status message for 2 seconds
  const showStatus = useCallback((msg: string) => {
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    setStatusMessage(msg);
    statusTimeoutRef.current = setTimeout(() => setStatusMessage(null), 2000);
  }, []);

  // Add event to log
  const addEvent = useCallback((type: string, message: string, raw?: WsMessage | SimEvent) => {
    const entry: EventLogEntry = { timestamp: new Date(), type, message, raw };
    setEvents((prev) => {
      const next = [...prev, entry];
      return next.length > MAX_EVENT_LOG_SIZE ? next.slice(-MAX_EVENT_LOG_SIZE) : next;
    });
    if (!userScrolledRef.current) {
      setEventLogScrollOffset(Number.MAX_SAFE_INTEGER);
    }
  }, []);

  // Wire up sim engine events
  useEffect(() => {
    simEngine.setOnEvent((event: SimEvent) => {
      addEvent(event.type, formatSimEvent(event), event);
      setSimStatus(simEngine.getStatus());
      setWallets(walletManager.getAll());
    });
  }, [simEngine, walletManager, addEvent]);

  // Command execution
  const executeCommand = useCallback(async (cmd: string) => {
    const parts = cmd.trim().split(/\s+/);
    const command = parts[0]?.toLowerCase();

    try {
      switch (command) {
        case 'wallets': {
          const count = parseInt(parts[1], 10);
          if (!count || count < 1 || count > 50) {
            showStatus('Usage: :wallets <1-50>');
            return;
          }
          const newWallets = walletManager.generateWallets(count);
          for (const w of newWallets) {
            clearnodePool.addWallet(w.privateKey, w.address);
          }
          setWallets(walletManager.getAll());
          showStatus(`Generated ${count} wallets`);
          addEvent('sim-started', `Generated ${count} wallets`);
          break;
        }

        case 'fund': {
          const all = walletManager.getAll();
          if (all.length === 0) {
            showStatus('No wallets. Run :wallets <n> first');
            return;
          }
          setLoadingMessage(`Funding 0/${all.length}...`);

          const BATCH_SIZE = 2;
          let funded = 0;
          for (let i = 0; i < all.length; i += BATCH_SIZE) {
            const batch = all.slice(i, i + BATCH_SIZE);
            const results = await Promise.allSettled(
              batch.map(async (w) => {
                await hubClient.fundUser(w.address, 5);
                walletManager.markFunded(w.index);
                // Fetch real balance from Clearnode (with fallback)
                try {
                  const balance = await clearnodePool.getBalance(w.address);
                  walletManager.updateBalance(w.index, balance);
                } catch {
                  walletManager.updateBalance(w.index, '50000000');
                }
                return w.index;
              }),
            );
            for (const r of results) {
              if (r.status === 'fulfilled') {
                funded++;
                addEvent('wallet-funded', `Wallet #${r.value} funded`);
              } else {
                addEvent('fund-error', `Fund failed: ${r.reason?.message ?? 'unknown'}`);
              }
            }
            setWallets(walletManager.getAll()); // Update UI after each batch
            setLoadingMessage(`Funding ${funded}/${all.length}...`);
            // Inter-batch delay to avoid overwhelming the external faucet
            if (i + BATCH_SIZE < all.length) {
              await new Promise((r) => setTimeout(r, 1000));
            }
          }
          setLoadingMessage(null);
          showStatus(`Funded ${funded}/${all.length} wallets`);
          break;
        }

        case 'fund-mm': {
          const count = parseInt(parts[1], 10) || 5;
          setLoadingMessage(`Funding MM (${count} x $10)...`);
          try {
            await hubClient.fundMM(count);
            await refreshMMBalance();
            setLoadingMessage(null);
            showStatus(`MM funded (${count} x $10)`);
            addEvent('wallet-funded', `MM funded (${count} x $10)`);
          } catch (err) {
            setLoadingMessage(null);
            showStatus(`MM fund failed: ${(err as Error).message}`);
          }
          break;
        }

        case 'open': {
          showStatus('Activating game & opening market...');
          await hubClient.setGameState(true);
          await hubClient.openMarket();
          setResults(null);
          // showStatus(`Market ${res.market.id} opened`);
          break;
        }

        case 'close': {
          await hubClient.closeMarket();
          showStatus('Market closed');
          break;
        }

        case 'resolve': {
          const outcome = parts[1]?.toUpperCase();
          if (outcome !== 'BALL' && outcome !== 'STRIKE') {
            showStatus('Usage: :resolve ball|strike');
            return;
          }
          simEngine.stop();
          setSimStatus('idle');
          await hubClient.resolveMarket(outcome);
          await refreshMMBalance();
          showStatus(`Market resolved: ${outcome}`);
          break;
        }

        case 'sim': {
          const sub = parts[1]?.toLowerCase();
          if (sub === 'start') {
            if (!adminState?.market || adminState.market.status !== 'OPEN') {
              showStatus('No open market. Run :open first');
              return;
            }
            let mmAddress: string;
            try {
              const mmInfo = await hubClient.getMMInfo();
              mmAddress = mmInfo.address;
              setMmBalance(mmInfo.balance);
            } catch {
              showStatus('Cannot reach MM. Is hub running?');
              return;
            }
            simEngine.start(adminState.market.id, mmAddress);
            setSimStatus('running');
            showStatus('Simulation started');
          } else if (sub === 'stop') {
            simEngine.stop();
            setSimStatus('idle');
            showStatus('Simulation stopped');
          } else if (sub === 'config') {
            if (parts.length > 2) {
              // Parse key=value pairs
              const updates: Partial<SimConfig> = {};
              for (let i = 2; i < parts.length; i++) {
                const [key, val] = parts[i].split('=');
                if (key && val) {
                  (updates as any)[key] = parseFloat(val);
                }
              }
              simEngine.setConfig(updates);
              showStatus('Config updated');
            } else {
              const config = simEngine.getConfig();
              showStatus(`bias=${config.ballBias} amt=${config.betAmountMin}-${config.betAmountMax} delay=${config.delayMinMs}-${config.delayMaxMs} max=${config.maxBetsPerWallet}`);
            }
          } else {
            showStatus('Usage: :sim start|stop|config');
          }
          break;
        }

        case 'status': {
          try {
            const state = await hubClient.getState();
            const status = state.market
              ? `Market: ${state.market.id} [${state.market.status}] Positions: ${state.positionCount} WS: ${state.connectionCount}`
              : 'No market active';
            showStatus(status);
            // Refresh MM balance (non-blocking)
            refreshMMBalance();
            // Refresh balances for all funded wallets (non-blocking)
            const allWallets = walletManager.getAll();
            const fundedWallets = allWallets.filter((w) => w.funded);
            if (fundedWallets.length > 0) {
              Promise.allSettled(
                fundedWallets.map(async (w) => {
                  const balance = await clearnodePool.getBalance(w.address);
                  walletManager.updateBalance(w.index, balance);
                }),
              ).then(() => setWallets(walletManager.getAll()));
            }
          } catch (err) {
            showStatus(`Status failed: ${(err as Error).message}`);
          }
          break;
        }

        case 'reset': {
          simEngine.stop();
          setSimStatus('idle');
          clearnodePool.clear();
          walletManager.clear();
          setWallets([]);
          setResults(null);
          setEvents([]);
          try {
            await hubClient.resetBackend();
            await refreshMMBalance();
            showStatus('Backend reset complete');
          } catch (err) {
            showStatus(`Reset failed: ${(err as Error).message}`);
          }
          break;
        }

        case 'clear':
        case 'c': {
          setEvents([]);
          setEventLogScrollOffset(0);
          showStatus('Event log cleared');
          break;
        }

        case 'reconnect': {
          reconnect();
          showStatus('Reconnecting...');
          break;
        }

        case 'quit':
        case 'q': {
          simEngine.stop();
          clearnodePool.clear();
          exit();
          break;
        }

        default:
          showStatus(`Unknown command: ${cmd}`);
      }
    } catch (err) {
      showStatus(`Error: ${(err as Error).message}`);
    }
  }, [walletManager, hubClient, clearnodePool, simEngine, adminState, showStatus, addEvent, reconnect, exit, refreshMMBalance]);

  // Input routing
  useInput((input, key) => {
    if (uiMode === 'help') {
      if (input === '?' || key.escape) setUiMode('normal');
      return;
    }

    if (uiMode === 'command') {
      if (key.escape) { setUiMode('normal'); setCommandBuffer(''); return; }
      if (key.return) {
        executeCommand(commandBuffer);
        setUiMode('normal');
        setCommandBuffer('');
        return;
      }
      if (key.backspace || key.delete) { setCommandBuffer((p) => p.slice(0, -1)); return; }
      if (input && !key.ctrl && !key.meta) { setCommandBuffer((p) => p + input); }
      return;
    }

    // Normal mode
    if (input === 'q') { simEngine.stop(); clearnodePool.clear(); exit(); return; }
    if (input === '?') { setUiMode('help'); return; }
    if (input === ':') { setUiMode('command'); setCommandBuffer(''); return; }
    if (key.tab) { setActivePanel((p) => p === 'wallets' ? 'eventLog' : 'wallets'); return; }

    const scrollDown = input === 'j' || key.downArrow;
    const scrollUp = input === 'k' || key.upArrow;
    const goTop = input === 'g';
    const goBottom = input === 'G';

    if (activePanel === 'wallets') {
      const maxOffset = Math.max(0, wallets.length - walletsVisibleCount);
      if (scrollDown) setWalletsScrollOffset((p) => Math.min(p + 1, maxOffset));
      else if (scrollUp) setWalletsScrollOffset((p) => Math.max(p - 1, 0));
      else if (goTop) setWalletsScrollOffset(0);
      else if (goBottom) setWalletsScrollOffset(maxOffset);
    } else {
      const maxOffset = Math.max(0, events.length - eventLogVisibleCount);
      if (scrollDown) { setEventLogScrollOffset((p) => Math.min(p + 1, maxOffset)); userScrolledRef.current = true; }
      else if (scrollUp) { setEventLogScrollOffset((p) => Math.max(p - 1, 0)); userScrolledRef.current = true; }
      else if (goTop) { setEventLogScrollOffset(0); userScrolledRef.current = true; }
      else if (goBottom) { setEventLogScrollOffset(maxOffset); userScrolledRef.current = false; }
    }
  });

  // Process WebSocket messages
  const processMessage = useCallback((msg: WsMessage) => {
    switch (msg.type) {
      case 'STATE_SYNC':
        setAdminState(msg.state);
        if (msg.state.market) setPrices(calculatePrices(msg.state.market));
        break;
      case 'ODDS_UPDATE':
        setPrices({ priceBall: msg.priceBall, priceStrike: msg.priceStrike });
        if (msg.qBall !== undefined && msg.qStrike !== undefined) {
          setAdminState((prev) => {
            if (!prev?.market) return prev;
            return { ...prev, market: { ...prev.market, qBall: msg.qBall, qStrike: msg.qStrike } };
          });
        }
        break;
      case 'MARKET_STATUS':
        setAdminState((prev) => {
          if (!prev) return prev;
          const isNew = !prev.market || prev.market.id !== msg.marketId;
          if (isNew) {
            setPrices({ priceBall: 0.5, priceStrike: 0.5 });
            return {
              ...prev,
              market: { id: msg.marketId, status: msg.status, outcome: msg.outcome ?? null, qBall: 0, qStrike: 0, b: 100 },
              positionCount: 0,
            };
          }
          return {
            ...prev,
            market: { ...prev.market!, id: msg.marketId, status: msg.status, outcome: msg.outcome ?? prev.market!.outcome },
          };
        });
        // Compute results on resolution
        if (msg.status === 'RESOLVED' && msg.outcome) {
          computeResults(msg.marketId, msg.outcome);
          refreshMMBalance();
        }
        break;
      case 'GAME_STATE':
        setAdminState((prev) => prev ? { ...prev, gameState: { active: msg.active } } : prev);
        break;
      case 'POSITION_ADDED':
        setAdminState((prev) => prev ? { ...prev, positionCount: msg.positionCount } : prev);
        // Update wallet bet counts from position address
        const posWallet = walletManager.getByAddress(msg.position.address);
        if (posWallet) {
          setWallets(walletManager.getAll());
        }
        break;
      case 'CONNECTION_COUNT':
        setAdminState((prev) => prev ? { ...prev, connectionCount: msg.count } : prev);
        break;
      case 'BET_RESULT':
        break;
      case 'SESSION_SETTLED':
        refreshMMBalance();
        break;
    }
  }, [walletManager, refreshMMBalance]);

  // Compute results helper
  const computeResults = useCallback(async (marketId: string, outcome: string) => {
    try {
      const { positions } = await hubClient.getPositions(marketId);
      const simWallets = walletManager.getAll();
      const winners: SimResults['winners'] = [];
      const losers: SimResults['losers'] = [];

      for (const pos of positions) {
        const sw = simWallets.find((w) => w.address.toLowerCase() === pos.address.toLowerCase());
        if (!sw) continue;

        if (pos.outcome === outcome) {
          const payout = pos.shares;
          const profit = payout - pos.costPaid;
          winners.push({ walletIndex: sw.index, address: pos.address, payout, profit });
        } else {
          losers.push({ walletIndex: sw.index, address: pos.address, loss: pos.costPaid });
        }
      }

      setResults({
        marketId,
        outcome: outcome as any,
        winners,
        losers,
        totalPayout: winners.reduce((sum, w) => sum + w.payout, 0),
        totalLoss: losers.reduce((sum, l) => sum + l.loss, 0),
      });
    } catch {
      // If we can't fetch positions, skip results
    }
  }, [hubClient, walletManager]);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (lastMessage) {
      if (lastMessage.type !== 'STATE_SYNC' && lastMessage.type !== 'CONNECTION_COUNT') {
        addEvent(lastMessage.type, formatWsMessage(lastMessage), lastMessage);
      }
      processMessage(lastMessage);
    }
  }, [lastMessage, processMessage, addEvent]);

  // Clamp event log scroll
  useEffect(() => {
    if (!userScrolledRef.current) {
      const maxOffset = Math.max(0, events.length - eventLogVisibleCount);
      setEventLogScrollOffset(maxOffset);
    }
  }, [events.length, eventLogVisibleCount]);

  // Fetch MM balance on mount
  useEffect(() => {
    refreshMMBalance();
  }, [refreshMMBalance]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current);
    };
  }, []);

  const marketId = adminState?.market?.id ?? null;
  const marketStatus = adminState?.market?.status ?? null;
  const totalBets = Array.from(simEngine.getBetCounts().values()).reduce((s, c) => s + c, 0);

  return (
    <Box flexDirection="column" height={rows}>
      {/* Header */}
      <Header marketId={marketId} marketStatus={marketStatus} simStatus={simStatus} />

      {/* Main content */}
      {uiMode === 'help' ? (
        <HelpOverlay height={rows - 4} />
      ) : (
        <Box flexDirection="column" flexGrow={1}>
          {/* Top row: wallets (55%) + market/results (45%) side-by-side */}
          <Box height={topHeight}>
            <Box flexDirection="column" width="55%">
              <WalletTable
                wallets={wallets}
                scrollOffset={walletsScrollOffset}
                visibleCount={walletsVisibleCount}
                isActive={activePanel === 'wallets'}
              />
            </Box>
            <Box flexDirection="column" width="45%">
              <MarketPanel
                state={adminState}
                priceBall={prices.priceBall}
                priceStrike={prices.priceStrike}
                barWidth={barWidth}
                betCount={totalBets}
                mmBalance={mmBalance}
              />
              <ResultsPanel results={results} />
            </Box>
          </Box>

          {/* Bottom row: full-width event log */}
          <Box flexGrow={1}>
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
          loadingMessage={loadingMessage}
          simStatus={simStatus}
          wsConnected={connected}
        />
      </Box>
    </Box>
  );
}
