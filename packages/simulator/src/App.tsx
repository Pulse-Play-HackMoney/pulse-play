import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { useWebSocket } from './hooks/useWebSocket.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { Header } from './components/Header.js';
import { WalletTable } from './components/WalletTable.js';
import { MarketPanel } from './components/MarketPanel.js';
import { EventLog } from './components/EventLog.js';
import { CommandBar } from './components/CommandBar.js';

import { HelpOverlay } from './components/HelpOverlay.js';
import { MarketsOverlay } from './components/MarketsOverlay.js';
import { PositionsPanel, EXPANDED_LINES } from './components/PositionsPanel.js';
import { SystemInfo } from './components/SystemInfo.js';
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
  MarketSummary,
} from './types.js';
import { DEFAULT_SIM_CONFIG } from './types.js';

interface AppProps {
  wsUrl: string;
  hubRestUrl: string;
  clearnodeUrl: string;
}

type UIMode = 'normal' | 'command' | 'help' | 'markets';
type ActivePanel = 'wallets' | 'positions' | 'eventLog';

const MAX_EVENT_LOG_SIZE = 100;

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
  const [prices, setPrices] = useState<number[]>([0.5, 0.5]);
  const [outcomes, setOutcomes] = useState<string[]>(['BALL', 'STRIKE']);
  const [quantities, setQuantities] = useState<number[]>([0, 0]);
  const [adminState, setAdminState] = useState<AdminStateResponse | null>(null);
  const [simStatus, setSimStatus] = useState<SimStatus>('idle');
  const [results, setResults] = useState<SimResults | null>(null);
  const [mmBalance, setMmBalance] = useState<string | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);

  // UI state
  const [uiMode, setUiMode] = useState<UIMode>('normal');
  const [activePanel, setActivePanel] = useState<ActivePanel>('positions');
  const [walletsScrollOffset, setWalletsScrollOffset] = useState(0);
  const [positionsScrollOffset, setPositionsScrollOffset] = useState(0);
  const [eventLogScrollOffset, setEventLogScrollOffset] = useState(0);
  const [commandBuffer, setCommandBuffer] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [positionsSelectedIndex, setPositionsSelectedIndex] = useState(0);
  const [positionsExpandedIndex, setPositionsExpandedIndex] = useState<number | null>(null);
  const [marketsList, setMarketsList] = useState<MarketSummary[]>([]);
  const [marketsSelectedIndex, setMarketsSelectedIndex] = useState(0);

  const userScrolledRef = useRef(false);
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const outcomesRef = useRef(outcomes);
  useEffect(() => { outcomesRef.current = outcomes; }, [outcomes]);

  // WebSocket connection
  const { connected, messageQueue, queueVersion, error: wsError, reconnect } = useWebSocket(wsUrl);

  // Layout calculations — all panels visible
  // Header=1, MarketPanel~5, CommandBar=1 → ~7 fixed rows
  const mainHeight = Math.max(rows - 8, 10);
  const positionsHeight = Math.max(Math.floor(mainHeight * 0.5), 4);
  const eventLogHeight = Math.max(mainHeight - positionsHeight, 4);
  const walletsVisibleCount = Math.max(mainHeight - 5, 1);
  const positionsVisibleCount = Math.max(positionsHeight - 6, 1);
  const eventLogVisibleCount = Math.max(eventLogHeight - 2, 1);
  const barWidth = Math.max(Math.floor(columns * 0.5) - 6, 10);
  const leftPanelWidth = Math.max(Math.floor(columns * 0.5) - 4, 10);

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
            setWallets(walletManager.getAll());
            setLoadingMessage(`Funding ${funded}/${all.length}...`);
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
          // :open [sportId] [categoryId] — defaults to baseball pitching
          const sportId = parts[1] || 'baseball';
          const categoryId = parts[2] || 'pitching';

          setLoadingMessage(`Creating game & opening market (${sportId}/${categoryId})...`);
          try {
            // Fetch category outcomes for this sport
            let categoryOutcomes: string[] = ['BALL', 'STRIKE'];
            try {
              const catRes = await hubClient.getSportCategories(sportId);
              const cat = catRes.categories.find((c) => c.id === categoryId);
              if (cat && cat.outcomes.length > 0) {
                categoryOutcomes = cat.outcomes;
              }
            } catch {
              // Fall back to defaults
            }

            await hubClient.setGameState(true);
            const gameRes = await hubClient.createGame(sportId, 'Demo Home', 'Demo Away');
            await hubClient.activateGame(gameRes.game.id);
            const res = await hubClient.openMarket(gameRes.game.id, categoryId);

            // Store outcomes for resolve validation and sim engine
            setOutcomes(categoryOutcomes);
            const n = categoryOutcomes.length;
            setPrices(Array(n).fill(1 / n));
            setQuantities(Array(n).fill(0));

            // Update sim engine config with current outcomes
            simEngine.setConfig({ outcomes: categoryOutcomes });

            setResults(null);
            setLoadingMessage(null);
            showStatus(`Market ${res.marketId} opened (${categoryOutcomes.join('/')})`);
          } catch (err) {
            setLoadingMessage(null);
            showStatus(`Open failed: ${(err as Error).message}`);
          }
          break;
        }

        case 'close': {
          await hubClient.closeMarket();
          showStatus('Market closed');
          break;
        }

        case 'resolve': {
          const outcome = parts[1]?.toUpperCase();
          if (!outcome || !outcomes.includes(outcome)) {
            showStatus(`Usage: :resolve <${outcomes.join('|').toLowerCase()}>`);
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
              showStatus(`bias=${config.outcomeBias} amt=${config.betAmountMin}-${config.betAmountMax} delay=${config.delayMinMs}-${config.delayMaxMs} max=${config.maxBetsPerWallet} outcomes=${config.outcomes.join('/')}`);
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
            refreshMMBalance();
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
          setOutcomes(['BALL', 'STRIKE']);
          setPrices([0.5, 0.5]);
          setQuantities([0, 0]);
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

        case 'games': {
          try {
            const res = await fetch(`${hubRestUrl}/api/games`);
            const data: any = await res.json();
            const games = data.games ?? data;
            if (!Array.isArray(games) || games.length === 0) {
              showStatus('No games found');
            } else {
              showStatus(`${games.length} game(s)`);
              for (const g of games) {
                addEvent('INFO', `${g.id} [${g.status}] ${g.sportId} — ${g.homeTeam} vs ${g.awayTeam}`);
              }
            }
          } catch (err) {
            showStatus(`Games fetch failed: ${(err as Error).message}`);
          }
          break;
        }

        case 'sports': {
          try {
            const res = await fetch(`${hubRestUrl}/api/sports`);
            const data: any = await res.json();
            const sports = data.sports ?? data;
            if (!Array.isArray(sports) || sports.length === 0) {
              showStatus('No sports found');
            } else {
              showStatus(`${sports.length} sport(s)`);
              for (const s of sports) {
                addEvent('INFO', `${s.id}: ${s.name} — ${(s.categories ?? []).map((c: any) => `${c.id}(${(c.outcomes ?? []).join('/')})`).join(', ')}`);
              }
            }
          } catch (err) {
            showStatus(`Sports fetch failed: ${(err as Error).message}`);
          }
          break;
        }

        case 'markets': {
          try {
            setLoadingMessage('Fetching markets...');
            const res = await hubClient.getMarkets();
            setLoadingMessage(null);
            if (res.markets.length === 0) {
              showStatus('No markets found');
            } else {
              setMarketsList(res.markets);
              setMarketsSelectedIndex(0);
              setUiMode('markets');
            }
          } catch (err) {
            setLoadingMessage(null);
            showStatus(`Markets fetch failed: ${(err as Error).message}`);
          }
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
  }, [walletManager, hubClient, clearnodePool, simEngine, adminState, outcomes, showStatus, addEvent, reconnect, exit, refreshMMBalance, hubRestUrl]);

  // Load a market from the overlay
  const loadMarketFromOverlay = useCallback(async (marketId: string) => {
    try {
      setLoadingMessage('Loading market...');
      const [marketRes, posRes] = await Promise.all([
        hubClient.getMarket(marketId),
        hubClient.getPositions(marketId),
      ]);
      if (marketRes.market) {
        setAdminState((prev) => ({
          ...(prev ?? { gameState: { active: false }, positionCount: 0, connectionCount: 0 }),
          market: {
            id: marketRes.market.id,
            status: marketRes.market.status,
            outcome: marketRes.market.outcome,
            quantities: marketRes.market.quantities ?? [],
            outcomes: marketRes.outcomes ?? [],
            b: marketRes.market.b ?? 100,
            gameId: marketRes.market.gameId,
            categoryId: marketRes.market.categoryId,
          },
          positionCount: posRes.positions.length,
          prices: marketRes.prices,
          outcomes: marketRes.outcomes,
        }));
        setPrices(marketRes.prices);
        setOutcomes(marketRes.outcomes);
        setQuantities(marketRes.market.quantities ?? []);
        setPositions(posRes.positions);
        setPositionsScrollOffset(0);
        setPositionsSelectedIndex(0);
        setPositionsExpandedIndex(null);
      }
      setLoadingMessage(null);
      setUiMode('normal');
      showStatus(`Loaded market ${marketId}`);
    } catch (err) {
      setLoadingMessage(null);
      showStatus(`Load failed: ${(err as Error).message}`);
    }
  }, [hubClient, showStatus]);

  // Input routing
  useInput((input, key) => {
    if (uiMode === 'markets') {
      if (key.escape) { setUiMode('normal'); return; }
      const scrollDown = input === 'j' || key.downArrow;
      const scrollUp = input === 'k' || key.upArrow;
      if (scrollDown) {
        setMarketsSelectedIndex((p) => Math.min(p + 1, marketsList.length - 1));
      } else if (scrollUp) {
        setMarketsSelectedIndex((p) => Math.max(p - 1, 0));
      } else if (key.return) {
        const selected = marketsList[marketsSelectedIndex];
        if (selected) loadMarketFromOverlay(selected.id);
      }
      return;
    }

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
    if (key.tab) {
      setActivePanel((p) => {
        if (p === 'positions') return 'eventLog';
        if (p === 'eventLog') return 'wallets';
        return 'positions';
      });
      return;
    }

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
    } else if (activePanel === 'positions') {
      const maxIndex = Math.max(0, positions.length - 1);
      if (scrollDown) {
        setPositionsSelectedIndex((p) => {
          const next = Math.min(p + 1, maxIndex);
          // Auto-scroll to keep selection visible
          if (next >= positionsScrollOffset + positionsVisibleCount) {
            setPositionsScrollOffset(next - positionsVisibleCount + 1);
          }
          return next;
        });
      } else if (scrollUp) {
        setPositionsSelectedIndex((p) => {
          const next = Math.max(p - 1, 0);
          if (next < positionsScrollOffset) {
            setPositionsScrollOffset(next);
          }
          return next;
        });
      } else if (goTop) {
        setPositionsSelectedIndex(0);
        setPositionsScrollOffset(0);
      } else if (goBottom) {
        setPositionsSelectedIndex(maxIndex);
        setPositionsScrollOffset(Math.max(0, positions.length - positionsVisibleCount));
      } else if (key.return || input === 'e') {
        const isCollapsing = positionsExpandedIndex === positionsSelectedIndex;
        setPositionsExpandedIndex(isCollapsing ? null : positionsSelectedIndex);
        // When expanding, ensure the selected position stays within the effective visible range
        if (!isCollapsing) {
          const effectiveCount = Math.max(positionsVisibleCount - EXPANDED_LINES, 1);
          if (positionsSelectedIndex >= positionsScrollOffset + effectiveCount) {
            setPositionsScrollOffset(positionsSelectedIndex - effectiveCount + 1);
          }
        }
      }
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
        setPositions(msg.positions);
        if (msg.state.prices) setPrices(msg.state.prices);
        if (msg.state.outcomes) setOutcomes(msg.state.outcomes);
        if (msg.state.market?.quantities) setQuantities(msg.state.market.quantities);
        break;
      case 'ODDS_UPDATE':
        setPrices(msg.prices);
        setOutcomes(msg.outcomes);
        setQuantities(msg.quantities);
        setAdminState((prev) => {
          if (!prev?.market) return prev;
          return { ...prev, market: { ...prev.market, quantities: msg.quantities, outcomes: msg.outcomes } };
        });
        break;
      case 'MARKET_STATUS':
        setAdminState((prev) => {
          if (!prev) return prev;
          const isNew = !prev.market || prev.market.id !== msg.marketId;
          if (isNew) {
            setPositions([]);
            setPositionsScrollOffset(0);
            const n = outcomesRef.current.length || 2;
            setPrices(Array(n).fill(1 / n));
            setQuantities(Array(n).fill(0));
            return {
              ...prev,
              market: {
                id: msg.marketId,
                status: msg.status,
                outcome: msg.outcome ?? null,
                quantities: Array(n).fill(0),
                outcomes: outcomesRef.current.length ? outcomesRef.current : ['BALL', 'STRIKE'],
                b: 100,
              },
              positionCount: 0,
            };
          }
          return {
            ...prev,
            market: { ...prev.market!, id: msg.marketId, status: msg.status, outcome: msg.outcome ?? prev.market!.outcome },
          };
        });
        // Compute results on resolution using current local positions
        if (msg.status === 'RESOLVED' && msg.outcome) {
          setPositions((currentPositions) => {
            computeResults(msg.marketId, msg.outcome!, currentPositions);
            return currentPositions;
          });
          refreshMMBalance();
        }
        break;
      case 'GAME_STATE':
        setAdminState((prev) => prev ? { ...prev, gameState: { active: msg.active } } : prev);
        break;
      case 'POSITION_ADDED':
        setAdminState((prev) => {
          if (!prev) return prev;
          const open = (prev.sessionCounts?.open ?? 0) + 1;
          return {
            ...prev,
            positionCount: msg.positionCount,
            sessionCounts: { open, settled: prev.sessionCounts?.settled ?? 0 },
          };
        });
        setPositions((prev) => [...prev, msg.position]);
        if (walletManager.getByAddress(msg.position.address)) {
          // Refresh bettor's balance after bet placement
          clearnodePool.getBalance(msg.position.address as `0x${string}`)
            .then((balance) => {
              const sw = walletManager.getByAddress(msg.position.address);
              if (sw) { walletManager.updateBalance(sw.index, balance); setWallets(walletManager.getAll()); }
            })
            .catch(() => { /* non-fatal */ });
        }
        break;
      case 'CONNECTION_COUNT':
        setAdminState((prev) => prev ? { ...prev, connectionCount: msg.count } : prev);
        break;
      case 'BET_RESULT':
        break;
      case 'SESSION_VERSION_UPDATED':
        setPositions((prev) =>
          prev.map((p) =>
            p.appSessionId === msg.appSessionId
              ? { ...p, appSessionVersion: msg.version, ...(msg.sessionData ? { sessionData: msg.sessionData } : {}) }
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
        setAdminState((prev) => {
          if (!prev) return prev;
          const open = (prev.sessionCounts?.open ?? 0) - 1;
          const settled = (prev.sessionCounts?.settled ?? 0) + 1;
          return {
            ...prev,
            sessionCounts: { open: Math.max(0, open), settled },
          };
        });
        refreshMMBalance();
        // Refresh settled wallet's balance
        if (msg.address && walletManager.getByAddress(msg.address)) {
          clearnodePool.getBalance(msg.address as `0x${string}`)
            .then((balance) => {
              const sw = walletManager.getByAddress(msg.address);
              if (sw) { walletManager.updateBalance(sw.index, balance); setWallets(walletManager.getAll()); }
            })
            .catch(() => { /* non-fatal */ });
        }
        break;
    }
  }, [walletManager, clearnodePool, refreshMMBalance]);

  // Compute results from local positions state (avoids race with hub clearing positions)
  const computeResults = useCallback((marketId: string, outcome: string, localPositions: Position[]) => {
    const simWallets = walletManager.getAll();
    const winners: SimResults['winners'] = [];
    const losers: SimResults['losers'] = [];

    for (const pos of localPositions) {
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
  }, [walletManager]);

  // Drain WebSocket message queue
  useEffect(() => {
    const pending = messageQueue.current!.splice(0);
    for (const msg of pending) {
      if (msg.type !== 'STATE_SYNC' && msg.type !== 'CONNECTION_COUNT') {
        addEvent(msg.type, formatWsMessage(msg), msg);
      }
      processMessage(msg);
    }
  }, [queueVersion, processMessage, addEvent, messageQueue]);

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
      ) : uiMode === 'markets' ? (
        <MarketsOverlay
          markets={marketsList}
          selectedIndex={marketsSelectedIndex}
          height={rows - 4}
        />
      ) : (
        <Box flexDirection="column" flexGrow={1}>
          {/* Main row: left column (55%) + right column (45%) */}
          <Box flexGrow={1}>
            {/* Left column: Positions (top) + EventLog (bottom) */}
            <Box flexDirection="column" width="50%">
              <Box height={positionsHeight}>
                <PositionsPanel
                  positions={positions}
                  scrollOffset={positionsScrollOffset}
                  visibleCount={positionsVisibleCount}
                  isActive={activePanel === 'positions'}
                  panelWidth={leftPanelWidth}
                  selectedIndex={positionsSelectedIndex}
                  expandedIndex={positionsExpandedIndex ?? undefined}
                />
              </Box>
              <Box flexGrow={1}>
                <EventLog
                  events={events}
                  scrollOffset={eventLogScrollOffset}
                  visibleCount={eventLogVisibleCount}
                  isActive={activePanel === 'eventLog'}
                />
              </Box>
            </Box>
            {/* Right column: SystemInfo (fixed) + WalletTable (fills) */}
            <Box flexDirection="column" width="50%">
              <SystemInfo
                wsConnected={connected}
                wsError={wsError}
                state={adminState}
              />
              <MarketPanel
                state={adminState}
                prices={prices}
                outcomes={outcomes}
                quantities={quantities}
                barWidth={barWidth}
                betCount={totalBets}
                mmBalance={mmBalance}
                results={results}
              />
              <WalletTable
                wallets={wallets}
                scrollOffset={walletsScrollOffset}
                visibleCount={walletsVisibleCount}
                isActive={activePanel === 'wallets'}
              />
            </Box>
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
