import { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { useAuth } from './hooks/useAuth'
import { LoginPage } from './components/auth/LoginPage'
import { CompleteProfile } from './components/auth/CompleteProfile'
import { Header } from './components/shared/Header'
import { CalendarPage } from './pages/CalendarPage'
import { AdminPanel } from './components/admin/AdminPanel'

type Page = 'calendar' | 'admin'

export default function App() {
  const { user, profile, loading, signOut } = useAuth()
  const [page, setPage] = useState<Page>('calendar')

  if (loading) {
    return (
      <div className="splash">
        <div className="splash-content">
          <span className="court-icon">🎾</span>
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) return <LoginPage />

  if (!profile) return <CompleteProfile user={user} onComplete={() => window.location.reload()} />

  return (
    <div className="app">
      <Toaster position="top-center" />
      <Header profile={profile} currentPage={page} onNavigate={setPage} onSignOut={signOut} />
      {page === 'calendar' && <CalendarPage profile={profile} />}
      {page === 'admin' && profile.role === 'admin' && <AdminPanel profile={profile} />}
      {page === 'admin' && profile.role !== 'admin' && (
        <main className="page-main">
          <p className="error-msg">Acceso denegado</p>
        </main>
      )}
    </div>
  )
}
