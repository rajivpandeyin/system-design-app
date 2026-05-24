import { clearAuthStorage, getAuthFromStorage, saveAuthToStorage } from './storage';

describe('auth storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty auth when nothing stored', () => {
    expect(getAuthFromStorage()).toEqual({
      token: null,
      refreshToken: null,
      user: null,
    });
  });

  it('saves and reads auth payload', () => {
    saveAuthToStorage({
      token: 'tok',
      refreshToken: 'ref',
      user: { name: 'Test', email: 'test@example.com' },
    });
    expect(getAuthFromStorage()).toEqual({
      token: 'tok',
      refreshToken: 'ref',
      user: { name: 'Test', email: 'test@example.com' },
    });
  });

  it('clears stored auth', () => {
    saveAuthToStorage({
      token: 'tok',
      refreshToken: 'ref',
      user: { name: 'Test', email: 'test@example.com' },
    });
    clearAuthStorage();
    expect(getAuthFromStorage().token).toBeNull();
  });
});
