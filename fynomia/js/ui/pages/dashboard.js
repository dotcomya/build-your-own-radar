/**
 * Tableau de bord.
 *
 * Un tableau de bord dirige l'attention ; il ne déverse pas. L'ordre de
 * lecture est donc imposé : d'abord un verdict, ensuite l'histoire des cinq
 * ans, puis ce qu'il faut faire — chiffré. Le détail vient après, replié,
 * pour qui veut vérifier.
 */

import { h, euro, pct, num, helpButton, narrow, monthLabel, yearLabel, refine, tabs, moduleHead } from '../dom.js'
import { barChart, areaChart, donut, stackedBar, waterfall, sparkline, PALETTE, YEAR_CATEGORIES, STATUS } from '../charts.js'
import { getPersona } from '../personas.js'
import { metricBoard } from '../levers.js'
import { trajectorySentence, revenueSentence, costsSentence, mixSentence, payrollSentence, bfrSentence, cashSentence } from '../explain.js'
import { referenceYear } from '../impact.js'
import { storyline, gauge } from '../story.js'
import { partBanner } from '../tutorial.js'
import { renderSimulation } from './simulation.js'
import { refinePanel } from '../refine-panel.js'
import { breakEvenBoard } from './model.js'
import { vocabulary } from '../../state/sectors.js'
import { suggestActions, applyAction } from '../../engine/simulate.js'
import { nudges, nudgePanel, sectorTraps, sectorRegime } from '../nudges.js'
import { getSector } from '../../state/sectors.js'
import { verdict } from '../../engine/verdict.js'
import { journey } from '../../engine/journey.js'
import { svg } from '../dom.js'
import store from '../../state/store.js'

// Le jugement vient du moteur : l'écran et le PowerPoint exporté disent la
// même chose parce qu'ils lisent la même fonction.
export const assess = (r, s) => verdict(r, s)

export function renderDashboard(navigate, refresh) {
  const r = store.result
  const s = store.scenario
  if (!r) return h('div', { class: 'content' }, h('p', {}, 'Aucun résultat.'))

  const persona = getPersona(store.persona)
  const sector = getSector(s.meta.sectorKey)
  const level = store.level
  const health = assess(r, s)
  const j = journey(s, r)

  // L'année regardée est un choix, pas une fatalité : les chiffres clés et la
  // cascade suivent la puce qu'on sélectionne, et le tableau devient un
  // instrument qu'on manipule au lieu d'une photographie.
  const y = renderDashboard.year ?? referenceYear(r)
  renderDashboard.year = y
  const pickYearFn = (next) => { renderDashboard.year = next; refresh() }

  // Trois temps, trois onglets : où j'en suis, ce que disent mes chiffres, et
  // ce qui se passerait si. Les conseils génériques ont disparu — ils
  // répétaient ce que les repères de métier disent déjà là où ça compte.
  const views = [
    { key: 'pilotage', label: 'Pilotage' },
    { key: 'analyse', label: 'Analyse' },
    { key: 'simulation', label: 'Simulation' },
  ]
  const view = views.some((v) => v.key === renderDashboard.view) ? renderDashboard.view : 'pilotage'
  renderDashboard.view = view

  return h('div', { class: 'content content-wide' },
    s.meta.isDemo && demoBanner(navigate, refresh),

    // Le verdict tient dans la ligne de titre : posé en dessous, il laissait une
    // bande vide sur toute la largeur pour une carte de 340 pixels.
    moduleHead('06', 'Tableau de bord', "La synth\u00e8se de tout ce que tu as saisi. Rien ne s\u2019\u00e9crit ici.",
      verdictCard(health, navigate)),

    partBanner('tableau-de-bord'),

    tabs(views, view, (k) => { renderDashboard.view = k; refresh() }),

    view === 'pilotage' ? h('div', { class: 'view board-stack' },
      cockpit(j, r, navigate),
      // C'est ici qu'on arrive en sortant du parcours : la première chose à
      // voir n'est pas un graphique, c'est ce qu'il reste à poser.
      refinePanel(navigate, { refresh }),
      // Le bloc porte son propre titre dans l'opération : l'encadrer d'un
      // panneau avec un second titre ajoutait une couche pour rien.
      breakEvenBoard(r, s, vocabulary(s)),
    ) : null,

    // L'analyse part de ce qui a été saisi : l'année regardée, les six chiffres
    // qui en découlent, puis les dessins — chacun accompagné d'une phrase qui
    // dit ce qu'il montre. Un graphique qu'on doit interpréter seul ne sert
    // qu'à celui qui connaissait déjà la réponse.
    view === 'analyse' ? h('div', { class: 'view board-stack' },
      yearBar(y, r, pickYearFn),
      netEquation(r, y),
      keyFigures(r, s, y, navigate),
      refine('board-cascade', 'Voir le détail ligne à ligne', moneyPanel(r, y)),
      h('section', { class: 'panel story-panel is-key' },
        h('div', { class: 'card-head' },
          h('div', {},
            h('h2', {}, 'Trajectoire sur cinq ans'),
            h('div', { class: 'tiny muted' }, 'Trésorerie mois par mois et moments qui comptent'),
          ),
          h('span', { class: 'spacer' }),
          h('button', { class: 'btn btn-sm btn-quiet', onClick: () => navigate('#/resultats') }, 'Les comptes'),
        ),
        storyline(r, s, { compact: narrow() }),
        h('p', { class: 'chart-note' }, trajectorySentence(r)),
      ),
      ...boardCharts(r, s, y, level, sector, navigate),
      detailDisclosure(persona, r, s, y, sector, navigate, refresh),
    ) : null,

    view === 'simulation' ? h('div', { class: 'view' }, renderSimulation(persona, refresh, navigate)) : null,

  )
}

