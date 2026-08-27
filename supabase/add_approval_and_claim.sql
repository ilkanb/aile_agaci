-- Faz 2, madde 3 + madde 4: onay kapısı + kullanıcı-kişi eşleştirme.
-- SQL Editor'e yapıştırıp çalıştır.

-- 1) Onay durumu — var olan hesapları geriye dönük kilitlememek için hepsini
--    onaylı işaretliyoruz, bundan sonraki yeni kayıtlar onaysız başlayacak.
alter table public.profiles add column approved boolean not null default false;
update public.profiles set approved = true;

-- 2) Kullanıcı hangi kişiyle eşleşti
alter table public.profiles add column person_id text references public.people (id) on delete set null;

-- 3) İlk kullanıcı tetikleyicisini onay durumunu da ayarlayacak şekilde güncelle
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, role, approved)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    case when (select count(*) from public.profiles) = 0 then 'admin' else 'member' end,
    case when (select count(*) from public.profiles) = 0 then true else false end
  );
  return new;
end;
$$;

-- 4) Sütun bazlı gizleme view'ı — onaysız kullanıcılar hassas alanları
--    (not, doğum/ölüm tarihi, fotoğraf) boş görür; kendi eşleştiği kişiyi
--    her zaman tam görebilir.
create view public.people_visible
with (security_invoker = true)
as
select
  id,
  name,
  gender,
  mother_id,
  father_id,
  spouse_ids,
  case
    when coalesce((select approved from public.profiles where id = auth.uid()), false)
      or id = (select person_id from public.profiles where id = auth.uid())
    then note else ''
  end as note,
  case
    when coalesce((select approved from public.profiles where id = auth.uid()), false)
      or id = (select person_id from public.profiles where id = auth.uid())
    then birth_date else null
  end as birth_date,
  case
    when coalesce((select approved from public.profiles where id = auth.uid()), false)
      or id = (select person_id from public.profiles where id = auth.uid())
    then death_date else null
  end as death_date,
  case
    when coalesce((select approved from public.profiles where id = auth.uid()), false)
      or id = (select person_id from public.profiles where id = auth.uid())
    then photo_url else null
  end as photo_url,
  created_at,
  updated_at
from public.people;

grant select on public.people_visible to authenticated;

-- 5) pending_actions'a yeni action type'lar için gereken kolonlar zaten
--    genel amaçlı (new_person jsonb, target_person_id) — claim-person ve
--    edit-name/edit-gender bunları olduğu gibi kullanabiliyor, ek kolon
--    sadece isim/cinsiyet değerleri için gerekiyor:
alter table public.pending_actions add column name_value text;
alter table public.pending_actions add column gender_value text check (gender_value in ('K', 'E', '?'));
