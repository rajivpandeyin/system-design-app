import { api } from '../../lib/api';
import type { LoginPayload, SignupPayload } from './authTypes';

export async function loginRequest(payload: LoginPayload) {
  const response = await api.post('/auth/login', payload);
  return response.data;
}

export async function signupRequest(payload: SignupPayload) {
  const response = await api.post('/auth/signup', payload);
  return response.data;
}

export async function refreshTokenRequest(refreshToken: string) {
  const response = await api.post('/auth/refresh', { refreshToken });
  return response.data;
}

export async function logoutRequest(refreshToken: string) {
  const response = await api.post('/auth/logout', { refreshToken });
  return response.data;
}
