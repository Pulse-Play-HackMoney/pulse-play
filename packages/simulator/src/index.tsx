#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './App.js';

// Parse CLI arguments
const args = process.argv.slice(2);

// Default URLs
let hubUrl = 'http://localhost:3001';
let clearnodeUrl = 'wss://clearnet-sandbox.yellow.com/ws';

// Check for help flag
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
PulsePlay Simulator — Terminal-based betting simulator for demos

Usage: pulse-simulator [hubUrl] [clearnodeUrl]

Arguments:
  hubUrl          Hub server URL (default: http://localhost:3001)
  clearnodeUrl    Clearnode WebSocket URL (default: wss://clearnet-sandbox.yellow.com/ws)

Examples:
  pulse-simulator
  pulse-simulator http://localhost:3001
  pulse-simulator http://localhost:3001 wss://clearnet-sandbox.yellow.com/ws

Demo Walkthrough:
  1. :wallets 5          Generate 5 wallets
  2. :fund               Fund all wallets via faucet
  3. :fund-mm            Fund market maker
  4. :open               Activate game + open market
  5. :sim start          Start automated betting
  6. (wait for bets)     Watch wallets place bets
  7. :sim stop           Stop simulation
  8. :close              Close market
  9. :resolve ball       Resolve with outcome

Simulation Commands:
  :wallets <n>           Generate N wallets (1-50)
  :fund                  Fund all wallets ($50 each)
  :fund-mm [n]           Fund market maker ($10 x n, default 5)
  :open                  Set game active + open market
  :close                 Close current market
  :resolve ball|strike   Resolve market
  :sim start             Start automated betting
  :sim stop              Stop automated betting
  :sim config            Show sim config
  :sim config key=val    Update sim config (e.g. ballBias=0.7)
  :status                Show backend state
  :reset                 Full reset (stop sim, clear wallets, reset backend)
  :clear                 Clear event log
  :reconnect             Reconnect WebSocket
  :quit / :q             Quit

Navigation:
  Tab                    Switch active panel (Wallets / Event Log)
  j / k                  Scroll active panel
  g / G                  Top / bottom
  ?                      Toggle help overlay
  :                      Enter command mode
  q                      Quit
`);
  process.exit(0);
}

// Parse positional arguments
if (args.length > 0 && !args[0].startsWith('-')) {
  hubUrl = args[0];
}
if (args.length > 1 && !args[1].startsWith('-')) {
  clearnodeUrl = args[1];
}

// Normalize URLs
hubUrl = hubUrl.replace(/\/$/, '');
const wsUrl = hubUrl.replace(/^http/, 'ws') + '/ws';

// Enter alternate screen buffer + hide cursor
const enterAltScreen = () => {
  process.stdout.write('\x1b[?1049h');
  process.stdout.write('\x1b[?25l');
};

const exitAltScreen = () => {
  process.stdout.write('\x1b[?25h');
  process.stdout.write('\x1b[?1049l');
};

let cleaned = false;
const cleanup = () => {
  if (cleaned) return;
  cleaned = true;
  exitAltScreen();
};

process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
process.on('uncaughtException', (err) => {
  cleanup();
  console.error('Uncaught exception:', err);
  process.exit(1);
});

enterAltScreen();

const { waitUntilExit } = render(
  <App wsUrl={wsUrl} hubRestUrl={hubUrl} clearnodeUrl={clearnodeUrl} />
);

waitUntilExit().then(() => {
  cleanup();
  process.exit(0);
});
