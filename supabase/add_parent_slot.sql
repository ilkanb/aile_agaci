alter table public.pending_actions add column parent_slot text check (parent_slot in ('mother', 'father'));
