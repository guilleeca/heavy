-- =====================================================================
-- Heavy · 003 · Entrenos, fotos y entreno en directo
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar varias veces.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Entrenos terminados
-- exercises: [{ exerciseId, notes, sets: [{ type, weight, reps, duration }] }]
-- ---------------------------------------------------------------------
create table if not exists public.workouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  routine_id  uuid references public.routines (id) on delete set null,
  title       text not null check (char_length(title) between 1 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  started_at  timestamptz not null,
  ended_at    timestamptz not null,
  duration_s  integer not null check (duration_s >= 0),
  volume_kg   real not null default 0,
  sets_count  integer not null default 0,
  exercises   jsonb not null default '[]'::jsonb check (jsonb_typeof(exercises) = 'array'),
  photos      text[] not null default '{}',
  visibility  text not null default 'everyone' check (visibility in ('everyone', 'private')),
  created_at  timestamptz not null default now()
);
create index if not exists workouts_user_idx on public.workouts (user_id, started_at desc);
create index if not exists workouts_started_idx on public.workouts (started_at desc);

alter table public.workouts enable row level security;

drop policy if exists "Ver entrenos propios y públicos" on public.workouts;
create policy "Ver entrenos propios y públicos" on public.workouts for select to authenticated
  using ((select auth.uid()) = user_id or visibility = 'everyone');

drop policy if exists "Crear entrenos propios" on public.workouts;
create policy "Crear entrenos propios" on public.workouts for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Editar entrenos propios" on public.workouts;
create policy "Editar entrenos propios" on public.workouts for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Borrar entrenos propios" on public.workouts;
create policy "Borrar entrenos propios" on public.workouts for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.workouts from anon, authenticated;
grant select, insert, update, delete on public.workouts to authenticated;

-- ---------------------------------------------------------------------
-- Entreno en directo: una fila por persona mientras entrena
-- ---------------------------------------------------------------------
create table if not exists public.live_sessions (
  user_id    uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  title      text not null default '',
  started_at timestamptz not null,
  snapshot   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.live_sessions enable row level security;

drop policy if exists "Ver entrenos en directo" on public.live_sessions;
create policy "Ver entrenos en directo" on public.live_sessions for select to authenticated using (true);

drop policy if exists "Publicar mi entreno en directo" on public.live_sessions;
create policy "Publicar mi entreno en directo" on public.live_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Actualizar mi entreno en directo" on public.live_sessions;
create policy "Actualizar mi entreno en directo" on public.live_sessions for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Terminar mi entreno en directo" on public.live_sessions;
create policy "Terminar mi entreno en directo" on public.live_sessions for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.live_sessions from anon, authenticated;
grant select, insert, update, delete on public.live_sessions to authenticated;

-- Avisar en tiempo real de los cambios (Supabase Realtime)
alter table public.live_sessions replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'live_sessions'
  ) then
    alter publication supabase_realtime add table public.live_sessions;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Fotos de los entrenos (almacenamiento privado)
-- Ruta de cada foto: <user_id>/<workout_id>/<archivo>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('workout-photos', 'workout-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "Ver fotos de entrenos" on storage.objects;
create policy "Ver fotos de entrenos" on storage.objects for select to authenticated
  using (bucket_id = 'workout-photos');

drop policy if exists "Subir mis fotos" on storage.objects;
create policy "Subir mis fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'workout-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Borrar mis fotos" on storage.objects;
create policy "Borrar mis fotos" on storage.objects for delete to authenticated
  using (bucket_id = 'workout-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
