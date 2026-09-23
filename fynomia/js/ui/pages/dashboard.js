/**
 * Tableau de bord.
 *
 * Un tableau de bord dirige l'attention ; il ne déverse pas. L'ordre de
 * lecture est donc imposé : d'abord un verdict, ensuite l'histoire des cinq
 * ans, puis ce qu'il faut faire — chiffré. Le détail vient après, replié,
 * pour qui veut vérifier.
 */

import { h, euro, pct, num, helpButton, narrow, monthLabel, yearLabel, refine, fold, tabs, moduleShell, foldSign } from '../dom.js'
import { barChart, areaChart, donut, stackedBar, waterfall, sparkline, PALETTE, YEAR_CATEGORIES, STATUS } from '../charts.js'
import { getPersona } from '../personas.js'
import { metricBoard } from '../levers.js'
import { trajectorySentence, revenueSentence, costsSentence, mixSentence, payrollSentence, bfrSentence, cashSentence, moneyFlowSentence } from '../explain.js'
import { referenceYear } from '../impact.js'
import { renderStudio } from './studio.js'
import { renderPitch } from './pitch.js'
import { storyline, gauge } from '../story.js'
import { stepGuide } from '../tutorial.js'
import { renderSimulation } from './simulation.js'
import { refinePanel } from '../refine-panel.js'
import { plainBoard } from '../plain.js'
import { deckBoard } from './deck.js'
import { breakEvenBoard } from './model.js'
import { vocabulary } from '../../state/sectors.js'
import { suggestActions, applyAction } from '../../engine/simulate.js'
import { nudges, nudgePanel, sectorTraps, sectorRegime } from '../nudges.js'
import { getSector } from '../../state/sectors.js'
import { verdict } from '../../engine/verdict.js'
import { lookup } from '../glossary.js'
import { icon } from '../icons.js'
import { goToGap } from '../spotlight.js'
import { checklist } from '../checklist.js'
import { journey } from '../../engine/journey.js'
import { svg } from '../dom.js'
import { figureSet, PAGE_NAME, avancement } from '../figures.js'
import store from '../../state/store.js'

// Le jugement vient du moteur : l'écran et le PowerPoint exporté disent la
// même chose parce qu'ils lisent la même fonction.
export const assess = (r, s) => verdict(r, s)

/**
 * Ouvrir le tableau de bord sur la synthèse.
 *
 * L'onglet retenu survit d'une visite à l'autre, ce qui est juste : on revient
 * où l'on était. Sauf au sortir du parcours — là, ce qu'on veut voir est ce
 * que les douze questions ont produit, pas l'onglet qu'on regardait la fois
 * d'avant.
 */
