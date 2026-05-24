export interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: {
    name: string;
    email: string;
  } | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
}
