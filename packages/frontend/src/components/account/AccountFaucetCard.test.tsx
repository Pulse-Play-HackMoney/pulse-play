import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountFaucetCard } from './AccountFaucetCard';
import * as api from '@/lib/api';

jest.mock('@/lib/api');

const mockRequestUserFaucet = api.requestUserFaucet as jest.MockedFunction<typeof api.requestUserFaucet>;

const mockRefreshBalance = jest.fn().mockResolvedValue(undefined);

jest.mock('@/providers/WagmiProvider', () => ({
  useWallet: () => ({
    address: '0xAlice',
    isConfigured: true,
    mode: 'private-key',
    isConnecting: false,
    isConnected: true,
    connect: jest.fn(),
    disconnect: jest.fn(),
  }),
}));

jest.mock('@/providers/ClearnodeProvider', () => ({
  useClearnode: () => ({
    refreshBalance: mockRefreshBalance,
  }),
}));

describe('AccountFaucetCard', () => {
  beforeEach(() => {
    mockRequestUserFaucet.mockReset();
    mockRefreshBalance.mockClear();
  });

  it('renders preset amount buttons', () => {
    render(<AccountFaucetCard />);

    expect(screen.getByTestId('account-faucet-preset-10')).toHaveTextContent('$10');
    expect(screen.getByTestId('account-faucet-preset-50')).toHaveTextContent('$50');
    expect(screen.getByTestId('account-faucet-preset-100')).toHaveTextContent('$100');
    expect(screen.getByTestId('account-faucet-preset-500')).toHaveTextContent('$500');
  });

  it('selecting preset updates submit button', async () => {
    const user = userEvent.setup();
    render(<AccountFaucetCard />);

    await user.click(screen.getByTestId('account-faucet-preset-50'));

    expect(screen.getByTestId('account-faucet-submit')).toHaveTextContent('Fund $50');
  });

  it('custom input accepts values', async () => {
    const user = userEvent.setup();
    render(<AccountFaucetCard />);

    const input = screen.getByTestId('account-faucet-custom-input');
    await user.clear(input);
    await user.type(input, '200');

    expect(screen.getByTestId('account-faucet-submit')).toHaveTextContent('Fund $200');
  });

  it('submitting calls requestUserFaucet with address and correct count', async () => {
    const user = userEvent.setup();
    mockRequestUserFaucet.mockResolvedValueOnce({ success: true, funded: 5 });

    render(<AccountFaucetCard />);

    await user.click(screen.getByTestId('account-faucet-preset-50'));
    await user.click(screen.getByTestId('account-faucet-submit'));

    await waitFor(() => {
      expect(mockRequestUserFaucet).toHaveBeenCalledWith('0xAlice', 5);
    });
  });

  it('shows loading state during request', async () => {
    const user = userEvent.setup();
    mockRequestUserFaucet.mockReturnValue(new Promise(() => {})); // never resolves

    render(<AccountFaucetCard />);

    await user.click(screen.getByTestId('account-faucet-preset-100'));
    await user.click(screen.getByTestId('account-faucet-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('account-faucet-submit')).toHaveTextContent('Funding $100...');
    });
  });

  it('shows success message on completion', async () => {
    const user = userEvent.setup();
    mockRequestUserFaucet.mockResolvedValueOnce({ success: true, funded: 10 });

    render(<AccountFaucetCard />);

    await user.click(screen.getByTestId('account-faucet-preset-100'));
    await user.click(screen.getByTestId('account-faucet-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('account-faucet-success')).toHaveTextContent('Successfully funded $100');
    });
  });

  it('shows warning on partial failure', async () => {
    const user = userEvent.setup();
    mockRequestUserFaucet.mockResolvedValueOnce({
      success: true,
      funded: 3,
      requested: 10,
      error: 'Rate limited',
    });

    render(<AccountFaucetCard />);

    await user.click(screen.getByTestId('account-faucet-preset-100'));
    await user.click(screen.getByTestId('account-faucet-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('account-faucet-warning')).toHaveTextContent('Partially funded: $30 of $100');
    });
  });

  it('shows error on failure', async () => {
    const user = userEvent.setup();
    mockRequestUserFaucet.mockRejectedValueOnce(new Error('Faucet down'));

    render(<AccountFaucetCard />);

    await user.click(screen.getByTestId('account-faucet-preset-10'));
    await user.click(screen.getByTestId('account-faucet-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('account-faucet-error')).toHaveTextContent('Faucet down');
    });
  });

  it('calls onFunded callback and refreshBalance after successful funding', async () => {
    const user = userEvent.setup();
    const onFunded = jest.fn();
    mockRequestUserFaucet.mockResolvedValueOnce({ success: true, funded: 1 });

    render(<AccountFaucetCard onFunded={onFunded} />);

    await user.click(screen.getByTestId('account-faucet-preset-10'));
    await user.click(screen.getByTestId('account-faucet-submit'));

    await waitFor(() => {
      expect(onFunded).toHaveBeenCalledTimes(1);
    });

    expect(mockRefreshBalance).toHaveBeenCalled();
  });
});