/* ───────────────────────── Le poste de pilotage ─────────────────── */

/**
 * Où en est le dossier, et ce qu'il reste à faire.
 *
 * Un tableau de bord qui ne dit que l'état des comptes laisse le fondateur
 * seul avec la question suivante. Celui-ci dit aussi où il en est de son
 * dossier : un anneau qui se remplit, les jalons déjà décrochés, ceux qui
 * restent, et la prochaine action à un clic.
 */
function cockpit(j, r, navigate) {
  const pctDone = Math.round(j.completion * 100)
  const R = 26
  const circ = 2 * Math.PI * R
  const next = j.trophies.find((t) => !t.won)

  return h('section', { class: 'cockpit' },
    h('div', { class: 'cockpit-score' },
      h('div', { class: 'cockpit-ring' },
        svg('svg', { viewBox: '0 0 64 64', width: 64, height: 64, 'aria-hidden': 'true' },
          svg('circle', { cx: 32, cy: 32, r: R, fill: 'none', stroke: 'var(--rule)', 'stroke-width': 6 }),
          svg('circle', {
            cx: 32, cy: 32, r: R, fill: 'none', stroke: 'var(--level, var(--signal))', 'stroke-width': 6,
            'stroke-linecap': 'round', 'stroke-dasharray': String(circ),
            'stroke-dashoffset': String(circ * (1 - j.completion)),
            transform: 'rotate(-90 32 32)',
          }),
        ),
        h('span', { class: 'cockpit-pct num' }, String(pctDone)),
      ),
      h('div', { style: { minWidth: '0' } },
        h('div', { class: 'cockpit-rank' }, j.rank.label),
        h('div', { class: 'cockpit-sub' },
          j.done === j.total
            ? "Tout est renseigné — ton dossier est complet."
            : `${j.done} étape${j.done > 1 ? 's' : ''} sur ${j.total} · environ ${j.remainingMinutes} min de saisie restante`),
      ),
    ),

    h('div', { class: 'cockpit-badges' },
      ...j.trophies.map((t) => h('span', {
        class: `badge ${t.won ? 'is-won' : ''}`,
        title: t.won ? `${t.label} — ${t.hint}` : `À décrocher : ${t.hint}`,
      },
        h('span', { class: 'badge-glyph' }, t.glyph),
        h('span', { class: 'badge-label' }, t.label),
        t.won && t.value ? h('span', { class: 'badge-value num' }, t.value) : null,
      )),
    ),

    h('div', { class: 'cockpit-next' },
      next
        ? h('div', { style: { minWidth: '0' } },
            h('div', { class: 'cockpit-next-tag' }, 'Prochain jalon'),
            h('div', { class: 'cockpit-next-label' }, next.label),
            h('div', { class: 'cockpit-next-hint' }, next.hint),
          )
        : h('div', { style: { minWidth: '0' } },
            h('div', { class: 'cockpit-next-tag' }, 'Tous les jalons'),
            h('div', { class: 'cockpit-next-label' }, 'Décrochés'),
            h('div', { class: 'cockpit-next-hint' }, "Ton modèle tient sur tous les points vérifiables."),
          ),
      j.current && j.current.status !== 'done'
        ? h('button', { class: 'btn btn-primary btn-sm', onClick: () => navigate(`#/${j.current.page}`) }, j.current.short || 'Continuer')
        : null,
    ),
  )
}

