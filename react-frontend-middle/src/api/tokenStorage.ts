const ACCESS_TOKEN_KEY = 'middle-app.access-token'
const REFRESH_TOKEN_KEY = 'middle-app.refresh-token'
const USERNAME_KEY = 'middle-app.username'

export interface StoredSession {
  accessToken: string | null
  refreshToken: string | null
  username: string | null
}

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

const readValue = (key: string): string | null => {
  try {
    return getStorage()?.getItem(key) ?? null
  } catch {
    return null
  }
}

const writeValue = (key: string, value: string): void => {
  try {
    getStorage()?.setItem(key, value)
  } catch {
    // Storage can be unavailable (private mode, quota, security settings).
  }
}

const removeValue = (key: string): void => {
  try {
    getStorage()?.removeItem(key)
  } catch {
    // Ignore storage cleanup failures.
  }
}

export const getAccessToken = (): string | null => {
  return readValue(ACCESS_TOKEN_KEY)
}

export const getRefreshToken = (): string | null => {
  return readValue(REFRESH_TOKEN_KEY)
}

export const getUsername = (): string | null => {
  return readValue(USERNAME_KEY)
}

export const loadSession = (): StoredSession => {
  return {
    accessToken: getAccessToken(),
    refreshToken: getRefreshToken(),
    username: getUsername(),
  }
}

export const saveSession = (session: StoredSession): void => {
  if (session.accessToken) {
    writeValue(ACCESS_TOKEN_KEY, session.accessToken)
  } else {
    removeValue(ACCESS_TOKEN_KEY)
  }

  if (session.refreshToken) {
    writeValue(REFRESH_TOKEN_KEY, session.refreshToken)
  } else {
    removeValue(REFRESH_TOKEN_KEY)
  }

  if (session.username) {
    writeValue(USERNAME_KEY, session.username)
  } else {
    removeValue(USERNAME_KEY)
  }
}

export const saveAccessToken = (accessToken: string): void => {
  writeValue(ACCESS_TOKEN_KEY, accessToken)
}

export const clearSession = (): void => {
  removeValue(ACCESS_TOKEN_KEY)
  removeValue(REFRESH_TOKEN_KEY)
  removeValue(USERNAME_KEY)
}
