# PulsePlay MVP Specification

**Version:** 1.0  
**Date:** February 4, 2026  
**Status:** Draft  
**Hackathon:** Hack Money 2026 (January 30 - February 11, 2026)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [User Personas & Workflows](#2-user-personas--workflows)
3. [System Architecture](#3-system-architecture)
4. [Component Specifications](#4-component-specifications)
5. [Data Models](#5-data-models)
6. [API Contracts](#6-api-contracts)
7. [Environment Configuration](#7-environment-configuration)
8. [Demo Requirements](#8-demo-requirements)
9. [Completion Criteria](#9-completion-criteria)
10. [Out of Scope / Future Work](#10-out-of-scope--future-work)

---

## 1. Executive Summary

### 1.1 Product Overview

PulsePlay is a decentralized micro-prediction platform for live sports betting that enables real-time wagering on individual baseball pitch outcomes (Ball vs Strike). The platform leverages Yellow Network's state channel infrastructure to provide instant, gasless betting while maintaining cryptographic guarantees.

### 1.2 Problem Statement

Traditional sports betting platforms suffer from:

- **High fees:** Centralized platforms extract significant margins
- **Slow settlement:** Bets take minutes to hours to confirm
- **Centralized control:** Users must trust the platform with custody of funds
- **Limited micro-betting:** Infrastructure can't support per-pitch wagering at scale

### 1.3 Solution

PulsePlay solves these problems through:

- **State channels:** Yellow Network enables instant, off-chain bet confirmation
- **LMSR pricing:** Logarithmic Market Scoring Rule provides fair, automated odds
- **Non-custodial design:** User funds remain in state channels until settlement
- **Unified balance model:** Seamless UX while maintaining cryptographic security

### 1.4 MVP Scope

The MVP demonstrates the core betting loop:

1. User funds their unified balance
2. User places a bet on a pitch outcome (Ball/Strike)
3. Oracle reports the outcome
4. Market resolves, winners are paid

The MVP targets the **test environment** using Yellow Network's Sandbox Clearnode with test tokens (ytest.usdc). The architecture is designed to seamlessly transition to production.

---

## 2. User Personas & Workflows

### 2.1 Persona Overview

The platform serves four distinct user personas, all accessible from a single frontend application:

| Persona | Primary Actions | Environment |
|---------|-----------------|-------------|
| **Bettor** | Fund balance, place bets, withdraw winnings | Test & Production |
| **Liquidity Provider (LP)** | Deposit/withdraw liquidity, view pool stats | Test & Production |
| **Oracle Operator** | Report pitch outcomes, control game state | Demo/Admin |
| **Admin** | System monitoring, faucet controls, scenario triggers | Demo/Admin |

### 2.2 Bettor Workflow

The bettor is the primary user of the platform.

#### 2.2.1 Authentication Flow

```
1. User visits PulsePlay frontend
2. User clicks "Connect Wallet"
3. MetaMask prompt appears
4. User approves connection
5. Frontend initiates Clearnode WebSocket connection
6. User signs authentication message (one-time)
7. Clearnode returns session key
8. User is now authenticated (wallet address = identity)
```

#### 2.2.2 Funding Flow (Test Environment)

```
1. User clicks "Get Test Funds"
2. Frontend calls faucet endpoint on Hub
3. Hub credits ytest.usdc to user's unified balance via Clearnode
4. User's balance updates in UI
```

#### 2.2.3 Betting Flow

```
1. User views current pitch odds (e.g., Ball: 1.8x, Strike: 2.2x)
2. User selects outcome (Ball or Strike)
3. User enters bet amount
4. User clicks "Place Bet"
5. Frontend creates app session via Clearnode:
   - User allocation: bet amount
   - MM allocation: 0
   - MM has all quorum weight
   - Session data includes outcome selection, market ID, etc.
6. Clearnode creates session, returns app_session_id
7. Frontend calls Hub's /bet endpoint with session details
8. Hub validates bet:
   - Is market open?
   - LMSR calculation for shares
   - Sufficient MM liquidity?
9. If REJECTED: Hub closes session via Clearnode (funds return to user)
10. If ACCEPTED: Hub records position off-chain, keeps session open
11. Frontend displays confirmation and updated odds
12. User's "locked" balance reflects the bet amount
```

#### 2.2.4 Resolution Flow (User Perspective)

```
1. Oracle reports pitch outcome
2. Market closes
3. Hub calculates results
4. If user WON:
   - Hub closes app session
   - Hub transfers winnings from MM to user via Clearnode
   - User's unified balance increases
5. If user LOST:
   - Hub reallocates session (user → MM)
   - Hub closes session
   - User's locked funds are gone
6. Frontend displays result and updated balance
7. New market opens for next pitch
```

#### 2.2.5 Withdrawal Flow

```
1. User clicks "Withdraw"
2. User enters amount (from available balance only)
3. Frontend initiates withdrawal via Clearnode
4. Funds transfer out of unified balance
5. (Production: funds return to user's on-chain wallet)
6. (Test: balance simply decreases)
```

### 2.3 Liquidity Provider (LP) Workflow

LPs provide the capital that backs the Market Maker.

#### 2.3.1 Test Environment LP Flow

```
1. LP connects wallet (same as bettor)
2. LP switches to "LP" view in frontend
3. LP clicks "Fund Pool"
4. Admin/faucet credits ytest.usdc to MM's unified balance
5. LP's share is tracked off-chain (share tokens)
6. LP views pool statistics:
   - Total pool size
   - Their share percentage
   - Current utilization
   - Pending bets exposure
```

#### 2.3.2 LP Withdrawal Rules

- **During active game:** Withdrawals are LOCKED
- **Game inactive:** Withdrawals are allowed
- **Withdrawal amount:** Proportional to share ownership

#### 2.3.3 Production Environment LP Flow (Future)

```
1. LP deposits USDC to on-chain LP Contract
2. LP receives share tokens representing pool ownership
3. Trusted party moves funds to MM's unified balance
4. LP can withdraw when game is inactive
5. Share tokens are burned, USDC returned
```

### 2.4 Oracle Operator Workflow

The Oracle Operator controls game state and reports outcomes.

#### 2.4.1 Game State Management

```
1. Operator views "Oracle" panel in frontend
2. Operator sees current game state:
   - Game status: INACTIVE / ACTIVE
   - Inning, count, teams (display only)
   - Current market status: PENDING / OPEN / CLOSED / RESOLVED
3. Operator can:
   - Set game to ACTIVE (locks LP withdrawals)
   - Set game to INACTIVE (unlocks LP withdrawals)
```

#### 2.4.2 Market Control

```
1. When game is ACTIVE, operator can:
   - Open betting window (market becomes OPEN)
   - Close betting window (market becomes CLOSED)
   - Submit outcome: BALL or STRIKE
2. Submitting outcome triggers resolution flow
3. After resolution, operator can open next market
```

#### 2.4.3 Demo Automation

```
1. Operator can enable "auto mode"
2. System automatically:
   - Opens market
   - Waits configurable duration
   - Closes market
   - Generates random outcome (or scripted sequence)
   - Resolves and opens next market
```

### 2.5 Admin Workflow

The Admin has system-wide visibility and control.

#### 2.5.1 System Monitoring

```
1. Admin views "Admin" panel in frontend
2. Dashboard shows:
   - All user unified balances
   - MM unified balance
   - All open positions
   - All open app sessions
   - Current market state
   - LP share distribution
```

#### 2.5.2 Faucet Controls

```
1. Admin can fund any wallet address with ytest.usdc
2. Admin can fund MM's unified balance directly
3. Admin can set funding amounts
```

#### 2.5.3 Scenario Triggers

```
1. Admin can pre-load scenarios:
   - "3 users with balances, 2 with open bets"
   - "Full game simulation with 10 pitches"
2. Admin can reset system to clean state
3. Admin can trigger specific test cases:
   - Rejected bet (insufficient shares)
   - Large bet affecting odds significantly
   - Multiple simultaneous bets
```

---

## 3. System Architecture

### 3.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PULSEPLAY SYSTEM                               │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                         FRONTEND                                   │ │
│  │                                                                   │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │ │
│  │  │   Bettor    │  │     LP      │  │   Oracle    │  │  Admin   │ │ │
│  │  │    View     │  │    View     │  │    View     │  │   View   │ │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └──────────┘ │ │
│  │                                                                   │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │              Shared Services Layer                          │ │ │
│  │  │  - Wallet Connection (MetaMask)                             │ │ │
│  │  │  - Clearnode SDK (WebSocket)                                │ │ │
│  │  │  - Hub Client (WebSocket + REST)                            │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                          │                    │                         │
│            Clearnode WS  │                    │  Hub WS + REST          │
│                          ▼                    ▼                         │
│  ┌────────────────────────────┐    ┌────────────────────────────────┐  │
│  │        CLEARNODE           │    │            HUB                 │  │
│  │     (Yellow Network)       │    │        (Our Backend)           │  │
│  │                            │    │                                │  │
│  │  ┌──────────────────────┐ │    │  ┌────────────────────────┐   │  │
│  │  │ Test: Sandbox        │ │◄──►│  │    LMSR Engine         │   │  │
│  │  │ Prod: Production     │ │    │  │    - Price calculation │   │  │
│  │  └──────────────────────┘ │    │  │    - Cost functions    │   │  │
│  │                            │    │  │    - Quantity tracking │   │  │
│  │  Responsibilities:         │    │  └────────────────────────┘   │  │
│  │  - User session keys       │    │                                │  │
│  │  - MM session key          │    │  ┌────────────────────────┐   │  │
│  │  - App sessions (bets)     │    │  │    Market Manager      │   │  │
│  │  - Unified balances        │    │  │    - Market lifecycle  │   │  │
│  │  - State channel mgmt      │    │  │    - Betting windows   │   │  │
│  │                            │    │  │    - Resolution logic  │   │  │
│  └────────────────────────────┘    │  └────────────────────────┘   │  │
│                                    │                                │  │
│                                    │  ┌────────────────────────┐   │  │
│                                    │  │   Position Tracker     │   │  │
│                                    │  │   - User positions     │   │  │
│                                    │  │   - App session mapping│   │  │
│                                    │  │   - Payout calculation │   │  │
│                                    │  └────────────────────────┘   │  │
│                                    │                                │  │
│                                    │  ┌────────────────────────┐   │  │
│                                    │  │   Clearnode Client     │   │  │
│                                    │  │   - MM authentication  │   │  │
│                                    │  │   - Session management │   │  │
│                                    │  │   - Fund transfers     │   │  │
│                                    │  └────────────────────────┘   │  │
│                                    │                                │  │
│                                    │  ┌────────────────────────┐   │  │
│                                    │  │     Mock Oracle        │   │  │
│                                    │  │   - Game state         │   │  │
│                                    │  │   - Outcome reporting  │   │  │
│                                    │  │   - Auto-play mode     │   │  │
│                                    │  └────────────────────────┘   │  │
│                                    │                                │  │
│                                    │  ┌────────────────────────┐   │  │
│                                    │  │   WebSocket Server     │   │  │
│                                    │  │   - Real-time updates  │   │  │
│                                    │  │   - Broadcast to clients│  │  │
│                                    │  └────────────────────────┘   │  │
│                                    │                                │  │
│                                    │  ┌────────────────────────┐   │  │
│                                    │  │      REST API          │   │  │
│                                    │  │   - Bet notifications  │   │  │
│                                    │  │   - Queries            │   │  │
│                                    │  │   - Admin operations   │   │  │
│                                    │  └────────────────────────┘   │  │
│                                    └────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Communication Patterns

| From | To | Protocol | Purpose |
|------|----|----------|---------|
| Frontend | Clearnode | WebSocket | Auth, session key, create/manage app sessions, fund/withdraw |
| Frontend | Hub | WebSocket | Real-time game state, odds updates, resolution notifications |
| Frontend | Hub | REST | Bet notifications, queries, admin operations |
| Hub | Clearnode | WebSocket | Close/reallocate app sessions (as MM), transfer funds |

### 3.3 The App Session Model

The core innovation is using Yellow Network's state channels ("app sessions") to represent bets.

#### 3.3.1 What is an App Session?

An app session is a state channel between two parties (user and Market Maker) with:

- **Allocations:** How funds are distributed between parties
- **Quorum weight:** Who can update or close the session
- **Session data:** Application-specific metadata

#### 3.3.2 App Session as a Bet

When a user places a bet:

```
┌─────────────────────────────────────────────────────────────┐
│                    APP SESSION (A Bet)                       │
│                                                             │
│  Participants:                                              │
│    - User (wallet address)                                  │
│    - Market Maker (MM - controlled by Hub)                  │
│                                                             │
│  Allocations:                                               │
│    - User: bet amount (e.g., 10 USDC)                       │
│    - MM: 0                                                  │
│                                                             │
│  Quorum Weight:                                             │
│    - MM has 100% quorum weight                              │
│    - Only MM can update state or close session              │
│                                                             │
│  Session Data:                                              │
│    - Outcome selection (Ball/Strike)                        │
│    - Market ID                                              │
│    - Additional validation parameters                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 3.3.3 Why This Design?

- **User funds are locked:** The bet amount is committed to the session
- **User can't double-spend:** Funds in session aren't available for other bets
- **MM can't steal:** MM can only close (return funds) or reallocate (on outcome)
- **Cryptographic guarantees:** Everything is auditable via Clearnode
- **No per-bet gas:** State updates are off-chain

### 3.4 The LMSR Engine

The Logarithmic Market Scoring Rule (LMSR) lives entirely off-chain in the Hub.

#### 3.4.1 Why LMSR?

- **Automated market making:** No need for order books or counterparties
- **Always liquid:** Any bet size can be accommodated
- **Fair pricing:** Odds adjust based on demand
- **Bounded loss:** MM's maximum loss is predictable

#### 3.4.2 LMSR Basics

For a binary market (Ball vs Strike):

- **q_ball:** Quantity of Ball shares sold
- **q_strike:** Quantity of Strike sold
- **b:** Liquidity parameter (controls price sensitivity)

**Cost function:**
```
C(q_ball, q_strike) = b * ln(e^(q_ball/b) + e^(q_strike/b))
```

**Price for outcome i:**
```
p_i = e^(q_i/b) / (e^(q_ball/b) + e^(q_strike/b))
```

**Cost to buy shares:**
```
cost = C(q_ball_new, q_strike_new) - C(q_ball_old, q_strike_old)
```

#### 3.4.3 LMSR in Hub

The Hub maintains:
- Current quantities (q_ball, q_strike)
- Liquidity parameter (b)
- Functions to calculate prices and costs

All calculations happen in-memory. No blockchain interaction for pricing.

### 3.5 Unified Balance Architecture

#### 3.5.1 Two Types of Unified Balances

1. **User Unified Balances**
   - Each user has a unified balance in the Clearnode
   - Represents available funds for betting
   - Managed by Yellow Network, not our Hub

2. **Market Maker (MM) Unified Balance**
   - The liquidity pool's funds
   - Controlled by Hub (Hub authenticates as MM)
   - Backs all LMSR calculations

#### 3.5.2 Balance States for Users

```
┌─────────────────────────────────────────────────────────────┐
│                    USER BALANCE STATES                       │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              UNIFIED BALANCE (in Clearnode)           │  │
│  │                                                       │  │
│  │   ┌─────────────────┐    ┌─────────────────────┐    │  │
│  │   │    AVAILABLE    │    │       LOCKED        │    │  │
│  │   │                 │    │  (in app sessions)  │    │  │
│  │   │  Can be used    │    │                     │    │  │
│  │   │  for new bets   │    │  Committed to open  │    │  │
│  │   │  or withdrawn   │    │  bets, cannot be    │    │  │
│  │   │                 │    │  used or withdrawn  │    │  │
│  │   └─────────────────┘    └─────────────────────┘    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

The "locked" amount is the sum of all open app sessions (pending bets).

---

## 4. Component Specifications

### 4.1 Frontend

#### 4.1.1 Technology Stack

- **Framework:** React 18+ with Next.js 14+
- **Language:** TypeScript
- **State Management:** Zustand or React Context
- **Styling:** Tailwind CSS
- **WebSocket:** Native WebSocket API or socket.io-client
- **Wallet:** ethers.js v6 + MetaMask

#### 4.1.2 Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── page.tsx            # Main entry, persona switcher
│   │   ├── bettor/             # Bettor view routes
│   │   ├── lp/                 # LP view routes
│   │   ├── oracle/             # Oracle view routes
│   │   └── admin/              # Admin view routes
│   │
│   ├── components/
│   │   ├── common/             # Shared components
│   │   │   ├── Header.tsx
│   │   │   ├── WalletConnect.tsx
│   │   │   ├── PersonaSwitcher.tsx
│   │   │   └── BalanceDisplay.tsx
│   │   │
│   │   ├── bettor/
│   │   │   ├── OddsDisplay.tsx
│   │   │   ├── BetForm.tsx
│   │   │   ├── PositionList.tsx
│   │   │   └── BetHistory.tsx
│   │   │
│   │   ├── lp/
│   │   │   ├── PoolStats.tsx
│   │   │   ├── DepositForm.tsx
│   │   │   └── SharesDisplay.tsx
│   │   │
│   │   ├── oracle/
│   │   │   ├── GameStatePanel.tsx
│   │   │   ├── OutcomeButtons.tsx
│   │   │   └── AutoPlayControls.tsx
│   │   │
│   │   └── admin/
│   │       ├── SystemDashboard.tsx
│   │       ├── FaucetControls.tsx
│   │       └── ScenarioPanel.tsx
│   │
│   ├── services/
│   │   ├── clearnode/
│   │   │   ├── client.ts       # Clearnode WebSocket client
│   │   │   ├── auth.ts         # Session key management
│   │   │   └── appSession.ts   # App session operations
│   │   │
│   │   ├── hub/
│   │   │   ├── websocket.ts    # Hub WebSocket client
│   │   │   ├── api.ts          # Hub REST client
│   │   │   └── types.ts        # API types
│   │   │
│   │   └── wallet/
│   │       └── metamask.ts     # MetaMask integration
│   │
│   ├── stores/
│   │   ├── walletStore.ts      # Wallet connection state
│   │   ├── marketStore.ts      # Market and odds state
│   │   ├── balanceStore.ts     # User balance state
│   │   └── positionStore.ts    # User positions state
│   │
│   ├── hooks/
│   │   ├── useWallet.ts
│   │   ├── useClearnode.ts
│   │   ├── useMarket.ts
│   │   └── useBetting.ts
│   │
│   └── config/
│       └── env.ts              # Environment configuration
│
├── public/
├── package.json
└── tsconfig.json
```

#### 4.1.3 Key Components

**WalletConnect**
- Connects to MetaMask
- Requests signature for Clearnode authentication
- Stores session key securely
- Displays connected address

**OddsDisplay**
- Shows current Ball/Strike odds
- Real-time updates via WebSocket
- Visual indication of odds movement

**BetForm**
- Outcome selector (Ball/Strike)
- Amount input with validation
- Max bet calculation
- Slippage/minimum shares display
- Submit button with loading state

**PositionList**
- Shows user's open positions
- Per-position: outcome, shares, cost, potential payout
- Updates on market resolution

**PersonaSwitcher**
- Toggle between Bettor/LP/Oracle/Admin views
- Persists selection in local storage
- Visual indicator of current persona

#### 4.1.4 State Management

```typescript
// marketStore.ts
interface MarketState {
  status: 'INACTIVE' | 'PENDING' | 'OPEN' | 'CLOSED' | 'RESOLVED';
  marketId: string | null;
  qBall: number;
  qStrike: number;
  b: number;
  priceBall: number;
  priceStrike: number;
  lastOutcome: 'BALL' | 'STRIKE' | null;
}

// balanceStore.ts
interface BalanceState {
  available: number;
  locked: number;
  total: number;
}

// positionStore.ts
interface Position {
  marketId: string;
  outcome: 'BALL' | 'STRIKE';
  shares: number;
  costPaid: number;
  appSessionId: string;
}

interface PositionState {
  positions: Position[];
}
```

#### 4.1.5 Clearnode Integration

The frontend must integrate with Yellow Network's Clearnode SDK (or implement the WebSocket protocol directly).

**Authentication Flow:**
```typescript
// 1. Connect wallet
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
const address = await signer.getAddress();

// 2. Sign auth message
const message = `Authenticate to PulsePlay: ${nonce}`;
const signature = await signer.signMessage(message);

// 3. Send to Clearnode, receive session key
const sessionKey = await clearnode.authenticate(address, signature);

// 4. Use session key for all subsequent operations
clearnode.setSessionKey(sessionKey);
```

**Creating App Session (Bet):**
```typescript
const appSession = await clearnode.createAppSession({
  counterparty: MM_ADDRESS,
  userAllocation: betAmount,
  counterpartyAllocation: 0,
  quorumWeights: { [MM_ADDRESS]: 100 },
  data: {
    outcome: 'STRIKE',
    marketId: 'pitch_123',
    // ... other session data
  }
});

// Then notify Hub
await hubApi.notifyBet({
  appSessionId: appSession.id,
  outcome: 'STRIKE',
  amount: betAmount,
  // ... other bet details
});
```

### 4.2 Hub Backend

#### 4.2.1 Technology Stack

- **Runtime:** Node.js 20+
- **Framework:** Express.js or Fastify
- **Language:** TypeScript
- **WebSocket:** ws library
- **Testing:** Jest

#### 4.2.2 Project Structure

```
hub/
├── src/
│   ├── index.ts                # Entry point
│   ├── server.ts               # Express/Fastify setup
│   │
│   ├── config/
│   │   └── env.ts              # Environment configuration
│   │
│   ├── modules/
│   │   ├── lmsr/
│   │   │   ├── engine.ts       # LMSR calculations
│   │   │   ├── types.ts        # LMSR types
│   │   │   └── engine.test.ts  # Unit tests
│   │   │
│   │   ├── market/
│   │   │   ├── manager.ts      # Market lifecycle
│   │   │   ├── types.ts        # Market types
│   │   │   └── manager.test.ts # Unit tests
│   │   │
│   │   ├── position/
│   │   │   ├── tracker.ts      # Position tracking
│   │   │   ├── types.ts        # Position types
│   │   │   └── tracker.test.ts # Unit tests
│   │   │
│   │   ├── clearnode/
│   │   │   ├── client.ts       # Clearnode WebSocket client
│   │   │   ├── mm.ts           # MM operations
│   │   │   └── types.ts        # Clearnode types
│   │   │
│   │   ├── oracle/
│   │   │   ├── mock.ts         # Mock oracle
│   │   │   └── types.ts        # Oracle types
│   │   │
│   │   └── lp/
│   │       ├── manager.ts      # LP share tracking (test env)
│   │       └── types.ts        # LP types
│   │
│   ├── api/
│   │   ├── rest/
│   │   │   ├── routes.ts       # REST route definitions
│   │   │   ├── betController.ts
│   │   │   ├── marketController.ts
│   │   │   ├── oracleController.ts
│   │   │   ├── adminController.ts
│   │   │   └── faucetController.ts
│   │   │
│   │   └── websocket/
│   │       ├── server.ts       # WebSocket server
│   │       ├── handlers.ts     # Message handlers
│   │       └── broadcast.ts    # Broadcast utilities
│   │
│   └── utils/
│       ├── logger.ts
│       └── validation.ts
│
├── package.json
├── tsconfig.json
└── jest.config.js
```

#### 4.2.3 Module Specifications

**LMSR Engine (`modules/lmsr/engine.ts`)**

Stateless functions for LMSR calculations.

```typescript
interface LMSREngine {
  // Calculate current price for an outcome
  getPrice(qBall: number, qStrike: number, b: number, outcome: 'BALL' | 'STRIKE'): number;
  
  // Calculate cost to purchase shares
  getCost(
    qBall: number, 
    qStrike: number, 
    b: number, 
    outcome: 'BALL' | 'STRIKE', 
    shares: number
  ): number;
  
  // Calculate shares received for a given cost
  getShares(
    qBall: number, 
    qStrike: number, 
    b: number, 
    outcome: 'BALL' | 'STRIKE', 
    cost: number
  ): number;
  
  // Calculate new quantities after a purchase
  getNewQuantities(
    qBall: number, 
    qStrike: number, 
    outcome: 'BALL' | 'STRIKE', 
    shares: number
  ): { qBall: number; qStrike: number };
}
```

**Market Manager (`modules/market/manager.ts`)**

Manages market lifecycle and state.

```typescript
interface MarketManager {
  // Create new market
  createMarket(marketId: string): Market;
  
  // Open betting window
  openMarket(marketId: string): void;
  
  // Close betting window
  closeMarket(marketId: string): void;
  
  // Resolve market with outcome
  resolveMarket(marketId: string, outcome: 'BALL' | 'STRIKE'): ResolutionResult;
  
  // Get current market state
  getMarket(marketId: string): Market | null;
  
  // Get current market (convenience)
  getCurrentMarket(): Market | null;
}

interface Market {
  id: string;
  status: 'PENDING' | 'OPEN' | 'CLOSED' | 'RESOLVED';
  qBall: number;
  qStrike: number;
  b: number;
  outcome: 'BALL' | 'STRIKE' | null;
  createdAt: number;
  openedAt: number | null;
  closedAt: number | null;
  resolvedAt: number | null;
}

interface ResolutionResult {
  winners: Array<{ address: string; payout: number; appSessionId: string }>;
  losers: Array<{ address: string; loss: number; appSessionId: string }>;
  totalPayout: number;
}
```

**Position Tracker (`modules/position/tracker.ts`)**

Tracks user positions off-chain.

```typescript
interface PositionTracker {
  // Record a new position
  addPosition(position: Position): void;
  
  // Get all positions for a market
  getPositionsByMarket(marketId: string): Position[];
  
  // Get all positions for a user
  getPositionsByUser(address: string): Position[];
  
  // Get specific position
  getPosition(address: string, marketId: string): Position | null;
  
  // Remove positions (after resolution)
  clearPositions(marketId: string): void;
}

interface Position {
  address: string;
  marketId: string;
  outcome: 'BALL' | 'STRIKE';
  shares: number;
  costPaid: number;
  appSessionId: string;
  timestamp: number;
}
```

**Clearnode Client (`modules/clearnode/client.ts`)**

Hub's connection to Clearnode as Market Maker.

```typescript
interface ClearnodeClient {
  // Connect and authenticate as MM
  connect(): Promise<void>;
  
  // Close an app session (rejected bet or resolution)
  closeSession(sessionId: string): Promise<void>;
  
  // Reallocate funds in a session (loser payout)
  reallocateSession(sessionId: string, toMM: boolean): Promise<void>;
  
  // Transfer funds (winner payout)
  transfer(fromMM: boolean, toAddress: string, amount: number): Promise<void>;
  
  // Get MM's unified balance
  getMMBalance(): Promise<number>;
}
```

**Mock Oracle (`modules/oracle/mock.ts`)**

Simulates game state and outcomes.

```typescript
interface MockOracle {
  // Set game active/inactive
  setGameActive(active: boolean): void;
  
  // Check if game is active
  isGameActive(): boolean;
  
  // Report outcome for current market
  reportOutcome(outcome: 'BALL' | 'STRIKE'): void;
  
  // Get current game state
  getGameState(): GameState;
  
  // Enable auto-play mode
  enableAutoPlay(config: AutoPlayConfig): void;
  
  // Disable auto-play mode
  disableAutoPlay(): void;
}

interface GameState {
  active: boolean;
  // Display fields (not functionally used in MVP)
  homeTeam: string;
  awayTeam: string;
  inning: number;
  balls: number;
  strikes: number;
  outs: number;
}

interface AutoPlayConfig {
  betWindowDuration: number;  // ms
  timeBetweenPitches: number; // ms
  outcomeSequence: ('BALL' | 'STRIKE' | 'RANDOM')[];
}
```

**LP Manager (`modules/lp/manager.ts`)**

Tracks LP shares off-chain (test environment).

```typescript
interface LPManager {
  // Record a deposit
  deposit(address: string, amount: number): void;
  
  // Process a withdrawal
  withdraw(address: string, amount: number): boolean;
  
  // Get LP's share
  getShare(address: string): LPShare;
  
  // Get all LP shares
  getAllShares(): LPShare[];
  
  // Get total pool size (MM unified balance)
  getPoolSize(): number;
  
  // Check if withdrawals are allowed
  canWithdraw(): boolean;
}

interface LPShare {
  address: string;
  depositedAmount: number;
  sharePercentage: number;
  currentValue: number;
}
```

#### 4.2.4 Bet Processing Flow

When Hub receives a bet notification:

```typescript
async function processBet(notification: BetNotification): Promise<BetResult> {
  const { appSessionId, address, outcome, amount } = notification;
  
  // 1. Validate market is open
  const market = marketManager.getCurrentMarket();
  if (!market || market.status !== 'OPEN') {
    await clearnodeClient.closeSession(appSessionId);
    return { accepted: false, reason: 'Market not open' };
  }
  
  // 2. Calculate shares using LMSR
  const shares = lmsrEngine.getShares(
    market.qBall, 
    market.qStrike, 
    market.b, 
    outcome, 
    amount
  );
  
  // 3. Validate shares meet minimum (if specified)
  // ... validation logic
  
  // 4. Check MM has sufficient liquidity
  const mmBalance = await clearnodeClient.getMMBalance();
  const maxPayout = shares; // In binary market, max payout = shares
  if (maxPayout > mmBalance) {
    await clearnodeClient.closeSession(appSessionId);
    return { accepted: false, reason: 'Insufficient liquidity' };
  }
  
  // 5. Update LMSR quantities
  const newQty = lmsrEngine.getNewQuantities(
    market.qBall, 
    market.qStrike, 
    outcome, 
    shares
  );
  marketManager.updateQuantities(market.id, newQty.qBall, newQty.qStrike);
  
  // 6. Record position
  positionTracker.addPosition({
    address,
    marketId: market.id,
    outcome,
    shares,
    costPaid: amount,
    appSessionId,
    timestamp: Date.now()
  });
  
  // 7. Broadcast updated odds
  websocketServer.broadcast({
    type: 'ODDS_UPDATE',
    data: {
      marketId: market.id,
      qBall: newQty.qBall,
      qStrike: newQty.qStrike,
      priceBall: lmsrEngine.getPrice(newQty.qBall, newQty.qStrike, market.b, 'BALL'),
      priceStrike: lmsrEngine.getPrice(newQty.qBall, newQty.qStrike, market.b, 'STRIKE')
    }
  });
  
  return { 
    accepted: true, 
    shares,
    newPriceBall: lmsrEngine.getPrice(newQty.qBall, newQty.qStrike, market.b, 'BALL'),
    newPriceStrike: lmsrEngine.getPrice(newQty.qBall, newQty.qStrike, market.b, 'STRIKE')
  };
}
```

#### 4.2.5 Resolution Flow

When Oracle reports an outcome:

```typescript
async function resolveMarket(outcome: 'BALL' | 'STRIKE'): Promise<void> {
  const market = marketManager.getCurrentMarket();
  if (!market || market.status !== 'CLOSED') {
    throw new Error('No closed market to resolve');
  }
  
  // 1. Get all positions for this market
  const positions = positionTracker.getPositionsByMarket(market.id);
  
  // 2. Process each position
  for (const position of positions) {
    if (position.outcome === outcome) {
      // WINNER: payout = shares (binary market)
      const profit = position.shares - position.costPaid;
      
      // Close session and transfer winnings
      await clearnodeClient.closeSession(position.appSessionId);
      if (profit > 0) {
        await clearnodeClient.transfer(true, position.address, profit);
      }
      
      websocketServer.sendTo(position.address, {
        type: 'BET_RESULT',
        data: {
          marketId: market.id,
          outcome: 'WIN',
          payout: position.shares,
          profit
        }
      });
    } else {
      // LOSER: reallocate to MM and close
      await clearnodeClient.reallocateSession(position.appSessionId, true);
      await clearnodeClient.closeSession(position.appSessionId);
      
      websocketServer.sendTo(position.address, {
        type: 'BET_RESULT',
        data: {
          marketId: market.id,
          outcome: 'LOSS',
          loss: position.costPaid
        }
      });
    }
  }
  
  // 3. Clear positions
  positionTracker.clearPositions(market.id);
  
  // 4. Mark market resolved
  marketManager.resolveMarket(market.id, outcome);
  
  // 5. Broadcast resolution
  websocketServer.broadcast({
    type: 'MARKET_RESOLVED',
    data: {
      marketId: market.id,
      outcome
    }
  });
}
```

### 4.3 Clearnode Integration

#### 4.3.1 Overview

Yellow Network provides two Clearnode environments:

| Environment | Purpose | URL |
|-------------|---------|-----|
| **Sandbox** | Test environment | (Provided by Yellow) |
| **Production** | Real funds | (Provided by Yellow) |

#### 4.3.2 Frontend Clearnode Usage

The frontend uses the Clearnode for:

1. **Authentication:** Sign message → receive session key
2. **Balance queries:** Check unified balance
3. **Funding:** Add funds to unified balance (test: faucet integration)
4. **App session creation:** Create bet sessions
5. **Withdrawal:** Remove funds from unified balance

#### 4.3.3 Hub Clearnode Usage

The Hub connects as the Market Maker and uses the Clearnode for:

1. **MM Authentication:** Establish MM identity
2. **Session management:** Close and reallocate app sessions
3. **Fund transfers:** Pay out winners
4. **Balance queries:** Check MM liquidity

#### 4.3.4 MM Identity

The Market Maker needs its own wallet/identity:

- Hub holds MM's private key (securely stored)
- Hub authenticates to Clearnode as MM
- Hub receives MM's session key
- All MM operations use this session key

**Security note:** In production, MM's private key should be in secure key management (HSM, KMS, etc.), not in environment variables.

---

## 5. Data Models

### 5.1 Market

```typescript
interface Market {
  id: string;                              // Unique market identifier
  status: MarketStatus;                    // Current lifecycle status
  qBall: number;                           // LMSR: Ball shares outstanding
  qStrike: number;                         // LMSR: Strike shares outstanding
  b: number;                               // LMSR: Liquidity parameter
  outcome: 'BALL' | 'STRIKE' | null;       // Resolved outcome
  createdAt: number;                       // Timestamp
  openedAt: number | null;                 // When betting opened
  closedAt: number | null;                 // When betting closed
  resolvedAt: number | null;               // When outcome resolved
}

type MarketStatus = 'PENDING' | 'OPEN' | 'CLOSED' | 'RESOLVED';
```

### 5.2 Position

```typescript
interface Position {
  address: string;                         // User wallet address
  marketId: string;                        // Associated market
  outcome: 'BALL' | 'STRIKE';              // Bet outcome
  shares: number;                          // Shares owned
  costPaid: number;                        // Amount paid for shares
  appSessionId: string;                    // Clearnode app session
  timestamp: number;                       // When bet was placed
}
```

### 5.3 Game State

```typescript
interface GameState {
  active: boolean;                         // Is game in progress?
  homeTeam: string;                        // Home team name
  awayTeam: string;                        // Away team name
  inning: number;                          // Current inning
  balls: number;                           // Ball count
  strikes: number;                         // Strike count
  outs: number;                            // Out count
}
```

### 5.4 LP Share

```typescript
interface LPShare {
  address: string;                         // LP wallet address
  depositedAmount: number;                 // Original deposit
  shareTokens: number;                     // Share token balance
  sharePercentage: number;                 // % of pool owned
  currentValue: number;                    // Current value of share
}
```

### 5.5 WebSocket Messages

#### 5.5.1 Hub → Frontend Messages

```typescript
// Odds update
interface OddsUpdateMessage {
  type: 'ODDS_UPDATE';
  data: {
    marketId: string;
    qBall: number;
    qStrike: number;
    priceBall: number;
    priceStrike: number;
  };
}

// Market status change
interface MarketStatusMessage {
  type: 'MARKET_STATUS';
  data: {
    marketId: string;
    status: MarketStatus;
    outcome?: 'BALL' | 'STRIKE';
  };
}

// Bet result (sent to specific user)
interface BetResultMessage {
  type: 'BET_RESULT';
  data: {
    marketId: string;
    outcome: 'WIN' | 'LOSS';
    payout?: number;
    profit?: number;
    loss?: number;
  };
}

// Game state change
interface GameStateMessage {
  type: 'GAME_STATE';
  data: GameState;
}
```

#### 5.5.2 Frontend → Hub Messages

Most frontend→hub communication uses REST, but WebSocket can be used for:

```typescript
// Subscribe to updates
interface SubscribeMessage {
  type: 'SUBSCRIBE';
  data: {
    channels: ('market' | 'positions')[];
    address?: string;  // For position updates
  };
}
```

---

## 6. API Contracts

### 6.1 REST Endpoints

#### 6.1.1 Betting

**POST /api/bet**

Notify Hub of a new bet (after app session creation).

```typescript
// Request
{
  appSessionId: string;
  address: string;
  outcome: 'BALL' | 'STRIKE';
  amount: number;
  // Additional session data as needed
}

// Response (200)
{
  accepted: true;
  shares: number;
  newPriceBall: number;
  newPriceStrike: number;
}

// Response (200, rejected)
{
  accepted: false;
  reason: string;
}
```

#### 6.1.2 Market

**GET /api/market**

Get current market state.

```typescript
// Response
{
  market: Market | null;
  priceBall: number;
  priceStrike: number;
}
```

**GET /api/market/:marketId**

Get specific market by ID.

```typescript
// Response
{
  market: Market;
  priceBall: number;
  priceStrike: number;
}
```

#### 6.1.3 Positions

**GET /api/positions/:address**

Get user's current positions.

```typescript
// Response
{
  positions: Position[];
}
```

#### 6.1.4 Oracle (Admin)

**POST /api/oracle/game-state**

Set game active/inactive.

```typescript
// Request
{
  active: boolean;
  // Optional display fields
  homeTeam?: string;
  awayTeam?: string;
}

// Response
{
  success: true;
  gameState: GameState;
}
```

**POST /api/oracle/market/open**

Open betting window.

```typescript
// Response
{
  success: true;
  marketId: string;
}
```

**POST /api/oracle/market/close**

Close betting window.

```typescript
// Response
{
  success: true;
  marketId: string;
}
```

**POST /api/oracle/outcome**

Submit market outcome.

```typescript
// Request
{
  outcome: 'BALL' | 'STRIKE';
}

// Response
{
  success: true;
  marketId: string;
  outcome: 'BALL' | 'STRIKE';
  resolutionSummary: {
    totalWinners: number;
    totalLosers: number;
    totalPayout: number;
  };
}
```

#### 6.1.5 Faucet (Test Environment)

**POST /api/faucet/user**

Fund a user's unified balance.

```typescript
// Request
{
  address: string;
  amount: number;
}

// Response
{
  success: true;
  newBalance: number;
}
```

**POST /api/faucet/mm**

Fund MM's unified balance.

```typescript
// Request
{
  amount: number;
}

// Response
{
  success: true;
  newBalance: number;
}
```

#### 6.1.6 LP

**GET /api/lp/pool**

Get pool statistics.

```typescript
// Response
{
  totalSize: number;
  utilization: number;
  shares: LPShare[];
  withdrawalsAllowed: boolean;
}
```

**POST /api/lp/deposit** (Test environment)

Simulate LP deposit.

```typescript
// Request
{
  address: string;
  amount: number;
}

// Response
{
  success: true;
  shareTokens: number;
  sharePercentage: number;
}
```

**POST /api/lp/withdraw** (Test environment)

Simulate LP withdrawal.

```typescript
// Request
{
  address: string;
  amount: number;
}

// Response
{
  success: true;
  withdrawnAmount: number;
  remainingShareTokens: number;
}

// Response (400, not allowed)
{
  success: false;
  reason: 'Withdrawals locked during active game';
}
```

#### 6.1.7 Admin

**GET /api/admin/state**

Get full system state (for dashboard).

```typescript
// Response
{
  market: Market | null;
  gameState: GameState;
  mmBalance: number;
  userCount: number;
  totalPositions: number;
  lpPool: {
    totalSize: number;
    shareCount: number;
  };
}
```

**POST /api/admin/reset**

Reset system to clean state.

```typescript
// Response
{
  success: true;
}
```

**POST /api/admin/scenario**

Load a predefined scenario.

```typescript
// Request
{
  scenarioId: string;
}

// Response
{
  success: true;
  description: string;
}
```

---

## 7. Environment Configuration

### 7.1 Environment Variables

#### 7.1.1 Frontend

```env
# Environment
NEXT_PUBLIC_ENV=test|production

# Clearnode
NEXT_PUBLIC_CLEARNODE_URL=wss://sandbox.clearnode.yellow.network  # or production URL

# Hub
NEXT_PUBLIC_HUB_REST_URL=http://localhost:3001
NEXT_PUBLIC_HUB_WS_URL=ws://localhost:3001

# Market Maker address (for app session counterparty)
NEXT_PUBLIC_MM_ADDRESS=0x...
```

#### 7.1.2 Hub Backend

```env
# Environment
NODE_ENV=development|production
ENV=test|production

# Server
PORT=3001

# Clearnode
CLEARNODE_URL=wss://sandbox.clearnode.yellow.network  # or production URL

# Market Maker
MM_PRIVATE_KEY=0x...  # NEVER commit this
MM_ADDRESS=0x...

# LMSR Configuration
LMSR_B=100  # Liquidity parameter

# Logging
LOG_LEVEL=debug|info|warn|error
```

### 7.2 Environment Differences

| Aspect | Test | Production |
|--------|------|------------|
| `ENV` | `test` | `production` |
| Clearnode URL | Sandbox | Production |
| Token | ytest.usdc | USDC |
| Faucet | Enabled | Disabled |
| LP deposits | Via faucet/API | On-chain contract |
| MM funding | Via faucet | On-chain LP contract |

### 7.3 Configuration Abstraction

Both frontend and backend should use configuration abstractions:

```typescript
// config/env.ts
export const config = {
  env: process.env.ENV as 'test' | 'production',
  isTest: process.env.ENV === 'test',
  isProduction: process.env.ENV === 'production',
  
  clearnode: {
    url: process.env.CLEARNODE_URL!,
  },
  
  mm: {
    address: process.env.MM_ADDRESS!,
    privateKey: process.env.MM_PRIVATE_KEY!, // Hub only
  },
  
  lmsr: {
    b: parseInt(process.env.LMSR_B || '100'),
  },
};
```

---

## 8. Demo Requirements

### 8.1 Demo Scenarios

The system must support demonstrating the following scenarios:

#### 8.1.1 Basic Betting Flow

**Scenario:** Single user places a bet and wins.

1. User connects wallet
2. User gets test funds from faucet
3. User sees current odds
4. User places bet on Strike
5. Odds update in real-time
6. Oracle reports Strike
7. User wins, balance increases

**Duration:** ~2 minutes

#### 8.1.2 Multiple Bettors

**Scenario:** Three users betting, odds shifting.

1. Three users connect (can use different browser profiles)
2. Each gets test funds
3. User A bets Ball, odds shift
4. User B bets Strike, odds shift
5. User C bets Ball (larger amount), significant shift
6. Oracle reports outcome
7. Winners paid, losers lose funds

**Duration:** ~3 minutes

#### 8.1.3 LP Participation

**Scenario:** LP provides liquidity, sees pool stats.

1. LP connects wallet
2. LP switches to LP view
3. LP deposits liquidity
4. Bettors place bets
5. LP sees utilization change
6. Oracle resolves market
7. LP sees pool balance change

**Duration:** ~3 minutes

#### 8.1.4 Full Game Simulation

**Scenario:** Automated 10-pitch game.

1. Admin enables auto-play mode
2. System automatically cycles through pitches
3. Market opens, accepts bets, closes, resolves
4. Multiple users betting throughout
5. Final balances shown

**Duration:** ~5 minutes

### 8.2 Demo Controls

The Admin view must provide:

1. **Faucet controls:** Quick-fund any address
2. **Pre-load scenarios:** One-click setup of predefined states
3. **Auto-play configuration:** Set timing, outcomes
4. **Reset button:** Clear all state and start fresh
5. **System dashboard:** Real-time view of all balances, positions

### 8.3 Demo Data

Pre-configured scenarios to load:

```typescript
const scenarios = {
  'empty': {
    description: 'Clean slate - no users, no positions',
  },
  
  'three-users': {
    description: '3 users with 1000 USDC each, no bets',
    users: [
      { address: '0x111...', balance: 1000 },
      { address: '0x222...', balance: 1000 },
      { address: '0x333...', balance: 1000 },
    ],
    mmBalance: 10000,
  },
  
  'mid-game': {
    description: 'Active market with 2 open bets',
    users: [
      { address: '0x111...', balance: 900, position: { outcome: 'BALL', shares: 12, cost: 100 } },
      { address: '0x222...', balance: 850, position: { outcome: 'STRIKE', shares: 18, cost: 150 } },
      { address: '0x333...', balance: 1000 },
    ],
    mmBalance: 9750,
    market: { status: 'OPEN', qBall: 12, qStrike: 18 },
  },
};
```

### 8.4 Visual Requirements

For an effective demo:

1. **Clear odds display:** Large, prominent Ball/Strike prices
2. **Real-time updates:** Visible animation when odds change
3. **Balance visibility:** Always show available/locked balances
4. **Transaction feedback:** Clear success/failure indicators
5. **Resolution animation:** Visual celebration/commiseration on outcome

---

## 9. Completion Criteria

### 9.1 Frontend Completion Criteria

| Feature | Criteria |
|---------|----------|
| **Wallet Connection** | User can connect MetaMask, address displays correctly |
| **Clearnode Auth** | User can sign message, session key obtained, persists across refresh |
| **Balance Display** | Shows available and locked balances, updates in real-time |
| **Odds Display** | Shows Ball/Strike prices, updates when bets placed |
| **Bet Placement** | User can select outcome, enter amount, submit bet |
| **Bet Confirmation** | User sees success/failure, balance updates |
| **Position List** | User sees open positions with details |
| **Resolution Display** | User sees win/loss notification, balance updates |
| **Persona Switcher** | Can switch between all 4 views |
| **LP View** | Shows pool stats, deposit/withdraw (test) |
| **Oracle View** | Can control game state, submit outcomes |
| **Admin View** | Shows system state, faucet controls, scenarios |

### 9.2 Hub Completion Criteria

| Feature | Criteria |
|---------|----------|
| **LMSR Engine** | Correct price/cost calculations (verified by unit tests) |
| **Market Lifecycle** | Markets transition correctly: PENDING → OPEN → CLOSED → RESOLVED |
| **Bet Processing** | Bets validated, positions recorded, quantities updated |
| **Clearnode Client** | Can authenticate as MM, close sessions, transfer funds |
| **Resolution** | Winners paid, losers' funds taken, positions cleared |
| **WebSocket Server** | Broadcasts odds updates, market status, results |
| **REST API** | All endpoints functional and returning correct data |
| **Mock Oracle** | Can set game state, report outcomes, auto-play works |
| **LP Manager** | Tracks shares, enforces withdrawal rules |
| **Faucet** | Can fund users and MM |

### 9.3 Integration Completion Criteria

| Feature | Criteria |
|---------|----------|
| **End-to-end bet** | User can place bet from frontend, Hub processes, position recorded |
| **End-to-end resolution** | Oracle submits outcome, Hub resolves, user balance updates in frontend |
| **Multiple users** | System handles multiple simultaneous users correctly |
| **Real-time updates** | All connected clients see updates within 1 second |
| **Demo scenarios** | All pre-configured scenarios load correctly |

### 9.4 Test Coverage

| Component | Unit Tests | Integration Tests |
|-----------|------------|-------------------|
| LMSR Engine | 20+ test cases | - |
| Market Manager | 15+ test cases | 5+ test cases |
| Position Tracker | 10+ test cases | - |
| Bet Processing | 10+ test cases | 5+ test cases |
| Resolution | 10+ test cases | 5+ test cases |
| API Endpoints | 5+ per endpoint | 10+ end-to-end |

---

## 10. Out of Scope / Future Work

### 10.1 Explicitly Out of Scope for MVP

The following are NOT part of the MVP:

1. **Production Clearnode integration** - MVP uses Sandbox only
2. **On-chain LP contracts** - LP deposits simulated via faucet
3. **Real oracle integration** - Mock oracle only
4. **Dispute resolution / Adjudicator** - Nice-to-have if time permits
5. **Multiple games/markets** - One market at a time
6. **Historical data persistence** - In-memory only
7. **User authentication beyond wallet** - No accounts, profiles
8. **Mobile-specific UI** - Desktop-first
9. **Advanced betting features** - No parlays, no cash-out
10. **Analytics/reporting** - Basic stats only

### 10.2 Production Environment Requirements

For production deployment (post-hackathon):

1. **Production Clearnode** - Switch to production URL and real USDC
2. **LP Smart Contract** - On-chain deposits, share tokens, withdrawals
3. **MM Key Management** - HSM/KMS for MM private key
4. **Database** - PostgreSQL or similar for persistence
5. **Real Oracle** - Integration with sports data provider
6. **Dispute Resolution** - Yellow Network adjudicator integration
7. **Monitoring** - Logging, metrics, alerting
8. **Security Audit** - Full audit of contracts and backend

### 10.3 Nice-to-Have Features

If time permits during hackathon:

1. **Dispute demo** - Show adjudicator flow (even if simulated)
2. **Auto-play with realistic timing** - More polished demo
3. **Sound effects** - Audio feedback on wins/losses
4. **Leaderboard** - Show top winners
5. **Bet history** - Past bets and outcomes

### 10.4 Architecture Decisions for Future Scaling

The MVP architecture supports future enhancements:

1. **Multiple markets** - Market Manager can be extended to handle concurrent markets
2. **Database integration** - Position Tracker interface can be backed by DB
3. **Real oracle** - Oracle module has clean interface for swapping implementations
4. **Production Clearnode** - Only URL changes needed
5. **LP contracts** - LP Manager interface can be backed by on-chain contract

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **App Session** | Yellow Network state channel between two parties (user and MM) |
| **Ball** | Baseball pitch outcome: outside the strike zone |
| **Clearnode** | Yellow Network's infrastructure for state channels |
| **Hub** | PulsePlay's backend server |
| **LMSR** | Logarithmic Market Scoring Rule - automated market maker algorithm |
| **LP** | Liquidity Provider - supplies capital to the market maker |
| **MM** | Market Maker - the counterparty to all bets, controlled by Hub |
| **Quorum Weight** | Who can update/close an app session |
| **Session Key** | Authentication token from Clearnode |
| **Strike** | Baseball pitch outcome: in the strike zone |
| **Unified Balance** | User's available funds in the Clearnode |
| **ytest.usdc** | Yellow Network's test token |

---

## Appendix B: Yellow Documentation

[Yellow SDK](https://github.com/stevenzeiler/yellow-ts)

### Learn

- **Introduction**
  - [What Yellow Solves](https://docs.yellow.org/docs/learn/introduction/what-yellow-solves)
  - [Architecture at a Glance](https://docs.yellow.org/docs/learn/introduction/architecture-at-a-glance)
- **Getting Started**
  - [Quickstart](https://docs.yellow.org/docs/learn/getting-started/quickstart)
  - [Prerequisites](https://docs.yellow.org/docs/learn/getting-started/prerequisites)
  - [Key Terms](https://docs.yellow.org/docs/learn/getting-started/key-terms)
- **Core Concepts**
  - [State Channels vs L1/L2](https://docs.yellow.org/docs/learn/core-concepts/state-channels-vs-l1-l2)
  - [App Sessions](https://docs.yellow.org/docs/learn/core-concepts/app-sessions)
  - [Session Keys](https://docs.yellow.org/docs/learn/core-concepts/session-keys)
  - [Challenge-Response](https://docs.yellow.org/docs/learn/core-concepts/challenge-response)
  - [Message Envelope](https://docs.yellow.org/docs/learn/core-concepts/message-envelope)
- **Advanced**
  - [Managing Session Keys](https://docs.yellow.org/docs/learn/advanced/managing-session-keys)

### Guides

- [Multi-Party App Sessions](https://docs.yellow.org/docs/guides/multi-party-app-sessions)

### Protocol

- [Introduction](https://docs.yellow.org/docs/protocol/introduction)
- [Terminology](https://docs.yellow.org/docs/protocol/terminology)
- [Architecture](https://docs.yellow.org/docs/protocol/architecture)
- **On-Chain**
  - [Overview](https://docs.yellow.org/docs/protocol/on-chain/overview)
  - [Data Structures](https://docs.yellow.org/docs/protocol/on-chain/data-structures)
  - [Channel Lifecycle](https://docs.yellow.org/docs/protocol/on-chain/channel-lifecycle)
  - [Signature Formats](https://docs.yellow.org/docs/protocol/on-chain/signature-formats)
  - [Security](https://docs.yellow.org/docs/protocol/on-chain/security)
- **Off-Chain**
  - [Overview](https://docs.yellow.org/docs/protocol/off-chain/overview)
  - [Message Format](https://docs.yellow.org/docs/protocol/off-chain/message-format)
  - [Authentication](https://docs.yellow.org/docs/protocol/off-chain/authentication)
  - [Transfers](https://docs.yellow.org/docs/protocol/off-chain/transfers)
  - [App Sessions](https://docs.yellow.org/docs/protocol/off-chain/app-sessions)
  - [Queries](https://docs.yellow.org/docs/protocol/off-chain/queries)
- [Communication Flows](https://docs.yellow.org/docs/protocol/communication-flows)
- [Glossary](https://docs.yellow.org/docs/protocol/glossary)

---

## Appendix C: References

- LMSR Paper: Hanson, Robin. "Logarithmic Market Scoring Rules for Modular Combinatorial Information Aggregation"
- Hack Money 2026: [Hackathon Link](https://ethglobal.com/events/hackmoney2026)

---

*End of Specification*