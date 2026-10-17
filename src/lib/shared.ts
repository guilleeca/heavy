/* Lo que llega desde el menú "Compartir" de Android (lo guarda public/share-sw.js en la caché). */

export type Shared = { routes: File[]; images: File[]; text: string }

const CACHE = 'heavy-share'
const base = () => new URL('./', document.baseURI).href

export const isRouteFile = (f: File) => /\.(gpx|tcx)$/i.test(f.name) || /gpx|tcx|xml/i.test(f.type)
export const isImageFile = (f: File) => /^image\//i.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)

/** Lee lo compartido sin borrarlo (varias pantallas pueden necesitarlo) */
export async function readShared(): Promise<Shared | null> {
  if (!('caches' in window)) return null
  try {
    const cache = await caches.open(CACHE)
    const index = await cache.match(base() + 'shared/index')
    if (!index) return null
    const data = (await index.json()) as { files: { key: string; name: string; type: string }[]; text: string; at: number }
    // Lo compartido hace más de una hora ya no vale
    if (Date.now() - data.at > 3600_000) {
      await clearShared()
      return null
    }
    const files: File[] = []
    for (const f of data.files) {
      const res = await cache.match(f.key)
      if (res) files.push(new File([await res.blob()], f.name, { type: f.type }))
    }
    return { routes: files.filter(isRouteFile), images: files.filter(isImageFile), text: data.text ?? '' }
  } catch {
    return null
  }
}

export async function clearShared() {
  try {
    await caches.delete(CACHE)
  } catch {
    /* nada que borrar */
  }
}

/** Guarda lo compartido (app nativa) igual que lo hace share-sw.js y dice a qué pantalla ir */
export async function storeShared(files: File[], text: string): Promise<string> {
  try {
    await clearShared()
    const cache = await caches.open(CACHE)
    const list: { key: string; name: string; type: string }[] = []
    for (let i = 0; i < files.length && i < 12; i++) {
      const f = files[i]
      const key = base() + 'shared/' + i
      await cache.put(key, new Response(f, { headers: { 'content-type': f.type || 'application/octet-stream' } }))
      list.push({ key, name: f.name || 'archivo', type: f.type || '' })
    }
    await cache.put(base() + 'shared/index', new Response(JSON.stringify({ files: list, text, at: Date.now() })))
  } catch {
    return '#/actividad/nueva'
  }
  const route = files.some(isRouteFile)
  const images = files.some(isImageFile)
  return route || (!images && text) ? '#/actividad/nueva?compartido=1' : '#/compartir'
}
