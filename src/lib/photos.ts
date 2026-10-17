/* Fotos de entrenos (privadas): enlaces firmados guardados en el móvil.
   Antes cada tarjeta pedía sus enlaces al abrir Inicio y las fotos esperaban a esa
   respuesta. Ahora los enlaces duran 7 días y se recuerdan, así que las fotos ya
   vistas salen al momento (el service worker además guarda las imágenes). */

import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const STORE = 'heavy.photoUrls'
const TTL_S = 7 * 24 * 3600
// Se renuevan cuando les queda menos de un día
const MARGIN_MS = 24 * 3600 * 1000

type Entry = { u: string; e: number }
let cache: Record<string, Entry> = (() => {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, Entry>
  } catch {
    return {}
  }
})()

function persist() {
  try {
    // Solo los vigentes (y como mucho 500) para no llenar el almacenamiento
    const now = Date.now()
    const live = Object.entries(cache)
      .filter(([, v]) => v.e > now)
      .sort((a, b) => b[1].e - a[1].e)
      .slice(0, 500)
    cache = Object.fromEntries(live)
    localStorage.setItem(STORE, JSON.stringify(cache))
  } catch {
    /* sin almacenamiento */
  }
}

const fresh = (path: string) => {
  const c = cache[path]
  return c && c.e - Date.now() > MARGIN_MS ? c.u : null
}

/* Las peticiones de todas las tarjetas que se pintan a la vez se juntan en una sola */
let queue = new Set<string>()
let waiting: { resolve: () => void }[] = []
let timer: number | undefined

function flush() {
  const paths = [...queue]
  const done = waiting
  queue = new Set()
  waiting = []
  timer = undefined
  supabase.storage
    .from('workout-photos')
    .createSignedUrls(paths, TTL_S)
    .then(({ data }) => {
      const exp = Date.now() + TTL_S * 1000
      for (const d of data ?? []) if (d.path && d.signedUrl) cache[d.path] = { u: d.signedUrl, e: exp }
      persist()
    })
    .finally(() => done.forEach((w) => w.resolve()))
}

/** Enlaces de las fotos, en el mismo orden (vacío si alguna no se pudo firmar) */
export async function photoUrls(paths: string[]): Promise<string[]> {
  const missing = paths.filter((p) => !fresh(p))
  if (missing.length) {
    missing.forEach((p) => queue.add(p))
    await new Promise<void>((resolve) => {
      waiting.push({ resolve })
      if (timer == null) timer = window.setTimeout(flush, 30)
    })
  }
  return paths.map((p) => cache[p]?.u ?? '')
}

/** Hook: devuelve al momento los enlaces ya conocidos y pide los que falten */
export function usePhotoUrls(paths: string[]) {
  const key = paths.join('|')
  const [urls, setUrls] = useState<string[]>(() => paths.map((p) => cache[p]?.u ?? ''))
  useEffect(() => {
    if (!key) return
    let cancelled = false
    const list = key.split('|')
    // oxlint-disable-next-line react/set-state-in-effect
    setUrls(list.map((p) => cache[p]?.u ?? ''))
    void photoUrls(list).then((u) => !cancelled && setUrls(u))
    return () => {
      cancelled = true
    }
  }, [key])
  return key ? urls : []
}
