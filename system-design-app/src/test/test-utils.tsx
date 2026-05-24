import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore, PreloadedState } from '@reduxjs/toolkit';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import authReducer from '../features/auth/authSlice';
import type { AuthState } from '../features/auth/authTypes';
import type { RootState } from '../store/store';

const defaultAuthState: AuthState = {
  token: null,
  refreshToken: null,
  user: null,
  status: 'idle',
  error: null,
};

export function createTestStore(preloadedState?: PreloadedState<{ auth: AuthState }>) {
  return configureStore({
    reducer: { auth: authReducer },
    preloadedState,
  });
}

type RenderWithProvidersOptions = Omit<RenderOptions, 'wrapper'> & {
  preloadedAuth?: Partial<AuthState>;
  initialEntries?: string[];
};

export function renderWithProviders(ui: ReactElement, options: RenderWithProvidersOptions = {}) {
  const { preloadedAuth, initialEntries = ['/'], ...renderOptions } = options;
  const store = createTestStore(
    preloadedAuth
      ? {
          auth: { ...defaultAuthState, ...preloadedAuth },
        }
      : undefined
  );

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </Provider>
    );
  }

  return {
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

export function renderWithBrowserRouter(ui: ReactElement, options: RenderWithProvidersOptions = {}) {
  const { preloadedAuth, ...renderOptions } = options;
  const store = createTestStore(
    preloadedAuth
      ? {
          auth: { ...defaultAuthState, ...preloadedAuth },
        }
      : undefined
  );

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <BrowserRouter>{children}</BrowserRouter>
      </Provider>
    );
  }

  return {
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

export type TestStore = ReturnType<typeof createTestStore>;
export type TestRootState = RootState;
