import { api, setAuthToken, clearAuthToken } from './api';

describe('api auth header helpers', () => {
  it('sets Authorization header when token provided', () => {
    setAuthToken('abc123');
    expect(api.defaults.headers.common['Authorization']).toBe('Bearer abc123');
    clearAuthToken();
    expect(api.defaults.headers.common['Authorization']).toBeUndefined();
  });
});
