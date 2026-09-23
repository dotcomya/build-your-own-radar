/**
 * Ce chiffre est-il vraisemblable ?
 *
 * Le moteur calcule juste ce qu'on lui donne. Un zéro de trop dans le prix
 * d'un couvert, un salaire saisi en milliers, une croissance tapée en entier
 * au lieu d'un pourcentage : il en sortait 280 millions d'euros de résultat
 * la première année, présentés comme un succès, dans la même typographie
 * qu'un plan sérieux. Le fondateur qui s'en aperçoit perd confiance dans tout
 * le reste ; celui qui ne s'en aperçoit pas l'envoie à sa banque.
 *
 * Ce module compare chaque saisie décisive à ce qu'on observe dans le métier
 * choisi, et dit l'écart en clair : « ce prix semble 50 fois au-dessus de ce
 * qu'on voit dans ton métier (en général 5 à 150 € le couvert) ». Les
 * fourchettes sont larges à dessein — elles couvrent la crêperie comme le
 * restaurant gastronomique — et l'on ne dit rien en dessous d'un facteur
 * trois : l'outil ne juge pas un positionnement, il attrape les fautes de
 * frappe et les ordres de grandeur impossibles.
 *
 * Deux niveaux : « attention » à partir de trois fois, « alerte » à partir de
 * dix. Une alerte change le verdict : le plan n'est pas présenté comme viable
 * tant qu'elle tient.
 */

import { euro, pct, num } from '../format.js'
import { SECTORS } from '../state/schema.js'
import { getActivity } from '../state/activities.js'
import { PARAMS } from './fiscal-fr-2026.js'

/**
 * Les fourchettes, par modèle économique.
 *
 *   prix   prix unitaire hors taxe d'une vente
 *   abo    abonnement mensuel hors taxe (absent : pas de repère)
 *   crois  croissance mensuelle au-delà de laquelle on s'étonne
 *   ca1    chiffre d'affaires de la première année, du plus petit au plus gros
 *   achats le coût de revient est une marchandise : la marge brute du métier
 *          se compare à celle du plan (ailleurs, le coût principal est le
 *          temps des équipes, que le plan range en salaires)
 *
 * Ce sont des ordres de grandeur observés sur des créations françaises, pas
 * des normes : ils situent, ils n'interdisent rien.
 */
export const REPERES = {
  logiciel: { prix: [20, 20000], abo: [5, 3000], crois: 0.2, ca1: [0, 2e6] },
  developpeur: { prix: [250, 1500], abo: [50, 5000], crois: 0.08, ca1: [15e3, 250e3] },
  conseil: { prix: [500, 100e3], abo: [200, 20e3], crois: 0.1, ca1: [25e3, 2e6] },
  avocat: { prix: [100, 30e3], abo: [100, 5000], crois: 0.08, ca1: [30e3, 1.5e6] },
  medecin: { prix: [25, 150], crois: 0.06, ca1: [50e3, 500e3] },
  kine: { prix: [15, 90], crois: 0.06, ca1: [35e3, 250e3] },
  dentiste: { prix: [25, 2500], crois: 0.06, ca1: [100e3, 1.2e6] },
  restaurant: { achats: true, prix: [5, 150], abo: [30, 600], crois: 0.08, ca1: [50e3, 2.5e6] },
  glacier: { achats: true, prix: [2, 40], crois: 0.08, ca1: [30e3, 1e6] },
  boulangerie: { achats: true, prix: [0.5, 60], crois: 0.06, ca1: [80e3, 2e6] },
  ecommerce: { achats: true, prix: [5, 1500], abo: [5, 200], crois: 0.2, ca1: [5e3, 5e6] },
  fleuriste: { achats: true, prix: [5, 300], abo: [20, 300], crois: 0.06, ca1: [50e3, 800e3] },
  commerce: { achats: true, prix: [2, 3000], abo: [5, 300], crois: 0.08, ca1: [40e3, 3e6] },
  coiffeur: { prix: [10, 250], abo: [20, 200], crois: 0.06, ca1: [35e3, 800e3] },
  spa: { prix: [25, 400], abo: [25, 400], crois: 0.08, ca1: [50e3, 2e6] },
  hebergement: { prix: [25, 800], crois: 0.1, ca1: [8e3, 3e6] },
  services: { prix: [15, 80], abo: [50, 2000], crois: 0.1, ca1: [15e3, 2e6] },
  coach: { prix: [10, 200], abo: [10, 250], crois: 0.1, ca1: [25e3, 2e6] },
  batiment: { achats: true, prix: [100, 150e3], crois: 0.08, ca1: [30e3, 3e6] },
  formation: { prix: [50, 5000], abo: [10, 500], crois: 0.1, ca1: [20e3, 3e6] },
  association: { prix: [2, 1000], abo: [2, 200], crois: 0.08, ca1: [5e3, 3e6] },
}

