/**
 * Ce que chaque page de saisie pèse dans le plan, en quatre chiffres.
 *
 * Les pages de saisie ne montraient que des champs : on posait un loyer, un
 * salaire, un prix, et il fallait aller au tableau de bord pour savoir ce que
 * ça changeait. Chacune s'ouvre maintenant comme la synthèse — une partie
 * numérotée, des cartes où le montant s'écrit en grand avec sa valeur exacte,
 * ses cinq exercices en barres — et la zone de travail vient ensuite, en
 * partie 02. Tout est lu dans le moteur, rien n'est recalculé ici.
 */

import { euro, pct, num, monthLabel } from './dom.js'
import store from '../state/store.js'
import { SECTORS } from '../state/schema.js'
import { getActivity } from '../state/activities.js'
import { section, entete, exercices, grandsChiffres, anneeLue, lireAnnee } from './sections.js'

const n = (v) => Number(v) || 0
const ANS = [0, 1, 2, 3, 4]
/** Cinq sommes annuelles d'une série mensuelle. */
const parAn = (m) => ANS.map((y) => (m || []).slice(y * 12, y * 12 + 12).reduce((a, v) => a + n(v), 0))
const absAn = (m) => ANS.map((y) => (m || []).slice(y * 12, y * 12 + 12).reduce((a, v) => a + Math.abs(n(v)), 0))
const partDuCA = (v, r, y) => (n(r.pnl.revenue[y]) > 0 ? `${pct(v / r.pnl.revenue[y], 0)} du chiffre d’affaires` : null)
const signe = (v) => (v > 0 ? 'good' : v < 0 ? 'bad' : 'none')

/** Un nombre qui n'est pas un montant : grand en entier, exact avec son unité. */
const compte = (unite, d = 0) => (v) => ({ court: num(v, d), exact: `${num(v, d)} ${unite}` })
/** Un petit montant garde ses centimes : un ticket de 4,50 € n'est pas 5 €. */
const prixUnitaire = (v) => {
  const t = `${num(v, v < 100 ? 2 : 0)} €`
  return { court: t, exact: t }
}

