-- Aile Ağacı — Supabase şema, RLS ve realtime kurulumu
-- Supabase Dashboard > SQL Editor içine yapıştırıp "Run" ile çalıştır.

-- ============================================================
-- 1. profiles — her Supabase Auth kullanıcısına 1:1 bağlı rol/kullanıcı adı
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "admins can update any profile"
  on public.profiles for update
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Kayıt olan ilk kullanıcı otomatik admin olur, sonrakiler member.
-- security definer sayesinde bu fonksiyon RLS'i bypass edip profiles satırını oluşturabilir.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    case when (select count(*) from public.profiles) = 0 then 'admin' else 'member' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. people — aile bireyleri (graf modeli)
-- ============================================================
create table public.people (
  id text primary key,
  name text not null,
  gender text not null default '?' check (gender in ('K', 'E', '?')),
  mother_id text references public.people (id) on delete set null,
  father_id text references public.people (id) on delete set null,
  spouse_ids text[] not null default '{}',
  note text not null default '',
  birth_date date,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.people enable row level security;

create policy "people readable by authenticated"
  on public.people for select
  to authenticated
  using (true);

create policy "people insertable by admins"
  on public.people for insert
  to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "people updatable by admins"
  on public.people for update
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "people deletable by admins"
  on public.people for delete
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ============================================================
-- 3. pending_actions — üyelerin onay bekleyen önerileri
-- ============================================================
create table public.pending_actions (
  id text primary key,
  type text not null,
  created_at timestamptz not null default now(),
  created_by text not null,
  anchor_person_id text not null,
  new_person jsonb,
  shared_parent text,
  other_parent_id text,
  note_value text,
  birth_date_value date,
  target_person_id text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected'))
);

alter table public.pending_actions enable row level security;

create policy "pending readable by authenticated"
  on public.pending_actions for select
  to authenticated
  using (true);

create policy "members can propose actions as themselves"
  on public.pending_actions for insert
  to authenticated
  with check (created_by = (select username from public.profiles where id = auth.uid()));

create policy "admins can delete pending actions"
  on public.pending_actions for delete
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ============================================================
-- 4. Realtime — birden fazla kullanıcı aynı anda değişiklikleri görsün
-- ============================================================
alter publication supabase_realtime add table public.people;
alter publication supabase_realtime add table public.pending_actions;