/** À partir de combien de fois on le dit, et à partir de combien on insiste. */
export const SEUILS = { attention: 3, alerte: 10 }

/** Le SMIC annuel brut à temps plein (35 h), à la valeur en vigueur. */
export const SMIC_ANNUEL = Math.round(PARAMS.smicHourly.value * 151.67 * 12)

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

/** Le repère du plan, ou rien si le métier n'en a pas. */
export function repere(scenario) {
  return REPERES[scenario?.meta?.sectorKey] || null
}

/** L'unité du métier : « couvert », « séance », « nuitée »… */
export function uniteDe(scenario) {
  const act = getActivity(scenario?.meta?.activityKey)
  return act?.unit?.one || SECTORS[scenario?.meta?.sectorKey]?.unit?.one || 'vente'
}

/**
 * L'écart d'une valeur à une fourchette, en nombre de fois.
 *
 * `null` quand la valeur est dans la fourchette, nulle, ou pas un nombre. Au-
 * dessus, c'est valeur / plafond ; en dessous, plancher / valeur.
 */
export function ecart(valeur, [bas, haut]) {
  const v = n(valeur)
  if (v <= 0) return null
  if (haut > 0 && v > haut) return { sens: 'haut', fois: v / haut }
  if (bas > 0 && v < bas) return { sens: 'bas', fois: bas / v }
  return null
}

/** « 3,5 fois », « 50 fois », « plus de mille fois ». */
export function fois(f) {
  if (f >= 1000) return 'plus de mille fois'
  if (f >= 10) return `${num(Math.round(f))} fois`
  return `${(Math.round(f * 10) / 10).toLocaleString('fr-FR')} fois`
}

const niveau = (f) => (f >= SEUILS.alerte ? 'alerte' : f >= SEUILS.attention ? 'attention' : null)
const sens = (e) => (e.sens === 'haut' ? 'au-dessus' : 'en dessous')

/* ───────────────────────────── Les saisies ───────────────────────────── */

/**
 * Un prix de vente unitaire, hors taxe.
 *
 * La première offre est le cœur du métier : elle se compare au prix d'un
 * couvert, d'une séance, d'une nuitée. Les suivantes peuvent se vendre à
 * une autre unité — une privatisation, un forfait, un coffret — et ne se
 * comparent qu'à l'ordre de grandeur, vingt fois plus large vers le haut.
 */
export function gardePrix(scenario, valeur, { principale = true } = {}) {
  const R = repere(scenario)
  if (!R) return null
  const bornes = principale ? R.prix : [R.prix[0], R.prix[1] * 20]
  const e = ecart(valeur, bornes)
  const lv = e && niveau(e.fois)
  if (!lv) return null
  const ou = principale
    ? `en général ${euro(bornes[0])} à ${euro(bornes[1])} HT par ${uniteDe(scenario)}`
    : `de ${euro(bornes[0])} à ${euro(bornes[1])} HT, toutes offres confondues`
  return {
    niveau: lv,
    texte: `Ce prix semble ${fois(e.fois)} ${sens(e)} de ce qu’on voit dans ton métier (${ou}).`,
  }
}

/** Un abonnement, ramené au mois. */
export function gardeAbonnement(scenario, valeurMensuelle) {
  const R = repere(scenario)
  if (!R || !R.abo) return null
  const e = ecart(valeurMensuelle, R.abo)
  const lv = e && niveau(e.fois)
  if (!lv) return null
  return {
    niveau: lv,
    texte: `Cet abonnement semble ${fois(e.fois)} ${sens(e)} de ce qu’on voit dans ton métier (en général ${euro(R.abo[0])} à ${euro(R.abo[1])} HT par mois).`,
  }
}

/**
 * Une croissance mensuelle.
 *
 * Au-delà de 100 % par mois, c'est presque toujours un pourcentage saisi en
 * entier (« 8 » pour 8 %) : on le dit tel quel.
 */
