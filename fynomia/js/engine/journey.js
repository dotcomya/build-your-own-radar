/**
 * Le parcours du fondateur.
 *
 * Un business plan n'est pas un formulaire : c'est une suite de questions dont
 * chacune ne se pose que parce qu'on a répondu à la précédente. Ce module
 * décrit cette suite — neuf étapes, trois actes — et sait dire, en lisant les
 * données réelles, où en est le fondateur.
 *
 * L'état d'une étape n'est jamais déclaré : il est *constaté*. Personne ne
 * coche une case ; on regarde le scénario, et si l'information y est, l'étape
 * est faite. C'est ce qui empêche le parcours de mentir.
 *
 * Chaque étape porte aussi ce qu'un fondateur seul face à son tableur n'a pas :
 * la question qu'on lui posera, l'erreur que tout le monde fait, et l'ordre de
 * grandeur qui sépare un chiffre crédible d'un chiffre inventé.
 */

import { euro, pct } from '../format.js'

/** Les trois actes. Un acte est une promesse, pas un chapitre. */
export const ACTS = [
  { key: 'projet', title: 'Les bases', tagline: 'Le projet et son modèle' },
  { key: 'moyens', title: 'Ce que ça coûte', tagline: "L'équipe et les frais" },
  { key: 'argent', title: 'Ce que ça rapporte', tagline: 'Les clients, la caisse, ta part' },
  { key: 'plus', title: 'Pour aller plus loin', tagline: 'Quand le reste est posé' },
]

/* ────────────────────────────── Petits outils ───────────────────────────── */

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const filled = (v) => typeof v === 'string' && v.trim().length > 0
const activities = (s) => (s.activities || []).filter(Boolean)
const liveTeam = (s) => (s.team || []).filter((m) => m && m.enabled !== false)
const liveOpex = (s) => (s.opex || []).filter((o) => o && o.enabled !== false)
const liveCampaigns = (s) => (s.marketing || []).filter((c) => c && c.enabled !== false)

/** Un état d'étape, normalisé. `score` pèse dans l'avancement global. */
const state = (score, detail) => ({
  score: Math.max(0, Math.min(1, score)),
  status: score >= 1 ? 'done' : score > 0 ? 'started' : 'todo',
  detail,
})

/* ───────────────────────────────── Étapes ───────────────────────────────── */

