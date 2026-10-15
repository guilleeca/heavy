-- =====================================================================
-- Heavy · 006 · Me gusta y comentarios en los entrenos
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar varias veces.
-- Solo se ven en los entrenos que cada persona puede ver.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Me gusta: uno por persona y entreno
-- ---------------------------------------------------------------------
create table if not exists public.workout_likes (
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workout_id, user_id)
);

alter table public.workout_likes enable row level security;

drop policy if exists "Ver me gusta" on public.workout_likes;
create policy "Ver me gusta" on public.workout_likes for select to authenticated
  using (exists (select 1 from public.workouts w where w.id = workout_id));

drop policy if exists "Dar me gusta" on public.workout_likes;
create policy "Dar me gusta" on public.workout_likes for insert to authenticated
  with check ((select auth.uid()) = user_id and exists (select 1 from public.workouts w where w.id = workout_id));

drop policy if exists "Quitar mi me gusta" on public.workout_likes;
create policy "Quitar mi me gusta" on public.workout_likes for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.workout_likes from anon, authenticated;
grant select, insert, delete on public.workout_likes to authenticated;

-- ---------------------------------------------------------------------
-- Comentarios
-- ---------------------------------------------------------------------
create table if not exists public.workout_comments (
  id         uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body       text not null check (char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists workout_comments_workout_idx on public.workout_comments (workout_id, created_at);

alter table public.workout_comments enable row level security;

drop policy if exists "Ver comentarios" on public.workout_comments;
create policy "Ver comentarios" on public.workout_comments for select to authenticated
  using (exists (select 1 from public.workouts w where w.id = workout_id));

drop policy if exists "Comentar" on public.workout_comments;
create policy "Comentar" on public.workout_comments for insert to authenticated
  with check ((select auth.uid()) = user_id and exists (select 1 from public.workouts w where w.id = workout_id));

-- Borra su comentario quien lo escribió o el dueño del entreno
drop policy if exists "Borrar comentarios" on public.workout_comments;
create policy "Borrar comentarios" on public.workout_comments for delete to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid()))
  );

revoke all on public.workout_comments from anon, authenticated;
grant select, insert, delete on public.workout_comments to authenticated;

-- ---------------------------------------------------------------------
-- Tiempo real: los me gusta y comentarios aparecen al momento
-- ---------------------------------------------------------------------
alter table public.workout_likes replica identity full;
alter table public.workout_comments replica identity full;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'workout_likes') then
    alter publication supabase_realtime add table public.workout_likes;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'workout_comments') then
    alter publication supabase_realtime add table public.workout_comments;
  end if;
end;
$$;
