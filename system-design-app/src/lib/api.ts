import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:4005',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

/**
 * Set the Authorization header for all requests.
 * Call `setAuthToken(token)` after login and on store hydration.
 */
export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

export function clearAuthToken() {
  delete api.defaults.headers.common['Authorization'];
}