export const STEPS = [
  {
    key: 'projet',
    act: 'projet',
    page: 'reglages',
    label: 'Mon projet',
    question: 'Quel est ton projet ?',
    promise: "Le métier choisi commande tout le reste : la TVA, ton statut social, les repères auxquels on te comparera.",
    minutes: 2,
    unlocks: "Repères du métier et régime de TVA applicable",
    check(s) {
      let score = 0
      if (s.meta?.sectorKey) score += 0.5
      if (filled(s.meta?.company) || filled(s.meta?.name)) score += 0.3
      if (s.meta?.legalForm) score += 0.2
      const bits = []
      if (s.meta?.sectorKey) bits.push(s.meta.sectorLabel || 'métier choisi')
      if (s.meta?.legalForm) bits.push(s.meta.legalForm)
      return state(score, bits.join(' · ') || 'Choisis ton métier pour démarrer')
    },
  },
  {
    key: 'modele',
    act: 'projet',
    page: 'modele',
    label: 'Mon modèle',
    question: 'Comment gagnes-tu de l’argent ?',
    promise: "Un prix, un coût de revient, et la façon dont l'argent revient — une fois ou tous les mois. C'est la brique dont tout le reste est fait.",
    minutes: 5,
    unlocks: 'Marge unitaire et point mort',
    check(s) {
      const list = activities(s)
      if (!list.length) return state(0, 'Aucune offre définie')
      const priced = list.filter((a) => n(a.unitPrice) > 0 || n(a.recurringPrice) > 0)
      if (!priced.length) return state(0.2, 'Aucun prix renseigné')

      // Un coût de revient nul est parfois la vérité — un conseil ne consomme
      // rien par mission. Ce qui doit être vrai, c'est que la marge soit
      // positive : c'est elle qui décide si le modèle tient debout.
      const margin = (a) => {
        const months = Math.max(1, n(a.contractMonths) || 1)
        return (n(a.unitPrice) - n(a.unitCost)) + (n(a.recurringPrice) - n(a.recurringCost)) * months
      }
      const losing = priced.filter((a) => margin(a) <= 0)
      if (losing.length) return state(0.75, `« ${losing[0].name} » se vend à perte`)

      const score = 1
      const first = priced[0]
      const price = n(first.recurringPrice) > 0
        ? `${euro(n(first.recurringPrice))}/mois`
        : euro(n(first.unitPrice))
      return state(score, `${priced.length} offre${priced.length > 1 ? 's' : ''} · ${price}`)
    },
  },
  {
    key: 'equipe',
    act: 'moyens',
    page: 'equipe',
    label: 'Mon équipe',
    question: 'Qui travaille avec toi ?',
    promise: "Tu donnes un brut annuel, Fynomia calcule le coût réel pour l'entreprise — cotisations patronales, réduction générale, allègements applicables.",
    minutes: 6,
    unlocks: 'Masse salariale chargée et point mort',
    check(s, r) {
      const team = liveTeam(s)
      if (!team.length) return state(0, "Personne dans l'équipe, pas même toi")
      const paid = team.filter((m) => n(m.monthlyGross) > 0 || m.contractType === 'stage')
      const cost = r ? (r.pnl.payroll[0] || 0) : 0
      const score = paid.length === team.length ? 1 : 0.6
      return state(score, `${team.length} personne${team.length > 1 ? 's' : ''}${cost > 0 ? ` · ${euro(cost, { compact: true })}/an` : ''}`)
    },
  },
  {
    key: 'charges',
    act: 'moyens',
    page: 'charges',
    label: 'Mes charges',
    question: 'Que coûte le fonctionnement ?',
    promise: "Loyer, comptable, logiciels, assurances, matériel. Les dépenses qui tombent que tu vendes ou non — celles qui fixent ton point mort.",
    minutes: 4,
    unlocks: 'Point mort et besoin en fonds de roulement',
    check(s) {
      const opex = liveOpex(s)
      if (!opex.length) return state(0, 'Aucune charge de fonctionnement')
      const total = opex.reduce((a, o) => a + n(o.monthlyAmount), 0)
      const labels = opex.map((o) => (o.label || '').toLowerCase()).join(' ')
      const essentials = ['compt', 'assur', 'banq']
      const covered = essentials.filter((k) => labels.includes(k)).length
      const score = 0.55 + (covered / essentials.length) * 0.45
      return state(score, `${opex.length} postes · ${euro(total)}/mois`)
    },
  },
  {
    key: 'clients',
    act: 'argent',
    page: 'offre',
    label: 'Mes clients',
    question: 'Combien de clients, et à quel rythme ?',
    promise: "Le nombre de clients du premier mois et la vitesse à laquelle il grossit. C'est l'hypothèse la plus contestée d'un business plan : autant l'assumer.",
    minutes: 6,
    unlocks: "Chiffre d'affaires et trajectoire sur cinq ans",
    check(s, r) {
      const list = activities(s)
      const withVolume = list.filter((a) => {
        const v = a.volumes || {}
        return n(v.startUnits) > 0 || (v.manual || []).some((x) => n(x) > 0)
      })
      if (!withVolume.length) return state(0, 'Aucun volume renseigné')
      const revenue = r ? (r.pnl.revenue[0] || 0) : 0
      const score = withVolume.length === list.length ? 1 : 0.6
      return state(score, revenue > 0 ? `${euro(revenue, { compact: true })} la première année` : 'Volumes renseignés')
    },
  },
  {
    key: 'financement',
    act: 'argent',
    page: 'financement',
    label: 'Mon financement',
    question: 'Comment tenir jusqu’à la rentabilité ?',
    promise: "Apport, prêt, subvention, levée. Fynomia calcule le trou à combler et la date avant laquelle il doit l'être.",
    minutes: 5,
    unlocks: 'Plan de financement et date limite',
    check(s, r) {
      const f = s.financing || {}
      const sources = [
        ...(f.equityFounders || []), ...(f.equityInvestors || []),
        ...(f.loans || []), ...(f.grants || []), ...(f.advances || []), ...(f.shareholderLoans || []),
      ].filter((x) => n(x.amount) > 0)
      const need = r?.kpis?.fundingNeed ?? 0
      if (!sources.length && n(f.openingCash) <= 0) {
        return state(0, need > 0 ? `${euro(need)} à trouver` : 'Aucune ressource saisie')
      }
      if (need > 0) return state(0.5, `Il manque encore ${euro(need)}`)
      const total = sources.reduce((a, x) => a + n(x.amount), 0) + n(f.openingCash)
      return state(1, `${euro(total, { compact: true })} mobilisés · trésorerie couverte`)
    },
  },
  {
    key: 'remuneration',
    act: 'argent',
    page: 'mon-revenu',
    label: 'Ma rémunération',
    question: 'Combien t’en reste-t-il ?',
    promise: "Une fois l'URSSAF, l'impôt sur les sociétés, la flat tax et l'impôt sur le revenu passés : ce qui arrive vraiment sur ton compte.",
    minutes: 3,
    unlocks: 'Revenu disponible, mois par mois',
    check(s, r) {
      const f = s.founder || {}
      const team = liveTeam(s)
      const paysSelf = team.some((m) => n(m.monthlyGross) > 0)
      const hasPayout = n(f.dividendPayout) > 0
      if (!paysSelf && !hasPayout) return state(0, 'Toi ne tu verses rien pour le moment')
      let score = 0.6
      if (n(f.taxParts) >= 1 && f.dividendRegime) score = 1
      return state(score, paysSelf ? 'Rémunération saisie' : 'Distribution de dividendes prévue')
    },
  },
  {
    key: 'acquisition',
    act: 'plus',
    page: 'marketing',
    label: 'Mon acquisition',
    question: 'Comment les trouves-tu ?',
    promise: "Combien te coûte un client, et combien il te rapporte. Le rapport entre les deux décide si dépenser plus accélère ou creuse.",
    minutes: 5,
    optional: true,
    unlocks: "Coût d'acquisition et rapport valeur client / coût",
    check(s, r) {
      const live = liveCampaigns(s)
      if (!live.length) return state(0, 'Pas de budget — bouche-à-oreille')
      const budget = live.reduce((a, c) => a + n(c.monthlyBudget), 0)
      const linked = live.filter((c) => (s.activities || []).some((a) => a.id === c.activityId))
      const cac = r?.kpis?.cac
      const score = linked.length === live.length ? 1 : 0.5
      return state(score, cac ? `${euro(cac)} par client acquis` : `${euro(budget)}/mois`)
    },
  },
  {
    key: 'dossier',
    act: 'plus',
    page: 'business-case',
    label: 'Mon dossier',
    question: 'Prêt à le présenter ?',
    promise: "La synthèse rédigée à partir de tes chiffres, et le PowerPoint qui dit exactement la même chose que ton écran.",
    minutes: 2,
    unlocks: 'Business plan exportable',
    check(s, r) {
      if (!r) return state(0, 'Rien à exporter pour le moment')
      const hasRevenue = (r.pnl.revenue || []).some((v) => v > 0)
      const hasCosts = (r.pnl.payroll || []).some((v) => v > 0) || (r.pnl.external || []).some((v) => v > 0)
      if (!hasRevenue) return state(0, "Il manque le chiffre d'affaires")
      if (!hasCosts) return state(0.4, 'Il manque les charges')
      return state(1, 'Exportable en PowerPoint et en CSV')
    },
  },

]

