import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlaceOrderForm } from './PlaceOrderForm';
import * as WagmiProvider from '@/providers/WagmiProvider';
import * as SelectedMarketProvider from '@/providers/SelectedMarketProvider';
import * as api from '@/lib/api';

jest.mock('@/providers/WagmiProvider', () => ({
  useWallet: jest.fn(),
}));

jest.mock('@/providers/SelectedMarketProvider', () => ({
  useSelectedMarket: jest.fn().mockReturnValue({
    market: { id: 'market-1', status: 'OPEN' },
    outcomes: ['BALL', 'STRIKE'],
    prices: [0.5, 0.5],
    quantities: [0, 0],
  }),
}));

jest.mock('@/lib/api');

jest.mock('@/hooks/useClearnode', () => ({
  useClearnode: jest.fn().mockReturnValue({
    status: 'connected',
    error: null,
    isSessionValid: true,
    expiresAt: Date.now() + 3600000,
    signer: null,
    ws: null,
    balance: '1000000',
    allowanceAmount: 1000,
    setAllowanceAmount: jest.fn(),
    refreshBalance: jest.fn(),
    reconnect: jest.fn(),
    disconnect: jest.fn(),
    createAppSession: jest.fn().mockResolvedValue({
      appSessionId: '0xSESSION',
      version: 1,
      status: 'open',
    }),
    closeAppSession: jest.fn(),
    submitAppState: jest.fn(),
    transfer: jest.fn(),
    getAppSessions: jest.fn(),
    getConfig: jest.fn(),
  }),
}));

const testGlobals = globalThis as typeof globalThis & { __TEST_MM_ADDRESS__?: string };
jest.mock('@/lib/config', () => ({
  get MM_ADDRESS() { return testGlobals.__TEST_MM_ADDRESS__; },
}));

const mockUseWallet = WagmiProvider.useWallet as jest.Mock;
const mockUseSelectedMarket = SelectedMarketProvider.useSelectedMarket as jest.Mock;
const mockPlaceP2POrder = api.placeP2POrder as jest.MockedFunction<typeof api.placeP2POrder>;

