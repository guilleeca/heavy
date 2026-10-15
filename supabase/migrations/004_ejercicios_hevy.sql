-- Heavy · paso 6b: ejercicios importados de Hevy que ahora tienen animación en la biblioteca.
-- Cambia en entrenos y rutinas el ejercicio personalizado por el de la biblioteca
-- y borra el personalizado. Se puede ejecutar más de una vez sin problema.

do $$
declare
  m record;
  c record;
begin
  for m in
    select * from (values
      ('remo sentado con agarre en v (cable)', 'Tq6gbK6'),
      ('remo en base rotativa', 'w2oRpuH'),
      ('extensión de tríceps (cable)', '2IxROQ1'),
      ('pull over unilateral polea', 'x69MAlq'),
      ('press pallof (polea)', '9pa4H5m'),
      ('jalón de remo a un brazo', 'WrYPP2g'),
      ('zancada curtsy (mancuerna)', 'gUjqdei')
    ) as t(name, lib_id)
  loop
    for c in select id from public.custom_exercises where lower(name) = m.name loop
      update public.workouts
        set exercises = replace(exercises::text, '"c:' || c.id || '"', '"' || m.lib_id || '"')::jsonb
        where exercises::text like '%c:' || c.id || '%';
      update public.routines
        set exercises = replace(exercises::text, '"c:' || c.id || '"', '"' || m.lib_id || '"')::jsonb
        where exercises::text like '%c:' || c.id || '%';
      delete from public.custom_exercises where id = c.id;
    end loop;
  end loop;
end $$;