/* ─────────────────────────────── Avancement ─────────────────────────────── */

/**
 * L'état complet du parcours.
 *
 * `completion` ne compte pas les étapes facultatives dans le dénominateur tant
 * qu'elles ne sont pas commencées : ne pas faire de publicité est une décision,
 * pas un oubli, et pénaliser un fondateur pour ça serait absurde.
 */
export function journey(scenario, result) {
  const steps = STEPS.map((step) => {
    let st
    try { st = step.check(scenario, result) } catch { st = state(0, '—') }
    return { ...step, ...st }
  })

  const counted = steps.filter((s) => !s.optional || s.score > 0)
  const completion = counted.length
    ? counted.reduce((a, s) => a + s.score, 0) / counted.length
    : 0

  // L'étape courante : la première qui n'est pas terminée, en ignorant les
  // facultatives qu'on a sciemment laissées vides.
  const current = steps.find((s) => s.status !== 'done' && !(s.optional && s.score === 0))
    || steps.find((s) => s.status !== 'done')
    || steps[steps.length - 1]

  const done = steps.filter((s) => s.status === 'done').length
  const acts = ACTS.map((act) => {
    const list = steps.filter((s) => s.act === act.key)
    return {
      ...act,
      steps: list,
      done: list.every((s) => s.status === 'done'),
      completion: list.length ? list.reduce((a, s) => a + s.score, 0) / list.length : 0,
    }
  })

  return {
    steps, acts, current, done, total: steps.length,
    completion,
    remainingMinutes: steps.filter((s) => s.status !== 'done').reduce((a, s) => a + s.minutes, 0),
    trophies: trophies(scenario, result, steps),
    rank: rank(completion, result),
  }
}