/** Les cinq exercices, en puces : l'écran suit celle qu'on choisit. */
/**
 * Les cinq exercices, en pleine largeur.
 *
 * C'était une rangée de pastilles grises qu'on prenait pour une légende. Ce
 * sont pourtant cinq boutons : chacun rejoue toute la page sur son année. Ils
 * portent donc le millésime en clair, le chiffre d'affaires, et le résultat —
 * de quoi choisir l'année qu'on veut regarder sans avoir à la deviner.
 */
function yearBar(y, r, pick) {
  return h('div', { class: 'years' },
    ...Array.from({ length: 5 }, (_, i) => {
      const net = r.pnl.netResult[i]
      return h('button', {
        class: `year ${i === y ? 'active' : ''}`,
        onClick: () => pick(i),
      },
        h('span', { class: 'year-no' }, `Année ${i + 1}`),
        h('span', { class: 'year-ca num' }, euro(r.pnl.revenue[i], { compact: true })),
        h('span', { class: `year-net num ${net >= 0 ? 'pos' : 'neg'}` },
          `${net >= 0 ? '+' : '−'}${euro(Math.abs(net), { compact: true })} net`),
      )
    }),
  )
}

/**
 * Du chiffre d'affaires au résultat, en une soustraction.
 *
 * La cascade dit tout, et demande d'être lue. L'opération, elle, se comprend
 * sans mode d'emploi : ce qui entre, ce qui sort, ce qui reste. Le détail des
 * dix lignes intermédiaires reste juste en dessous, pour qui veut vérifier.
 */
function netEquation(r, y) {
  const p = r.pnl
  const revenue = p.revenue[y] || 0
  const net = p.netResult[y] || 0
  const charges = revenue - net
  const marge = revenue > 0 ? net / revenue : 0
  return h('section', { class: 'eq' },
    h('div', { class: 'eq-terms' },
      h('div', { class: 'eq-term' },
        h('div', { class: 'eq-tag' }, 'Ce que tu encaisses'),
        h('div', { class: 'eq-value num' }, euro(revenue, { compact: true })),
        h('div', { class: 'eq-note' }, "Chiffre d'affaires de l'exercice"),
      ),
      h('span', { class: 'eq-op' }, '−'),
      h('div', { class: 'eq-term' },
        h('div', { class: 'eq-tag' }, 'Ce que ça coûte'),
        h('div', { class: 'eq-value num' }, euro(charges, { compact: true })),
        h('div', { class: 'eq-note' }, 'Achats, salaires, charges, impôts, amortissements'),
      ),
      h('span', { class: 'eq-op' }, '='),
      h('div', { class: `eq-term is-result ${net >= 0 ? '' : 'is-loss'}` },
        h('div', { class: 'eq-tag' }, net >= 0 ? 'Ce qu’il reste' : 'Ce que tu perds'),
        h('div', { class: 'eq-value num' }, euro(net, { compact: true })),
        h('div', { class: 'eq-note' }, `${pct(marge, 0)} du chiffre d'affaires`),
      ),
    ),
  )
}

/* ────────────────────────── En-tête et verdict ────────────────────────── */

/**
 * Le nom du projet, et le verdict à côté.
 *
 * Le verdict occupait auparavant un bandeau sombre pleine largeur : il volait
 * la vedette aux chiffres alors qu'il n'en est que le résumé. Il tient
 * désormais dans une carte étroite, posée à droite du titre — une pastille de
 * couleur, un mot, une ligne. Le détail est à un clic, pas à l'écran.
 */
function verdictCard(health, navigate) {
  const detail = h('div', { class: 'verdict-body' }, health.body,
    health.figure && h('div', { class: 'verdict-figure' },
      h('span', {}, health.figure.label),
      h('strong', { class: 'num' }, health.figure.value),
    ),
  )
  const card = h('aside', { class: `verdict verdict-${health.tone}` },
    h('button', {
      class: 'verdict-head',
      title: 'Voir le raisonnement',
      onClick: () => { card.classList.toggle('open') },
    },
      h('span', { class: 'verdict-dot' }),
      h('span', { class: 'spacer' },
        h('span', { class: 'verdict-word' }, health.word),
        h('span', { class: 'verdict-line' }, health.line),
      ),
      h('span', { class: 'verdict-more' }, '›'),
    ),
    detail,
  )
  return card
}

/* ────────────────────────────── Les chiffres ──────────────────────────── */

