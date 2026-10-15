-- =====================================================================
-- Heavy · 007 · Fotos de perfil
-- Ejecutar en Supabase → SQL Editor. Se puede ejecutar varias veces.
-- Ruta de cada foto: <user_id>/<archivo>. Se ven con enlace público
-- (como la foto de Google que ya teníais); solo el dueño puede cambiarla.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152;

drop policy if exists "Subir mi foto de perfil" on storage.objects;
create policy "Subir mi foto de perfil" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Borrar mi foto de perfil" on storage.objects;
create policy "Borrar mi foto de perfil" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
