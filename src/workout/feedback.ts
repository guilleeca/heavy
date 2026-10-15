/* Aviso al terminar el descanso: vibración + dos pitidos */

let ctx: AudioContext | null = null

/** Desbloquea el audio en el primer toque (los navegadores lo exigen) */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    /* sin audio */
  }
}

export function restDoneAlert() {
  try {
    navigator.vibrate?.([250, 120, 250])
  } catch {
    /* sin vibración */
  }
  try {
    ctx ??= new AudioContext()
    const now = ctx.currentTime
    for (const t of [0, 0.28]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.25, now + t)
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.22)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + t)
      osc.stop(now + t + 0.24)
    }
  } catch {
    /* sin audio */
  }
}

/** Mantiene la pantalla encendida mientras se entrena (si el móvil lo permite) */
export async function keepScreenOn(): Promise<() => void> {
  try {
    const lock = await navigator.wakeLock?.request('screen')
    return () => void lock?.release().catch(() => {})
  } catch {
    return () => {}
  }
}
