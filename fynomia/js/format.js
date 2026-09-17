/**
 * Formats francophones — nombres, euros, pourcentages, mois.
 *
 * Ces fonctions ne touchent pas au DOM et ne dépendent de rien : elles servent
 * aussi bien à l'écran qu'au moteur (un verdict contient des montants écrits)
 * et qu'à l'export PowerPoint. Les garder ici évite qu'une couche basse ait à
 * importer une couche haute pour écrire « 1 200 € ».
 */

const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const nf2 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 2 })

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

export const num = (n, d = 0) => (Number.isFinite(n) ? (d === 0 ? nf0 : d === 1 ? nf1 : nf2).format(n) : '—')

export function pct(n, d = 1) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—'
  return `${(d === 0 ? nf0 : nf1).format(n * 100)} %`
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
