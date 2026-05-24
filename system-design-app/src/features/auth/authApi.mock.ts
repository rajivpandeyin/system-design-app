export const mockSignupResponse = (overrides: Record<string, unknown> = {}) => ({
  token: 'fake-signup-token',
  refreshToken: 'fake-signup-refresh',
  user: { name: 'Test User', email: 'test@example.com' },
  ...overrides,
});

export const mockLoginResponse = (overrides: Record<string, unknown> = {}) => ({
  token: 'fake-login-token',
  refreshToken: 'fake-login-refresh',
  user: { name: 'Test User', email: 'test@example.com' },
  ...overrides,
});
