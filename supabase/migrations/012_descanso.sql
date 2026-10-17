-- Heavy · 012 · Aviso de fin de descanso desde el servidor
-- La app avisa a la función rest-alarm de cuándo acaba el descanso; aquí se guarda
-- el último aviso pedido por cada uno para poder cancelarlo o moverlo (±15 s, Saltar).
-- Solo lo usa la función (service_role); la app no lee ni escribe esta tabla.

create table if not exists public.rest_alarms (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  ends_at    bigint,
  updated_at timestamptz not null default now()
);

alter table public.rest_alarms enable row level security;
revoke all on public.rest_alarms from anon, authenticated;
grant select, insert, update, delete on public.rest_alarms to service_role;
