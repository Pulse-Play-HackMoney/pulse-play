import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LPDepositForm } from './LPDepositForm';
import * as api from '@/lib/api';

const mockTransfer = jest.fn().mockResolvedValue(undefined);
const mockRefreshBalance = jest.fn();

jest.mock('@/hooks/useClearnode', () => ({
  useClearnode: jest.fn(() => ({
    transfer: mockTransfer,
    refreshBalance: mockRefreshBalance,
    status: 'connected',
  })),
}));

jest.mock('@/lib/config', () => ({
  MM_ADDRESS: '0xMM' as `0x${string}`,
}));

jest.mock('@/lib/api', () => ({
  depositLP: jest.fn(),
}));

const mockDepositLP = api.depositLP as jest.MockedFunction<typeof api.depositLP>;

describe('LPDepositForm', () => {
  beforeEach(() => {
    mockDepositLP.mockReset();
    mockTransfer.mockReset();
    mockTransfer.mockResolvedValue(undefined);
    mockRefreshBalance.mockReset();
  });

  it('shows "Connect wallet" when address is null', () => {
    render(<LPDepositForm address={null} />);

    expect(screen.getByTestId('lp-deposit-connect')).toHaveTextContent('Connect wallet');
  });

  it('preset amount buttons set the input value', async () => {
    const user = userEvent.setup();
    render(<LPDepositForm address="0x1234" />);

    await user.click(screen.getByTestId('deposit-preset-50'));

    const input = screen.getByTestId('deposit-amount-input') as HTMLInputElement;
    expect(input.value).toBe('50');
    expect(screen.getByTestId('deposit-submit')).toHaveTextContent('Deposit $50');
  });

  it('transfers funds to MM then records deposit on success', async () => {
    const user = userEvent.setup();
    const onDeposit = jest.fn();
    mockDepositLP.mockResolvedValueOnce({
      success: true,
      shares: 10,
      sharePrice: 10,
      poolValueAfter: 1100,
    });

    render(<LPDepositForm address="0x1234" onDeposit={onDeposit} />);

    await user.click(screen.getByTestId('deposit-preset-100'));
    await user.click(screen.getByTestId('deposit-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('deposit-success')).toBeInTheDocument();
    });

    // Verify transfer was called first with correct params
    expect(mockTransfer).toHaveBeenCalledWith({
      destination: '0xMM',
      asset: 'ytest.usd',
      amount: '100000000',
    });

    // Verify hub was notified after transfer
    expect(mockDepositLP).toHaveBeenCalledWith('0x1234', 100);

    // Verify order: transfer before depositLP
    const transferOrder = mockTransfer.mock.invocationCallOrder[0];
    const depositOrder = mockDepositLP.mock.invocationCallOrder[0];
    expect(transferOrder).toBeLessThan(depositOrder);

    expect(screen.getByTestId('deposit-success')).toHaveTextContent('Deposited $100');
    expect(onDeposit).toHaveBeenCalledTimes(1);
    expect(mockRefreshBalance).toHaveBeenCalled();
  });

  it('does not call depositLP if transfer fails', async () => {
    const user = userEvent.setup();
    mockTransfer.mockRejectedValueOnce(new Error('Insufficient balance'));

    render(<LPDepositForm address="0x1234" />);

    await user.click(screen.getByTestId('deposit-preset-100'));
    await user.click(screen.getByTestId('deposit-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('deposit-error')).toBeInTheDocument();
    });

    expect(screen.getByTestId('deposit-error')).toHaveTextContent('Insufficient balance');
    expect(mockDepositLP).not.toHaveBeenCalled();
  });

  it('shows error when hub deposit recording fails', async () => {
    const user = userEvent.setup();
    mockDepositLP.mockRejectedValueOnce(new Error('Server error'));

    render(<LPDepositForm address="0x1234" />);

    await user.click(screen.getByTestId('deposit-preset-100'));
    await user.click(screen.getByTestId('deposit-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('deposit-error')).toBeInTheDocument();
    });

    expect(mockTransfer).toHaveBeenCalled();
    expect(screen.getByTestId('deposit-error')).toHaveTextContent('Server error');
  });

  it('submit button disabled while submitting', async () => {
    const user = userEvent.setup();
    mockTransfer.mockReturnValue(new Promise(() => {})); // never resolves

    render(<LPDepositForm address="0x1234" />);

    await user.click(screen.getByTestId('deposit-preset-50'));
    await user.click(screen.getByTestId('deposit-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('deposit-submit')).toHaveTextContent('Transferring funds...');
    });

    expect(screen.getByTestId('deposit-submit')).toBeDisabled();
  });

  it('validates amount is positive — submit disabled with no input', () => {
    render(<LPDepositForm address="0x1234" />);

    expect(screen.getByTestId('deposit-submit')).toBeDisabled();
  });

  it('validates amount is positive — submit disabled for zero', async () => {
    const user = userEvent.setup();
    render(<LPDepositForm address="0x1234" />);

    const input = screen.getByTestId('deposit-amount-input');
    await user.clear(input);
    await user.type(input, '0');

    expect(screen.getByTestId('deposit-submit')).toBeDisabled();
  });
});
