import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import LoginPage from './LoginPage';
import { renderWithBrowserRouter } from '../test/test-utils';
import * as authApi from '../features/auth/authApi';
import { mockLoginResponse } from '../features/auth/authApi.mock';

jest.mock('../features/auth/authApi');

describe('LoginPage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
  });

  it('renders login form inputs', () => {
    renderWithBrowserRouter(<LoginPage />);
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('shows validation errors for invalid submit', async () => {
    const user = userEvent.setup();
    renderWithBrowserRouter(<LoginPage />);

    await user.click(screen.getByRole('button', { name: /login/i }));

    expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument();
    expect(authApi.loginRequest).not.toHaveBeenCalled();
  });

  it('dispatches login on valid submit', async () => {
    (authApi.loginRequest as jest.Mock).mockResolvedValue(mockLoginResponse());
    const user = userEvent.setup();
    const { store } = renderWithBrowserRouter(<LoginPage />);

    await user.type(screen.getByLabelText(/Email/i), 'user@example.com');
    await user.type(screen.getByLabelText(/Password/i), 'password1');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(store.getState().auth.token).toBe('fake-login-token');
    });
    expect(authApi.loginRequest).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password1',
    });
  });
});
