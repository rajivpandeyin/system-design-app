import { configureStore } from '@reduxjs/toolkit';
import authReducer, { login, signup, logout, setCredentials } from './authSlice';
import * as authApi from './authApi';
import { mockLoginResponse, mockSignupResponse } from './authApi.mock';

jest.mock('./authApi');

function createIsolatedStore() {
  return configureStore({
    reducer: { auth: authReducer },
  });
}

describe('auth thunks', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    localStorage.clear();
  });

  it('signup thunk stores token, refreshToken, and user on success', async () => {
    (authApi.signupRequest as jest.Mock).mockResolvedValue(mockSignupResponse());
    const store = createIsolatedStore();

    const result = await store.dispatch(signup({ name: 'A', email: 'a@x.com', password: 'secret' }));

    expect(signup.fulfilled.match(result)).toBe(true);
    const state = store.getState().auth;
    expect(state.token).toBe('fake-signup-token');
    expect(state.refreshToken).toBe('fake-signup-refresh');
    expect(state.user?.email).toBe('test@example.com');
    expect(state.status).toBe('succeeded');
  });

  it('login thunk stores token, refreshToken, and user on success', async () => {
    (authApi.loginRequest as jest.Mock).mockResolvedValue(mockLoginResponse());
    const store = createIsolatedStore();

    const result = await store.dispatch(login({ email: 'a@x.com', password: 'secret' }));

    expect(login.fulfilled.match(result)).toBe(true);
    const state = store.getState().auth;
    expect(state.token).toBe('fake-login-token');
    expect(state.refreshToken).toBe('fake-login-refresh');
    expect(state.user?.email).toBe('test@example.com');
  });

  it('login thunk sets error on failure', async () => {
    (authApi.loginRequest as jest.Mock).mockRejectedValue({
      response: { data: { message: 'Invalid credentials' } },
    });
    const store = createIsolatedStore();

    const result = await store.dispatch(login({ email: 'bad@x.com', password: 'wrong' }));

    expect(login.rejected.match(result)).toBe(true);
    expect(store.getState().auth.status).toBe('failed');
    expect(store.getState().auth.error).toBe('Invalid credentials');
  });

  it('logout reducer clears auth state', () => {
    const store = createIsolatedStore();
    const mock = mockLoginResponse();
    store.dispatch(
      setCredentials({
        token: mock.token,
        refreshToken: mock.refreshToken,
        user: mock.user,
      })
    );
    store.dispatch(logout());
    expect(store.getState().auth.token).toBeNull();
    expect(store.getState().auth.user).toBeNull();
  });
});
