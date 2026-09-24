/**
 * Formats francophones — nombres, euros, pourcentages, mois.
 *
 * Ces fonctions ne touchent pas au DOM et ne dépendent de rien : elles servent
 * aussi bien à l'écran qu'au moteur (un verdict contient des montants écrits)
 * et qu'à l'export PowerPoint. Les garder ici évite qu'une couche basse ait à
 * importer une couche haute pour écrire « 1 200 € ».
 */

/**
 * Le séparateur des milliers : une espace insécable ordinaire, pas l'espace
 * fine que produit Intl.
 *
 * L'espace fine insécable (U+202F) est la bonne typographie française, et la
 * police des titres ne la dessine pas : elle lui donne une largeur nulle. Dans
 * un titre, « 280 582 085 € » s'affichait « 280582085 € » — un montant
 * illisible à l'endroit exact où il devait se lire d'un coup. L'espace
 * insécable ordinaire (U+00A0) existe dans toutes les polices de l'outil ;
 * elle est un peu plus large, et elle ne disparaît jamais.
 */
const lisible = (fmt) => ({ format: (v) => fmt.format(v).replace(/\u202f/g, '\u00a0') })

const nf0 = lisible(new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }))
const nf1 = lisible(new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 }))

export function euro(n, { sign = false, compact = false } = {}) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  // Math.round(-0.2) vaut -0, qu'Intl rend « -0 € » : on le neutralise.
  const v = Math.round(n) === 0 ? 0 : Math.round(n)
  if (compact && Math.abs(v) >= 1000) {
    const abs = Math.abs(v)
    if (abs >= 1000000) return `${sign && v > 0 ? '+' : ''}${nf1.format(v / 1000000)} M€`
    return `${sign && v > 0 ? '+' : ''}${nf0.format(v / 1000)} k€`
  }
  return `${sign && v > 0 ? '+' : ''}${nf0.format(v)} €`
}

export const num = (n, d = 0) => (Number.isFinite(n) ? digits(d).format(n) : '—')

/**
 * Un pourcentage, à la précision demandée.
 *
 * Elle était ignorée au-delà d'une décimale : toute demande supérieure retombait
 * sur un seul chiffre après la virgule. Sur la page des règles fiscales, dont
 * l'objet est précisément de montrer les taux tels qu'ils s'appliquent, un
 * relecteur y a lu 0,5 % là où le moteur calcule 0,55 %, 0,7 % au lieu de
 * 0,68 %, 0,2 % au lieu de 0,16 % — et en a conclu, légitimement, que le
 * logiciel appliquait de faux taux. Un affichage qui arrondit un texte de loi
 * ne vérifie rien : il fabrique un doute.
 */
export function pct(n, d = 1) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return `${digits(d).format(n * 100)} %`
}

/** Le formateur à n décimales, fabriqué une fois puis retenu. */
const kept = new Map()
function digits(d) {
  const k = Math.max(0, Math.min(6, Math.round(d)))
  if (!kept.has(k)) {
    kept.set(k, lisible(new Intl.NumberFormat('fr-FR', k === 0
      ? { maximumFractionDigits: 0 }
      : { maximumFractionDigits: k, minimumFractionDigits: k })))
  }
  return kept.get(k)
}

export const monthName = (m) => ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][m % 12]

export function monthLabel(index, startDate) {
  const d = new Date(startDate || '2026-01-01')
  const total = d.getMonth() + index
  const year = d.getFullYear() + Math.floor(total / 12)
  return `${monthName(total % 12)} ${String(year).slice(2)}`
}

export const yearLabel = (y) => `Année ${y + 1}`

/**
 * L'exercice sur lequel on juge le modèle : le premier bénéficiaire, ou la
 * troisième année à défaut — assez loin pour que la montée en charge ait eu
 * lieu, assez proche pour rester crédible.
 */
export function referenceYear(result) {
  if (!result) return 2
  const i = result.pnl.netResult.findIndex((v) => v > 0)
  return i >= 0 ? i : 2
}
