# PulsePlay Developer Dashboard

A fullscreen terminal-based real-time developer dashboard for observing the PulsePlay hub backend. Built with [Ink](https://github.com/vadimdemedes/ink) (React for CLI).

## Features

- **Fullscreen TUI** with alternate screen buffer (clean terminal on exit)
- **Dynamic sizing** — adapts to terminal resize
- **Panel navigation** — Tab to switch active panel, j/k to scroll
- **Vim-style command bar** — `:clear`, `:reset`, `:reconnect`, `:quit`
- **Help overlay** — press `?` for keybinding reference
- **Visual price bars** — ASCII progress bars for N-outcome odds (dynamic per category)
- Real-time WebSocket event log with auto-scroll
- Market state display with LMSR odds (decimal + American)
- Position tracking with scrollable list
- System status (connections, game state)
- Auto-reconnect on connection loss

## Installation

```bash
# From monorepo root
pnpm install
```

## Usage

### Development

```bash
# Start the hub first (in another terminal)
cd packages/hub && pnpm dev

# Then start the dashboard
cd packages/dashboard && pnpm dev
```

### With Custom Hub URL

```bash
# Connect to a different hub instance
pnpm dev http://localhost:3002

# Or a remote server
pnpm dev http://192.168.1.100:3001
```

### Help

```bash
pnpm dev --help
```

## Layout

```
╔═══════════════════════════════════════════════════════════════════════╗
║  PULSEPLAY DEVELOPER DASHBOARD                        [Event Log]   ║
╚═══════════════════════════════════════════════════════════════════════╝
┌────────── MARKET: market-3 ──────┐ ┌──────────── SYSTEM ────────────┐
│ Status: OPEN                     │ │ WS: Connected                  │
│                                  │ │ API: OK                        │
│ BALL    52.3% (-110)             │ │ Clients: 2                     │
│ ████████████░░░░░░░░░░           │ │ Game: ACTIVE                   │
│                                  │ │ Positions: 5                   │
│ STRIKE  47.7% (+110)             │ └────────────────────────────────┘
│ ██████████░░░░░░░░░░░░           │ ┌──────── EVENT LOG ─────────────┐
│                                  │ │ 14:32:15 [GAME_STATE] ACTIVE   │
│ Quantities: 10.50, -2.30        │ │ 14:32:18 [MARKET] OPEN         │
└──────────────────────────────────┘ │ 14:32:22 [ODDS] Ball: 52.3%    │
┌────── POSITIONS (5) 1-3 of 5 ───┐ │ 14:32:25 [BET] WIN $12.50      │
│ 0x1234.. BALL   12.50 $5.00     │ │ 14:32:30 [POSITION] 0x56..     │
│ 0x5678.. STRIKE  8.30 $4.10     │ │                                 │
│ 0xabcd.. BALL    5.00 $2.75     │ │                                 │
└──────────────────────────────────┘ └─────────────────────────────────┘
 Tab panel  j/k scroll  ? help  : cmd  q quit       WS: ws://localhost:3001/ws
```

## Controls

### Navigation

| Key | Action |
|-----|--------|
| `Tab` | Switch active panel (Positions / Event Log) |
| `j` / `↓` | Scroll down in active panel |
| `k` / `↑` | Scroll up in active panel |
| `g` | Scroll to top |
| `G` | Scroll to bottom |

### Commands

Press `:` to enter command mode, type a command, then press Enter.

| Command | Description |
|---------|-------------|
| `:clear` / `:c` | Clear event log |
| `:reset` / `:r` | Reset backend state (POST /api/admin/reset) |
| `:games` | List games from the hub |
| `:sports` | List sports and categories |
| `:reconnect` | Reconnect WebSocket |
| `:quit` / `:q` | Quit dashboard |

### General

| Key | Action |
|-----|--------|
| `q` | Quit |
| `?` | Toggle help overlay |
| `Escape` | Cancel command / dismiss help |

## Event Types

| Type | Description |
|------|-------------|
| `STATE_SYNC` | Initial state snapshot sent on connect |
| `ODDS_UPDATE` | Market odds changed after a bet |
| `MARKET_STATUS` | Market state changed (PENDING → OPEN → CLOSED → RESOLVED) |
| `GAME_STATE` | Game activated or deactivated |
| `BET_RESULT` | Bettor received win/loss notification |
| `POSITION_ADDED` | New bet position created |
| `CONNECTION_COUNT` | WebSocket client count changed |

## Architecture

The dashboard runs as a separate process and connects to the hub via **WebSocket only** (`ws://host:port/ws`).

All state is derived from WebSocket messages:
- `STATE_SYNC` provides initial state on connection
- Incremental updates via `POSITION_ADDED`, `CONNECTION_COUNT`, etc.
- No REST polling required (reduces backend load)

The dashboard uses an **alternate screen buffer** — when it launches, your terminal history is hidden and the dashboard takes over the full screen. On exit (via `q`, `:quit`, or Ctrl+C), the terminal is restored to its previous state.

## Testing

```bash
pnpm test
```

## Building

```bash
pnpm build
```

After building, you can run with Node directly:

```bash
node dist/index.js
```
