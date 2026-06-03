import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../types'
import toast from 'react-hot-toast'
import { Shield, ShieldOff, Ban, CheckCircle } from 'lucide-react'

interface Props { currentProfile: Profile }

export function UserManager({ currentProfile }: Props) {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchUsers() }, [])

  async function fetchUsers() {
    const { data } = await supabase.from('profiles').select('*').order('name')
    setUsers(data ?? [])
    setLoading(false)
  }

  async function toggleRole(user: Profile) {
    if (user.id === currentProfile.id) {
      toast.error('No puedes cambiarte el rol a ti mismo')
      return
    }
    const newRole = user.role === 'admin' ? 'member' : 'admin'
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', user.id)
    if (error) toast.error('Error al actualizar rol')
    else {
      toast.success(`${user.name} ahora es ${newRole === 'admin' ? 'administrador' : 'miembro'}`)
      fetchUsers()
    }
  }

  async function toggleBlock(user: Profile) {
    if (user.id === currentProfile.id) {
      toast.error('No puedes bloquearte a ti mismo')
      return
    }
    const newBlocked = !user.is_blocked
    const { error } = await supabase
      .from('profiles')
      .update({ is_blocked: newBlocked })
      .eq('id', user.id)
    if (error) {
      toast.error('Error al actualizar el usuario')
    } else {
      toast.success(newBlocked ? `${user.name} fue suspendido` : `${user.name} fue reactivado`)
      fetchUsers()
    }
  }

  if (loading) return <p className="loading-text">Cargando usuarios...</p>

  return (
    <div className="user-manager">
      <p className="settings-intro">{users.length} usuario(s) registrado(s)</p>
      <div className="user-list">
        {users.map(u => (
          <div key={u.id} className={`user-row ${u.role === 'admin' ? 'is-admin' : ''} ${u.is_blocked ? 'is-blocked' : ''}`}>
            <div className="user-details">
              <span className="user-full-name">
                {u.name}
                {u.is_blocked && <span className="blocked-badge">Suspendido</span>}
              </span>
              <span className="user-meta">{u.email} · Apt. {u.unit}</span>
            </div>
            <div className="user-actions">
              <span className={`role-badge ${u.role}`}>
                {u.role === 'admin' ? 'Admin' : 'Miembro'}
              </span>
              <button
                className="icon-btn"
                onClick={() => toggleRole(u)}
                title={u.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                disabled={u.id === currentProfile.id}
              >
                {u.role === 'admin' ? <ShieldOff size={16} /> : <Shield size={16} />}
              </button>
              <button
                className={`icon-btn ${u.is_blocked ? 'unblock' : 'danger'}`}
                onClick={() => toggleBlock(u)}
                title={u.is_blocked ? 'Reactivar usuario' : 'Suspender usuario'}
                disabled={u.id === currentProfile.id}
              >
                {u.is_blocked ? <CheckCircle size={16} /> : <Ban size={16} />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
