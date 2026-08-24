import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY tanımlı değil — .env.local dosyasını kontrol et.'
  )
}

export const supabase = createClient(url, anonKey)

// Gerçek e-posta toplamıyoruz; kullanıcı adını Supabase Auth'un beklediği
// e-posta formatına çeviriyoruz. Bu yüzden Supabase Dashboard > Authentication
// > Providers > Email altında "Confirm email" kapalı olmalı — sahte adrese
// gönderilen bir onay maili asla okunamaz.
export function usernameToEmail(username: string): string {
  return `${username.trim().toLocaleLowerCase('tr')}@aile-agaci.local`
}
