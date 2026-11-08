import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { apiRequest, getErrorMessage } from '../../api/client'
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  loadSession,
  saveSession,
} from '../../api/tokenStorage'
import type { RootState } from '../../app/store'
import type {
  Credentials,
  LoginResponse,
  RequestStatus,
} from '../../types/api'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  username: string | null
  status: RequestStatus
  error: string | null
}

const createInitialState = (): AuthState => {
  const session = loadSession()

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    username: session.username,
    status: 'idle',
    error: null,
  }
}

const initialState: AuthState = createInitialState()

export const login = createAsyncThunk<
  LoginResponse,
  Credentials,
  { rejectValue: string }
>('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const response = await apiRequest<LoginResponse>('/login', {
      method: 'POST',
      body: credentials,
      auth: false,
    })

    saveSession({
      accessToken: response.tokens.access,
      refreshToken: response.tokens.refresh,
      username: credentials.username,
    })

    return response
  } catch (error) {
    return rejectWithValue(getErrorMessage(error))
  }
})

export const register = createAsyncThunk<
  LoginResponse,
  Credentials,
  { rejectValue: string }
>('auth/register', async (credentials, { dispatch, rejectWithValue }) => {
  try {
    await apiRequest<{ message: string }>('/register', {
      method: 'POST',
      body: credentials,
      auth: false,
    })

    return await dispatch(login(credentials)).unwrap()
  } catch (error) {
    return rejectWithValue(getErrorMessage(error))
  }
})

export const logout = createAsyncThunk<void, void>('auth/logout', async () => {
  const revokeToken = async (token: string | null): Promise<void> => {
    if (!token) {
      return
    }

    try {
      await apiRequest('/logout', {
        method: 'GET',
        skipRefresh: true,
        token,
      })
    } catch {
      // Logout is best-effort: revoke what we can and clear the local session.
    }
  }

  try {
    await Promise.all([
      revokeToken(getAccessToken()),
      revokeToken(getRefreshToken()),
    ])
  } finally {
    clearSession()
  }
})

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionExpired: (state) => {
      state.accessToken = null
      state.refreshToken = null
      state.username = null
      state.status = 'idle'
      state.error = 'Сессия истекла. Войдите снова.'
    },
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.accessToken = action.payload.tokens.access
        state.refreshToken = action.payload.tokens.refresh
        state.username = action.meta.arg.username
        state.error = null
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'failed'
        state.error =
          action.payload ?? 'Не удалось выполнить вход. Попробуйте ещё раз.'
      })
      .addCase(register.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(register.fulfilled, (state, action) => {
        state.status = 'succeeded'
        state.accessToken = action.payload.tokens.access
        state.refreshToken = action.payload.tokens.refresh
        state.username = action.meta.arg.username
        state.error = null
      })
      .addCase(register.rejected, (state, action) => {
        state.status = 'failed'
        state.error =
          action.payload ?? 'Не удалось зарегистрироваться. Попробуйте ещё раз.'
      })
      .addCase(logout.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(logout.fulfilled, (state) => {
        state.accessToken = null
        state.refreshToken = null
        state.username = null
        state.status = 'idle'
        state.error = null
      })
  },
})

export const { sessionExpired, clearError } = authSlice.actions

export const selectAuth = (state: RootState) => state.auth
export const selectAuthStatus = (state: RootState) => state.auth.status
export const selectAuthError = (state: RootState) => state.auth.error
export const selectUsername = (state: RootState) => state.auth.username
export const selectIsAuthenticated = (state: RootState) =>
  Boolean(state.auth.accessToken)

export const authReducer = authSlice.reducer
