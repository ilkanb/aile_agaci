import { useState } from 'react'
import { useAuthStore } from '../store/authStore'

export function LoginScreen() {
  const login = useAuthStore((s) => s.login)
  const register = useAuthStore((s) => s.register)

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [adminPin, setAdminPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    setError(null)
    const result = mode === 'login' ? await login(username, password) : await register(username, password, adminPin)
    setBusy(false)
    if (!result.ok) setError(result.error ?? 'Bir şeyler ters gitti')
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="brand" style={{ marginBottom: 8 }}>Aile Ağacı</div>
        <div className="login-tabs">
          <button
            className={mode === 'login' ? 'primary-btn' : 'ghost-btn'}
            onClick={() => {
              setMode('login')
              setError(null)
            }}
          >
            Giriş yap
          </button>
          <button
            className={mode === 'register' ? 'primary-btn' : 'ghost-btn'}
            onClick={() => {
              setMode('register')
              setError(null)
            }}
          >
            Hesap oluştur
          </button>
        </div>

        <input placeholder="Kullanıcı adı" value={username} onChange={(e) => setUsername(e.target.value)} />
        <input
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />

        {mode === 'register' && (
          <input
            type="password"
            placeholder="Yönetici kurulum şifresi (opsiyonel)"
            value={adminPin}
            onChange={(e) => setAdminPin(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        )}

        {mode === 'register' && (
          <div className="login-hint">
            Sadece ilk yöneticiyi belirlemek için — boş bırakırsan normal üye olarak kayıt olursun.
          </div>
        )}

        {error && <div className="error-text">{error}</div>}

        <button className="primary-btn" onClick={submit} disabled={busy || !username.trim() || !password}>
          {mode === 'login' ? 'Giriş yap' : 'Hesap oluştur'}
        </button>
      </div>
    </div>
  )
}
