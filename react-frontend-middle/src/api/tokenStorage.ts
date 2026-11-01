const ACCESS_TOKEN_KEY = 'middle-app.access-token'
const REFRESH_TOKEN_KEY = 'middle-app.refresh-token'
const USERNAME_KEY = 'middle-app.username'

export interface StoredSession {
  accessToken: string | null
  refreshToken: string | null
  username: string | null
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function readValue(key: string): string | null {
  try {
    return getStorage()?.getItem(key) ?? null
  } catch {
    return null
  }
}

function writeValue(key: string, value: string): void {
  try {
    getStorage()?.setItem(key, value)
  } catch {
    // Storage can be unavailable (private mode, quota, security settings).
  }
}

function removeValue(key: string): void {
  try {
    getStorage()?.removeItem(key)
  } catch {
    // Ignore storage cleanup failures.
  }
}

export function getAccessToken(): string | null {
  return readValue(ACCESS_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  return readValue(REFRESH_TOKEN_KEY)
}

export function getUsername(): string | null {
  return readValue(USERNAME_KEY)
}

export function loadSession(): StoredSession {
  return {
    accessToken: getAccessToken(),
    refreshToken: getRefreshToken(),
    username: getUsername(),
  }
}

export function saveSession(session: StoredSession): void {
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

export function saveAccessToken(accessToken: string): void {
  writeValue(ACCESS_TOKEN_KEY, accessToken)
}

export function clearSession(): void {
  removeValue(ACCESS_TOKEN_KEY)
  removeValue(REFRESH_TOKEN_KEY)
  removeValue(USERNAME_KEY)
}
