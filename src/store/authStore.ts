import { create } from 'zustand'
import type { Role, User } from '../types'
import { supabase, usernameToEmail } from '../lib/supabaseClient'

interface ProfileRow {
  username: string
  role: Role
  created_at: string
}

function rowToUser(row: ProfileRow): User {
  return { id: row.username, passwordHash: '', role: row.role, createdAt: new Date(row.created_at).getTime() }
}

export function canApprove(user: User | null | undefined): boolean {
  return user?.role === 'admin'
}

interface AuthStore {
  currentUser: User | null
  users: Record<string, User>
  ready: boolean
  initialized: boolean
  init: () => void
  refreshUsers: () => Promise<void>
  register: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
  setRole: (username: string, role: Role) => Promise<void>
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  currentUser: null,
  users: {},
  ready: false,
  initialized: false,

  init: () => {
    if (get().initialized) return
    set({ initialized: true })

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        set({ currentUser: null, ready: true })
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('username, role, created_at')
        .eq('id', session.user.id)
        .single()
      set({ currentUser: data ? rowToUser(data) : null, ready: true })
    })

    get().refreshUsers()
    supabase
      .channel('profiles-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => get().refreshUsers())
      .subscribe()
  },

  refreshUsers: async () => {
    const { data } = await supabase.from('profiles').select('username, role, created_at')
    if (!data) return
    const users: Record<string, User> = {}
    for (const row of data as ProfileRow[]) users[row.username] = rowToUser(row)
    set({ users })
  },

  register: async (usernameRaw, password) => {
    const username = usernameRaw.trim()
    if (!username || !password) return { ok: false, error: 'Kullanıcı adı ve şifre gerekli' }

    const { data, error } = await supabase.auth.signUp({
      email: usernameToEmail(username),
      password,
      options: { data: { username } },
    })

    if (error) {
      if (error.message.toLowerCase().includes('already registered')) {
        return { ok: false, error: 'Bu kullanıcı adı zaten alınmış' }
      }
      return { ok: false, error: error.message }
    }
    if (!data.session) {
      return {
        ok: false,
        error: 'Kayıt oldu ama oturum açılamadı — Supabase\'de Authentication > Email > "Confirm email" ayarı kapalı olmalı.',
      }
    }
    return { ok: true }
  },

  login: async (usernameRaw, password) => {
    const username = usernameRaw.trim()
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    })
    if (error) return { ok: false, error: 'Kullanıcı adı veya şifre yanlış' }
    return { ok: true }
  },

  logout: async () => {
    await supabase.auth.signOut()
  },

  setRole: async (username, role) => {
    await supabase.from('profiles').update({ role }).eq('username', username)
  },
}))