/**
 * Les six chiffres qu'on vient chercher, chacun avec sa trajectoire.
 *
 * Un nombre seul ne dit pas s'il monte ou s'il tombe. Chaque tuile porte donc
 * sa courbe sur cinq ans : c'est la différence entre un tableau de chiffres et
 * un tableau de bord.
 */
/** Les six nombres, calculés à part pour pouvoir être rejoués à la volée. */
/**
 * Les quatre chiffres qui ne sont pas déjà dans l'opération.
 *
 * Chiffre d'affaires et résultat net figuraient ici en plus de l'équation
 * juste au-dessus : le même nombre deux fois, à dix centimètres d'écart, et la
 * page paraissait deux fois plus chargée qu'elle ne l'est.
 */
function figureSet(r, s, y) {
  const k = r.kpis, p = r.pnl
  const reached = k.breakEven[y] && p.revenue[y] >= k.breakEven[y]
  return [
    { label: 'EBITDA', value: euro(p.ebitda[y], { compact: true }), note: `${pct(k.ebitdaMargin[y], 0)} du chiffre d'affaires`,
      tone: p.ebitda[y] >= 0 ? 'pos' : 'neg', spark: p.ebitda, go: 'resultats', help: 'ebitda' },
    { label: 'Point mort', value: k.breakEven[y] ? euro(k.breakEven[y], { compact: true }) : '\u2014',
      note: reached ? 'franchi cette année' : 'pas encore franchi',
      tone: reached ? 'pos' : 'warn', spark: k.breakEven.map((v) => v || 0), go: 'resultats', help: 'pointMort' },
    { label: 'Tr\u00e9sorerie au plus bas', value: euro(k.cashLow.value, { compact: true }),
      note: `au plus bas en ${monthLabel(k.cashLow.month, r.startDate)}`, tone: k.cashLow.value < 0 ? 'neg' : 'pos',
      spark: r.cash.balance, go: 'financement', help: 'tresorerie' },
    { label: '\u00c0 financer', value: k.fundingNeed > 0 ? euro(k.fundingNeed, { compact: true }) : 'Rien',
      note: k.fundingNeed > 0 ? `\u00e0 r\u00e9unir avant ${monthLabel(k.cashLow.month, r.startDate)}` : 'la caisse se suffit',
      tone: k.fundingNeed > 0 ? 'warn' : 'pos', go: 'financement', help: 'besoinFinancement' },
  ]
}

function keyFigures(r, s, y, navigate) {
  const figures = figureSet(r, s, y)
   const ink = { pos: STATUS.gain, neg: STATUS.loss, warn: STATUS.warn }
  // Chaque notion porte son « i » : EBITDA, point mort, résultat net ne sont
  // pas des mots que tout le monde a déjà croisés, et un tableau de bord qui
  // les affiche sans les définir suppose un bagage qu'un fondateur n'a pas
  // forcément. La tuile reste cliquable ; le « i » ouvre l'explication.
  const cells = figures.map((f) => {
    const valueEl = h('span', { class: 'figure-value num' }, f.value)
    const noteEl = h('span', { class: 'figure-note' }, f.note)
    const btn = h('div', {
      class: `figure ${f.tone || ''}`, role: 'button', tabindex: '0',
      title: `Aller à la page ${f.go}`,
      onClick: () => navigate(`#/${f.go}`),
      onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`#/${f.go}`) } },
    },
      h('span', { class: 'figure-label' }, f.label),
      valueEl,
      h('span', { class: 'figure-foot' },
        noteEl,
        f.spark && f.spark.some((v) => v) ? sparkline({ values: f.spark, width: 58, height: 20, color: ink[f.tone] || STATUS.signal }) : null,
      ),
      f.help ? h('span', { class: 'figure-help' }, helpButton(f.help)) : null,
    )
    return { btn, valueEl, noteEl }
  })

  const section = h('section', { class: 'figures' }, ...cells.map((c) => c.btn))

  // Pendant qu'un curseur bouge, on ne redessine pas la page : on réécrit les
  // six nombres. C'est ce qui rend le geste continu au lieu de saccadé.
  section.updateWith = (live) => {
    if (section.isConnected === false) return
    const next = figureSet(live, s, y)
    next.forEach((f, i) => {
      const cell = cells[i]
      if (!cell) return
      if (cell.valueEl.textContent !== f.value) {
        cell.valueEl.textContent = f.value
        cell.valueEl.classList.remove('changed')
        void cell.valueEl.offsetWidth
        cell.valueEl.classList.add('changed')
      }
      cell.noteEl.textContent = f.note
      cell.btn.className = `figure ${f.tone || ''}`
    })
  }
  return section
}

