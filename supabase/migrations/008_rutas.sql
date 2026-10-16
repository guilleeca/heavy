-- =====================================================================
-- Heavy · 008 · Rutas y carreras (actividades importadas desde GPX/TCX)
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar varias veces.
-- Las actividades se guardan en la misma tabla que los entrenos de gimnasio,
-- así salen igual en Inicio, Perfil, calendario, me gusta y comentarios.
-- =====================================================================

alter table public.workouts
  add column if not exists kind text not null default 'gym',
  add column if not exists distance_m real,
  add column if not exists elevation_gain_m real,
  add column if not exists moving_s integer,
  -- Recorrido simplificado: [[lat, lon, altitud, segundos desde el inicio, pulso], ...]
  add column if not exists track jsonb;

alter table public.workouts drop constraint if exists workouts_kind_check;
alter table public.workouts add constraint workouts_kind_check
  check (kind in ('gym', 'run', 'hike', 'walk', 'ride'));

create index if not exists workouts_kind_idx on public.workouts (user_id, kind, started_at desc);