const CARTES = {
  offre(r, s) {
    const p = r.pnl
    const act = getActivity(s.meta?.activityKey)
    const unites = act?.unit?.many || SECTORS[s.meta?.sectorKey]?.unit?.many || 'ventes'
    const ventes = parAn(r.revenue?.units)
    const recurrent = ANS.map((y) => (r.revenue?.perActivity || []).reduce((t, a) => t + parAn(a.recurring)[y], 0))
    return [
      { cle: 'ca', label: 'Chiffre d’affaires', valeurs: p.revenue, ton: () => 'none', note: () => 'Hors taxes, toutes offres confondues.' },
      { cle: 'ventes', label: `${unites.charAt(0).toUpperCase()}${unites.slice(1)} vendus`, neutre: true, valeurs: ventes, format: compte(unites), unite: unites, note: (y) => (ventes[y] > 0 ? `Soit ${num(ventes[y] / 12, 0)} par mois en moyenne.` : 'Aucune vente cette année-là.') },
      // Un abonnement se vend une fois et rapporte chaque mois : diviser le
      // chiffre d'affaires par les abonnements vendus ne donnerait pas un
      // prix. Pour un plan qui en compte, on montre ce qu'ils rapportent.
      recurrent.some((v) => v > 0)
        ? { cle: 'recurrent', label: 'Revenu des abonnements', valeurs: recurrent, note: (y) => (n(p.revenue[y]) > 0 ? `${pct(recurrent[y] / p.revenue[y], 0)} du chiffre d’affaires, attrition déduite.` : 'Abonnements actifs, attrition déduite.') }
        : { cle: 'panier', label: 'Prix moyen d’une vente', valeurs: ANS.map((y) => (ventes[y] > 0 ? n(p.revenue[y]) / ventes[y] : 0)), format: prixUnitaire, note: () => 'Chiffre d’affaires divisé par le nombre de ventes, hors taxes.' },
      { cle: 'marge', label: 'Marge brute', valeurs: p.grossMargin, ton: signe, note: (y) => (n(p.revenue[y]) > 0 ? `${pct(n(r.kpis.marginRate?.[y]), 0)} de chaque euro vendu, après ce que coûte la vente.` : 'Ce qu’il reste des ventes après leur coût direct.') },
    ]
  },

  achats(r) {
    const p = r.pnl
    return [
      { cle: 'externes', label: 'Charges externes', valeurs: p.external.map((v) => Math.abs(n(v))), baisseBonne: true, note: (y) => partDuCA(Math.abs(n(p.external[y])), r, y) || 'Loyer, abonnements, assurances, honoraires.' },
      { cle: 'variables', label: 'Coût de ce que tu vends', valeurs: p.variableCost.map((v) => Math.abs(n(v))), baisseBonne: true, note: (y) => partDuCA(Math.abs(n(p.variableCost[y])), r, y) || 'Achats et charges qui suivent chaque vente.' },
      { cle: 'invest', label: 'Investissements payés', valeurs: parAn(r.capex?.spendMonthly), neutre: true, note: () => 'Matériel et aménagements, décaissés dans l’année.' },
      { cle: 'amort', label: 'Amortissements', valeurs: p.amortisation.map((v) => Math.abs(n(v))), neutre: true, note: () => 'La part des investissements qui passe en charge chaque année.' },
    ]
  },

  equipe(r) {
    const p = r.pnl
    const etp = ANS.map((y) => parAn(r.payroll?.fte)[y] / 12)
    const pic = ANS.map((y) => Math.max(0, ...(r.payroll?.headcount || []).slice(y * 12, y * 12 + 12).map(n)))
    return [
      { cle: 'masse', label: 'Masse salariale', valeurs: p.payroll.map((v) => Math.abs(n(v))), baisseBonne: true, note: (y) => `${partDuCA(Math.abs(n(p.payroll[y])), r, y) || 'Aucun chiffre d’affaires en face'}, cotisations comprises.` },
      { cle: 'etp', label: 'Effectif moyen', valeurs: etp, neutre: true, format: compte('équivalents temps plein', 1), unite: 'équivalents temps plein', note: (y) => (pic[y] > 0 ? `${num(pic[y], 0)} personne${pic[y] > 1 ? 's' : ''} au plus fort de l’année.` : 'Personne en poste cette année-là.') },
      { cle: 'cout', label: 'Coût moyen d’un poste', neutre: true, valeurs: ANS.map((y) => (etp[y] > 0 ? Math.abs(n(p.payroll[y])) / etp[y] : 0)), note: () => 'Coût employeur annuel par équivalent temps plein.' },
    ]
  },

  financement(r, s) {
    const c = r.cash || {}
    const rows = c.rows || {}
    const bas = ANS.map((y) => {
      const mois = (c.balance || []).slice(y * 12, y * 12 + 12).map(n)
      return mois.length ? Math.min(...mois) : 0
    })
    const quand = ANS.map((y) => {
      const mois = (c.balance || []).slice(y * 12, y * 12 + 12).map(n)
      return y * 12 + mois.indexOf(Math.min(...mois))
    })
    const recu = ANS.map((y) => ['equity', 'loans', 'grants', 'shareholder'].reduce((t, k) => t + parAn(rows[k])[y], 0))
    const rembourse = ANS.map((y) => absAn(rows.loanRepayment)[y] + absAn(rows.advanceRepayment)[y])
    return [
      { cle: 'cloture', label: 'Trésorerie à la clôture', valeurs: c.yearEnd || [], ton: (v) => (v < 0 ? 'bad' : 'good'), note: () => 'Sur le compte au dernier jour de l’exercice.' },
      { cle: 'bas', label: 'Point bas de l’année', valeurs: bas, ton: (v) => (v < 0 ? 'bad' : 'good'), note: (y) => `Au plus bas en ${monthLabel(quand[y], r.startDate)}${bas[y] < 0 ? ' : c’est ce qu’il faut trouver avant.' : '.'}` },
      { cle: 'recu', label: 'Argent reçu', valeurs: recu, neutre: true, note: () => 'Apports, emprunts, subventions et avances encaissés.' },
      { cle: 'rembourse', label: 'Remboursements', valeurs: rembourse, baisseBonne: true, note: () => 'Emprunts et avances remboursés dans l’année.' },
    ]
  },
}

const NOMS = {
  offre: 'Ce que tes offres rapportent',
  achats: 'Ce que tu dépenses',
  equipe: 'Ce que coûte ton équipe',
  financement: 'L’argent du départ, et ce qu’il devient',
}

/** Le nom de la zone de travail, selon l'onglet ouvert. */
const VUES = {
  offre: { offres: 'Tes offres', acquisition: 'Comment tu trouves tes clients', compare: 'Tes offres, comparées' },
  achats: { charges: 'Tes charges', invest: 'Tes investissements', repartition: 'Où part l’argent' },
  equipe: { postes: 'Les postes', avantages: 'Les avantages', masse: 'La masse salariale', jei: 'Recherche et JEI' },
  financement: { sources: 'Tes sources de financement', plan: 'Le plan de financement' },
}

/**
 * La partie 01 d'une page de saisie : ses chiffres, ou rien si la page est
 * encore vide — des cartes à zéro partout ne diraient rien.
 */
export function chiffresDePage(route, refresh) {
  const r = store.result
  const s = store.scenario
  if (!r || !CARTES[route]) return null
  let cartes = []
  try { cartes = CARTES[route](r, s).filter(Boolean) } catch { return null }
  if (!cartes.some((c) => (c.valeurs || []).some((v) => Math.abs(n(v)) >= 1))) return null
  const an = anneeLue(r)
  const choisir = (k) => { lireAnnee(k); refresh() }
  return section({ no: 1, nom: NOMS[route], droite: exercices(an, choisir), cle: `page-${route}` },
    grandsChiffres(cartes, an, choisir, { cle: route }))
}

/** La tête de la zone de travail : 02 si les chiffres la précèdent, 01 sinon. */
export function partieTravail(route, view, avecChiffres) {
  const nom = VUES[route]?.[view]
  if (!nom) return null
  return entete({ no: avecChiffres ? 2 : 1, nom })
}