const mockOrderResponse = {
  orderId: 'order-123',
  status: 'OPEN' as const,
  fills: [],
  order: {
    orderId: 'order-123',
    marketId: 'market-1',
    gameId: 'game-1',
    userAddress: '0x123',
    outcome: 'BALL',
    mcps: 0.60,
    amount: 6,
    filledAmount: 0,
    unfilledAmount: 6,
    maxShares: 10,
    filledShares: 0,
    unfilledShares: 10,
    appSessionId: '0xSESSION',
    appSessionVersion: 1,
    status: 'OPEN' as const,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
};

describe('PlaceOrderForm', () => {
  beforeEach(() => {
    mockUseWallet.mockReturnValue({ address: '0x123', isConfigured: true });
    mockPlaceP2POrder.mockReset();
    testGlobals.__TEST_MM_ADDRESS__ = '0xMM';
  });

  it('renders form with outcome buttons and inputs', () => {
    render(<PlaceOrderForm marketId="market-1" gameId="game-1" outcomes={['BALL', 'STRIKE']} />);

    expect(screen.getByTestId('place-order-form')).toBeInTheDocument();
    expect(screen.getByTestId('order-outcome-ball')).toBeInTheDocument();
    expect(screen.getByTestId('order-outcome-strike')).toBeInTheDocument();
    expect(screen.getByTestId('mcps-input')).toBeInTheDocument();
    expect(screen.getByTestId('order-amount-input')).toBeInTheDocument();
  });

  it('selects outcome when clicked', async () => {
    const user = userEvent.setup();
    render(<PlaceOrderForm marketId="market-1" gameId="game-1" outcomes={['BALL', 'STRIKE']} />);

    await user.click(screen.getByTestId('order-outcome-ball'));
    expect(screen.getByTestId('order-outcome-ball')).toHaveClass('border-blue-500');
  });

  it('updates amount from preset buttons', async () => {
    const user = userEvent.setup();
    render(<PlaceOrderForm marketId="market-1" gameId="game-1" outcomes={['BALL', 'STRIKE']} />);

    await user.click(screen.getByTestId('order-preset-10'));
    expect(screen.getByTestId('order-amount-input')).toHaveValue(10);
  });

  it('shows match hint based on MCPS value', async () => {
    const user = userEvent.setup();
    render(<PlaceOrderForm marketId="market-1" gameId="game-1" outcomes={['BALL', 'STRIKE']} />);

    await user.type(screen.getByTestId('mcps-input'), '0.60');

    expect(screen.getByTestId('match-hint')).toHaveTextContent('0.40');
  });

  it('shows max shares when MCPS and amount are valid', async () => {
    const user = userEvent.setup();
    render(<PlaceOrderForm marketId="market-1" gameId="game-1" outcomes={['BALL', 'STRIKE']} />);

    await user.type(screen.getByTestId('mcps-input'), '0.50');
    await user.type(screen.getByTestId('order-amount-input'), '10');

    expect(screen.getByTestId('max-shares-display')).toHaveTextContent('20.00');
  });

  it('disables submit button when fields are incomplete', () => {
    render(<PlaceOrderForm marketId="market-1" gameId="game-1" outcomes={['BALL', 'STRIKE']} />);

    expect(screen.getByTestId('place-order-button')).toBeDisabled();
  });

  it('submits order with correct parameters', async () => {
    const user = userEvent.setup();
    mockPlaceP2POrder.mockResolvedValueOnce(mockOrderResponse);
    const onOrderPlaced = jest.fn();

    render(
      <PlaceOrderForm
        marketId="market-1"
        gameId="game-1"
        outcomes={['BALL', 'STRIKE']}
        onOrderPlaced={onOrderPlaced}
      />
    );

    await user.click(screen.getByTestId('order-outcome-ball'));
    await user.type(screen.getByTestId('mcps-input'), '0.60');
    await user.type(screen.getByTestId('order-amount-input'), '6');
    await user.click(screen.getByTestId('place-order-button'));

    await waitFor(() => {
      expect(mockPlaceP2POrder).toHaveBeenCalledWith(
        expect.objectContaining({
          marketId: 'market-1',
          gameId: 'game-1',
          outcome: 'BALL',
          mcps: 0.60,
          amount: 6,
        })
      );
    });

    await waitFor(() => {
      expect(onOrderPlaced).toHaveBeenCalled();
    });
  });

  it('shows "Place Order" when not loading', () => {
    render(<PlaceOrderForm marketId="market-1" gameId="game-1" outcomes={['BALL', 'STRIKE']} />);
    expect(screen.getByTestId('place-order-button')).toHaveTextContent('Place Order');
  });

  it('renders all preset amount buttons', () => {
    render(<PlaceOrderForm marketId="market-1" gameId="game-1" outcomes={['BALL', 'STRIKE']} />);

    expect(screen.getByTestId('order-preset-1')).toBeInTheDocument();
    expect(screen.getByTestId('order-preset-5')).toBeInTheDocument();
    expect(screen.getByTestId('order-preset-10')).toBeInTheDocument();
    expect(screen.getByTestId('order-preset-25')).toBeInTheDocument();
  });

  it('shows warning and disables button when market is not open', async () => {
    const user = userEvent.setup();
    mockUseSelectedMarket.mockReturnValue({
      market: { id: 'market-1', status: 'CLOSED' },
      outcomes: ['BALL', 'STRIKE'],
      prices: [0.5, 0.5],
      quantities: [0, 0],
    });

    render(<PlaceOrderForm marketId="market-1" gameId="game-1" outcomes={['BALL', 'STRIKE']} />);

    expect(screen.getByTestId('market-closed-warning')).toHaveTextContent('Market is not open for orders');

    // Even with all fields filled, button should be disabled
    await user.click(screen.getByTestId('order-outcome-ball'));
    await user.type(screen.getByTestId('mcps-input'), '0.60');
    await user.type(screen.getByTestId('order-amount-input'), '6');
    expect(screen.getByTestId('place-order-button')).toBeDisabled();
  });
});
