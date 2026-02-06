# Simulator Package — Agent Instructions

## Overview
This is the `packages/simulator/` package — a terminal-based Ink app for generating simulated betting volume during demos.

## Development Practices

- **TDD**: Write tests first, then implement. All core modules have comprehensive test suites.
- **Mock external deps**: WS, viem, and @erc7824/nitrolite are mocked in tests via `src/test/mocks/` and `jest.mock()`.
- **Mirror dashboard patterns**: UI components follow the same conventions as `packages/dashboard/` (presentational components, state in App.tsx, Ink primitives).
- **Progress tracking**: Update `../../progress.txt` when completing significant work.

## Key Files

| File | Purpose |
|---|---|
| `src/core/wallet-manager.ts` | Wallet generation, balance tracking, profile assignment |
| `src/core/hub-client.ts` | REST wrapper for hub endpoints |
| `src/core/clearnode-pool.ts` | Per-wallet Clearnode WS connection management |
| `src/core/simulation-engine.ts` | Automated betting orchestration |
| `src/App.tsx` | Main integration: state, commands, WS messages, layout |
| `src/index.tsx` | Entry point: CLI args, alt-screen, signals |
| `src/types.ts` | All shared types (mirrors hub WsMessage types + sim types) |

## Adding Commands

1. Add the command case in `App.tsx` `executeCommand()`
2. Update the `HelpOverlay.tsx` command reference
3. Update `README.md` command table
4. Add event logging via `addEvent()`

## Adding Components

1. Create in `src/components/`
2. Export from `src/components/index.ts`
3. Wire into `App.tsx` layout

## Test Infrastructure

- Jest config: `jest.config.js` (ts-jest ESM preset)
- Nitrolite mock: `src/test/mocks/nitroliteModule.ts`
- Module mappers handle `.js` extensions and @erc7824/nitrolite

## Important Notes

- Clearnode auth uses the same 3-step EIP-712 flow as the hub (`src/core/clearnode/auth.ts`)
- `sendAndWait` correlates by RPC method name; errors if method === "error"
- WalletManager uses 1-based indices for display
- SimulationEngine is resilient: errors don't stop the simulation
