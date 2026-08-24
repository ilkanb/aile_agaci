-- Önceki (uuid tabanlı, farklı kolon adlı) şemayı temizler.
-- Sonra supabase/migration.sql'i çalıştır.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

drop table if exists public.pending_actions cascade;
drop table if exists public.people cascade;
drop table if exists public.profiles cascade;