/* ────────────────────── Le plan, en graphiques ───────────────────── */

/**
 * Tout ce qu'un prévisionnel raconte, en images.
 *
 * L'ordre suit une question par graphique : où part l'argent, comment le
 * compte évolue, ce qui coûte, d'où vient le chiffre d'affaires, ce que pèse
 * l'équipe, ce que le cycle immobilise. Le niveau de détail choisi décide
 * combien de ces questions sont posées — pas si elles le sont graphiquement.
 */
function boardCharts(r, s, y, level, sector, navigate) {
  const k = r.kpis, p = r.pnl
  const out = []

  const trajectory = panel("Chiffre d'affaires et résultat", 'Les cinq exercices',
    barChart({
      categories: YEAR_CATEGORIES,
      series: [
        { label: "Chiffre d'affaires", values: p.revenue, color: PALETTE[0] },
        { label: 'EBITDA', values: p.ebitda, color: PALETTE[2] },
        { label: 'Résultat net', values: p.netResult, color: PALETTE[5] },
      ],
      line: k.breakEven.some((v) => v)
        ? { label: 'Point mort', values: k.breakEven.map((v) => v || 0), color: STATUS.loss, dashed: true }
        : null,
    }), chartNote(revenueSentence(r)))

  const costs = panel('Structure des charges', 'Par exercice',
    stackedBar({
      categories: YEAR_CATEGORIES,
      series: [
        { label: 'Achats variables', values: p.variableCost, color: PALETTE[5] },
        { label: 'Charges externes', values: p.external, color: PALETTE[1] },
        { label: 'Personnel', values: p.payroll, color: PALETTE[0] },
        { label: 'Impôts et taxes', values: p.duties, color: PALETTE[4] },
        { label: 'Amortissements', values: p.amortisation, color: PALETTE[2] },
      ],
    }), chartNote(costsSentence(r, y)))
  out.push(pair(trajectory, costs))

  const activities = r.revenue.perActivity
    .map((a, i) => ({ label: a.name, value: a.total.reduce((x, z) => x + z, 0), color: PALETTE[i % PALETTE.length] }))
    .filter((a) => a.value > 0)
  // Un camembert à une part ne dit rien : il ne s'affiche qu'à partir de deux
  // sources de revenus.
  const mix = activities.length > 1
    ? panel('Répartition du chiffre d\'affaires', 'Cumul sur cinq ans', donut({ items: activities }), chartNote(mixSentence(activities)))
    : null

  const payrollY = yearly(r.payroll.gross)
  const team = payrollY.some((v) => v > 0)
    ? panel('Masse salariale', 'Brut, cotisations patronales et avantages',
        barChart({
          categories: YEAR_CATEGORIES,
          series: [
            { label: 'Salaires bruts', values: payrollY, color: PALETTE[0] },
            { label: 'Cotisations patronales', values: yearly(r.payroll.employerCharges), color: PALETTE[1] },
            ...(r.payroll.benefits && r.payroll.benefits.some((v) => v > 0)
              ? [{ label: 'Avantages', values: yearly(r.payroll.benefits), color: PALETTE[4] }]
              : []),
          ],
        }), chartNote(payrollSentence(r, y)))
    : null

  if (mix || team) out.push(pair(mix, team))

  {
    const bfr = panel('Besoin en fonds de roulement',
      k.peakBfr > 0 ? "L'argent avancé aux clients et immobilisé dans les stocks" : 'Le cycle dégage de la ressource',
      areaChart({ values: r.bfr.total, startDate: r.startDate, color: k.peakBfr > 0 ? PALETTE[1] : STATUS.gain }),
      chartNote(bfrSentence(r)))
    const cashPanel = panel('Trésorerie',
      Number.isFinite(k.runwayMonths) && k.runwayMonths !== null ? `${num(k.runwayMonths, 0)} mois au rythme de consommation actuel` : 'La caisse ne se vide pas',
      areaChart({ values: r.cash.balance, startDate: r.startDate, color: STATUS.signal }),
      chartNote(cashSentence(r)))
    out.push(refine('board-cycle', 'Affiner : besoin en fonds de roulement et courbe de trésorerie', pair(bfr, cashPanel)))
  }

  return out
}


/**
 * Du chiffre d'affaires au résultat net.
 *
 * La cascade est le seul dessin qui répond à « et il m'en reste combien » sans
 * qu'on ait à lire un compte de résultat. Elle sait se redessiner pendant
 * qu'un curseur bouge : c'est là que la manipulation devient parlante.
 */
