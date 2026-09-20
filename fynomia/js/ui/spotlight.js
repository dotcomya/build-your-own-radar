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
 * Cliquer « Y aller » depuis le guide, la liste ou une encoche fait franchir
 * une vraie distance : on quitte une page pour arriver sur un champ précis
 * d'une autre. Sans transition, l'écran se remplace en une image et le geste
 * ressemble à un défaut d'affichage. Le drapeau posé ici dit à la charpente
 * d'animer ce passage.
 */
let travelling = false

/** Le rendu suivant est-il un voyage ? La question se pose une seule fois. */
export function takeTravel() { const t = travelling; travelling = false; return t }

/** Poser l'intention, puis y aller. */
export function goToGap(target, navigate) {
  travelling = true
  Object.assign(intent, EMPTY, target)
  navigate(`#/${target.route}`)
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
