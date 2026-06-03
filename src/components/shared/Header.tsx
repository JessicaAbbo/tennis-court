import { LogOut, Settings, CalendarDays } from 'lucide-react'
import type { Profile } from '../../types'

interface Props {
  profile: Profile
  currentPage: 'calendar' | 'admin'
  onNavigate: (page: 'calendar' | 'admin') => void
  onSignOut: () => void
}

export function Header({ profile, currentPage, onNavigate, onSignOut }: Props) {
  return (
    <header className="app-header">
      <div className="header-brand">
        <span className="court-icon-sm">🎾</span>
        <span className="brand-name">Cancha de Tenis · PH Bayshore</span>
      </div>

      <nav className="header-nav">
        <button
          className={`nav-btn ${currentPage === 'calendar' ? 'active' : ''}`}
          onClick={() => onNavigate('calendar')}
        >
          <CalendarDays size={16} />
          <span>Calendario</span>
        </button>
        {profile.role === 'admin' && (
          <button
            className={`nav-btn ${currentPage === 'admin' ? 'active' : ''}`}
            onClick={() => onNavigate('admin')}
          >
            <Settings size={16} />
            <span>Administrar</span>
          </button>
        )}
      </nav>

      <div className="header-user">
        <span className="user-info">
          <span className="user-name">{profile.name}</span>
          <span className="user-unit">Apt. {profile.unit}</span>
          {profile.role === 'admin' && <span className="badge-admin">Admin</span>}
        </span>
        <button className="icon-btn" onClick={onSignOut} title="Cerrar sesión">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}
