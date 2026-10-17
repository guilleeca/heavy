-- Heavy · 014 · "Landmine Press a Un Brazo (Barra)" personalizado → el de la biblioteca
-- (con animación). Cambia entrenos y rutinas y borra el personalizado.
-- Se puede ejecutar más de una vez sin problema.

do $$
declare
  c record;
begin
  for c in select id, name from public.custom_exercises where lower(name) like '%landmine%press%' loop
    update public.workouts
      set exercises = replace(exercises::text, '"c:' || c.id || '"', '"2KGnL6M"')::jsonb
      where exercises::text like '%c:' || c.id || '%';
    update public.routines
      set exercises = replace(exercises::text, '"c:' || c.id || '"', '"2KGnL6M"')::jsonb
      where exercises::text like '%c:' || c.id || '%';
    delete from public.custom_exercises where id = c.id;
  end loop;
end $$;

select name from public.custom_exercises order by name;
