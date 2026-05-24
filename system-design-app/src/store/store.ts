import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import { getAuthFromStorage, saveAuthToStorage } from '../core/storage';
import { setAuthToken } from '../lib/api';

const stored = getAuthFromStorage();

const preloadedState = {
  auth: {
    token: stored.token,
    refreshToken: stored.refreshToken,
    user: stored.user,
    status: stored.token ? 'succeeded' as const : 'idle' as const,
    error: null,
  },
};

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
  preloadedState,
});

// Persist auth changes to localStorage and keep Axios Authorization header in sync.
store.subscribe(() => {
  try {
    const state = store.getState() as RootState;
    saveAuthToStorage({
      token: state.auth.token,
      refreshToken: state.auth.refreshToken,
      user: state.auth.user,
    });
    setAuthToken(state.auth.token);
  } catch (e) {
    // swallow
  }
});

// Ensure axios has auth header if token exists on startup
setAuthToken(stored.token);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
