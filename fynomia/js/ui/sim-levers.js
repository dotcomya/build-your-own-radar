/**
 * Les curseurs de la simulation, fabriqués à partir du plan lui-même.
 *
 * Treize leviers génériques — « le prix », « les volumes », « la masse
 * salariale » — ne disent rien à qui a saisi trois offres et onze charges :
 * lequel de ses prix bouge ? quelle charge ? Et surtout, ils ne permettent pas
 * la question qu'on se pose vraiment : « et si j'embauchais quelqu'un ? »
 *
 * Ici, chaque ligne du plan devient son propre curseur. Le prix du menu du
 * midi, le loyer, le salaire de la deuxième personne, le montant de l'emprunt.
 * La valeur réelle reste écrite, en gris, à côté de la valeur simulée : on
 * voit d'où l'on part et de combien on s'écarte.
 *
 * Un levier ne sait rien de l'écran. Il sait lire sa valeur dans un scénario,
 * l'y réécrire, et dire dans quelles bornes il a le droit de bouger.
 */

import { newTeamMember } from '../state/schema.js'
import { vocabulaireDuPlan, uniteOffre } from '../state/sectors.js'

const n = (v) => Number(v) || 0
const pctFmt = (v) => `${Math.round(v * 1000) / 10} %`.replace('.', ',')
const eurFmt = (v) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(v))} €`
const unitFmt = (v) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v)

/** Les bornes d'un curseur autour d'une valeur : moitié en bas, double en haut. */
function around(v, { floor = 0, ceil = null, mult = 2 } = {}) {
  const base = Math.abs(v) > 0 ? Math.abs(v) : 100
  const max = ceil ?? base * mult
  return { min: floor, max: Math.max(max, base * 1.05), step: max / 200 }
}

/**
 * Tous les curseurs d'un scénario, groupés comme les modules qui les portent.
 *
 * L'ordre suit celui de la construction : ce qu'on vend, ce que ça coûte, qui
 * le fait, avec quel argent. C'est l'ordre dans lequel un fondateur pense son
 * modèle, donc celui dans lequel il veut le bousculer.
 */
export function simLevers(s) {
  const voc = vocabulaireDuPlan(s)
  const out = []

  // ── Ce que tu vends ─────────────────────────────────────────────────────
  for (const a of s.activities || []) {
    const rec = n(a.recurringPrice) > 0
    const price = rec ? 'recurringPrice' : 'unitPrice'
    const cost = rec ? 'recurringCost' : 'unitCost'
    if (n(a[price]) > 0) {
      out.push(lever({
        id: `px-${a.id}`, group: 'offre', line: a.name || 'Offre',
        label: rec ? 'Prix de l’abonnement' : 'Prix de vente',
        read: (sc) => n(find(sc.activities, a.id)?.[price]),
        write: (sc, v) => { const t = find(sc.activities, a.id); if (t) t[price] = v },
        fmt: eurFmt, ...around(n(a[price])),
      }))
    }
    if (n(a[cost]) > 0 || n(a[price]) > 0) {
      out.push(lever({
        id: `ct-${a.id}`, group: 'offre', line: a.name || 'Offre',
        label: 'Coût de revient', hint: 'Ce que coûte une vente, hors charges fixes.',
        read: (sc) => n(find(sc.activities, a.id)?.[cost]),
        write: (sc, v) => { const t = find(sc.activities, a.id); if (t) t[cost] = v },
        fmt: eurFmt, ...around(n(a[cost]) || n(a[price]) * 0.4, { ceil: n(a[price]) || undefined }),
      }))
    }
    const v = a.volumes || {}
    if (v.mode !== 'manual') {
      out.push(lever({
        id: `vol-${a.id}`, group: 'offre', line: a.name || 'Offre',
        label: `${uniteOffre(s, a).many[0].toUpperCase()}${uniteOffre(s, a).many.slice(1)} le premier mois`,
        read: (sc) => n(find(sc.activities, a.id)?.volumes?.startUnits),
        write: (sc, v2) => { const t = find(sc.activities, a.id); if (t) t.volumes.startUnits = Math.round(v2) },
        fmt: unitFmt, ...around(n(v.startUnits) || 10, { mult: 3 }),
      }))
      out.push(lever({
        id: `cr-${a.id}`, group: 'offre', line: a.name || 'Offre',
        label: 'Croissance par mois',
        read: (sc) => n(find(sc.activities, a.id)?.volumes?.monthlyGrowth),
        write: (sc, v2) => { const t = find(sc.activities, a.id); if (t) t.volumes.monthlyGrowth = v2 },
        fmt: pctFmt, min: -0.1, max: 0.3, step: 0.005,
      }))
    }
    if (n(a.recurringPrice) > 0) {
      out.push(lever({
        id: `ch-${a.id}`, group: 'offre', line: a.name || 'Offre',
        label: 'Attrition mensuelle', hint: 'La part de clients qui partent chaque mois.',
        read: (sc) => n(find(sc.activities, a.id)?.churnMonthly),
        write: (sc, v2) => { const t = find(sc.activities, a.id); if (t) t.churnMonthly = v2 },
        fmt: pctFmt, min: 0, max: 0.15, step: 0.0025,
      }))
    }
  }

  // ── Ce que ça coûte ─────────────────────────────────────────────────────
  for (const o of s.opex || []) {
    if (o.enabled === false) continue
    const mode = o.mode || 'fixed'
    const field = mode === 'pctRevenue' ? 'pctRevenue' : mode === 'perUnit' ? 'perUnit' : mode === 'perEmployee' ? 'perEmployee' : 'monthlyAmount'
    const isPct = field === 'pctRevenue'
    out.push(lever({
      id: `op-${o.id}`, group: 'charge', line: o.label || 'Charge',
      label: isPct ? 'Part du chiffre d’affaires' : field === 'perUnit' ? `Par ${voc.one}` : field === 'perEmployee' ? 'Par personne et par mois' : 'Montant mensuel',
      read: (sc) => n(find(sc.opex, o.id)?.[field]),
      write: (sc, v) => { const t = find(sc.opex, o.id); if (t) t[field] = v },
      fmt: isPct ? pctFmt : eurFmt,
      ...(isPct ? { min: 0, max: 0.6, step: 0.005 } : around(n(o[field]))),
    }))
  }

  // ── Qui le fait ─────────────────────────────────────────────────────────
  for (const m of s.team || []) {
    out.push(lever({
      id: `sal-${m.id}`, group: 'equipe', line: m.role || 'Poste',
      label: m.contractType === 'tns' ? 'Rémunération mensuelle' : 'Brut mensuel',
      read: (sc) => n(find(sc.team, m.id)?.monthlyGross),
      write: (sc, v) => { const t = find(sc.team, m.id); if (t) t.monthlyGross = v },
      fmt: eurFmt, ...around(n(m.monthlyGross) || 2000),
    }))
    if (n(m.count) > 1 || m.contractType !== 'tns') {
      out.push(lever({
        id: `nb-${m.id}`, group: 'equipe', line: m.role || 'Poste',
        label: 'Nombre de personnes',
        read: (sc) => n(find(sc.team, m.id)?.count) || 1,
        write: (sc, v) => { const t = find(sc.team, m.id); if (t) t.count = Math.max(0, Math.round(v)) },
        fmt: (v) => `${Math.round(v)}`, min: 0, max: Math.max(6, (n(m.count) || 1) * 3), step: 1,
      }))
    }
  }

  // La question qu'aucun levier existant ne posait : « et si j'embauchais ? »
  // Le poste n'existe pas encore dans le plan — la simulation le crée dans sa
  // copie, et le validera comme une ligne ordinaire si le fondateur le garde.
  out.push(lever({
    id: 'hire', group: 'equipe', line: 'Une embauche de plus',
    label: 'Recrues supplémentaires', hint: 'Au salaire médian de ton équipe, à partir du sixième mois.',
    read: (sc) => (sc.team || []).filter((m) => m.simulated).length,
    write: (sc, v) => setHires(sc, Math.max(0, Math.round(v))),
    fmt: (v) => (v < 1 ? 'aucune' : `${Math.round(v)}`), min: 0, max: 5, step: 1,
  }))

  // ── Avec quel argent ────────────────────────────────────────────────────
  const f = s.financing || {}
  out.push(lever({
    id: 'cash0', group: 'financement', line: 'Trésorerie de départ',
    label: 'Sur le compte le premier jour',
    read: (sc) => n(sc.financing?.openingCash) + (sc.financing?.equityFounders || []).reduce((a, e) => a + n(e.amount), 0),
    write: (sc, v) => {
      const eq = sc.financing.equityFounders || []
      if (eq.length) { eq[0].amount = Math.max(0, v - n(sc.financing.openingCash)) }
      else sc.financing.openingCash = v
    },
    fmt: eurFmt, ...around(n(f.openingCash) + (f.equityFounders || []).reduce((a, e) => a + n(e.amount), 0) || 20000),
  }))
  for (const l of f.loans || []) {
    out.push(lever({
      id: `loan-${l.id}`, group: 'financement', line: l.label || 'Emprunt',
      label: 'Montant emprunté',
      read: (sc) => n(find(sc.financing.loans, l.id)?.amount),
      write: (sc, v) => { const t = find(sc.financing.loans, l.id); if (t) t.amount = v },
      fmt: eurFmt, ...around(n(l.amount) || 50000),
    }))
    out.push(lever({
      id: `rate-${l.id}`, group: 'financement', line: l.label || 'Emprunt',
      label: 'Taux annuel',
      read: (sc) => n(find(sc.financing.loans, l.id)?.rate),
      write: (sc, v) => { const t = find(sc.financing.loans, l.id); if (t) t.rate = v },
      fmt: pctFmt, min: 0, max: 0.12, step: 0.0025,
    }))
  }

  return out
}

/** Les groupes, dans l'ordre de la construction d'un modèle. */
export const SIM_GROUPS = [
  { key: 'offre', label: 'Ce que tu vends', note: 'Prix, volumes, coût de revient, attrition.' },
  { key: 'charge', label: 'Ce que ça coûte', note: 'Chaque charge de fonctionnement, une par une.' },
  { key: 'equipe', label: 'Qui le fait', note: 'Les salaires, les effectifs, et une embauche de plus.' },
  { key: 'financement', label: 'Avec quel argent', note: 'Ton apport, tes emprunts et leur taux.' },
]

/* ──────────────────────────── Mécanique interne ─────────────────────────── */

const find = (arr, id) => (arr || []).find((x) => x.id === id)

function lever(def) {
  return { hint: '', step: 1, min: 0, max: 100, ...def }
}

/**
 * Ajouter ou retirer des postes simulés.
 *
 * Ils portent un drapeau : la simulation sait les retrouver pour les compter,
 * et l'écran de validation sait dire qu'il s'agit de créations et non de
 * modifications.
 */
function setHires(sc, want) {
  const existing = (sc.team || []).filter((m) => m.simulated)
  if (want === existing.length) return
  if (want < existing.length) {
    sc.team = sc.team.filter((m) => !m.simulated || existing.indexOf(m) < want)
    return
  }
  const salaries = (sc.team || []).filter((m) => !m.simulated && n(m.monthlyGross) > 0).map((m) => n(m.monthlyGross)).sort((a, b) => a - b)
  const median = salaries.length ? salaries[Math.floor(salaries.length / 2)] : 2200
  for (let i = existing.length; i < want; i++) {
    sc.team.push(newTeamMember({
      role: `Recrue simulée ${i + 1}`, contractType: 'cdi', status: 'non-cadre',
      monthlyGross: median, startMonth: 6, simulated: true,
    }))
  }
}
