import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

// ── Sports ──────────────────────────────────────────────────────────────────

export const sports = sqliteTable('sports', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('created_at').notNull(),
});

// ── Market Categories ───────────────────────────────────────────────────────

export const marketCategories = sqliteTable('market_categories', {
  id: text('id').primaryKey(),
  sportId: text('sport_id').notNull().references(() => sports.id),
  name: text('name').notNull(),
  outcomes: text('outcomes').notNull(), // JSON array: '["BALL","STRIKE"]'
  description: text('description'),
  createdAt: integer('created_at').notNull(),
});

// ── Teams ───────────────────────────────────────────────────────────────────

export const teams = sqliteTable('teams', {
  id: text('id').primaryKey(),
  sportId: text('sport_id').notNull().references(() => sports.id),
  name: text('name').notNull(),
  abbreviation: text('abbreviation').notNull(),
  logoPath: text('logo_path'),
  createdAt: integer('created_at').notNull(),
});

// ── Games ───────────────────────────────────────────────────────────────────

export const games = sqliteTable('games', {
  id: text('id').primaryKey(),
  sportId: text('sport_id').notNull().references(() => sports.id),
  homeTeamId: text('home_team_id').notNull().references(() => teams.id),
  awayTeamId: text('away_team_id').notNull().references(() => teams.id),
  status: text('status').notNull().default('SCHEDULED'),
  startedAt: integer('started_at'),
  completedAt: integer('completed_at'),
  imagePath: text('image_path'),
  metadata: text('metadata'),
  createdAt: integer('created_at').notNull(),
});

// ── Markets ─────────────────────────────────────────────────────────────────

export const markets = sqliteTable('markets', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id),
  categoryId: text('category_id').notNull().references(() => marketCategories.id),
  sequenceNum: integer('sequence_num').notNull(),
  status: text('status').notNull().default('PENDING'),
  quantities: text('quantities').notNull().default('[]'), // JSON array: '[0,0]'
  b: real('b').notNull().default(100),
  outcome: text('outcome'),
  createdAt: integer('created_at').notNull(),
  openedAt: integer('opened_at'),
  closedAt: integer('closed_at'),
  resolvedAt: integer('resolved_at'),
}, (table) => [
  index('idx_markets_game_category_status').on(table.gameId, table.categoryId, table.status),
  index('idx_markets_game_status').on(table.gameId, table.status),
]);

// ── Positions ───────────────────────────────────────────────────────────────

export const positions = sqliteTable('positions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  address: text('address').notNull(),
  marketId: text('market_id').notNull().references(() => markets.id),
  outcome: text('outcome').notNull(),
  shares: real('shares').notNull(),
  costPaid: real('cost_paid').notNull(),
  fee: real('fee').notNull().default(0),
  appSessionId: text('app_session_id').notNull(),
  appSessionVersion: integer('app_session_version').notNull(),
  sessionStatus: text('session_status').notNull().default('open'),
  sessionData: text('session_data'),
  mode: text('mode').notNull().default('lmsr'), // 'lmsr' | 'p2p'
  createdAt: integer('created_at').notNull(),
}, (table) => [
  index('idx_positions_market').on(table.marketId),
  index('idx_positions_address').on(table.address),
  index('idx_positions_session').on(table.appSessionId),
]);

// ── P2P Orders ──────────────────────────────────────────────────────────────

export const p2pOrders = sqliteTable('p2p_orders', {
  orderId: text('order_id').primaryKey(),
  marketId: text('market_id').notNull().references(() => markets.id),
  gameId: text('game_id').notNull().references(() => games.id),
  userAddress: text('user_address').notNull(),
  outcome: text('outcome').notNull(),
  mcps: real('mcps').notNull(),
  amount: real('amount').notNull(),
  filledAmount: real('filled_amount').notNull().default(0),
  unfilledAmount: real('unfilled_amount').notNull(),
  maxShares: real('max_shares').notNull(),
  filledShares: real('filled_shares').notNull().default(0),
  unfilledShares: real('unfilled_shares').notNull(),
  appSessionId: text('app_session_id').notNull(),
  appSessionVersion: integer('app_session_version').notNull(),
  status: text('status').notNull().default('OPEN'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  index('idx_p2p_orders_market_outcome_status').on(table.marketId, table.outcome, table.status),
  index('idx_p2p_orders_user').on(table.userAddress),
]);

// ── P2P Fills ───────────────────────────────────────────────────────────────

export const p2pFills = sqliteTable('p2p_fills', {
  fillId: text('fill_id').primaryKey(),
  orderId: text('order_id').notNull().references(() => p2pOrders.orderId),
  counterpartyOrderId: text('counterparty_order_id').notNull().references(() => p2pOrders.orderId),
  counterpartyAddress: text('counterparty_address').notNull(),
  shares: real('shares').notNull(),
  effectivePrice: real('effective_price').notNull(),
  cost: real('cost').notNull(),
  filledAt: integer('filled_at').notNull(),
}, (table) => [
  index('idx_p2p_fills_order').on(table.orderId),
]);

// ── Users ───────────────────────────────────────────────────────────────────

export const users = sqliteTable('users', {
  address: text('address').primaryKey(),
  totalBets: integer('total_bets').notNull().default(0),
  totalWins: integer('total_wins').notNull().default(0),
  totalLosses: integer('total_losses').notNull().default(0),
  totalWagered: real('total_wagered').notNull().default(0),
  totalPayout: real('total_payout').notNull().default(0),
  netPnl: real('net_pnl').notNull().default(0),
  firstSeenAt: integer('first_seen_at').notNull(),
  lastActiveAt: integer('last_active_at').notNull(),
}, (table) => [
  index('idx_users_pnl').on(table.netPnl),
]);

// ── Settlements ─────────────────────────────────────────────────────────────

export const settlements = sqliteTable('settlements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  marketId: text('market_id').notNull().references(() => markets.id),
  address: text('address').notNull(),
  outcome: text('outcome').notNull(),
  result: text('result').notNull(),
  shares: real('shares').notNull(),
  costPaid: real('cost_paid').notNull(),
  payout: real('payout').notNull(),
  profit: real('profit').notNull(),
  appSessionId: text('app_session_id').notNull(),
  settledAt: integer('settled_at').notNull(),
}, (table) => [
  index('idx_settlements_market').on(table.marketId),
  index('idx_settlements_address').on(table.address),
]);
