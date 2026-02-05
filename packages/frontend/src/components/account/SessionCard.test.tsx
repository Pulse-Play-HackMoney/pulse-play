import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionCard } from './SessionCard';

const mockUseClearnode = jest.fn();
jest.mock('@/providers/ClearnodeProvider', () => ({
  useClearnode: () => mockUseClearnode(),
}));

function defaultContext(overrides = {}) {
  return {
    status: 'disconnected',
    isSessionValid: false,
    expiresAt: 0,
    error: null,
    allowanceAmount: 1000,
    setAllowanceAmount: jest.fn(),
    reconnect: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('SessionCard', () => {
  beforeEach(() => {
    mockUseClearnode.mockReturnValue(defaultContext());
  });

  it('renders with "Not Authenticated" status when disconnected', () => {
    render(<SessionCard />);

    expect(screen.getByTestId('session-card')).toBeInTheDocument();
    expect(screen.getByTestId('session-status-badge')).toHaveTextContent('Not Authenticated');
  });

  it('shows "Active" badge when connected and session valid', () => {
    mockUseClearnode.mockReturnValue(
      defaultContext({
        status: 'connected',
        isSessionValid: true,
        expiresAt: Date.now() + 3600_000,
      }),
    );

    render(<SessionCard />);

    expect(screen.getByTestId('session-status-badge')).toHaveTextContent('Active');
  });

  it('shows "Expired" badge when connected but session not valid', () => {
    mockUseClearnode.mockReturnValue(
      defaultContext({
        status: 'connected',
        isSessionValid: false,
        expiresAt: Date.now() - 1000,
      }),
    );

    render(<SessionCard />);

    expect(screen.getByTestId('session-status-badge')).toHaveTextContent('Expired');
  });

  it('shows "Connecting..." badge during connecting status', () => {
    mockUseClearnode.mockReturnValue(
      defaultContext({ status: 'connecting' }),
    );

    render(<SessionCard />);

    expect(screen.getByTestId('session-status-badge')).toHaveTextContent('Connecting...');
  });

  it('shows "Error" badge and error message on error status', () => {
    mockUseClearnode.mockReturnValue(
      defaultContext({ status: 'error', error: 'Auth failed' }),
    );

    render(<SessionCard />);

    expect(screen.getByTestId('session-status-badge')).toHaveTextContent('Error');
    expect(screen.getByTestId('session-error')).toHaveTextContent('Auth failed');
  });

  it('shows session expiry time when connected', () => {
    mockUseClearnode.mockReturnValue(
      defaultContext({
        status: 'connected',
        isSessionValid: true,
        expiresAt: Date.now() + 90 * 60_000, // 90 minutes
      }),
    );

    render(<SessionCard />);

    expect(screen.getByTestId('session-expiry')).toHaveTextContent(/1h \d+m remaining/);
  });

  it('calls reconnect when re-authenticate button is clicked', async () => {
    const reconnect = jest.fn().mockResolvedValue(undefined);
    mockUseClearnode.mockReturnValue(
      defaultContext({ reconnect }),
    );

    const user = userEvent.setup();
    render(<SessionCard />);

    await user.click(screen.getByTestId('session-reconnect'));

    expect(reconnect).toHaveBeenCalledTimes(1);
  });

  it('disables reconnect button while connecting', () => {
    mockUseClearnode.mockReturnValue(
      defaultContext({ status: 'connecting' }),
    );

    render(<SessionCard />);

    expect(screen.getByTestId('session-reconnect')).toBeDisabled();
  });

  it('renders allowance input with default value', () => {
    render(<SessionCard />);

    const input = screen.getByTestId('allowance-input') as HTMLInputElement;
    expect(input.value).toBe('1000');
  });

  it('calls setAllowanceAmount when input changes', async () => {
    const setAllowanceAmount = jest.fn();
    mockUseClearnode.mockReturnValue(
      defaultContext({ setAllowanceAmount }),
    );

    const user = userEvent.setup();
    render(<SessionCard />);

    const input = screen.getByTestId('allowance-input');
    await user.clear(input);
    await user.type(input, '500');

    expect(setAllowanceAmount).toHaveBeenCalled();
  });
});
