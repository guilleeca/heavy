-- Heavy · 013 · El curl "por detrás de la espalda" personalizado pasa a ser el
-- "Curl Bayesian (Polea)" de la biblioteca (con animación). Cambia entrenos y rutinas
-- y borra el ejercicio personalizado. Se puede ejecutar más de una vez sin problema.

do $$
declare
  c record;
begin
  for c in
    select id, name from public.custom_exercises
    where lower(name) like '%bayes%'
       or (lower(name) like '%curl%' and lower(name) like '%espalda%')
  loop
    raise notice 'Cambiando "%" por Curl Bayesian (Polea)', c.name;
    update public.workouts
      set exercises = replace(exercises::text, '"c:' || c.id || '"', '"bayesC1"')::jsonb
      where exercises::text like '%c:' || c.id || '%';
    update public.routines
      set exercises = replace(exercises::text, '"c:' || c.id || '"', '"bayesC1"')::jsonb
      where exercises::text like '%c:' || c.id || '%';
    delete from public.custom_exercises where id = c.id;
  end loop;
end $$;

-- Para comprobar qué ejercicios personalizados quedan:
select name from public.custom_exercises order by name;