function moneyPanel(r, y) {
  const host = h('div', { class: 'panel-body' })
  const note = h('p', { class: 'chart-note' })
  // Un rendu complet peut survenir entre deux images du geste : les nœuds de
  // la passe précédente ne sont alors plus dans le document, et il n'y a plus
  // rien à repeindre. On sort, plutôt que d'écrire dans le vide.
  // Le premier rendu a lieu avant que le nœud ne rejoigne le document ; on ne
  // s'abstient que pour les repeints suivants, quand un rendu complet est
  // passé entre-temps et a détaché ce qu'on s'apprêtait à mettre à jour.
  let painted = false
  const paint = (res) => {
    if (painted && !host.isConnected) return
    painted = true
    host.replaceChildren(waterfall({ items: moneyFlow(res, y) }))
    note.textContent = moneyFlowSentence(res, y)
  }
  paint(r)
  const section = h('section', { class: 'panel' },
    h('div', { class: 'card-head' },
      h('div', {},
        h('h2', {}, 'Du chiffre d\'affaires au r\u00e9sultat net'),
        h('div', { class: 'tiny muted' }, `Soldes interm\u00e9diaires de gestion \u2014 ${yearLabel(y).toLowerCase()}`),
      ),
    ),
    host, note,
  )
  section.updateWith = paint
  return section
}

/** Deux graphiques côte à côte, un seul s'il n'y en a qu'un. */
function pair(a, b) {
  const cards = [a, b].filter(Boolean)
  if (cards.length === 0) return null
  return h('div', { class: 'board-pair' }, ...cards)
}

/**
 * La cascade du compte de résultat : chiffre d'affaires, ce qu'on en retire,
 * ce qu'il reste. Les paliers sont les soldes intermédiaires de gestion — ceux
 * qu'une banque lit en premier.
 */
function moneyFlow(r, y) {
  const p = r.pnl
  const items = [{ label: "Chiffre d'affaires", value: p.revenue[y], total: true }]
  if (p.grants[y]) items.push({ label: 'Subventions', value: p.grants[y] })
  if (p.variableCost[y]) items.push({ label: 'Achats', value: -p.variableCost[y] })
  if (p.external[y]) items.push({ label: 'Charges externes', value: -p.external[y] })
  if (p.duties[y]) items.push({ label: 'Impôts et taxes', value: -p.duties[y] })
  if (p.payroll[y]) items.push({ label: 'Personnel', value: -p.payroll[y] })
  items.push({ label: 'EBITDA', value: p.ebitda[y], total: true })
  if (p.amortisation[y]) items.push({ label: 'Amortis.', value: -p.amortisation[y] })
  if (p.interest[y]) items.push({ label: 'Frais fin.', value: -p.interest[y] })
  if (p.corporateTax[y]) items.push({ label: 'Impôt sociétés', value: -p.corporateTax[y] })
  if (p.credits[y]) items.push({ label: "Crédits impôt", value: p.credits[y] })
  items.push({ label: 'Résultat net', value: p.netResult[y], total: true })
  return items
}

/** Une phrase qui dit ce que le dessin montre, pour qui ne lit pas les dessins. */
function moneyFlowSentence(r, y) {
  const p = r.pnl
  const rev = p.revenue[y]
  if (rev <= 0) return "Aucun chiffre d'affaires sur cet exercice : renseigne tes ventes pour voir la cascade se remplir."
  const kept = p.netResult[y] / rev
  const biggest = [
    { label: 'les achats', v: p.variableCost[y] },
    { label: 'les charges externes', v: p.external[y] },
    { label: "l'équipe", v: p.payroll[y] },
  ].sort((a, b) => b.v - a.v)[0]
  if (biggest.v <= 0) return `Sur 100 € facturés, il t’en reste ${Math.round(kept * 100)} € après impôt.`
  return `Sur 100 € facturés, ${biggest.label} en prennent ${Math.round((biggest.v / rev) * 100)} € et il t’en reste ${Math.round(kept * 100)} € après impôt.`
}

/* ──────────────────────── Actions déjà chiffrées ──────────────────────── */

/**
 * Ce qu'il faut faire, et ce que ça rapporte.
 * Chaque proposition est obtenue en rejouant le modèle complet, pas estimée.
 */