export function gardeCroissance(scenario, taux) {
  const g = n(taux)
  if (g <= 0) return null
  if (g >= 1) {
    const x = 1 + g
    const dit = x === 2 ? 'doubler les ventes chaque mois' : `multiplier les ventes par ${num(x, Number.isInteger(x) ? 0 : 1)} chaque mois`
    return { niveau: 'alerte', texte: `${pct(g, 0)} par mois, c’est ${dit}. As-tu voulu écrire ${pct(g / 100, 0)} ?` }
  }
  const R = repere(scenario)
  const plafond = R?.crois || 0.1
  const f = g / plafond
  const lv = niveau(f)
  if (!lv) return null
  const an = Math.pow(1 + g, 12)
  return {
    niveau: lv,
    texte: `${pct(g, 0)} par mois multiplie les ventes par ${fois(an).replace(' fois', '')} en un an : ${fois(f)} ce qu’on voit dans ton métier (jusqu’à ${pct(plafond, 0)} par mois).`,
  }
}

/**
 * Un salaire, en brut annuel.
 *
 * Le SMIC sert de plancher aux contrats de travail ; un dirigeant peut ne
 * rien se verser, mais pas 44 € par an sans que ce soit une erreur d'unité.
 * L'alternance et le stage ont leurs propres minima, plus bas : on ne les
 * compare qu'à l'absurde.
 */
export function gardeSalaire(annuel, contrat = 'cdi') {
  const a = n(annuel)
  if (a <= 0 || contrat === 'freelance') return null
  const plancher = ['cdi', 'cdd'].includes(contrat) ? SMIC_ANNUEL
    : ['alternance', 'stage'].includes(contrat) ? SMIC_ANNUEL * 0.27
      : SMIC_ANNUEL / 4
  if (a < plancher) {
    const f = plancher / a
    const lv = niveau(f)
    const salarie = ['cdi', 'cdd'].includes(contrat)
    if (!lv && !salarie) return null
    // Deux fautes courantes : un montant en milliers (« 44 » pour 44 000 €)
    // et un montant mensuel dans un champ annuel (« 1 800 »).
    const piste = a < 1000 ? ` As-tu voulu écrire ${euro(a * 1000)} ?`
      : a < 5000 ? ` Si c’est un montant mensuel, cela fait ${euro(a * 12)} par an.` : ''
    const texte = salarie
      ? lv
        ? `${euro(a)} brut par an, c’est ${fois(f)} moins que le SMIC à temps plein (${euro(SMIC_ANNUEL)}).${piste}`
        : `${euro(a)} brut par an, c’est sous le SMIC à temps plein (${euro(SMIC_ANNUEL)}). Un temps partiel ?${piste}`
      : `${euro(a)} brut par an semble ${fois(f)} en dessous de ce qu’on verse d’ordinaire.${piste}`
    return { niveau: lv || 'attention', texte }
  }
  const haut = 150000
  if (a > haut) {
    const f = a / haut
    const lv = f >= 5 ? 'alerte' : f >= 2 ? 'attention' : null
    if (!lv) return null
    return { niveau: lv, texte: `${euro(a)} brut par an semble ${fois(f)} au-dessus des rémunérations d’une jeune entreprise (rarement plus de ${euro(haut)}).` }
  }
  return null
}

/* ─────────────────────────────── Le plan ─────────────────────────────── */

const GO = {
  prix: { route: 'offre', view: 'offres', sec: 'offre', openAll: true, anchor: 'prix' },
  volumes: { route: 'offre', view: 'offres', sec: 'volumes', openAll: true, anchor: 'volumes' },
  equipe: { route: 'equipe', view: 'postes', anchor: 'equipe' },
  charges: { route: 'achats', view: 'charges', anchor: 'charges' },
  sources: { route: 'financement', view: 'sources', anchor: 'sources' },
}

const somme = (xs) => (xs || []).reduce((a, x) => a + n(x?.amount ?? x), 0)

/**
 * Tout ce qui sort de l'ordinaire dans un plan, le plus grave d'abord.
 *
 * Chaque ligne dit ce qui étonne, de combien, et où le corriger :
 * `{ cle, niveau, sujet, texte, go, sortie }`. `sortie` marque les chiffres
 * calculés (chiffre d'affaires, résultat) — ceux qu'un verdict ne doit pas
 * présenter comme un succès.
 */
