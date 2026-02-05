import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountBalanceCard } from './AccountBalanceCard';

const mockUseClearnode = jest.fn();
jest.mock('@/providers/ClearnodeProvider', () => ({
  useClearnode: () => mockUseClearnode(),
}));

function defaultContext(overrides = {}) {
  return {
    status: 'connected',
    balance: '10000000',
    refreshBalance: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('AccountBalanceCard', () => {
  beforeEach(() => {
    mockUseClearnode.mockReturnValue(defaultContext());
  });

  it('shows not-connected state when disconnected', () => {
    mockUseClearnode.mockReturnValue(defaultContext({ status: 'disconnected' }));

    render(<AccountBalanceCard />);

    expect(screen.getByTestId('account-balance-not-connected')).toBeInTheDocument();
    expect(screen.getByText('Connect wallet to view balance')).toBeInTheDocument();
  });

  it('displays formatted balance when connected', () => {
    render(<AccountBalanceCard />);

    expect(screen.getByTestId('account-balance-card')).toBeInTheDocument();
    expect(screen.getByTestId('account-balance')).toHaveTextContent('$10.00');
  });

  it('displays $0.00 when balance is null', () => {
    mockUseClearnode.mockReturnValue(defaultContext({ balance: null }));

    render(<AccountBalanceCard />);

    expect(screen.getByTestId('account-balance')).toHaveTextContent('$0.00');
  });

  it('calls refreshBalance when refresh button clicked', async () => {
    const refreshBalance = jest.fn().mockResolvedValue(undefined);
    mockUseClearnode.mockReturnValue(defaultContext({ refreshBalance }));

    const user = userEvent.setup();
    render(<AccountBalanceCard />);

    await user.click(screen.getByTestId('account-refresh-button'));

    expect(refreshBalance).toHaveBeenCalledTimes(1);
  });

  it('formats large balances correctly', () => {
    mockUseClearnode.mockReturnValue(
      defaultContext({ balance: '1500000000' }),
    );

    render(<AccountBalanceCard />);

    expect(screen.getByTestId('account-balance')).toHaveTextContent('$1,500.00');
  });
});
