import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../app/hooks'
import {
  logout,
  selectAuthStatus,
  selectUsername,
} from '../features/auth/authSlice'
import { CitiesPage } from './CitiesPage'
import { RegionsPage } from './RegionsPage'

type DashboardTab = 'regions' | 'cities'

export const AppShell = () => {
  const dispatch = useAppDispatch()
  const username = useAppSelector(selectUsername)
  const authStatus = useAppSelector(selectAuthStatus)
  const [tab, setTab] = useState<DashboardTab>('regions')

  const isLoggingOut = authStatus === 'loading'

  const handleLogout = () => {
    if (!isLoggingOut) {
      void dispatch(logout())
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              РГ
            </span>
            <div className="brand-text">
              <strong>Регионы и города</strong>
              <span>Flask Middle</span>
            </div>
          </div>

          <div className="user-area">
            {username ? (
              <span className="user-chip" title={username}>
                <span className="user-avatar" aria-hidden="true">
                  {username.slice(0, 1).toUpperCase()}
                </span>
                <span className="user-name">{username}</span>
              </span>
            ) : null}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? 'Выходим…' : 'Выйти'}
            </button>
          </div>
        </div>

        <div className="app-nav-wrap">
          <nav className="app-nav" aria-label="Основная навигация">
            <button
              type="button"
              className={tab === 'regions' ? 'nav-tab is-active' : 'nav-tab'}
              aria-current={tab === 'regions' ? 'page' : undefined}
              onClick={() => setTab('regions')}
            >
              Регионы
            </button>
            <button
              type="button"
              className={tab === 'cities' ? 'nav-tab is-active' : 'nav-tab'}
              aria-current={tab === 'cities' ? 'page' : undefined}
              onClick={() => setTab('cities')}
            >
              Города
            </button>
          </nav>
        </div>
      </header>

      <main className="app-main">
        {tab === 'regions' ? <RegionsPage /> : <CitiesPage />}
      </main>
    </div>
  )
}
