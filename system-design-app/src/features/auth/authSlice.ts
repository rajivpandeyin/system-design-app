import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { AuthState, LoginPayload, SignupPayload } from './authTypes';
import { loginRequest, signupRequest, refreshTokenRequest, logoutRequest } from './authApi';

const initialState: AuthState = {
  token: null,
  refreshToken: null,
  user: null,
  status: 'idle',
  error: null,
};

export const login = createAsyncThunk(
  'auth/login',
  async (payload: LoginPayload, { rejectWithValue }) => {
    try {
      const data = await loginRequest(payload);
      return data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const signup = createAsyncThunk(
  'auth/signup',
  async (payload: SignupPayload, { rejectWithValue }) => {
    try {
      const data = await signupRequest(payload);
      return data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const refreshAuth = createAsyncThunk(
  'auth/refresh',
  async (refreshToken: string, { rejectWithValue }) => {
    try {
      const data = await refreshTokenRequest(refreshToken);
      return data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

export const doLogout = createAsyncThunk(
  'auth/logout',
  async (refreshToken: string, { rejectWithValue }) => {
    try {
      await logoutRequest(refreshToken);
      return true;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || error.message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.token = null;
      state.refreshToken = null;
      state.user = null;
      state.status = 'idle';
      state.error = null;
    },
    setCredentials(
      state,
      action: PayloadAction<{ token: string; refreshToken: string; user: { name: string; email: string } }>
    ) {
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
      state.user = action.payload.user;
      state.status = 'succeeded';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
        state.user = action.payload.user;
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      })
      .addCase(signup.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(signup.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
        state.user = action.payload.user;
      })
      .addCase(signup.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      })
      .addCase(refreshAuth.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
      })
      .addCase(refreshAuth.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      })
      .addCase(doLogout.fulfilled, (state) => {
        state.token = null;
        state.refreshToken = null;
        state.user = null;
        state.status = 'idle';
        state.error = null;
      })
      .addCase(doLogout.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      });
  },
});

export const { logout, setCredentials } = authSlice.actions;
export default authSlice.reducer;
