// ---------------------------------------------------------------------------
// PulsePlay Hub Logger
// Zero-dependency, ANSI-colored terminal output with visual hierarchy.
// Auto-silent in test environments (JEST_WORKER_ID / NODE_ENV=test).
// ---------------------------------------------------------------------------

// ── ANSI escape codes ──────────────────────────────────────────────────────
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const WHITE = '\x1b[37m';

// ── Silent detection ───────────────────────────────────────────────────────
const silent =
  !!process.env.JEST_WORKER_ID || process.env.NODE_ENV === 'test';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Timestamp in [HH:MM:SS] format, dimmed. */
function ts(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${DIM}[${h}:${m}:${s}]${RESET}`;
}

/** Truncate an address for display: 0x1234...abc */
function addr(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** Color a status code: green 2xx, yellow 4xx, red 5xx. */
function statusColor(code: number): string {
  if (code < 300) return `${GREEN}${code}${RESET}`;
  if (code < 500) return `${YELLOW}${code}${RESET}`;
  return `${RED}${BOLD}${code}${RESET}`;
}

/** Indentation that aligns with the timestamp prefix. */
const INDENT = '           ';

function write(line: string): void {
  process.stdout.write(line + '\n');
}

// ── Logger ─────────────────────────────────────────────────────────────────

export const logger = {
  // ── Startup ────────────────────────────────────────────────────────────

  startup(port: number): void {
    if (silent) return;
    write('');
    write(`${ts()} ${BOLD}${MAGENTA}◆${RESET} ${BOLD}PulsePlay Hub v0.1.0${RESET}`);
    write(`${ts()} ${BOLD}${MAGENTA}◆${RESET} Listening on ${CYAN}http://0.0.0.0:${port}${RESET}`);
    write('');
  },

  // ── Request / Response lifecycle ───────────────────────────────────────

  request(method: string, path: string, statusCode: number, durationMs: number): void {
    if (silent) return;
    const m = `${BOLD}${WHITE}${method.padEnd(6)}${RESET}`;
    const p = `${WHITE}${path}${RESET}`;
    const s = statusColor(statusCode);
    const d = `${DIM}(${durationMs}ms)${RESET}`;
    write(`${ts()} ${m} ${p} ${DIM}->${RESET} ${s} ${d}`);
  },

  // ── Bet events ─────────────────────────────────────────────────────────

  betPlaced(
    address: string,
    amount: number,
    outcome: string,
    marketId: string,
    shares: number,
    priceBall: number,
    priceStrike: number,
  ): void {
    if (silent) return;
    const a = `${MAGENTA}${addr(address)}${RESET}`;
    const amt = `${GREEN}$${amount.toFixed(2)}${RESET}`;
    const out = `${BOLD}${WHITE}${outcome}${RESET}`;
    const mid = `${BLUE}${marketId}${RESET}`;
    write(`${INDENT}${DIM}├${RESET} ${a} bet ${amt} on ${out} (${mid})`);

    const sh = shares.toFixed(2);
    const pb = `Ball: ${(priceBall * 100).toFixed(1)}%`;
    const ps = `Strike: ${(priceStrike * 100).toFixed(1)}%`;
    write(`${INDENT}${DIM}├${RESET} Shares: ${sh} ${DIM}|${RESET} ${pb} ${DIM}|${RESET} ${ps}`);
  },

  betRejected(address: string, reason: string): void {
    if (silent) return;
    const a = `${MAGENTA}${addr(address)}${RESET}`;
    write(`${INDENT}${DIM}└${RESET} ${YELLOW}Rejected${RESET} ${a}: ${reason}`);
  },

  // ── Market lifecycle ───────────────────────────────────────────────────

  marketOpened(marketId: string): void {
    if (silent) return;
    const mid = `${BLUE}${marketId}${RESET}`;
    write(`${INDENT}${DIM}├${RESET} Market ${mid} ${GREEN}${BOLD}OPEN${RESET}`);
  },

  marketClosed(marketId: string): void {
    if (silent) return;
    const mid = `${BLUE}${marketId}${RESET}`;
    write(`${INDENT}${DIM}├${RESET} Market ${mid} ${YELLOW}${BOLD}CLOSED${RESET}`);
  },

  marketResolved(
    marketId: string,
    outcome: string,
    winners: number,
    losers: number,
    totalPayout: number,
  ): void {
    if (silent) return;
    const mid = `${BLUE}${marketId}${RESET}`;
    const out = `${BOLD}${WHITE}${outcome}${RESET}`;
    write(`${INDENT}${DIM}├${RESET} Resolved ${mid} -> ${out}`);
    const pay = `${GREEN}$${totalPayout.toFixed(2)}${RESET}`;
    write(`${INDENT}${DIM}├${RESET} Winners: ${winners} ${DIM}|${RESET} Losers: ${losers} ${DIM}|${RESET} Payout: ${pay}`);
  },

  // ── Game state ─────────────────────────────────────────────────────────

  gameStateChanged(active: boolean): void {
    if (silent) return;
    const state = active
      ? `${GREEN}${BOLD}ACTIVE${RESET}`
      : `${YELLOW}${BOLD}INACTIVE${RESET}`;
    write(`${INDENT}${DIM}└${RESET} Game -> ${state}`);
  },

  // ── Faucet ─────────────────────────────────────────────────────────────

  faucetMM(success: boolean, count: number = 1, error?: string): void {
    if (silent) return;
    if (success) {
      write(`${INDENT}${DIM}└${RESET} ${GREEN}MM faucet funded${RESET} ${DIM}(${count}x)${RESET}`);
    } else {
      write(`${INDENT}${DIM}└${RESET} ${RED}${BOLD}ERROR${RESET}: MM faucet failed — ${error ?? 'unknown'} ${DIM}(${count}x requested)${RESET}`);
    }
  },

  mmInfoFetched(): void {
    if (silent) return;
    write(`${INDENT}${DIM}└${RESET} ${CYAN}MM info fetched${RESET}`);
  },

  faucetUser(address: string, count: number = 1, error?: string): void {
    if (silent) return;
    const a = `${MAGENTA}${addr(address)}${RESET}`;
    if (!error) {
      write(`${INDENT}${DIM}└${RESET} ${GREEN}User faucet funded${RESET} ${a} ${DIM}(${count}x)${RESET}`);
    } else {
      write(`${INDENT}${DIM}└${RESET} ${RED}${BOLD}ERROR${RESET}: User faucet failed ${a} — ${error} ${DIM}(${count}x requested)${RESET}`);
    }
  },

  // ── Admin ──────────────────────────────────────────────────────────────

  adminReset(): void {
    if (silent) return;
    write(`${INDENT}${DIM}└${RESET} ${YELLOW}System reset to clean state${RESET}`);
  },

  configUpdated(key: string, value: unknown): void {
    if (silent) return;
    write(`${INDENT}${DIM}└${RESET} ${YELLOW}Config: ${key} = ${value}${RESET}`);
  },

  // ── Clearnode ────────────────────────────────────────────────────────

  clearnodeAutoConnect(): void {
    if (silent) return;
    write(`${ts()} ${BOLD}${CYAN}◆${RESET} Clearnode auto-connecting...`);
  },

  clearnodeConnected(address: string): void {
    if (silent) return;
    write(`${ts()} ${BOLD}${GREEN}◆${RESET} Clearnode connected as ${MAGENTA}${addr(address)}${RESET}`);
  },

  clearnodeDisconnected(): void {
    if (silent) return;
    write(`${ts()} ${BOLD}${YELLOW}◆${RESET} Clearnode ${YELLOW}disconnected${RESET} — running in degraded mode`);
  },

  // ── WebSocket ──────────────────────────────────────────────────────────

  wsConnect(address: string | null, totalConnections: number): void {
    if (silent) return;
    const who = address ? `${MAGENTA}${addr(address)}${RESET}` : `${DIM}anonymous${RESET}`;
    const count = `${DIM}(${totalConnections} total)${RESET}`;
    write(`${ts()} ${CYAN}${BOLD}WS${RESET}  ${DIM}<-${RESET} ${who} ${GREEN}connected${RESET} ${count}`);
  },

  wsDisconnect(address: string | null, totalConnections: number): void {
    if (silent) return;
    const who = address ? `${MAGENTA}${addr(address)}${RESET}` : `${DIM}anonymous${RESET}`;
    const count = `${DIM}(${totalConnections} total)${RESET}`;
    write(`${ts()} ${CYAN}${BOLD}WS${RESET}  ${DIM}->${RESET} ${who} ${YELLOW}disconnected${RESET} ${count}`);
  },

  // ── Broadcast / SendTo ─────────────────────────────────────────────────

  broadcast(messageType: string, clientCount: number): void {
    if (silent) return;
    write(`${INDENT}${DIM}└${RESET} ${CYAN}Broadcast${RESET} ${messageType} ${DIM}-> ${clientCount} client${clientCount !== 1 ? 's' : ''}${RESET}`);
  },

  sendTo(address: string, messageType: string): void {
    if (silent) return;
    const a = `${MAGENTA}${addr(address)}${RESET}`;
    write(`${INDENT}${DIM}├${RESET} ${CYAN}->${RESET} ${a}: ${messageType}`);
  },

  // ── Settlement ─────────────────────────────────────────────────────────

  betRejectionSessionClosed(appSessionId: string): void {
    if (silent) return;
    write(`${INDENT}${DIM}├${RESET} ${CYAN}Closed session${RESET} ${DIM}${appSessionId.slice(0, 10)}...${RESET} (bet rejected → funds returned)`);
  },

  resolutionSessionClosed(address: string, appSessionId: string): void {
    if (silent) return;
    const a = `${MAGENTA}${addr(address)}${RESET}`;
    write(`${INDENT}${DIM}├${RESET} ${a} session ${DIM}${appSessionId.slice(0, 10)}...${RESET} ${GREEN}closed${RESET}`);
  },

  betSessionDataUpdated(address: string, appSessionId: string, version: number): void {
    if (silent) return;
    const a = `${MAGENTA}${addr(address)}${RESET}`;
    write(`${INDENT}${DIM}├${RESET} ${a} session ${DIM}${appSessionId.slice(0, 10)}...${RESET} data updated → v${version}`);
  },

  betSessionDataFailed(address: string, appSessionId: string, err: unknown): void {
    if (silent) return;
    const a = `${MAGENTA}${addr(address)}${RESET}`;
    const msg = err instanceof Error ? err.message : String(err);
    write(`${INDENT}${DIM}├${RESET} ${YELLOW}V2 sessionData failed${RESET} ${a} ${DIM}${appSessionId.slice(0, 10)}...${RESET} — ${msg}`);
  },

  resolutionStateUpdate(address: string, appSessionId: string, version: number): void {
    if (silent) return;
    const a = `${MAGENTA}${addr(address)}${RESET}`;
    write(`${INDENT}${DIM}├${RESET} ${a} session ${DIM}${appSessionId.slice(0, 10)}...${RESET} state → v${version}`);
  },

  resolutionTransfer(address: string, amount: number): void {
    if (silent) return;
    const a = `${MAGENTA}${addr(address)}${RESET}`;
    const amt = `${GREEN}$${amount.toFixed(2)}${RESET}`;
    write(`${INDENT}${DIM}├${RESET} ${a} profit transfer ${amt}`);
  },

  // ── P2P Order Book ───────────────────────────────────────────────────

  orderPlaced(address: string, outcome: string, mcps: number, amount: number, orderId: string): void {
    if (silent) return;
    const a = `${MAGENTA}${addr(address)}${RESET}`;
    const out = `${BOLD}${WHITE}${outcome}${RESET}`;
    const amt = `${GREEN}$${amount.toFixed(2)}${RESET}`;
    const price = `${CYAN}@${(mcps * 100).toFixed(0)}¢${RESET}`;
    write(`${INDENT}${DIM}├${RESET} ${a} P2P order ${amt} on ${out} ${price} ${DIM}(${orderId.slice(0, 8)}...)${RESET}`);
  },

  orderFilled(orderId: string, shares: number, price: number, counterparty: string): void {
    if (silent) return;
    const cp = `${MAGENTA}${addr(counterparty)}${RESET}`;
    const sh = `${GREEN}${shares.toFixed(2)}${RESET} shares`;
    const pr = `${CYAN}@${(price * 100).toFixed(1)}¢${RESET}`;
    write(`${INDENT}${DIM}├${RESET} Fill ${sh} ${pr} vs ${cp} ${DIM}(${orderId.slice(0, 8)}...)${RESET}`);
  },

  orderCancelled(orderId: string, address: string): void {
    if (silent) return;
    const a = `${MAGENTA}${addr(address)}${RESET}`;
    write(`${INDENT}${DIM}├${RESET} ${YELLOW}Cancelled${RESET} ${a} order ${DIM}${orderId.slice(0, 8)}...${RESET}`);
  },

  orderExpired(orderId: string): void {
    if (silent) return;
    write(`${INDENT}${DIM}├${RESET} ${DIM}Expired${RESET} order ${DIM}${orderId.slice(0, 8)}...${RESET}`);
  },

  p2pResolutionStart(marketId: string, filledCount: number): void {
    if (silent) return;
    const mid = `${BLUE}${marketId}${RESET}`;
    write(`${INDENT}${DIM}├${RESET} P2P resolution ${mid}: ${filledCount} filled orders`);
  },

  p2pLoserSettled(address: string, loss: number): void {
    if (silent) return;
    const a = `${MAGENTA}${addr(address)}${RESET}`;
    const amt = `${RED}$${loss.toFixed(2)}${RESET}`;
    write(`${INDENT}${DIM}├${RESET} ${a} P2P ${RED}LOSS${RESET} ${amt}`);
  },

  p2pWinnerSettled(address: string, payout: number, profit: number): void {
    if (silent) return;
    const a = `${MAGENTA}${addr(address)}${RESET}`;
    const pay = `${GREEN}$${payout.toFixed(2)}${RESET}`;
    const prof = `${GREEN}+$${profit.toFixed(2)}${RESET}`;
    write(`${INDENT}${DIM}├${RESET} ${a} P2P ${GREEN}WIN${RESET} ${pay} (profit: ${prof})`);
  },

  // ── Errors ─────────────────────────────────────────────────────────────

  error(context: string, err: unknown): void {
    if (silent) return;
    const msg = err instanceof Error ? err.message : String(err);
    write(`${ts()} ${RED}${BOLD}ERROR${RESET} [${context}] ${msg}`);
  },
};
