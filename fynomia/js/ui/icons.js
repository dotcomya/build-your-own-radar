/**
 * Les icônes des familles de métiers.
 *
 * Les glyphes Unicode qui servaient jusqu'ici — ☗ ⌂ ▤ ✿ — ne veulent rien dire.
 * Ils sont dessinés par la police du système, changent d'un appareil à l'autre,
 * et sur le premier écran de l'outil ils donnent le ton de ce qui suit : un
 * formulaire administratif.
 *
 * Celles-ci sont dessinées ici, en SVG, dans un registre isométrique volumique :
 * une plaque au sol qui porte l'objet, une face claire et une face d'ombre, un
 * éclairage constant venu d'en haut à gauche. C'est le vocabulaire des icônes
 * 3D d'aujourd'hui, obtenu sans image ni bibliothèque — deux kilo-octets, nets
 * à toutes les tailles, et qui prennent les couleurs du thème.
 *
 * Elles se déclinent en deux tons pris aux variables de la charte : `--accent`
 * pour la lumière, `--ink` pour le volume. Rien n'est codé en dur, donc rien à
 * reprendre si la charte bouge.
 *
 * Note d'honnêteté : ce ne sont pas des rendus 3D. Un vrai rendu — le registre
 * Airbnb, 3dicons, Iconscout — est une image produite dans un moteur, livrée en
 * PNG ou WebP, sous licence. Il faudrait les fichiers ; voir le README.
 */

/**
 * Le cadre commun : une plaque isométrique, et de la place au-dessus.
 *
 * Toutes les icônes partagent la même boîte et la même lumière. C'est ce qui
 * les fait tenir ensemble : un jeu d'icônes n'est pas une collection de
 * dessins, c'est un dessin décliné.
 */
function frame(body, { tone = 'accent' } = {}) {
  const id = `g${Math.random().toString(36).slice(2, 8)}`
  return `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true" class="ico3">
  <defs>
    <linearGradient id="${id}a" x1="8" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse">
      <stop stop-color="var(--ico-hi)"/><stop offset="1" stop-color="var(--ico-lo)"/>
    </linearGradient>
    <linearGradient id="${id}b" x1="24" y1="30" x2="24" y2="46" gradientUnits="userSpaceOnUse">
      <stop stop-color="var(--ico-base)" stop-opacity=".5"/><stop offset="1" stop-color="var(--ico-base)" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <ellipse cx="24" cy="40" rx="15" ry="4.5" fill="url(#${id}b)"/>
  <g class="ico3-body" data-tone="${tone}" style="--g:url(#${id}a)">${body}</g>
</svg>`
}

