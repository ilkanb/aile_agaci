import { create } from 'zustand'
import type { Role, User } from '../types'

const USERS_KEY = 'aile-agaci-users-v1'
const SESSION_KEY = 'aile-agaci-session-v1'

// Shared secret to bootstrap the first admin account(s) at registration time.
// This is a client-only prototype (no backend) so this is identification, not
// real security — anyone with devtools access can read localStorage regardless.
const ADMIN_SETUP_PIN = '2026'

interface StoredShape {
  users: Record<string, User>
}

function loadUsers(): Record<string, User> {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (raw) return (JSON.parse(raw) as StoredShape).users
  } catch {
    // ignore corrupt storage
  }
  return {}
}

function persistUsers(users: Record<string, User>) {
  localStorage.setItem(USERS_KEY, JSON.stringify({ users }))
}

function loadSession(): string | null {
  return localStorage.getItem(SESSION_KEY)
}

async function hashPassword(username: string, password: string): Promise<string> {
  const input = `${username.toLocaleLowerCase('tr')}::${password}::aile-agaci-salt-v1`
  if (window.crypto?.subtle) {
    const data = new TextEncoder().encode(input)
    const digest = await window.crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
  // Fallback for non-secure contexts (e.g. plain http on a LAN address) where
  // crypto.subtle is unavailable. Still not real security, just avoids storing
  // the raw password.
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0
  }
  return `fallback-${h}`
}

export function canApprove(user: User | null | undefined): boolean {
  return user?.role === 'admin' || user?.role === 'editor'
}

interface AuthStore {
  users: Record<string, User>
  currentUserId: string | null
  currentUser: () => User | null
  register: (username: string, password: string, adminPin: string) => Promise<{ ok: boolean; error?: string }>
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  setRole: (userId: string, role: Role) => void
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  users: loadUsers(),
  currentUserId: loadSession(),

  currentUser: () => {
    const id = get().currentUserId
    return id ? get().users[id] ?? null : null
  },

  register: async (usernameRaw, password, adminPin) => {
    const username = usernameRaw.trim()
    if (!username || !password) return { ok: false, error: 'Kullanıcı adı ve şifre gerekli' }
    const key = username.toLocaleLowerCase('tr')
    if (get().users[key]) return { ok: false, error: 'Bu kullanıcı adı zaten alınmış' }

    const passwordHash = await hashPassword(username, password)
    const role: Role = adminPin.trim() === ADMIN_SETUP_PIN ? 'admin' : 'member'
    const user: User = { id: username, passwordHash, role, createdAt: Date.now() }

    const users = { ...get().users, [key]: user }
    persistUsers(users)
    localStorage.setItem(SESSION_KEY, key)
    set({ users, currentUserId: key })
    return { ok: true }
  },

  login: async (usernameRaw, password) => {
    const username = usernameRaw.trim()
    const key = username.toLocaleLowerCase('tr')
    const user = get().users[key]
    if (!user) return { ok: false, error: 'Kullanıcı bulunamadı' }
    const passwordHash = await hashPassword(user.id, password)
    if (passwordHash !== user.passwordHash) return { ok: false, error: 'Şifre yanlış' }
    localStorage.setItem(SESSION_KEY, key)
    set({ currentUserId: key })
    return { ok: true }
  },

  logout: () => {
    localStorage.removeItem(SESSION_KEY)
    set({ currentUserId: null })
  },

  setRole: (userId, role) => {
    const key = userId.toLocaleLowerCase('tr')
    const existing = get().users[key]
    if (!existing) return
    const users = { ...get().users, [key]: { ...existing, role } }
    persistUsers(users)
    set({ users })
  },
}))
