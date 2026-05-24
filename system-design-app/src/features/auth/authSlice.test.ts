import authReducer, { logout, setCredentials, login, signup } from './authSlice';
import type { AuthState } from './authTypes';

const initialState: AuthState = {
  token: null,
  refreshToken: null,
  user: null,
  status: 'idle',
  error: null,
};

describe('auth slice reducer', () => {
  it('handles setCredentials', () => {
    const next = authReducer(
      initialState,
      setCredentials({
        token: 'abc',
        refreshToken: 'refresh-abc',
        user: { name: 'Joe', email: 'joe@example.com' },
      })
    );
    expect(next.token).toBe('abc');
    expect(next.refreshToken).toBe('refresh-abc');
    expect(next.user).toEqual({ name: 'Joe', email: 'joe@example.com' });
    expect(next.status).toBe('succeeded');
    expect(next.error).toBeNull();
  });

  it('handles logout', () => {
    const populated: AuthState = {
      token: 'abc',
      refreshToken: 'refresh-abc',
      user: { name: 'Joe', email: 'joe@example.com' },
      status: 'succeeded',
      error: null,
    };
    const next = authReducer(populated, logout());
    expect(next).toEqual(initialState);
  });

  it('handles login.fulfilled', () => {
    const next = authReducer(
      { ...initialState, status: 'loading' },
      {
        type: login.fulfilled.type,
        payload: {
          token: 'login-token',
          refreshToken: 'login-refresh',
          user: { name: 'Jane', email: 'jane@example.com' },
        },
      }
    );
    expect(next.token).toBe('login-token');
    expect(next.refreshToken).toBe('login-refresh');
    expect(next.user?.email).toBe('jane@example.com');
    expect(next.status).toBe('succeeded');
  });

  it('handles login.rejected', () => {
    const next = authReducer(
      { ...initialState, status: 'loading' },
      { type: login.rejected.type, payload: 'Invalid credentials' }
    );
    expect(next.status).toBe('failed');
    expect(next.error).toBe('Invalid credentials');
    expect(next.token).toBeNull();
  });

  it('handles signup.fulfilled', () => {
    const next = authReducer(
      { ...initialState, status: 'loading' },
      {
        type: signup.fulfilled.type,
        payload: {
          token: 'signup-token',
          refreshToken: 'signup-refresh',
          user: { name: 'New', email: 'new@example.com' },
        },
      }
    );
    expect(next.token).toBe('signup-token');
    expect(next.user?.name).toBe('New');
    expect(next.status).toBe('succeeded');
  });
});
