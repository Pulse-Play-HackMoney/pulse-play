# PulsePlay Simulator

Terminal-based betting simulator for PulsePlay demos. Generates wallets, funds them, controls the oracle, runs automated betting simulations, and displays everything in a fullscreen terminal UI — all while the audience watches the frontend react in real time.

## Why This Exists

For the Hack Money 2026 demo, we need to show multiple users betting on markets simultaneously. Since only one browser wallet can be connected at a time, the simulator provides an out-of-band way to generate betting volume against the hub backend and Clearnode.

## Prerequisites

- Hub backend running (`cd packages/hub && pnpm dev`)
- Network access to Clearnode sandbox (default: `wss://clearnet-sandbox.yellow.com/ws`)

## Installation

From the monorepo root:

```bash
pnpm install
```

## Running

```bash
cd packages/simulator
pnpm dev [hubUrl] [clearnodeUrl]
```

Defaults:
- `hubUrl`: `http://localhost:3001`
- `clearnodeUrl`: `wss://clearnet-sandbox.yellow.com/ws`

Examples:
```bash
pnpm dev
pnpm dev http://localhost:3001
pnpm dev http://localhost:3001 wss://clearnet-sandbox.yellow.com/ws
```

## Tests

```bash
pnpm test
pnpm test:watch
```

## Command Reference

### Simulation

| Command | Description |
|---|---|
| `:wallets <n>` | Generate N wallets (1-50) |
| `:fund` | Fund all wallets via hub faucet ($50 each) |
| `:fund-mm [n]` | Fund market maker ($10 x n, default 5) |
| `:open [sport] [category]` | Open a market (default: `baseball pitching`) |
| `:close` | Close the current market |
| `:resolve <outcome>` | Resolve market with outcome (validated against current category) |
| `:sim start` | Start automated betting |
| `:sim stop` | Stop automated betting |
| `:sim config` | Show current simulation config |
| `:sim config key=val` | Update config (e.g. `outcomeBias=0.7 maxBetsPerWallet=5`) |

### Admin

| Command | Description |
|---|---|
| `:status` | Fetch and display backend state |
| `:reset` | Full reset: stop sim, clear wallets, reset backend |
| `:clear` / `:c` | Clear event log |
| `:reconnect` | Reconnect WebSocket |
| `:quit` / `:q` | Quit simulator |

### Navigation

| Key | Action |
|---|---|
| `Tab` | Switch active panel (Wallets / Event Log) |
| `j` / `k` | Scroll active panel down / up |
| `g` / `G` | Scroll to top / bottom |
| `?` | Toggle help overlay |
| `:` | Enter command mode |
| `Escape` | Cancel command / dismiss help |
| `q` | Quit |

## Demo Walkthrough

1. **Generate wallets**: `:wallets 5` — creates 5 wallets with private keys
2. **Fund wallets**: `:fund` — funds each wallet with $50 via hub faucet
3. **Fund market maker**: `:fund-mm 10` — funds MM with $100
4. **Open market**: `:open` — opens a baseball/pitching market (BALL/STRIKE). Use `:open basketball free_throw` for other sports.
5. **Start simulation**: `:sim start` — wallets begin placing automated bets with random timing
6. **Watch**: observe the wallet table, event log, and odds updating in real time
7. **Stop + close**: `:sim stop` then `:close`
8. **Resolve**: `:resolve BALL` — resolves market (outcome must match current category's outcomes)

## Simulation Config

| Parameter | Default | Description |
|---|---|---|
| `outcomeBias` | `0.5` | Fraction of wallets betting on the first outcome |
| `betAmountMin` | `1.0` | Minimum bet amount ($) |
| `betAmountMax` | `5.0` | Maximum bet amount ($) |
| `delayMinMs` | `1500` | Minimum delay between bets (ms) |
| `delayMaxMs` | `4000` | Maximum delay between bets (ms) |
| `maxBetsPerWallet` | `3` | Max bets per wallet per simulation |

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    SIMULATOR PROCESS                          │
│  WalletManager ─── generates/stores private keys in-memory   │
│  ClearnodePool ─── N lazy WS connections to Clearnode        │
│  HubClient ─────── REST calls to Hub + WS for live updates   │
│  SimulationEngine ── orchestrates timed bets via profiles     │
│  Ink UI ─────────── fullscreen terminal interface             │
└──────────────┬─────────────────────────┬─────────────────────┘
               │ WS per wallet           │ REST + WS
               ▼                         ▼
         Clearnode Sandbox          Hub Backend (localhost:3001)
```

### Layout

```
┌─ Header ─────────────────────────────────────────────────────┐
├──────────────────────────────────┬───────────────────────────┤
│ WalletTable (60%)                │ MarketPanel (40%)         │
│ #  Address    Balance  Side Bets │ + ResultsPanel (resolved) │
│ 1  0x1234..5678 $50.00 BALL 1/3 │ + EventLog                │
│ 2  0x2345..6789 $50.00 STRK 0/3 │                           │
├──────────────────────────────────┴───────────────────────────┤
│ CommandBar                                                    │
└──────────────────────────────────────────────────────────────┘
```

### Core Modules

- **WalletManager** — Generates private keys via viem, tracks balances and betting profiles
- **HubClient** — REST wrapper for all hub API endpoints (bet, faucet, oracle, admin)
- **ClearnodePool** — Per-wallet lazy Clearnode WS connections with EIP-712 auth
- **SimulationEngine** — Orchestrates randomized betting with staggered timers