/**
 * Les trophées.
 *
 * Ils ne récompensent pas d'avoir rempli un champ mais d'avoir atteint un
 * résultat que le modèle constate : une marge positive, un point mort
 * franchi, une trésorerie couverte. On ne triche pas avec un trophée.
 */
function trophies(scenario, result, steps) {
  const k = result?.kpis
  const p = result?.pnl
  // Un trophée suppose que l'étape qui le produit a bien été traversée : sans
  // ça, une valeur par défaut suffirait à le décrocher, et il ne dirait rien.
  const did = (key) => steps.find((s) => s.key === key)?.status === 'done'
  const list = [
    {
      key: 'modele', label: 'Modèle posé', glyph: '◈',
      won: steps.find((s) => s.key === 'modele')?.status === 'done',
      hint: 'Un prix et une marge positive sur chaque offre',
    },
    {
      key: 'marge', label: 'Marge positive', glyph: '△',
      won: did('modele') && !!k && k.marginRate.some((v) => v > 0),
      hint: 'Chaque vente rapporte plus qu’elle ne coûte',
      value: k && k.marginRate[0] > 0 ? pct(k.marginRate[0], 0) : null,
    },
    {
      key: 'pointmort', label: 'Point mort franchi', glyph: '◎',
      won: did('modele') && did('charges') && !!k && !!p && k.breakEven.some((v, y) => v !== null && p.revenue[y] >= v),
      hint: "Le chiffre d'affaires dépasse les charges sur au moins un exercice",
    },
    {
      key: 'tresorerie', label: 'Trésorerie couverte', glyph: '◇',
      won: did('financement') && !!k && k.fundingNeed === 0,
      hint: 'La caisse ne passe jamais sous zéro',
    },
    {
      key: 'rentable', label: 'Rentable', glyph: '★',
      won: did('modele') && did('charges') && !!k && k.firstProfitableYear !== null,
      hint: 'Au moins un exercice en bénéfice',
      value: k && k.firstProfitableYear !== null ? `Année ${k.firstProfitableYear + 1}` : null,
    },
    {
      key: 'paye', label: 'Je me paie', glyph: '◉',
      won: (scenario?.team || []).some((m) => m?.enabled !== false && n(m?.monthlyGross) > 0),
      hint: 'La rémunération du dirigeant est dans le modèle',
    },
    {
      key: 'dossier', label: 'Dossier prêt', glyph: '◆',
      won: steps.find((s) => s.key === 'dossier')?.status === 'done',
      hint: 'Exportable en PowerPoint devant un financeur',
    },
  ]
  return list
}

/**
 * Le rang.
 *
 * Il dit où en est le dossier vis-à-vis de l'extérieur, pas combien de champs
 * sont remplis : un plan complet mais qui perd de l'argent n'est pas « prêt ».
 */
function rank(completion, result) {
  const k = result?.kpis
  const solid = k && k.fundingNeed === 0 && k.firstProfitableYear !== null
  const viable = k && k.marginRate.some((v) => v > 0)

  if (completion >= 0.98 && solid) {
    return { key: 'investisseur', label: 'Prêt pour un investisseur', tone: 'good',
      line: 'Le dossier tient debout tout seul. Va le défendre.' }
  }
  if (completion >= 0.85) {
    return { key: 'banque', label: 'Présentable à une banque', tone: 'good',
      line: 'Les grandes masses tiennent. Il reste à boucler le financement pour viser un fonds.' }
  }
  if (completion >= 0.6) {
    return { key: 'chiffre', label: 'Chiffré', tone: 'watch',
      line: viable ? 'Les grandes masses y sont. Reste à boucler le financement et la trésorerie.' : "Les grandes masses y sont, mais la marge unitaire ne tient pas encore." }
  }
  if (completion >= 0.3) {
    return { key: 'esquisse', label: 'Esquissé', tone: 'watch',
      line: 'Le modèle prend forme : les chiffres commencent à se répondre.' }
  }
  return { key: 'depart', label: 'Au départ', tone: 'neutral',
    line: 'Cinq minutes suffisent pour voir un premier point mort.' }
}

/** Progression exprimée en points, pour l'affichage. */
export const points = (j) => Math.round(j.completion * 100)
