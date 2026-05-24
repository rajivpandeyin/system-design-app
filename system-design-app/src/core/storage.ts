export interface StoredAuth {
  token: string | null;
  refreshToken: string | null;
  user: { name: string; email: string } | null;
}

const AUTH_KEY = 'system_design_app_auth_v1';

export function getAuthFromStorage(): StoredAuth {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return { token: null, refreshToken: null, user: null };
    return JSON.parse(raw) as StoredAuth;
  } catch (e) {
    console.warn('Failed to read auth from storage', e);
    return { token: null, refreshToken: null, user: null };
  }
}

export function saveAuthToStorage(payload: StoredAuth) {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Failed to save auth to storage', e);
  }
}

export function clearAuthStorage() {
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch (e) {
    console.warn('Failed to clear auth storage', e);
  }
}
