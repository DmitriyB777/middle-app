import { useAppSelector } from './app/hooks'
import { AppShell } from './components/AppShell'
import { AuthPage } from './components/AuthPage'
import { selectIsAuthenticated } from './features/auth/authSlice'

function App() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)

  return isAuthenticated ? <AppShell /> : <AuthPage />
}

export default App
