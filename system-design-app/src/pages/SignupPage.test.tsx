import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import SignupPage from './SignupPage';
import { renderWithBrowserRouter } from '../test/test-utils';
import * as authApi from '../features/auth/authApi';
import { mockSignupResponse } from '../features/auth/authApi.mock';

jest.mock('../features/auth/authApi');

describe('SignupPage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
  });

  it('renders signup form inputs', () => {
    renderWithBrowserRouter(<SignupPage />);
    expect(screen.getByLabelText(/Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /signup/i })).toBeInTheDocument();
  });

  it('shows validation errors for invalid submit', async () => {
    const user = userEvent.setup();
    renderWithBrowserRouter(<SignupPage />);

    await user.click(screen.getByRole('button', { name: /signup/i }));

    expect(await screen.findByText(/name must contain/i)).toBeInTheDocument();
    expect(authApi.signupRequest).not.toHaveBeenCalled();
  });

  it('dispatches signup on valid submit', async () => {
    (authApi.signupRequest as jest.Mock).mockResolvedValue(mockSignupResponse());
    const user = userEvent.setup();
    const { store } = renderWithBrowserRouter(<SignupPage />);

    await user.type(screen.getByLabelText(/Name/i), 'Jane Doe');
    await user.type(screen.getByLabelText(/Email/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/Password/i), 'password1');
    await user.click(screen.getByRole('button', { name: /signup/i }));

    await waitFor(() => {
      expect(store.getState().auth.token).toBe('fake-signup-token');
    });
    expect(authApi.signupRequest).toHaveBeenCalledWith({
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'password1',
    });
  });
});
