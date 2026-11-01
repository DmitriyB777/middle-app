import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import {
  clearError,
  login,
  register,
  selectAuthError,
  selectAuthStatus,
} from '../features/auth/authSlice'

type AuthMode = 'login' | 'register'

const proxyTarget =
  import.meta.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000'

export function AuthPage() {
  const dispatch = useAppDispatch()
  const status = useAppSelector(selectAuthStatus)
  const storeError = useAppSelector(selectAuthError)

  const [mode, setMode] = useState<AuthMode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const isLoading = status === 'loading'

  const switchMode = (nextMode: AuthMode) => {
    if (nextMode === mode) {
      return
    }

    setMode(nextMode)
    setFormError(null)
    setPassword('')
    setPasswordConfirmation('')
    dispatch(clearError())
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isLoading) {
      return
    }

    const trimmedUsername = username.trim()

    if (!trimmedUsername || !password) {
      setFormError('Введите имя пользователя и пароль.')
      return
    }

    if (mode === 'register' && password !== passwordConfirmation) {
      setFormError('Пароли не совпадают.')
      return
    }

    setFormError(null)

    try {
      const credentials = { username: trimmedUsername, password }

      if (mode === 'login') {
        await dispatch(login(credentials)).unwrap()
      } else {
        await dispatch(register(credentials)).unwrap()
      }
    } catch {
      // The error is rendered from the auth store.
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true">
            РГ
          </span>
          <div>
            <p className="eyebrow">Flask Middle</p>
            <h1 id="auth-title">Регионы и города</h1>
          </div>
        </div>

        <p className="auth-lead">
          Войдите или создайте аккаунт, чтобы управлять иерархией регионов и
          городами.
        </p>

        <div className="segmented" role="group" aria-label="Режим входа">
          <button
            type="button"
            aria-pressed={mode === 'login'}
            className={mode === 'login' ? 'segmented-item is-active' : 'segmented-item'}
            onClick={() => switchMode('login')}
          >
            Вход
          </button>
          <button
            type="button"
            aria-pressed={mode === 'register'}
            className={
              mode === 'register' ? 'segmented-item is-active' : 'segmented-item'
            }
            onClick={() => switchMode('register')}
          >
            Регистрация
          </button>
        </div>

        <form className="form-stack" onSubmit={handleSubmit} noValidate>
          <label className="field">
            <span>Имя пользователя</span>
            <input
              type="text"
              name="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
              disabled={isLoading}
              autoFocus
            />
          </label>

          <label className="field">
            <span>Пароль</span>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              disabled={isLoading}
            />
          </label>

          {mode === 'register' ? (
            <label className="field">
              <span>Повторите пароль</span>
              <input
                type="password"
                name="password-confirmation"
                value={passwordConfirmation}
                onChange={(event) =>
                  setPasswordConfirmation(event.target.value)
                }
                autoComplete="new-password"
                required
                disabled={isLoading}
              />
            </label>
          ) : null}

          {formError || storeError ? (
            <div className="alert alert-error" role="alert">
              {formError ?? storeError}
            </div>
          ) : null}

          <button type="submit" className="btn btn-primary btn-block" disabled={isLoading}>
            {isLoading
              ? 'Подождите…'
              : mode === 'login'
                ? 'Войти'
                : 'Зарегистрироваться'}
          </button>
        </form>

        <p className="hint">
          API: <code>/api</code> → <code>{proxyTarget}</code>
          <br />
          Убедитесь, что backend запущен на этом адресе.
        </p>
      </section>
    </main>
  )
}