/* Les formes. Chaque métier est réduit à l'objet qu'on verrait de la rue. */
const SHAPES = {
  // Une assiette et deux couverts, vus de trois quarts.
  restauration: `
    <ellipse cx="24" cy="26" rx="13" ry="7" fill="var(--g)"/>
    <ellipse cx="24" cy="24" rx="13" ry="7" fill="var(--ico-face)"/>
    <ellipse cx="24" cy="24" rx="7" ry="3.6" fill="var(--ico-hole)"/>
    <path d="M9 12v8M9 12v5a2 2 0 0 0 2 2M39 12c0 4-2 5-2 5v3" stroke="var(--ico-line)" stroke-width="2.2" stroke-linecap="round"/>`,
  // Un toit et une porte : le logement.
  hebergement: `
    <path d="M24 8 41 21v15a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V21L24 8Z" fill="var(--g)"/>
    <path d="M24 8 41 21H7L24 8Z" fill="var(--ico-face)"/>
    <rect x="20" y="26" width="8" height="12" rx="1" fill="var(--ico-hole)"/>`,
  // Un cabas rempli.
  alimentaire: `
    <path d="M11 17h26l-2.4 20a3 3 0 0 1-3 2.6H16.4a3 3 0 0 1-3-2.6L11 17Z" fill="var(--g)"/>
    <path d="M11 17h26l-.5 4h-25l-.5-4Z" fill="var(--ico-face)"/>
    <path d="M18 17v-3a6 6 0 0 1 12 0v3" stroke="var(--ico-line)" stroke-width="2.4" stroke-linecap="round"/>`,
  // Une devanture avec son store.
  commerce: `
    <rect x="9" y="20" width="30" height="19" rx="2" fill="var(--g)"/>
    <path d="M7 14h34l-2 7H9l-2-7Z" fill="var(--ico-face)"/>
    <rect x="15" y="27" width="8" height="12" rx="1" fill="var(--ico-hole)"/>
    <rect x="27" y="27" width="7" height="6" rx="1" fill="var(--ico-hole)"/>`,
  // Un flacon et sa goutte.
  beaute: `
    <path d="M17 20h14v17a3 3 0 0 1-3 3H20a3 3 0 0 1-3-3V20Z" fill="var(--g)"/>
    <rect x="17" y="18" width="14" height="4" rx="1.4" fill="var(--ico-face)"/>
    <rect x="21" y="9" width="6" height="9" rx="1.6" fill="var(--ico-face)"/>
    <circle cx="24" cy="30" r="3.4" fill="var(--ico-hole)"/>`,
  // Une croix médicale en volume.
  sante: `
    <path d="M20 10h8v10h10v8H28v10h-8V28H10v-8h10V10Z" fill="var(--g)"/>
    <path d="M20 10h8v6h-8v-6ZM10 20h8v8h-8v-8Z" fill="var(--ico-face)" opacity=".55"/>`,
  // Un casque de chantier.
  batiment: `
    <path d="M8 32a16 16 0 0 1 32 0v2a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2Z" fill="var(--g)"/>
    <path d="M19 17.5a16 16 0 0 1 10 0V30h-10V17.5Z" fill="var(--ico-face)"/>
    <rect x="6" y="35" width="36" height="5" rx="2.5" fill="var(--ico-face)"/>`,
  // Un écran et son socle.
  digital: `
    <rect x="7" y="11" width="34" height="22" rx="3" fill="var(--g)"/>
    <rect x="11" y="15" width="26" height="12" rx="1.6" fill="var(--ico-hole)"/>
    <path d="M18 40h12M24 33v7" stroke="var(--ico-line)" stroke-width="2.6" stroke-linecap="round"/>`,
  // Une mallette.
  entreprises: `
    <rect x="7" y="17" width="34" height="21" rx="3" fill="var(--g)"/>
    <rect x="7" y="23" width="34" height="4" fill="var(--ico-face)" opacity=".5"/>
    <path d="M18 17v-3a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v3" stroke="var(--ico-line)" stroke-width="2.4" stroke-linecap="round"/>
    <rect x="21" y="25" width="6" height="5" rx="1" fill="var(--ico-hole)"/>`,
  // Deux silhouettes, l'une derrière l'autre.
  personne: `
    <circle cx="19" cy="17" r="6" fill="var(--ico-face)"/>
    <path d="M7 38a12 12 0 0 1 24 0v2H7v-2Z" fill="var(--g)"/>
    <circle cx="33" cy="19" r="5" fill="var(--ico-face)" opacity=".7"/>
    <path d="M26 40a9 9 0 0 1 16-2v2H26Z" fill="var(--g)" opacity=".7"/>`,
  // Un ballon à facettes.
  sport: `
    <circle cx="24" cy="24" r="15" fill="var(--g)"/>
    <path d="M24 12l7 5-2.6 8.4h-8.8L17 17l7-5Z" fill="var(--ico-face)"/>
    <path d="M9.6 20.5 17 17M38.4 20.5 31 17M15 37l4.6-11.6M33 37l-4.6-11.6" stroke="var(--ico-line)" stroke-width="1.8" stroke-linecap="round"/>`,
  // Un livre ouvert.
  savoir: `
    <path d="M24 15c-4-3-9-4-14-4v22c5 0 10 1 14 4V15Z" fill="var(--g)"/>
    <path d="M24 15c4-3 9-4 14-4v22c-5 0-10 1-14 4V15Z" fill="var(--ico-face)"/>
    <path d="M24 15v22" stroke="var(--ico-line)" stroke-width="2" stroke-linecap="round"/>`,
}

/** L'icône d'une famille, prête à poser dans un `innerHTML`. */
export function familyIcon(key) {
  return frame(SHAPES[key] || SHAPES.entreprises)
}

/** La liste des familles couvertes — pour vérifier qu'aucune n'est orpheline. */
export const ICON_KEYS = Object.keys(SHAPES)
