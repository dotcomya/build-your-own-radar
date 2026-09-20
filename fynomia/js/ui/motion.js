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

// Plus lent qu'une micro-interaction : un volet qui s'ouvre déplace la page,
// et l'œil doit pouvoir suivre ce déplacement plutôt que le subir.
const EASE = 'cubic-bezier(.62, .02, .34, 1)'
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
    { duration: 420, easing: EASE },
  )
  anim.onfinish = () => { body.style.overflow = '' }
}

function collapse(details, body) {
  const height = body.scrollHeight
  body.style.overflow = 'hidden'
  const anim = body.animate(
    [{ height: `${height}px`, opacity: 1 }, { height: '0px', opacity: 0 }],
    { duration: 340, easing: EASE },
  )
  // `open` ne tombe qu'à la fin : sinon le contenu disparaît avant d'avoir
  // commencé à se replier, et l'animation joue dans le vide.
  anim.onfinish = () => { details.open = false; body.style.overflow = '' }
}

/**
 * Le changement d'onglet.
 *
 * La vue est reconstruite à chaque rendu, y compris pendant la frappe. Marquer
 * la racine pendant une seconde rejouait donc l'entrée de tous les blocs au
 * moindre clic dans ce laps de temps — un sursaut sans raison, juste après
 * qu'on ait cliqué ailleurs.
 *
 * Le signal est désormais à usage unique : le clic l'arme, le rendu suivant le
 * consomme en marquant les nœuds qu'il vient de créer. Un rendu ultérieur
 * fabrique d'autres nœuds, sans la classe : rien ne rejoue.
 */
let armed = false

export function markViewChange() { armed = true }

/** Appelé après chaque rendu : n'anime que la vue née du dernier clic. */
export function consumeViewChange(root = document) {
  if (!armed) return
  armed = false
  if (reduced()) return
  for (const view of root.querySelectorAll('.view, .item-body')) view.classList.add('just-in')
}

/**
 * Un changement d'écran qui se regarde.
 *
 * L'API des transitions de vue prend une photo de l'état actuel, laisse muter
 * le DOM, puis fond l'ancienne image dans la nouvelle. C'est le seul moyen
 * d'obtenir un fondu propre quand on remplace toute la page d'un coup — une
 * transition CSS ordinaire n'a rien à quoi s'accrocher, puisque les anciens
 * nœuds n'existent plus.
 *
 * Là où l'API manque, ou quand le mouvement est refusé, la mutation se fait
 * sèchement : c'est le comportement d'avant, pas une dégradation.
 */
/**
 * Trois façons de changer d'écran, trois durées.
 *
 *   'page'   on quitte un module pour un autre — le geste franchit une
 *            distance, et l'animation la montre ;
 *   'view'   on passe d'un onglet au suivant à l'intérieur d'un module — on
 *            ne bouge pas de place, le contenu coulisse ;
 *   'quiet'  un interrupteur, une case cochée — rien ne doit se voir bouger,
 *            mais tout doit changer sans clignoter. C'est le fondu le plus
 *            court possible, dont le seul rôle est de supprimer le saut.
 */
let pending = null

/** Armer la prochaine mutation. Le rendu qui suit la consommera. */
export function armTravel(mode = 'page') { pending = mode }

/** Le mode du rendu en cours, une seule fois. */
export function takeTravel() { const t = pending; pending = null; return t }

export function travel(mutate, mode = 'page') {
  if (reduced() || typeof document.startViewTransition !== 'function') { mutate(); return }
  const root = document.documentElement
  const cls = `is-travelling is-move-${mode}`
  const done = () => root.classList.remove('is-travelling', `is-move-${mode}`)
  root.classList.add(...cls.split(' '))
  try {
    const vt = document.startViewTransition(mutate)
    // La classe doit tenir jusqu'à la fin de l'animation, pas jusqu'à la fin
    // de la mutation.
    //
    // C'est elle qui sélectionne les images : « .is-move-page::view-transition-
    // new(root) ». En la retirant dès que le DOM était en place — c'est-à-dire
    // avant que la moindre image n'ait été jouée — on annulait les règles
    // écrites pour ce voyage, et le navigateur retombait sur son fondu par
    // défaut : un quart de seconde, sans direction. On avait beau allonger les
    // durées dans la feuille de style, rien ne changeait à l'écran.
    //
    // On relâche donc à « finished ». Le filet de sécurité reste — une classe
    // oubliée bloquerait l'outil — mais il est plus long que la plus longue
    // des animations.
    vt.finished.catch(() => {}).finally(done)
    setTimeout(done, 2600)
  } catch {
    done()
    mutate()
  }
}
