/**
 * Les fichiers qu'on emporte : la présentation PowerPoint et le prévisionnel
 * en tableur.
 *
 * Ils vivaient dans la page Business case, retirée. Le PowerPoint se
 * télécharge désormais à côté des diapos, dans la synthèse ; le tableur, à
 * côté des états financiers dont il reprend les lignes.
 */

import { toast, monthLabel } from '../ui/dom.js'
import { exportPptx } from './pptx.js'
import { download } from './zip.js'
import store from '../state/store.js'

/* Les diacritiques passent par une RegExp construite depuis une chaîne : un
   littéral les écrirait en vrais caractères combinants dans le paquet. */
const DIACRITIQUES = new RegExp('[\\u0300-\\u036f]', 'g')
/** Nom de fichier : décompose les accents puis retire les diacritiques. */
export const slug = (s) => String(s || 'business-plan').normalize('NFD').replace(DIACRITIQUES, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase()

// Selon le contexte, le fichier est remis par l'hôte (qui demande
// confirmation au visiteur) ou téléchargé directement par le navigateur :
// download() choisit, et renvoie ce qui s'est réellement passé.
const annoncer = (outcome, fait) => {
  if (outcome === 'declined') toast('Téléchargement annulé.')
  else toast(fait, 'ok')
}
const echec = (e) => toast(`Export impossible : ${(e && (e.message || e.code)) || e}`, 'err')

/** La présentation, en .pptx. */
export async function telechargerPptx() {
  const s = store.scenario, r = store.result
  if (!s || !r) return
  try {
    const { slides, outcome } = await exportPptx(s, r, store.profile)
    annoncer(outcome, `Présentation de ${slides} diapositives prête.`)
  } catch (e) { echec(e) }
}

/** Le prévisionnel complet, en .csv, ouvrable dans Excel, Numbers ou Sheets. */
export async function telechargerCsv() {
  const s = store.scenario, r = store.result
  if (!s || !r) return
  try {
    const outcome = await download(new Blob(['﻿' + tableur(r)], { type: 'text/csv;charset=utf-8' }), `${slug(s.meta.name)}-previsionnel.csv`)
    annoncer(outcome, 'Tableau exporté.')
  } catch (e) { echec(e) }
}

function tableur(r) {
  const rows = []
  const push = (label, values) => rows.push([label, ...values.map((v) => (Number.isFinite(v) ? Math.round(v) : ''))].join(';'))
  rows.push(['Poste', ...Array.from({ length: 5 }, (_, i) => `Année ${i + 1}`)].join(';'))
  const p = r.pnl
  push("Chiffre d'affaires", p.revenue)
  push('Achats et charges variables', p.variableCost)
  push('Marge brute', p.grossMargin)
  push('Charges externes', p.external)
  push('Valeur ajoutée', p.valueAdded)
  push('Impôts et taxes', p.duties)
  push('Subventions', p.grants)
  push('Charges de personnel', p.payroll)
  push('EBE', p.ebe)
  push('Pertes sur créances', p.badDebts || [0, 0, 0, 0, 0])
  push('Amortissements', p.amortisation)
  push("Résultat d'exploitation", p.ebit)
  push('Charges financières', p.interest)
  push("Crédits d'impôt", p.credits)
  push('Impôt sur les sociétés', p.corporateTax)
  push('Résultat net', p.netResult)
  rows.push('')
  push('Point mort', r.kpis.breakEven.map((v) => v || 0))
  push('Trésorerie fin de période', r.cash.yearEnd)
  push('BFR fin de période', Array.from({ length: 5 }, (_, y) => r.bfr.total[y * 12 + 11]))
  rows.push('')
  rows.push(['Trésorerie mensuelle', ...Array.from({ length: 60 }, (_, m) => monthLabel(m, r.startDate))].join(';'))
  rows.push(['Solde', ...r.cash.balance.map((v) => Math.round(v))].join(';'))
  return rows.join('\n')
}
