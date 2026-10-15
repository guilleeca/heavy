-- =====================================================================
-- Heavy · 001 · Cuentas y perfiles
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar varias veces.
--
-- Qué crea:
--   1. allowed_emails: lista de emails que pueden entrar (la "segunda cerradura").
--   2. Un trigger que rechaza cualquier alta cuyo email no esté en la lista.
--   3. profiles: un perfil por persona, creado automáticamente al entrar.
--
-- Los emails NO se guardan en este archivo (el repo es público):
-- se añaden aparte con el snippet del final.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Lista de acceso
-- ---------------------------------------------------------------------
create table if not exists public.allowed_emails (
  email      text primary key check (email = lower(email)),
  added_at   timestamptz not null default now()
);

-- Nadie la lee ni la escribe desde la app: solo se gestiona desde el panel.
alter table public.allowed_emails enable row level security;
revoke all on public.allowed_emails from anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Bloquear altas de emails que no estén en la lista
-- ---------------------------------------------------------------------
create or replace function public.check_allowed_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.allowed_emails where email = lower(new.email)
  ) then
    raise exception 'Esta cuenta no tiene acceso a Heavy';
  end if;
  return new;
end;
$$;

drop trigger if exists before_user_created_check_email on auth.users;
create trigger before_user_created_check_email
  before insert on auth.users
  for each row execute function public.check_allowed_email();

-- ---------------------------------------------------------------------
-- 3. Perfiles
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text unique check (username ~ '^[a-z0-9._]{3,24}$'),
  full_name    text not null default '',
  avatar_url   text,
  bio          text not null default '' check (char_length(bio) <= 160),
  created_at   timestamptz not null default now()
);

-- Al crearse un usuario, se crea su perfil con nombre y foto de Google.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists after_user_created_profile on auth.users;
create trigger after_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Reglas: los dos podéis ver ambos perfiles; cada uno solo edita el suyo.
alter table public.profiles enable row level security;

drop policy if exists "Perfiles visibles para usuarios con sesión" on public.profiles;
create policy "Perfiles visibles para usuarios con sesión"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Cada uno edita su perfil" on public.profiles;
create policy "Cada uno edita su perfil"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Permisos explícitos (la exposición automática de tablas está desactivada).
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (username, full_name, avatar_url, bio) on public.profiles to authenticated;

-- =====================================================================
-- DESPUÉS de ejecutar lo anterior, añade vuestros emails en una consulta
-- aparte (no los guardes en este archivo):
--
--   insert into public.allowed_emails (email) values
--     ('tu_email@gmail.com'),
--     ('email_de_tu_hermano@gmail.com')
--   on conflict do nothing;
-- =====================================================================