function actionsPanel(r, s, navigate, refresh) {
  let suggestion
  try { suggestion = suggestActions(s, r) } catch { return null }
  if (!suggestion.best.length) return null

  const apply = (key, label) => {
    store.update((sc) => applyAction(sc, key), { label })
    refresh()
  }

  return h('section', { class: 'panel actions-panel' },
    h('div', { class: 'card-head' },
      h('div', {},
        h('h2', {}, 'Leviers classés par impact'),
        h('div', { class: 'tiny muted' },
          suggestion.shortOfCash
            ? 'Classé par ce que cela libère en trésorerie'
            : "Classé par ce que cela ajoute à l'EBITDA"),
      ),
    ),
    h('div', { class: 'actions' },
      ...suggestion.best.map((a, i) => h('article', { class: 'action' },
        h('span', { class: 'action-rank num' }, String(i + 1)),
        h('div', { class: 'action-main' },
          h('h3', { class: 'action-label' }, a.label),
          a.detail && h('div', { class: 'action-detail num' }, a.detail),
          h('p', { class: 'action-why' }, a.rationale),
        ),
        h('div', { class: 'action-gains' },
          gainRow('EBITDA', a.delta.ebitda, true),
          a.delta.fundingNeed !== 0 && gainRow('Financement', a.delta.fundingNeed, false),
          a.delta.breakEven !== null && a.delta.breakEven !== 0 && gainRow('Point mort', a.delta.breakEven, false),
          a.delta.founderMonthly !== 0 && gainRow('Pour toi', a.delta.founderMonthly, true, '/mois'),
        ),
        h('button', { class: 'btn btn-sm', onClick: () => apply(a.key, a.label) }, 'Appliquer'),
      )),
    ),
    h('div', { class: 'panel-body', style: { paddingTop: '0' } },
      h('p', { class: 'tiny muted', style: { margin: 0 } },
        "Chaque estimation rejoue le modèle entier avec la modification. Appliquer reste réversible : la barre du bas mesure l'écart et l'annulation est disponible."),
    ),
  )
}

/** Une ligne de gain : le sens du bien dépend de l'indicateur. */
function gainRow(label, delta, higherIsBetter, suffix = '') {
  if (!Number.isFinite(delta) || Math.round(delta) === 0) return null
  const good = higherIsBetter ? delta > 0 : delta < 0
  return h('div', { class: `gain ${good ? 'gain-good' : 'gain-bad'}` },
    h('span', { class: 'gain-label' }, label),
    h('span', { class: 'gain-value num' }, `${delta > 0 ? '+' : ''}${euro(delta, { compact: Math.abs(delta) >= 100000 })}${suffix}`),
  )
}

/* ─────────────────────── Position dans le métier ──────────────────────── */

function gaugePanel(r, s, sector, y) {
  const b = sector.benchmarks || {}
  const k = r.kpis, p = r.pnl
  const gauges = []

  if (b.grossMargin && p.revenue[y] > 0) {
    gauges.push(gauge({ label: 'Marge brute', value: k.marginRate[y], range: b.grossMargin }))
  }
  if (b.payrollRatio && p.revenue[y] > 0) {
    const denom = sector.resourcesIncludeGrants ? p.revenue[y] + p.grants[y] : p.revenue[y]
    if (denom > 0) gauges.push(gauge({ label: 'Masse salariale', value: p.payroll[y] / denom, range: b.payrollRatio, invert: true }))
  }
  if (b.overheadRatio && p.revenue[y] > 0) {
    const ownDraw = sector.ownerIsProfit
      ? (s.team || []).filter((m) => m.contractType === 'tns').reduce((a, m) => a + (Number(m.monthlyGross) || 0) * 12, 0)
      : 0
    const overhead = Math.max(0, p.payroll[y] - ownDraw) + p.external[y] + p.duties[y] + p.amortisation[y]
    gauges.push(gauge({ label: 'Charges de structure', value: overhead / p.revenue[y], range: b.overheadRatio, invert: true }))
  }
  if (b.churn) {
    const a = (s.activities || []).find((x) => (Number(x.recurringPrice) || 0) > 0)
    if (a) gauges.push(gauge({ label: 'Attrition mensuelle', value: Number(a.churnMonthly) || 0, range: b.churn, invert: true, format: (v) => pct(v, 1) }))
  }
  if (b.ltvCac && k.ltvCacRatio !== null) {
    gauges.push(gauge({ label: 'LTV / CAC', value: k.ltvCacRatio, range: b.ltvCac, format: (v) => `${num(v, 1)}×` }))
  }
  if (b.rentRatio && p.revenue[y] > 0) {
    const rent = (s.opex || []).filter((o) => /loyer|local|bureau|cabinet|salle/i.test(o.label))
      .reduce((a, o) => a + (Number(o.monthlyAmount) || 0) * 12, 0)
    if (rent > 0) gauges.push(gauge({ label: 'Loyer', value: rent / p.revenue[y], range: b.rentRatio, invert: true }))
  }

  if (!gauges.length) return null
  return h('section', { class: 'panel' },
    h('div', { class: 'card-head' },
      h('div', {},
        h('h2', {}, 'Position dans le métier'),
        h('div', { class: 'tiny muted' }, `Comparé aux ordres de grandeur observés — ${sector.label.toLowerCase()}`),
      ),
    ),
    h('div', { class: 'gauges' }, ...gauges),
  )
}

