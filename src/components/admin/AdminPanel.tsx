import { useState } from 'react'
import type { Profile } from '../../types'
import { Settings2, Users, CalendarX, ClipboardList } from 'lucide-react'
import { SettingsEditor } from './SettingsEditor'
import { UserManager } from './UserManager'
import { BlockSlotManager } from './BlockSlotManager'
import { BookingHistory } from './BookingHistory'

type Tab = 'settings' | 'users' | 'block' | 'history'

interface Props { profile: Profile }

export function AdminPanel({ profile }: Props) {
  const [tab, setTab] = useState<Tab>('history')

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'history',  label: 'Reservas',       icon: <ClipboardList size={16} /> },
    { id: 'block',    label: 'Bloquear slots',  icon: <CalendarX size={16} /> },
    { id: 'users',    label: 'Usuarios',        icon: <Users size={16} /> },
    { id: 'settings', label: 'Reglas',          icon: <Settings2 size={16} /> },
  ]

  return (
    <div className="admin-panel">
      <h2 className="panel-title">Panel de Administración</h2>
      <div className="tab-bar">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <div className="tab-content">
        {tab === 'settings' && <SettingsEditor />}
        {tab === 'users'    && <UserManager currentProfile={profile} />}
        {tab === 'block'    && <BlockSlotManager profile={profile} />}
        {tab === 'history'  && <BookingHistory isAdmin />}
      </div>
    </div>
  )
}
