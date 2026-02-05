import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MMBalanceCard } from './MMBalanceCard';
import * as api from '@/lib/api';

jest.mock('@/lib/api');

const mockGetMMInfo = api.getMMInfo as jest.MockedFunction<typeof api.getMMInfo>;

describe('MMBalanceCard', () => {
  beforeEach(() => {
    mockGetMMInfo.mockReset();
  });

  it('renders loading state initially', () => {
    mockGetMMInfo.mockReturnValue(new Promise(() => {})); // never resolves
    render(<MMBalanceCard />);

    expect(screen.getByTestId('mm-balance-loading')).toBeInTheDocument();
  });

  it('displays address, balance, and connection status after fetch', async () => {
    mockGetMMInfo.mockResolvedValueOnce({
      address: '0x1234567890abcdef1234567890abcdef12345678',
      balance: '10000000',
      isConnected: true,
    });

    render(<MMBalanceCard />);

    await waitFor(() => {
      expect(screen.getByTestId('mm-balance-card')).toBeInTheDocument();
    });

    expect(screen.getByTestId('mm-address')).toHaveTextContent('0x1234...5678');
    expect(screen.getByTestId('mm-balance')).toHaveTextContent('$10.00');
    expect(screen.getByTestId('mm-connection-status')).toHaveTextContent('Connected');
  });

  it('refresh button triggers re-fetch', async () => {
    const user = userEvent.setup();
    mockGetMMInfo
      .mockResolvedValueOnce({
        address: '0xABCD',
        balance: '5000000',
        isConnected: true,
      })
      .mockResolvedValueOnce({
        address: '0xABCD',
        balance: '15000000',
        isConnected: true,
      });

    render(<MMBalanceCard />);

    await waitFor(() => {
      expect(screen.getByTestId('mm-balance-card')).toBeInTheDocument();
    });

    expect(screen.getByTestId('mm-balance')).toHaveTextContent('$5.00');

    await user.click(screen.getByTestId('mm-refresh-button'));

    await waitFor(() => {
      expect(screen.getByTestId('mm-balance')).toHaveTextContent('$15.00');
    });

    expect(mockGetMMInfo).toHaveBeenCalledTimes(2);
  });

  it('displays error on API failure', async () => {
    mockGetMMInfo.mockRejectedValueOnce(new Error('Server error'));

    render(<MMBalanceCard />);

    await waitFor(() => {
      expect(screen.getByTestId('mm-balance-error')).toBeInTheDocument();
    });

    expect(screen.getByText('Server error')).toBeInTheDocument();
  });

  it('shows disconnected status when not connected', async () => {
    mockGetMMInfo.mockResolvedValueOnce({
      address: '0xABCD',
      balance: '0',
      isConnected: false,
    });

    render(<MMBalanceCard />);

    await waitFor(() => {
      expect(screen.getByTestId('mm-connection-status')).toHaveTextContent('Disconnected');
    });
  });
});