function nudgesSection(s, r, navigate) {
  const advice = nudges(s, r)
  const issues = store.issues.filter((i) => i.level === 'error')
  if (!advice.length && !issues.length) return null
  return h('div', { class: 'stack' },
    issues.length > 0 && h('div', { class: 'note danger' },
      h('div', { class: 'note-title' }, `${issues.length} point${issues.length > 1 ? 's' : ''} à corriger`),
      h('div', { class: 'stack', style: { gap: '6px', marginTop: '6px' } },
        ...issues.slice(0, 3).map((i) => h('div', { class: 'row', style: { alignItems: 'flex-start' } },
          h('div', { class: 'spacer' },
            h('div', { style: { fontWeight: '500' } }, i.message),
            i.hint && h('div', { class: 'tiny muted' }, i.hint)),
          i.page && h('button', { class: 'btn btn-sm btn-quiet', onClick: () => navigate(`#/${i.page}`) }, 'Corriger'),
        )),
      ),
    ),
    advice.length > 0 && nudgePanel(advice, navigate),
  )
}

/* ────────────────────────────── Le détail ─────────────────────────────── */

/**
 * Les graphiques sont désormais à l'écran, plus dans un pli. Ne restent ici
 * que les indicateurs détaillés, les leviers à tirer et les pièges propres au
 * métier — utiles, mais qu'on ne consulte pas à chaque visite.
 */
function detailDisclosure(persona, r, s, y, sector, navigate, refresh) {
  const board = metricBoard(persona, r)
  const open = detailDisclosure.open ?? false

  const details = h('details', { class: 'detail-block', open: open || null },
    h('summary', { class: 'detail-summary' },
      h('span', { class: 'detail-title' }, 'Indicateurs détaillés'),
      h('span', { class: 'detail-hint' }, `${persona.metrics.length} indicateurs détaillés et les pièges du métier`),
    ),
    h('div', { class: 'detail-body' },
      board,
      sector && h('div', { class: 'grid grid-2 mt', style: { alignItems: 'start' } },
        sectorTraps(s), sectorRegime(s)),
    ),
  )
  details.addEventListener('toggle', () => { detailDisclosure.open = details.open })
  return details
}

/** La phrase qui dit ce que le dessin montre. */
const chartNote = (text) => (text ? h('p', { class: 'chart-note' }, text) : null)

function panel(title, subtitle, ...body) {
  return h('section', { class: 'panel' },
    h('div', { class: 'card-head' }, h('div', {}, h('h2', {}, title), subtitle && h('div', { class: 'tiny muted' }, subtitle))),
    h('div', { class: 'panel-body' }, ...body),
  )
}

function demoBanner(navigate, refresh) {
  return h('div', { class: 'note', style: { marginBottom: '18px' } },
    h('div', { class: 'row-wrap', style: { gap: '12px' } },
      h('div', { class: 'spacer', style: { minWidth: '240px' } },
        h('div', { class: 'note-title' }, 'Tu regardes un exemple'),
        h('div', {}, "Les chiffres de ce scénario sont fictifs : ils servent à montrer comment tout s'articule. Modifie-les librement, ou repars d'une page blanche."),
      ),
      h('button', { class: 'btn btn-primary', onClick: () => { store.adoptDemo(); refresh() } }, 'Partir de cet exemple'),
      h('button', { class: 'btn', onClick: () => navigate('#/demarrer') }, 'Créer le mien'),
    ),
  )
}

const yearly = (arr) => Array.from({ length: 5 }, (_, y) => arr.slice(y * 12, y * 12 + 12).reduce((a, b) => a + b, 0))

export const pickYear = (pnl) => {
  const i = pnl.netResult.findIndex((v) => v > 0)
  return i >= 0 ? i : 2
}
