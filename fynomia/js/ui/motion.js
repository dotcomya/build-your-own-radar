/**
 * Les ouvertures et les fermetures.
 *
 * Un `<details>` natif claque : le contenu apparaît d'un coup, la page saute,
 * et l'œil doit retrouver où il en était. Ce module intercepte le clic sur le
 * résumé et anime la hauteur dans les deux sens — assez vite pour ne pas faire
 * attendre, assez lent pour que le regard suive le mouvement.
 *
 * Rien n'est réécrit dans les pages : un seul écouteur, posé sur le document,
 * couvre tous les volets présents et à venir. L'attribut `open` reste géré par
 * le navigateur, donc les mémoires d'ouverture branchées sur l'événement
 * `toggle` continuent de fonctionner.
 */

const EASE = 'cubic-bezier(.2, .8, .2, 1)'
const reduced = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

export function installMotion() {
  if (installMotion.done) return
  installMotion.done = true

  document.addEventListener('click', (e) => {
    const summary = e.target && e.target.closest ? e.target.closest('summary') : null
    if (!summary) return
    const details = summary.parentElement
    if (!details || details.tagName !== 'DETAILS') return
    if (reduced() || typeof details.animate !== 'function') return

    const body = Array.from(details.children).find((c) => c !== summary)
    if (!body) return
    e.preventDefault()
    details.open ? collapse(details, body) : expand(details, body)
  })
}

function expand(details, body) {
  details.open = true
  const height = body.scrollHeight
  body.style.overflow = 'hidden'
  const anim = body.animate(
    [{ height: '0px', opacity: 0 }, { height: `${height}px`, opacity: 1 }],
    { duration: 210, easing: EASE },
  )
  anim.onfinish = () => { body.style.overflow = '' }
}

function collapse(details, body) {
  const height = body.scrollHeight
  body.style.overflow = 'hidden'
  const anim = body.animate(
    [{ height: `${height}px`, opacity: 1 }, { height: '0px', opacity: 0 }],
    { duration: 180, easing: EASE },
  )
  // `open` ne tombe qu'à la fin : sinon le contenu disparaît avant d'avoir
  // commencé à se replier, et l'animation joue dans le vide.
  anim.onfinish = () => { details.open = false; body.style.overflow = '' }
}

/**
 * Le changement d'onglet.
 *
 * La vue est reconstruite à chaque rendu, y compris pendant la frappe : une
 * animation posée sur la classe jouerait à chaque touche. On marque donc la
 * racine le temps d'un rendu, et seule la vue née de ce clic est animée.
 */
export function markViewChange() {
  const root = document.documentElement
  root.classList.add('view-switch')
  clearTimeout(markViewChange.t)
  markViewChange.t = setTimeout(() => root.classList.remove('view-switch'), 320)
}
