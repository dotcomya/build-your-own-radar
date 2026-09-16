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
  { key: 'projet', title: 'Ce que tu vends', tagline: "D'où vient l'argent" },
  { key: 'moyens', title: 'Ce que ça coûte', tagline: 'Ce que tu dépenses pour y arriver' },
  { key: 'argent', title: "L'argent", tagline: 'Combien il en manque, et ce qui te revient' },
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
    label: 'Ton projet',
    question: "C'est quoi, ton projet ?",
    promise: "Le métier que tu choisis change tout le reste : la TVA, ton statut, les repères auxquels on te comparera.",
    investor: "La première chose qu'on regarde : est-ce que tu sais dire en une phrase ce que tu vends et à qui.",
    minutes: 2,
    unlocks: "Les repères de ton métier et le bon régime de TVA",
    tips: [
      {
        title: 'Ton métier décide de ta TVA',
        body: "Un cabinet médical ou paramédical est exonéré : tu ne la factures pas, mais tu ne la récupères pas non plus sur tes achats. Dans ce cas, saisis tout en TTC — sinon tu sous-estimes tes charges de 20 %.",
      },
      {
        title: 'SAS ou SARL : ce n’est pas un détail',
        body: "En SAS, le président est assimilé salarié : meilleure couverture, environ 80 % de charges sur le net. En SARL, le gérant majoritaire est TNS : environ 45 % de cotisations, mais des dividendes soumis à cotisations au-delà de 10 % du capital.",
      },
      {
        title: 'La date de départ n’est pas aujourd’hui',
        body: "Mets la date à laquelle tu encaisseras ton premier euro, pas celle de l'immatriculation. Un décalage de trois mois déplace tout ton besoin de trésorerie.",
      },
    ],
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
    label: 'Ton modèle',
    question: 'Comment tu gagnes de l’argent ?',
    promise: "Un prix, un coût de revient, et la façon dont l'argent revient — une fois ou tous les mois. C'est la brique dont tout le reste est fait.",
    investor: "On vérifiera que ta marge unitaire est positive avant même de regarder ton chiffre d'affaires. Vendre à perte ne se rattrape pas au volume.",
    minutes: 5,
    unlocks: 'Ta marge unitaire et ton point mort',
    tips: [
      {
        title: 'La marge brute, pas le prix',
        body: "Ce qui paie tes charges fixes, ce n'est pas ton prix : c'est ton prix moins ce que coûte chaque vente. À 100 € vendus et 70 € de coût, il te faut dix fois plus de clients qu'à 30 € de coût pour le même résultat.",
      },
      {
        title: "Le récurrent vaut plusieurs fois l'unitaire",
        body: "Un abonnement de 50 €/mois sur un contrat de 24 mois, c'est 1 200 € de revenu pour une seule vente. C'est pour ça qu'un investisseur paie plus cher un euro d'abonnement qu'un euro de prestation.",
      },
      {
        title: "L'erreur classique : oublier le coût de revient",
        body: "Hébergement, commission de paiement, matières, sous-traitance, livraison. Tout ce qui augmente quand tu vends une unité de plus est un coût variable — pas une charge fixe.",
      },
    ],
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
    key: 'clients',
    act: 'projet',
    page: 'offre',
    label: 'Tes clients',
    question: 'Combien, et à quel rythme ?',
    promise: "Le nombre de clients du premier mois et la vitesse à laquelle il grossit. C'est l'hypothèse la plus contestée d'un business plan : autant l'assumer.",
    investor: "Un investisseur ne discute presque jamais tes charges. Il discute tes volumes. Prépare-toi à dire d'où vient ce premier chiffre.",
    minutes: 6,
    unlocks: "Ton chiffre d'affaires et ta trajectoire sur cinq ans",
    tips: [
      {
        title: 'Pars de ce que tu sais faire, pas du marché',
        body: "« 1 % d'un marché de 400 millions » ne convainc personne. « Trois clients le premier mois parce que j'en ai déjà deux qui attendent » se vérifie. Dimensionne à partir de ta capacité réelle à livrer.",
      },
      {
        title: '10 % par mois, c’est déjà énorme',
        body: "10 % de croissance mensuelle triple tes volumes en un an. 30 % les multiplie par 23. Au-delà de 15 %, il faut expliquer par quel canal — Fizzy freine automatiquement la croissance dans la durée, parce qu'aucune courbe ne monte indéfiniment.",
      },
      {
        title: 'Le délai de paiement tue plus que le prix',
        body: "Vendre à 60 jours quand tu paies tes salaires à 30 crée un trou permanent. Demande un acompte : c'est la manière la plus simple de financer ta croissance sans lever un euro.",
      },
    ],
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
    key: 'acquisition',
    act: 'moyens',
    page: 'marketing',
    label: 'Ton acquisition',
    question: 'Comment tu les trouves ?',
    promise: "Combien te coûte un client, et combien il te rapporte. Le rapport entre les deux décide si dépenser plus accélère ou creuse.",
    investor: "La question qui suit toujours : combien coûte l'acquisition d'un client, et en combien de temps il est remboursé.",
    minutes: 5,
    optional: true,
    unlocks: 'Ton coût d’acquisition et le rapport valeur client / coût',
    tips: [
      {
        title: 'La règle des 3',
        body: "Un client doit rapporter au moins trois fois ce qu'il a coûté à acquérir. En dessous, chaque euro de publicité supplémentaire accélère les pertes au lieu de les combler.",
      },
      {
        title: 'Le bouche-à-oreille n’est pas un canal',
        body: "Si tes premiers clients viennent de ton réseau, laisse cette page vide et dis-le : c'est plus honnête qu'un budget publicitaire inventé. Tu la rempliras quand tu voudras passer à l'échelle.",
      },
      {
        title: 'Ton taux de conversion est plus bas que tu ne crois',
        body: "2 à 5 % d'un visiteur à un contact, 10 à 20 % d'un contact à un client : voilà les ordres de grandeur. Au-delà de 20 %, il faut des données réelles pour l'étayer.",
      },
    ],
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
    key: 'equipe',
    act: 'moyens',
    page: 'equipe',
    label: 'Ton équipe',
    question: 'Qui travaille avec toi ?',
    promise: "Tu donnes un brut mensuel, Fizzy calcule le coût réel pour l'entreprise — cotisations patronales, réduction générale, allègements auxquels tu as droit.",
    investor: "Les salaires sont le premier poste de dépense et le plus difficile à réduire. Le mois d'arrivée compte autant que le montant.",
    minutes: 6,
    unlocks: 'Ta masse salariale chargée et ton point mort',
    tips: [
      {
        title: 'Un salaire brut coûte 1,25 à 1,45 fois plus',
        body: "Les cotisations patronales s'ajoutent au brut. Au niveau du SMIC, la réduction générale les ramène presque à zéro ; elle s'annule à 3 SMIC. Fizzy applique la dégressivité réelle : ne fais pas la moyenne toi-même.",
      },
      {
        title: 'Décaler une embauche de trois mois',
        body: "C'est souvent le levier le plus rapide pour réduire le besoin de financement, sans rien changer à ton modèle. Regarde l'effet avant d'aller chercher de l'argent.",
      },
      {
        title: 'Compte-toi dedans',
        body: "Un business plan où le fondateur ne se paie pas n'est pas prudent : il est faux. Mets ta rémunération, même modeste, sinon ton point mort est sous-estimé et ta première année te surprendra.",
      },
    ],
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
    label: 'Tes charges',
    question: 'Ce que ça coûte de tourner ?',
    promise: "Loyer, comptable, logiciels, assurances, matériel. Les dépenses qui tombent que tu vendes ou non — celles qui fixent ton point mort.",
    investor: "Un prévisionnel sans comptable, sans assurance et sans banque n'a pas été relu. C'est le premier signe qu'on cherche.",
    minutes: 4,
    unlocks: 'Ton point mort et ton besoin en fonds de roulement',
    tips: [
      {
        title: 'Les quatre oubliés',
        body: "Expert-comptable (150 à 400 €/mois), assurance responsabilité civile professionnelle, frais bancaires et de paiement, mutuelle obligatoire dès le premier salarié. Aucun business plan crédible ne les omet.",
      },
      {
        title: 'Investissement ou charge ?',
        body: "Ce qui sert plus d'un an et dépasse 500 € est un investissement : il sort de la trésorerie d'un coup, mais s'étale dans le résultat sur sa durée d'amortissement. Ça change ton résultat sans changer ta caisse.",
      },
      {
        title: 'Les charges qui suivent le chiffre d’affaires',
        body: "Certaines charges ne sont pas fixes : commission de plateforme, frais de livraison, part variable d'un loyer. Rattache-les au chiffre d'affaires plutôt que de les figer — ton point mort en dépend.",
      },
    ],
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
    key: 'financement',
    act: 'argent',
    page: 'financement',
    label: 'Ton financement',
    question: 'Comment tu tiens jusqu’à la rentabilité ?',
    promise: "Apport, prêt, subvention, levée. Fizzy calcule le trou à combler et la date avant laquelle il doit l'être.",
    investor: "Le chiffre qu'on retient de ton dossier : combien tu demandes, et pour combien de mois d'autonomie.",
    minutes: 5,
    unlocks: 'Ton plan de financement et ta date limite',
    tips: [
      {
        title: 'Demande le point bas, pas la perte',
        button: 'Voir mon point bas',
        body: "Ce qu'il te faut, ce n'est pas la somme de tes pertes : c'est le point le plus bas de ta trésorerie, plus une marge. Fizzy te donne le montant exact et le mois où il tombe.",
      },
      {
        title: 'La règle du 1 pour 1',
        body: "Une banque prête rarement plus que les fonds propres. 20 000 € d'apport ouvrent la porte à 20 000 € de prêt — rarement à 60 000. Prévois l'apport avant de compter sur l'emprunt.",
      },
      {
        title: 'Lève pour 18 mois, pas pour 6',
        body: "Une levée prend quatre à six mois. Si tu ne finances que six mois d'autonomie, tu repars en levée le jour où tu as fini. Vise 18 à 24 mois entre deux tours.",
      },
    ],
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
    label: 'Ta rémunération',
    question: 'Combien il t’en reste ?',
    promise: "Une fois l'URSSAF, l'impôt sur les sociétés, la flat tax et l'impôt sur le revenu passés : ce qui arrive vraiment sur ton compte.",
    investor: "Un fondateur qui sait ce qu'il touche net a compris son propre modèle. C'est plus rare qu'on ne croit.",
    minutes: 3,
    unlocks: 'Ton revenu disponible, mois par mois',
    tips: [
      {
        title: "L'arbitrage salaire / dividendes",
        body: "Le salaire coûte plus cher à l'entreprise mais ouvre des droits — retraite, chômage parfois, prévoyance. Les dividendes coûtent moins mais n'ouvrent rien, et supposent un bénéfice. Fizzy chiffre les deux.",
      },
      {
        title: 'Ce que ton comptable appelle le « coût d’un euro net »',
        body: "L'entreprise doit souvent produire 1,70 à 2,20 € de valeur pour t'en laisser un dans la poche. Le savoir change la façon dont tu fixes tes prix.",
      },
      {
        title: "Le gérant majoritaire de SARL n'échappe pas aux cotisations",
        body: "Ses dividendes au-delà de 10 % du capital social supportent les cotisations TNS, pas seulement les prélèvements sociaux. C'est l'erreur la plus fréquente des simulateurs gratuits.",
      },
    ],
    check(s, r) {
      const f = s.founder || {}
      const team = liveTeam(s)
      const paysSelf = team.some((m) => n(m.monthlyGross) > 0)
      const hasPayout = n(f.dividendPayout) > 0
      if (!paysSelf && !hasPayout) return state(0, 'Tu ne te verses rien pour le moment')
      let score = 0.6
      if (n(f.taxParts) >= 1 && f.dividendRegime) score = 1
      return state(score, paysSelf ? 'Rémunération saisie' : 'Distribution de dividendes prévue')
    },
  },

  {
    key: 'dossier',
    act: 'argent',
    page: 'business-case',
    label: 'Ton dossier',
    question: 'Prêt à le présenter ?',
    promise: "La synthèse rédigée à partir de tes chiffres, et le PowerPoint qui dit exactement la même chose que ton écran.",
    investor: "Le dossier ne remplace pas la conversation : il prouve que tu as fait le travail avant d'entrer dans la pièce.",
    minutes: 2,
    unlocks: 'Ton business plan exportable',
    tips: [
      {
        title: 'Douze diapositives, pas quarante',
        body: "Le dossier exporté s'ouvre sur le verdict, pose la courbe de trésorerie annotée, chiffre ce qui changerait le plus et finit sur ce que tu touches. C'est l'ordre dans lequel on te lira.",
      },
      {
        title: 'Emporte le CSV',
        body: "Un banquier ou un incubateur demandera souvent le détail mois par mois. Le CSV contient les soixante mois : tu réponds en trente secondes au lieu de trois jours.",
      },
      {
        title: 'Relis tes hypothèses avant d’envoyer',
        body: "La dernière diapositive liste les paramètres sur lesquels tout repose. Si tu n'es pas capable de défendre chaque ligne, corrige-la maintenant plutôt qu'en réunion.",
      },
    ],
    check(s, r) {
      if (!r) return state(0, 'Rien à exporter pour le moment')
      const hasRevenue = (r.pnl.revenue || []).some((v) => v > 0)
      const hasCosts = (r.pnl.payroll || []).some((v) => v > 0) || (r.pnl.external || []).some((v) => v > 0)
      if (!hasRevenue) return state(0, "Il manque ton chiffre d'affaires")
      if (!hasCosts) return state(0.4, 'Il manque tes charges')
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
      hint: 'Un prix et un coût de revient sur chaque offre',
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
      hint: "Ton chiffre d'affaires dépasse tes charges sur au moins un exercice",
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
      key: 'paye', label: 'Tu te paies', glyph: '◉',
      won: (scenario?.team || []).some((m) => m?.enabled !== false && n(m?.monthlyGross) > 0),
      hint: 'Ta rémunération est dans le modèle',
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
      line: 'Ton dossier tient debout tout seul. Va le défendre.' }
  }
  if (completion >= 0.85) {
    return { key: 'comite', label: 'Prêt pour ton incubateur', tone: 'good',
      line: 'De quoi passer un comité de sélection sans se faire arrêter à la deuxième question.' }
  }
  if (completion >= 0.6) {
    return { key: 'chiffre', label: 'Chiffré', tone: 'watch',
      line: viable ? 'Les grandes masses y sont. Reste à boucler le financement et la trésorerie.' : "Les grandes masses y sont, mais ta marge unitaire ne tient pas encore." }
  }
  if (completion >= 0.3) {
    return { key: 'esquisse', label: 'Esquissé', tone: 'watch',
      line: 'Le modèle prend forme. Continue : les chiffres commencent à se répondre.' }
  }
  return { key: 'depart', label: 'Au départ', tone: 'neutral',
    line: 'Cinq minutes suffisent pour voir ton premier point mort.' }
}

/** Progression exprimée en points, pour l'affichage. */
export const points = (j) => Math.round(j.completion * 100)
