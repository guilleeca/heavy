/** Aviso breve arriba de la pantalla */
let toastTimer: number | undefined
export function toast(message: string) {
  let el = document.getElementById('toast')
  if (!el) {
    el = document.createElement('div')
    el.id = 'toast'
    el.className = 'toast'
    el.setAttribute('role', 'status')
    document.body.appendChild(el)
  }
  el.textContent = message
  el.classList.add('show')
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => el?.classList.remove('show'), 2600)
}

