-- =====================================================================
-- Heavy · 009 · Biblioteca de rutas para seguir (de Wikiloc, Komoot, Strava…)
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar varias veces.
-- Las rutas las ven los dos; cada uno edita y borra solo las suyas.
-- =====================================================================

create table if not exists public.saved_routes (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 80),
  description      text not null default '' check (char_length(description) <= 1000),
  kind             text not null default 'hike' check (kind in ('run', 'hike', 'walk', 'ride')),
  distance_m       real not null default 0,
  elevation_gain_m real not null default 0,
  elevation_loss_m real not null default 0,
  -- Recorrido simplificado: [[lat, lon, altitud, null, null], ...]
  track            jsonb not null check (jsonb_typeof(track) = 'array'),
  created_at       timestamptz not null default now()
);
create index if not exists saved_routes_user_idx on public.saved_routes (user_id, created_at desc);

alter table public.saved_routes enable row level security;

drop policy if exists "Ver rutas" on public.saved_routes;
create policy "Ver rutas" on public.saved_routes for select to authenticated using (true);

drop policy if exists "Crear rutas propias" on public.saved_routes;
create policy "Crear rutas propias" on public.saved_routes for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Editar rutas propias" on public.saved_routes;
create policy "Editar rutas propias" on public.saved_routes for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Borrar rutas propias" on public.saved_routes;
create policy "Borrar rutas propias" on public.saved_routes for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.saved_routes from anon, authenticated;
grant select, insert, update, delete on public.saved_routes to authenticated;