export function vraisemblance(scenario, result) {
  const s = scenario || {}
  const R = repere(s)
  const out = []
  const push = (cle, g, sujet, go, extra = {}) => { if (g) out.push({ cle, sujet, go, ...g, ...extra }) }

  for (const [k, a] of (s.activities || []).entries()) {
    const nom = a.name ? `« ${a.name} »` : 'une offre'
    push(`prix:${a.id}`, gardePrix(s, a.unitPrice, { principale: k === 0 }), `Le prix de ${nom}`, GO.prix, { valeur: n(a.unitPrice) })
    push(`abo:${a.id}`, gardeAbonnement(s, a.recurringPrice), `L’abonnement de ${nom}`, GO.prix, { valeur: n(a.recurringPrice) })
    if (a.volumes?.mode !== 'manual') push(`crois:${a.id}`, gardeCroissance(s, a.volumes?.monthlyGrowth), `La croissance de ${nom}`, GO.volumes)
  }

  for (const m of s.team || []) {
    const g = gardeSalaire(n(m.monthlyGross) * 12, m.contractType)
    push(`salaire:${m.id}`, g, `Le salaire de « ${m.role || 'ce poste'} »`, GO.equipe)
  }

  if (result && R) {
    const p = result.pnl || {}
    const ca = n(p.revenue?.[0])
    const net = n(p.netResult?.[0])
    const e = ecart(ca, R.ca1)
    if (e && e.sens === 'haut' && niveau(e.fois)) {
      out.push({
        cle: 'ca1', sortie: true, niveau: niveau(e.fois), sujet: 'Le chiffre d’affaires de la première année', go: GO.volumes,
        texte: `${euro(ca)} la première année, c’est ${fois(e.fois)} ce que font les plus grosses affaires de ton métier dès le départ (jusqu’à ${euro(R.ca1[1])}). Vérifie le prix et les volumes.`,
      })
    }
    if (net > 0 && R.ca1[1] > 0 && net / R.ca1[1] >= SEUILS.attention) {
      const f = net / R.ca1[1]
      out.push({
        cle: 'net1', sortie: true, niveau: niveau(f), sujet: 'Le résultat de la première année', go: GO.prix,
        texte: `${euro(net)} de résultat net la première année : ${fois(f)} le chiffre d’affaires annuel des plus grosses affaires de ton métier. Un prix ou un volume a sans doute un zéro de trop.`,
      })
    }

    // La marge : on compare la part du prix qui part en achats, pas la marge
    // elle-même — 99 % contre 75 % n'a l'air de rien, 1 % d'achats contre 25 %
    // dit l'oubli.
    const bm = SECTORS[s.meta?.sectorKey]?.benchmarks?.grossMargin
    const mr = n(result.kpis?.marginRate?.[0])
    if (R.achats && bm && ca > 0 && bm[1] < 0.97) {
      const typ = [1 - bm[1], 1 - bm[0]]
      const part = Math.max(0, 1 - mr)
      // Un prix aberrant écrase la part des achats : c'est le prix qu'il faut
      // corriger, et le dire deux fois brouillerait la piste.
      const prixFaux = out.some((x) => x.cle.startsWith('prix:') && x.niveau === 'alerte')
      const aucun = Math.abs(n(p.variableCost?.[0])) === 0
      if (!prixFaux && part < typ[0] / SEUILS.attention) {
        const f = part > 0 ? typ[0] / part : Infinity
        out.push({
          cle: 'marge', niveau: 'attention', sujet: 'Le coût de revient', go: GO.charges,
          texte: !aucun
            ? `Tes achats ne pèsent que ${pct(part, part < 0.01 ? 2 : 1)} du prix, ${fois(f)} moins que dans ton métier (en général ${pct(typ[0], 0)} à ${pct(typ[1], 0)}). Un coût de revient oublié ?`
            : `Aucun achat en face des ventes, alors que ton métier y consacre en général ${pct(typ[0], 0)} à ${pct(typ[1], 0)} du prix. Un coût de revient oublié ?`,
        })
      }
    }

    // Le financement : ce qu'il manque au point bas, face à ce qui est prévu.
    const f = s.financing || {}
    const prevu = n(f.openingCash) + somme(f.equityFounders) + somme(f.equityInvestors) + somme(f.loans) +
      somme(f.grants) + somme(f.advances) + somme(f.shareholderLoans)
    const manque = n(result.kpis?.fundingNeed)
    // Manquer d'argent est une situation réelle, que le verdict dit déjà ; on
    // ne soupçonne une faute de saisie qu'à dix fois l'écart, et sans bloquer.
    if (manque > 0 && prevu > 0 && manque / prevu >= SEUILS.alerte) {
      const x = manque / prevu
      out.push({
        cle: 'financement', niveau: 'attention', sujet: 'Le financement', go: GO.sources,
        texte: `Tu prévois ${euro(prevu)} de financement, et il manque encore ${euro(manque)} au point bas : ${fois(x)} plus que prévu. Un montant sans ses zéros ?`,
      })
    }
  }

  const rang = { alerte: 0, attention: 1 }
  return out.sort((a, b) => rang[a.niveau] - rang[b.niveau])
}

/** Les alertes qui doivent empêcher un verdict favorable. */
export function bloquantes(liste) {
  return (liste || []).filter((x) => x.niveau === 'alerte')
}
