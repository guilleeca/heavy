-- Heavy · 011 · Permisos para las funciones del servidor (notify)
-- Las funciones usan la clave de administrador (rol service_role). En este proyecto ese rol
-- no tenía permisos sobre las tablas, así que la función no podía leer las suscripciones.
-- El service_role ya se salta RLS y solo existe en el servidor: no da acceso a nadie más.

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Y para las tablas que se creen más adelante
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;

