-- =====================================================================
-- Heavy · 005 · Medidas corporales (peso, % grasa y perímetros)
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar varias veces.
-- Son privadas: cada persona solo ve las suyas.
-- =====================================================================

create table if not exists public.measurements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg   real check (weight_kg between 20 and 400),
  body_fat    real check (body_fat between 2 and 70),
  chest_cm    real check (chest_cm between 30 and 250),
  waist_cm    real check (waist_cm between 30 and 250),
  hips_cm     real check (hips_cm between 30 and 250),
  arm_cm      real check (arm_cm between 10 and 100),
  thigh_cm    real check (thigh_cm between 20 and 150),
  created_at  timestamptz not null default now()
);
create index if not exists measurements_user_idx on public.measurements (user_id, measured_on desc);

alter table public.measurements enable row level security;

drop policy if exists "Ver medidas propias" on public.measurements;
create policy "Ver medidas propias" on public.measurements for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Crear medidas propias" on public.measurements;
create policy "Crear medidas propias" on public.measurements for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Editar medidas propias" on public.measurements;
create policy "Editar medidas propias" on public.measurements for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Borrar medidas propias" on public.measurements;
create policy "Borrar medidas propias" on public.measurements for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.measurements from anon, authenticated;
grant select, insert, update, delete on public.measurements to authenticated;
