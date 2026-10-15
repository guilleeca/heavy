-- =====================================================================
-- Heavy · 002 · Ejercicios personalizados, carpetas y rutinas
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar varias veces.
--
-- Reglas: los dos veis todo (para poder copiar rutinas del otro),
-- pero cada uno solo crea, edita y borra lo suyo.
-- =====================================================================

-- Actualiza "updated_at" automáticamente
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Ejercicios personalizados
-- ---------------------------------------------------------------------
create table if not exists public.custom_exercises (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 80),
  equipment         text not null default 'other',
  muscle            text not null,
  secondary_muscles text[] not null default '{}',
  exercise_type     text not null default 'weight_reps'
                    check (exercise_type in ('weight_reps', 'reps', 'assisted', 'duration')),
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Carpetas de rutinas
-- ---------------------------------------------------------------------
create table if not exists public.routine_folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Rutinas
-- exercises: lista ordenada de
--   { exerciseId, notes, restSeconds, sets: [{ type, weight, reps, repsMax, duration }] }
-- ---------------------------------------------------------------------
create table if not exists public.routines (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  folder_id  uuid references public.routine_folders (id) on delete set null,
  title      text not null check (char_length(title) between 1 and 80),
  notes      text not null default '' check (char_length(notes) <= 1000),
  exercises  jsonb not null default '[]'::jsonb check (jsonb_typeof(exercises) = 'array'),
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists routines_user_idx on public.routines (user_id, position);

drop trigger if exists routines_touch on public.routines;
create trigger routines_touch before update on public.routines
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Seguridad (RLS) y permisos, igual para las tres tablas
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['custom_exercises', 'routine_folders', 'routines'] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "Ver (usuarios con sesión)" on public.%I', t);
    execute format('create policy "Ver (usuarios con sesión)" on public.%I for select to authenticated using (true)', t);

    execute format('drop policy if exists "Crear lo propio" on public.%I', t);
    execute format('create policy "Crear lo propio" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);

    execute format('drop policy if exists "Editar lo propio" on public.%I', t);
    execute format('create policy "Editar lo propio" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);

    execute format('drop policy if exists "Borrar lo propio" on public.%I', t);
    execute format('create policy "Borrar lo propio" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);

    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

-- Una carpeta solo puede contener rutinas de su mismo dueño
create or replace function public.check_routine_folder_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.folder_id is not null and not exists (
    select 1 from public.routine_folders f where f.id = new.folder_id and f.user_id = new.user_id
  ) then
    raise exception 'La carpeta no es tuya';
  end if;
  return new;
end;
$$;

drop trigger if exists routines_folder_owner on public.routines;
create trigger routines_folder_owner before insert or update of folder_id on public.routines
  for each row execute function public.check_routine_folder_owner();
