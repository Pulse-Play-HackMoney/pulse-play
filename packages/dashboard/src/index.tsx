#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './App.js';

// Parse CLI arguments
const args = process.argv.slice(2);

// Default URLs
let hubUrl = 'http://localhost:3001';

// Check for help flag
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
PulsePlay Developer Dashboard

Usage: pulse-dashboard [hub-url]

Arguments:
  hub-url    Base URL for the hub server (default: http://localhost:3001)

Examples:
  pulse-dashboard
  pulse-dashboard http://localhost:3001
  pulse-dashboard http://192.168.1.100:3001

Navigation:
  Tab          Switch active panel (Positions / Event Log)
  j / ↓        Scroll down in active panel
  k / ↑        Scroll up in active panel
  g            Scroll to top
  G            Scroll to bottom

Commands:
  :clear       Clear event log
  :reset       Reset backend state
  :reconnect   Reconnect WebSocket
  :quit        Quit dashboard

General:
  q            Quit
  ?            Toggle help overlay
  Escape       Cancel command / dismiss help
`);
  process.exit(0);
}

// Parse hub URL from first positional argument
if (args.length > 0 && !args[0].startsWith('-')) {
  hubUrl = args[0];
}

// Normalize URL (strip trailing slash)
hubUrl = hubUrl.replace(/\/$/, '');

// Derive WebSocket URL from HTTP URL
const wsUrl = hubUrl.replace(/^http/, 'ws') + '/ws';

// Enter alternate screen buffer + hide cursor
const enterAltScreen = () => {
  process.stdout.write('\x1b[?1049h'); // Enter alt screen
  process.stdout.write('\x1b[?25l');   // Hide cursor
};

// Restore normal screen + show cursor
const exitAltScreen = () => {
  process.stdout.write('\x1b[?25h');   // Show cursor
  process.stdout.write('\x1b[?1049l'); // Leave alt screen
};

// Cleanup handler
let cleaned = false;
const cleanup = () => {
  if (cleaned) return;
  cleaned = true;
  exitAltScreen();
};

// Register signal handlers for clean exit
process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});
process.on('uncaughtException', (err) => {
  cleanup();
  console.error('Uncaught exception:', err);
  process.exit(1);
});

// Enter alternate screen before rendering
enterAltScreen();

// Render the app
const { waitUntilExit } = render(
  <App wsUrl={wsUrl} hubUrl={hubUrl} />
);

// Wait for exit
waitUntilExit().then(() => {
  cleanup();
  process.exit(0);
});