export function openSynthesis() { renderDashboard.view = 'synthese' }

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

  // Trois temps, trois onglets.
  //
  // « Synthèse » et « Analyse » n'en font plus qu'un : c'étaient deux lectures
  // du même calcul, et passer de l'une à l'autre demandait de retrouver de
  // quel exercice on parlait. La synthèse ouvre, en grand ; les six chiffres
  // qui la fondent viennent dessous, dans l'ordre où on les interroge ; et
  // l'analyse complète — courbes, cascade, présentation — attend dans un
  // socle qu'on déplie quand on veut vérifier.
  const views = [
    { key: 'synthese', read: true, label: 'Synthèse' },
    // Une seconde écriture de la même synthèse, mise à l'essai : mêmes séries,
    // autre forme. Elle vit à côté de l'originale tant qu'on les compare.
    { key: 'studio', read: true, label: 'Synthèse — essai' },
    { key: 'pilotage', read: true, label: 'Pilotage' },
    // Pour un business angel ou un fonds : l'essentiel du plan, en une page.
    { key: 'pitch', read: true, label: 'Pitch investisseur' },
    { key: 'simulation', label: 'Simulation' },
  ]
  const view = views.some((v) => v.key === renderDashboard.view) ? renderDashboard.view : 'synthese'
  renderDashboard.view = view
  const goView = (k) => { renderDashboard.view = k; refresh() }

  return h('div', { class: 'content content-wide' },
    s.meta.isDemo && demoBanner(navigate, refresh),

    moduleShell({
      no: '06', title: 'Tableau de bord',
      lede: "La synthèse de tout ce que tu as saisi. Rien ne s’écrit ici.",
      guide: stepGuide(null, null, 'tableau-de-bord'),
      views, view, onPick: goView,
    }),

    view === 'studio' ? h('div', { class: 'view' }, renderStudio(navigate, refresh, goView)) : null,
    view === 'pitch' ? h('div', { class: 'view' }, renderPitch(navigate, refresh, goView)) : null,

    view === 'synthese' ? h('div', { class: 'view board-stack' },
      // Ce qui manque se dit avant ce qu'on a trouvé.
      //
      // Au sortir du parcours, douze réponses ont produit un modèle complet —
      // et c'est exactement le piège : l'écran donne des chiffres nets, avec
      // l'autorité d'un résultat, alors que la moitié des lignes vient encore
      // des repères du métier. Le fondateur repart en croyant son dossier
      // fini. Ce bandeau le dit avant tout le reste, et donne le geste suivant
      // au lieu de le laisser chercher.
      finishBanner(s, navigate),
      // Le verdict ouvre la synthèse : c'est la phrase qui résume les six
      // cartes qui suivent, et la lire après elles n'avait pas de sens.
      verdictCard(health, navigate),
      plainBoard(s, r, navigate, () => goView('pilotage')),
      // Les six chiffres qu'un lecteur extérieur réclame, chacun repliable sur
      // ce qu'il veut dire et sur la page où il se corrige.
      kpiBoard(r, s, y, navigate),
      // L'analyse entière, dans un socle — et sans un seul pli à l'intérieur.
      //
      // Elle en portait trois : la cascade, le cycle, les indicateurs. On
      // ouvrait le socle pour avoir le détail, et il fallait encore ouvrir
      // trois volets pour l'obtenir. Qui demande le détail le demande en
      // entier ; le seul choix qui reste est de l'afficher ou non.
      deepFold(
        h('div', { class: 'board-stack' },
          yearBar(y, r, pickYearFn),
          netEquation(r, y),
          moneyPanel(r, y),
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
          deckBoard(navigate, refresh),
          detailBoard(persona, r, s, y, sector),
        ),
      ),
    ) : null,

    // Pilotage : non plus « où j'en suis », qui est désormais la synthèse, mais
    // « qu'est-ce que je fais maintenant ». Ce qu'il reste à poser, le seuil à
    // franchir, les leviers classés par ce qu'ils rapportent, la position dans
    // le métier, et les points qui clochent.
    view === 'pilotage' ? h('div', { class: 'view board-stack' },
      refinePanel(navigate, { refresh }),
      breakEvenBoard(r, s, vocabulary(s)),
      actionsPanel(r, s, navigate, refresh),
      gaugePanel(r, s, sector, y),
      nudgesSection(s, r, navigate),
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
/**
 * Le dossier n'est pas fini, et ça se voit.
 *
 * Tant qu'il reste des lignes à poser, les chiffres affichés reposent en
 * partie sur les repères du métier. Les donner sans le dire, c'est laisser
 * quelqu'un présenter à sa banque un prévisionnel qu'il croit être le sien.
 * Le bandeau annonce ce qui manque, nomme la prochaine ligne, et emmène
 * dessus — un seul geste, pas une liste.
 */
function finishBanner(s, navigate) {
  const c = checklist(s)
  if (!c.open || !c.next) return null
  const reste = c.open
  const t = avancement(c)
  // Le bandeau disait ce qui manque ; il dit maintenant où l'on en est.
  //
  // « Ton dossier n'est pas terminé » ouvrait sur un reproche, et la promesse
  // — un dossier qu'on présente à une banque ou à un fonds — n'apparaissait
  // nulle part. L'avancement chiffré, l'enjeu nommé, l'étape suivante et son
  // utilité : c'est ce qui donne envie de poser la ligne suivante.
  return h('section', { class: 'finish' },
    h('div', { class: 'finish-say' },
      h('div', { class: 'finish-kicker' }, t.surtitre),
      h('h2', { class: 'finish-big' }, t.titre),
      h('p', { class: 'finish-body' }, t.texte),
      h('div', { class: 'finish-next' },
        h('span', { class: 'finish-next-tag' }, 'Prochaine étape'),
        h('span', { class: 'finish-next-label' }, c.next.label),
        c.next.why ? h('span', { class: 'finish-next-why' }, c.next.why) : null,
      ),
    ),
    h('div', { class: 'finish-acts' },
      h('button', {
        class: 'btn btn-primary btn-lg finish-go',
        onClick: (e) => goToGap(c.next.go, navigate, e.currentTarget),
      }, `Renseigner « ${c.next.label} » →`),
      h('button', {
        class: 'btn btn-lg finish-list',
        onClick: () => { renderDashboard.view = 'pilotage'; navigate('#/tableau-de-bord') },
      }, t.parcourir),
    ),
    h('div', { class: 'finish-meter', 'aria-hidden': 'true' },
      h('i', { style: { width: `${Math.round((c.done / Math.max(1, c.total)) * 100)}%` } }),
      h('span', {}, `${c.done} / ${c.total} posées`),
    ),
  )
}

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
 * Le chiffre, puis ce qu'il veut dire, puis où on le corrige.
 *
 * C'étaient des tuiles qui emmenaient ailleurs d'un clic. Deux défauts : on
 * quittait la page sans savoir ce qu'on allait y faire, et celui qui ne
 * connaît pas le mot « EBITDA » n'avait qu'un « ? » à survoler pour
 * l'apprendre. Un clic déplie maintenant la définition, ce à quoi le chiffre
 * sert et le piège à connaître ; le déplacement vient après, par un bouton
 * qui dit où il mène.
 */
function kpiBoard(r, s, y, navigate) {
  const figures = figureSet(r, s, y)
  const ink = { pos: STATUS.gain, neg: STATUS.loss, warn: STATUS.warn }
  const memory = kpiBoard.open || (kpiBoard.open = new Set())

  return h('section', { class: 'kpis6' },
    h('header', { class: 'kpis6-head' },
      h('h2', {}, 'Les six chiffres qu\u2019on te demandera'),
      h('p', {}, 'Clique sur l\u2019un d\u2019eux : il dit ce qu\u2019il signifie avant d\u2019emmener l\u00e0 o\u00f9 il se corrige.'),
    ),
    h('div', { class: 'kpis6-grid' },
      ...figures.map((f) => {
        const g = lookup(f.help)
        const el = h('details', { class: `kpi6 ${f.tone || ''}`, open: memory.has(f.help) || null },
          h('summary', { class: 'kpi6-head' },
            f.ico ? h('span', { class: 'kpi6-ico', 'aria-hidden': 'true', html: icon(f.ico) }) : null,
            h('span', { class: 'kpi6-id' },
              h('span', { class: 'kpi6-label' }, f.label),
              h('span', { class: 'kpi6-value num' }, f.value),
              h('span', { class: 'kpi6-note' }, f.note),
            ),
            f.spark && f.spark.some((v) => v)
              ? h('span', { class: 'kpi6-spark' }, sparkline({ values: f.spark, width: 58, height: 20, color: ink[f.tone] || STATUS.signal }))
              : null,
            foldSign(),
          ),
          h('div', { class: 'kpi6-body' },
            g ? h('p', { class: 'kpi6-what' }, g.what) : null,
            g && g.use ? h('p', { class: 'kpi6-use' }, g.use) : null,
            g && g.watch ? h('p', { class: 'kpi6-watch' }, h('b', {}, '\u00c0 surveiller \u2014 '), g.watch) : null,
            h('button', {
              class: 'btn btn-sm',
              onClick: (e) => { e.preventDefault(); goToGap({ route: f.go }, navigate) },
            }, `Aller voir \u2014 ${PAGE_NAME[f.go] || f.go}`),
          ),
        )
        el.addEventListener('toggle', () => { el.open ? memory.add(f.help) : memory.delete(f.help) })
        return el
      }),
    ),
  )
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
    // Ces deux dessins vivaient dans un volet « affiner ». Ils sont désormais
    // à l'intérieur de l'analyse détaillée, qu'on n'ouvre que pour tout voir.
    out.push(pair(bfr, cashPanel))
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
function detailBoard(persona, r, s, y, sector) {
  return h('section', { class: 'panel' },
    h('div', { class: 'card-head' },
      h('div', {},
        h('h2', {}, 'Indicateurs détaillés'),
        h('div', { class: 'tiny muted' }, `${persona.metrics.length} indicateurs et les pièges du métier`),
      ),
    ),
    h('div', { class: 'panel-body' },
      metricBoard(persona, r),
      sector && h('div', { class: 'grid grid-2 mt', style: { alignItems: 'start' } },
        sectorTraps(s), sectorRegime(s)),
    ),
  )
}

/**
 * Le socle de l'analyse détaillée : un bloc, pas une ligne de texte.
 *
 * Un volet ordinaire — un chevron et six mots en gris — se lisait comme une
 * note de bas de page. Ce qu'il ouvre est pourtant la moitié du tableau de
 * bord : tous les exercices, la cascade, les courbes, la présentation. Il lui
 * faut la taille de ce qu'il contient.
 */
function deepFold(body) {
  const memory = deepFold.open || (deepFold.open = new Set())
  const el = h('details', { class: 'deepfold', open: memory.has('analyse') || null },
    h('summary', { class: 'deepfold-head refine-head' },
      h('span', { class: 'deepfold-id' },
        h('span', { class: 'deepfold-title' }, 'Analyse détaillée'),
        h('span', { class: 'deepfold-sub' },
          'Les cinq exercices, la cascade du résultat, les courbes, la présentation — tout, d’un coup.'),
      ),
      foldSign(),
    ),
    h('div', { class: 'deepfold-body' }, body),
  )
  el.addEventListener('toggle', () => { el.open ? memory.add('analyse') : memory.delete('analyse') })
  return el
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
