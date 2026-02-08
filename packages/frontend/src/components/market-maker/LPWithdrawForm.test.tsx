import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LPWithdrawForm } from './LPWithdrawForm';
import * as api from '@/lib/api';

jest.mock('@/lib/api', () => ({
  withdrawLP: jest.fn(),
}));

const mockWithdrawLP = api.withdrawLP as jest.MockedFunction<typeof api.withdrawLP>;

describe('LPWithdrawForm', () => {
  beforeEach(() => {
    mockWithdrawLP.mockReset();
  });

  it('shows "Connect wallet" when address is null', () => {
    render(<LPWithdrawForm address={null} />);

    expect(screen.getByTestId('lp-withdraw-connect')).toHaveTextContent('Connect wallet');
  });

  it('shows lock message when canWithdraw is false', () => {
    render(<LPWithdrawForm address="0x1234" canWithdraw={false} />);

    expect(screen.getByTestId('lp-withdraw-locked')).toHaveTextContent('Withdrawals are currently locked');
  });

  it('successful withdrawal shows success message and calls onWithdraw', async () => {
    const user = userEvent.setup();
    const onWithdraw = jest.fn();
    mockWithdrawLP.mockResolvedValueOnce({
      success: true,
      amount: 500,
      sharePrice: 10,
      poolValueAfter: 500,
    });

    render(<LPWithdrawForm address="0x1234" maxShares={50} onWithdraw={onWithdraw} />);

    const input = screen.getByTestId('withdraw-shares-input');
    await user.clear(input);
    await user.type(input, '50');
    await user.click(screen.getByTestId('withdraw-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('withdraw-success')).toBeInTheDocument();
    });

    expect(screen.getByTestId('withdraw-success')).toHaveTextContent('Withdrew $500.00 for 50 shares');
    expect(mockWithdrawLP).toHaveBeenCalledWith('0x1234', 50);
    expect(onWithdraw).toHaveBeenCalledTimes(1);
  });

  it('failed withdrawal shows error message', async () => {
    const user = userEvent.setup();
    mockWithdrawLP.mockRejectedValueOnce(new Error('Insufficient shares'));

    render(<LPWithdrawForm address="0x1234" maxShares={50} />);

    const input = screen.getByTestId('withdraw-shares-input');
    await user.clear(input);
    await user.type(input, '100');
    await user.click(screen.getByTestId('withdraw-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('withdraw-error')).toBeInTheDocument();
    });

    expect(screen.getByTestId('withdraw-error')).toHaveTextContent('Insufficient shares');
  });

  it('max button fills in maxShares value', async () => {
    const user = userEvent.setup();
    render(<LPWithdrawForm address="0x1234" maxShares={75.5} />);

    await user.click(screen.getByTestId('withdraw-max-button'));

    const input = screen.getByTestId('withdraw-shares-input') as HTMLInputElement;
    expect(input.value).toBe('75.5');
  });

  it('validates shares is positive — submit disabled with no input', () => {
    render(<LPWithdrawForm address="0x1234" />);

    expect(screen.getByTestId('withdraw-submit')).toBeDisabled();
  });

  it('validates shares is positive — submit disabled for zero', async () => {
    const user = userEvent.setup();
    render(<LPWithdrawForm address="0x1234" />);

    const input = screen.getByTestId('withdraw-shares-input');
    await user.clear(input);
    await user.type(input, '0');

    expect(screen.getByTestId('withdraw-submit')).toBeDisabled();
  });
});
