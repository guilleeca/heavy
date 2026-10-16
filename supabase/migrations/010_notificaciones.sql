-- =====================================================================
-- Heavy · 010 · Notificaciones push (cuando el otro entrena, da like o comenta)
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar varias veces.
-- =====================================================================

-- Un registro por móvil/navegador donde cada uno ha activado las notificaciones
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Ver mis suscripciones" on public.push_subscriptions;
create policy "Ver mis suscripciones" on public.push_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Crear mis suscripciones" on public.push_subscriptions;
create policy "Crear mis suscripciones" on public.push_subscriptions for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Actualizar mis suscripciones" on public.push_subscriptions;
create policy "Actualizar mis suscripciones" on public.push_subscriptions for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Borrar mis suscripciones" on public.push_subscriptions;
create policy "Borrar mis suscripciones" on public.push_subscriptions for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Qué avisos quiere recibir cada uno
alter table public.profiles
  add column if not exists notify jsonb not null
  default '{"live": true, "workouts": true, "likes": true, "comments": true}'::jsonb;

grant update (notify) on public.profiles to authenticated;
