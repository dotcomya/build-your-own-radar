/**
 * Conduire quelqu'un jusqu'au champ qui manque.
 *
 * Le panneau « ce que tu pourrais encore affiner » listait des manques sans
 * dire où les combler : cliquer dessus ne faisait rien, et retrouver soi-même
 * l'onglet « Paiement » de la deuxième offre annule le service rendu.
 *
 * Une intention est donc posée avant la navigation : la route, l'onglet à
 * ouvrir, et le repère à entourer. Chaque page lit cette intention pendant son
 * rendu pour se présenter au bon endroit ; l'anneau est tracé juste après, puis
 * l'intention est oubliée — elle ne vaut que pour ce clic.
 */

const EMPTY = { route: null, view: null, sec: null, openAll: false, anchor: null }


const intent = { ...EMPTY }

/**
 * Y aller, et que ça se voie.
 *
 * Cliquer « Y aller », « Renseigner » ou une étape de la synthèse fait
 * franchir une vraie distance : on quitte une page pour arriver sur un champ
 * précis d'une autre. C'est un voyage — l'écran qu'on quitte s'éloigne, celui
 * qu'on rejoint arrive — puis l'anneau se pose sur le champ visé.
 *
 * Il avait été retiré, au motif d'un quart de seconde d'écran gelé avant le
 * départ. Sans lui, l'écran se remplaçait en une image et le geste perdait sa
 * direction : on ne sentait plus qu'on avait été conduit quelque part. Le
 * départ ne gèle plus — la mutation est jouée d'office au bout d'un dixième
 * de seconde si le navigateur tarde (voir travel) — et le voyage revient.
 *
 * `depuis` est le bouton cliqué : il crache un « + » avant qu'on parte, pour
 * que le geste ait une réponse à l'endroit où le doigt était.
 */
export function goToGap(target, navigate, depuis) {
  if (depuis) pop(depuis)
  Object.assign(intent, EMPTY, target)
  navigate(`#/${target.route}`)
}

/**
 * Le « + » qui éclate et disparaît.
 *
 * Un clic qui change de page sans rien confirmer laisse douter qu'il a été
 * pris. Ce signe monte de l'élément cliqué, grossit et s'efface en un peu plus
 * d'un tiers de seconde : le temps de voir qu'on a bien appuyé, pas assez pour
 * attendre. Il se pose sur la page, hors de tout parent, pour qu'aucun bloc à
 * débordement caché ne le tronque.
 */
export function pop(el, signe = '+') {
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const r = el.getBoundingClientRect()
    const n = document.createElement('span')
    n.className = 'gappop'
    n.textContent = signe
    n.style.left = `${r.left + r.width / 2}px`
    n.style.top = `${r.top + 12}px`
    document.body.appendChild(n)
    setTimeout(() => n.remove(), 700)
  } catch { /* un signe en moins ne casse rien */ }
}

/** Ce que la page doit ouvrir, si c'est elle qui est visée. */
export function claim(route) { return intent.route === route ? intent : null }

/**
 * Entourer la zone, trois secondes.
 *
 * Pas de couleur d'alerte ni de secousse : un anneau qui respire deux fois et
 * s'efface. Assez pour dire « c'est ici », trop discret pour faire sursauter.
 */
export function settle(root = document) {
  const anchor = intent.anchor
  Object.assign(intent, EMPTY)
  if (!anchor) return
  requestAnimationFrame(() => {
    const el = root.querySelector(`[data-gap="${anchor}"]`)
    if (!el) return
    // Un volet fermé cache le champ visé : on l'ouvre avant de montrer.
    const fold = el.matches('details') ? el : el.querySelector('details')
    if (fold) fold.open = true
    try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }) } catch { /* vieux moteur */ }
    el.classList.add('spotlit')
    setTimeout(() => el.classList.remove('spotlit'), 3400)
    const field = el.querySelector('input:not([type=hidden]), textarea, select')
    if (field) setTimeout(() => { try { field.focus({ preventScroll: true }) } catch { /* rien */ } }, 500)
  })
}
