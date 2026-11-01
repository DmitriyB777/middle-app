import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  saveAccessToken,
} from './tokenStorage'

const API_BASE = '/api'

const NETWORK_ERROR_MESSAGE =
  'Не удалось связаться с сервером. Проверьте, что backend запущен и доступен через прокси.'

const NO_REFRESH_PATHS = new Set(['/login', '/register', '/refresh', '/logout'])

const MESSAGE_TRANSLATIONS: Record<string, string> = {
  'Invalid username or password': 'Неверное имя пользователя или пароль.',
  'User already exists': 'Пользователь с таким именем уже существует.',
  'Bad Request': 'Некорректные данные запроса.',
  'Internal Server Error': 'Внутренняя ошибка сервера. Попробуйте позже.',
  'Parent region not found': 'Родительский регион не найден.',
  'Region not found': 'Регион не найден.',
  'Not found': 'Запись не найдена.',
  'A region cannot be its own parent': 'Регион не может быть родителем сам себе.',
  'Cannot move a region to one of its own descendants':
    'Нельзя переместить регион в собственного потомка.',
  'No cities or sub-regions found for this region':
    'Для этого региона нет городов и подрегионов.',
  'Token has expired': 'Сессия истекла. Войдите снова.',
  'Signature verification failed': 'Сессия истекла. Войдите снова.',
  "Request doesn't contain valid token": 'Сессия истекла. Войдите снова.',
  'Token has been revoked': 'Сессия истекла. Войдите снова.',
  authorization_token: 'Сессия истекла. Войдите снова.',
  invalid_token: 'Сессия истекла. Войдите снова.',
  expired_token: 'Сессия истекла. Войдите снова.',
}

export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  auth?: boolean
  skipRefresh?: boolean
}

let unauthorizedHandler: (() => void) | null = null
let refreshInFlight: Promise<string> | null = null

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

function notifyUnauthorized(): void {
  unauthorizedHandler?.()
}

function invalidateSession(): void {
  clearSession()
  notifyUnauthorized()
}

function extractMessage(body: unknown): string | null {
  if (typeof body === 'string' && body.trim()) {
    return body.trim()
  }

  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>
    for (const key of ['error', 'message', 'msg']) {
      const value = record[key]
      if (typeof value === 'string' && value.trim()) {
        return value.trim()
      }
    }
  }

  return null
}

function translateMessage(message: string): string {
  return MESSAGE_TRANSLATIONS[message] ?? message
}

function buildErrorMessage(body: unknown, status: number): string {
  const extracted = extractMessage(body)
  if (!extracted) {
    return `HTTP ${status}`
  }

  return translateMessage(extracted)
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

async function createApiError(response: Response): Promise<ApiError> {
  const body = await parseResponseBody(response)
  return new ApiError(
    response.status,
    body,
    buildErrorMessage(body, response.status),
  )
}

async function performFetch(
  path: string,
  method: string,
  body: unknown,
  accessToken: string | null,
): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  try {
    return await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, null, NETWORK_ERROR_MESSAGE)
  }
}

async function performRefresh(): Promise<string> {
  const refreshToken = getRefreshToken()

  if (!refreshToken) {
    invalidateSession()
    throw new ApiError(401, null, 'Сессия истекла. Войдите снова.')
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}/refresh`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${refreshToken}`,
      },
    })
  } catch {
    invalidateSession()
    throw new ApiError(0, null, NETWORK_ERROR_MESSAGE)
  }

  const body = await parseResponseBody(response)

  if (!response.ok) {
    invalidateSession()
    throw new ApiError(
      response.status,
      body,
      buildErrorMessage(body, response.status),
    )
  }

  const accessToken =
    body && typeof body === 'object'
      ? (body as { access_token?: unknown }).access_token
      : undefined

  if (typeof accessToken !== 'string' || !accessToken) {
    invalidateSession()
    throw new ApiError(
      response.status,
      body,
      'Сервер не вернул новый access-токен.',
    )
  }

  if (getRefreshToken() !== refreshToken) {
    throw new ApiError(401, null, 'Сессия истекла. Войдите снова.')
  }

  saveAccessToken(accessToken)
  return accessToken
}

function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null
    })
  }

  return refreshInFlight
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const method = options.method ?? 'GET'
  const requiresAuth = options.auth ?? true
  const skipRefresh =
    options.skipRefresh === true || NO_REFRESH_PATHS.has(path)

  let accessToken = requiresAuth ? getAccessToken() : null
  let response = await performFetch(path, method, options.body, accessToken)

  if (response.status === 401 && requiresAuth && !skipRefresh) {
    if (!getRefreshToken()) {
      const error = await createApiError(response)
      invalidateSession()
      throw error
    }

    accessToken = await refreshAccessToken()
    response = await performFetch(path, method, options.body, accessToken)

    if (response.status === 401) {
      const error = await createApiError(response)
      invalidateSession()
      throw error
    }
  }

  if (!response.ok) {
    throw await createApiError(response)
  }

  const body = await parseResponseBody(response)
  return body as T
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }

  if (typeof error === 'string' && error.trim()) {
    return error
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Неизвестная ошибка. Попробуйте ещё раз.'
}

export { NETWORK_ERROR_MESSAGE }
