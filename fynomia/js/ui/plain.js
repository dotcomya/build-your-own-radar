/**
 * La synthèse : ton plan, en français.
 *
 * L'analyse existe déjà — six chiffres, quatre courbes, un compte de résultat.
 * Elle répond à un lecteur qui sait quoi y chercher. Le fondateur pressé, lui,
 * pose trois questions et une seule à la fois :
 *
 *   1. Est-ce que je gagne de l'argent, et quand ?
 *   2. Est-ce que je tiens jusque-là ?
 *   3. Combien il m'en reste, à moi ?
 *
 * Cette page ne calcule rien de neuf. Elle prend ce que le moteur a produit et
 * l'écrit en phrases, avec un seul chiffre par phrase et une image qui le
 * montre. Trois cartes, trois réponses — et la suite en un clic quand on veut
 * savoir d'où ça sort.
 */

import { h, svg, euro, monthLabel } from './dom.js'
import { goToGap } from './spotlight.js'
import { icon } from './icons.js'

const n = (v) => Number(v) || 0
const YEARS = ['année 1', 'année 2', 'année 3', 'année 4', 'année 5']

/** La synthèse complète. `r` est le résultat du moteur, `s` le scénario. */
export function plainBoard(s, r, navigate, goRefine) {
  if (!r) return null

  // Un plan encore vide n'a pas de verdict à rendre. Lui en donner un —
  // « aucune année ne dégage de bénéfice » — serait exact et inutile : ce
  // n'est pas le modèle qui est mauvais, c'est qu'il n'y a rien dedans.
  if (!(r.pnl.revenue || []).some((v) => n(v) > 0)) return emptyBoard(goRefine)
  const money = profitCard(r)
  const cash = cashCard(r)
  const mine = takeCard(s, r)

  return h('div', { class: 'plain' },
    h('p', { class: 'plain-lede' },
      'Ce que ton plan raconte, sans vocabulaire comptable. Trois questions, trois réponses.'),
    h('div', { class: 'plain-cards' }, money, cash, mine),
    h('div', { class: 'plain-foot' },
      h('p', {},
        'Ces trois phrases sortent des mêmes chiffres que l’onglet Analyse. Si l’une d’elles te surprend, c’est là qu’il faut regarder — ou dans ce qu’il te reste à poser.'),
      h('div', { class: 'plain-foot-go' },
        goRefine
          ? h('button', { class: 'btn btn-sm', onClick: goRefine }, 'Ce qu’il me reste à poser')
          : null,
        h('button', {
          class: 'btn btn-quiet btn-sm',
          onClick: () => goToGap({ route: 'resultats' }, navigate),
        }, 'Voir les états financiers'),
      ),
    ),
  )
}

/** Rien à lire encore : on dit quoi poser, et où. */
function emptyBoard(goRefine) {
  return h('div', { class: 'plain' },
    h('p', { class: 'plain-lede' },
      'Il n’y a encore rien à résumer : ton plan ne porte aucun chiffre d’affaires.'),
    h('section', { class: 'plaincard is-watch' },
      h('header', { class: 'plaincard-head' },
        h('span', { class: 'plaincard-ico', html: icon('idee') }),
        h('div', {},
          h('div', { class: 'plaincard-kicker' }, 'Par où commencer'),
          h('h3', { class: 'plaincard-title' }, 'Pose un prix et un volume'),
        ),
      ),
      h('p', { class: 'plaincard-body' },
        'Trois questions suffisent à faire apparaître cette page : ce que tu vends, à quel prix, et combien de fois par mois. Le reste — les charges, l’équipe, la trésorerie — vient se poser dessus.'),
      goRefine ? h('div', { class: 'plain-foot-go' },
        h('button', { class: 'btn btn-primary btn-sm', onClick: goRefine }, 'Ce qu’il me reste à poser'),
      ) : null,
    ),
  )
}

/* ─────────────────── 1. Est-ce que je gagne de l'argent ? ────────────────── */

function profitCard(r) {
  const net = r.pnl.netResult
  const first = net.findIndex((v) => v > 0)
  const y1 = n(net[0])

  let tone = 'bad', title = 'Tu ne gagnes pas d’argent', body
  if (first === 0) {
    tone = 'good'
    title = 'Tu gagnes de l’argent dès la première année'
    body = `Ton activité dégage ${euro(y1)} de résultat net la première année. C’est rare, et c’est bon signe — vérifie surtout que tes charges sont bien toutes saisies.`
  } else if (first > 0) {
    tone = 'watch'
    title = `Tu deviens rentable en ${YEARS[first]}`
    body = `Les ${first === 1 ? 'douze premiers mois' : `${first} premières années`} coûtent plus qu’ils ne rapportent : ${euro(Math.abs(y1))} de perte la première année. À partir de ${YEARS[first]}, le résultat passe au vert avec ${euro(n(net[first]))}.`
  } else {
    body = `Sur cinq ans, aucune année ne dégage de bénéfice. La perte de la première année est de ${euro(Math.abs(y1))}. Ce n’est pas une fatalité : c’est un prix trop bas, un coût trop haut, ou des volumes trop prudents.`
  }

  return card({
    tone, kicker: 'Est-ce que je gagne de l’argent ?', title, body,
    ico: 'argent',
    bars: net.slice(0, 5).map((v, i) => ({ label: `A${i + 1}`, value: n(v) })),
    figure: { label: 'Résultat net, année 1', value: euro(y1), good: y1 >= 0 },
  })
}

/* ──────────────────── 2. Est-ce que je tiens jusque-là ? ─────────────────── */

function cashCard(r) {
  const low = r.kpis.cashLow
  const need = n(r.kpis.fundingNeed)
  const when = low && low.month != null ? monthLabel(low.month, r.startDate) : null

  let tone = 'good', title = 'Ta trésorerie tient', body
  if (need > 0) {
    tone = 'bad'
    title = `Il te manque ${euro(need)}`
    body = `Ton compte descend au plus bas en ${when} : ${euro(n(low.value))}. Il faut réunir ${euro(need)} avant cette date — apport, emprunt, ou moins de dépenses au démarrage. C’est la seule question qui compte pour l’instant.`
  } else if (n(low?.value) < 5000) {
    tone = 'watch'
    title = 'Ta trésorerie passe juste'
    body = `Le point bas est de ${euro(n(low.value))} en ${when}. Ça tient, mais sans marge : un client qui paie en retard et tu es à découvert.`
  } else {
    body = `Le point bas de ton compte est de ${euro(n(low?.value))}${when ? `, en ${when}` : ''}. Tu passes l’année sans avoir à chercher d’argent.`
  }

  return card({
    tone, kicker: 'Est-ce que je tiens jusque-là ?', title, body,
    ico: 'cible',
    line: (r.cash?.balance || []).slice(0, 36).map((v) => n(v)),
    figure: { label: 'Point bas de trésorerie', value: euro(n(low?.value)), good: n(low?.value) >= 0 },
  })
}

/* ──────────────────── 3. Combien il m'en reste, à moi ? ──────────────────── */

function takeCard(s, r) {
  const team = s.team || []
  // Un littéral d'expression régulière n'est pas échappé à l'empaquetage : les
  // accents y passeraient tels quels dans un fichier livré en ASCII, et le
  // motif ne reconnaîtrait plus « gérant ». Écrit ainsi, il survit au build.
  const FOUNDER = new RegExp('fondateur|dirigeant|moi|g\\u00e9rant|president|pr\\u00e9sident', 'i')
  const me = team.find((m) => FOUNDER.test(m.role || '')) || team[0]
  const gross = n(me?.monthlyGross)

  if (!gross) {
    return card({
      tone: 'watch', kicker: 'Combien il m’en reste, à moi ?',
      title: 'Tu ne te verses rien', ico: 'commerce',
      body: 'Aucune rémunération n’est saisie pour toi. Un plan où le fondateur ne se paie pas n’est pas prudent : il est incomplet, et un financeur le lit comme tel. Pose ce que tu comptes te verser, même modeste.',
      figure: { label: 'Ta rémunération annuelle', value: '—', good: false },
    })
  }

  const yearly = gross * 12
  const marge = n(r.pnl.netResult[0])
  return card({
    tone: marge >= 0 ? 'good' : 'watch',
    kicker: 'Combien il m’en reste, à moi ?',
    title: `Tu te verses ${euro(yearly)} par an`,
    ico: 'commerce',
    body: marge >= 0
      ? `Ta rémunération est déjà comptée dans le résultat : l’entreprise dégage ${euro(marge)} en plus de ce que tu touches. Ce surplus peut rester en réserve ou se distribuer en dividendes.`
      : `Ta rémunération est déjà comptée dans le résultat. L’entreprise perd ${euro(Math.abs(marge))} la première année en te payant : c’est fréquent au démarrage, mais il faut de quoi financer cette perte.`,
    figure: { label: 'Brut annuel', value: euro(yearly), good: true },
  })
}

/* ──────────────────────────── La carte commune ──────────────────────────── */

function card({ tone, kicker, title, body, figure, bars, line, ico }) {
  return h('section', { class: `plaincard is-${tone}` },
    h('header', { class: 'plaincard-head' },
      ico ? h('span', { class: 'plaincard-ico', html: icon(ico) }) : null,
      h('div', {},
        h('div', { class: 'plaincard-kicker' }, kicker),
        h('h3', { class: 'plaincard-title' }, title),
      ),
    ),
    h('p', { class: 'plaincard-body' }, body),
    bars ? miniBars(bars) : null,
    line ? miniLine(line) : null,
    figure ? h('div', { class: 'plaincard-figure' },
      h('span', { class: 'plaincard-figure-label' }, figure.label),
      h('span', { class: `plaincard-figure-value num ${figure.good ? 'pos' : 'neg'}` }, figure.value),
    ) : null,
  )
}

/**
 * Cinq barres, une par année.
 *
 * Pas d'axe, pas de graduation : la seule chose à lire est le sens — ça monte,
 * ça part du rouge, ça passe au vert telle année. Un graphique complet dirait
 * la même chose en demandant un effort.
 */
function miniBars(items) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.value)))
  return h('div', { class: 'plainbars' },
    ...items.map((it) => h('div', { class: 'plainbar' },
      h('div', { class: 'plainbar-track' },
        h('i', {
          class: it.value >= 0 ? 'is-pos' : 'is-neg',
          style: { height: `${Math.max(3, (Math.abs(it.value) / max) * 100)}%` },
        }),
      ),
      h('span', { class: 'plainbar-label' }, it.label),
    )),
  )
}

/** La courbe de trésorerie, réduite à sa forme et à son passage sous zéro. */
function miniLine(values) {
  if (!values.length) return null
  const max = Math.max(...values, 0)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const w = 300, hgt = 56
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = hgt - ((v - min) / span) * hgt
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const zero = hgt - ((0 - min) / span) * hgt
  // Un élément SVG ne se crée pas comme un élément HTML : sans son espace de
  // noms, le navigateur fabrique un nœud inconnu qu'il n'affiche jamais.
  return h('div', { class: 'plainline' },
    svg('svg', { viewBox: `0 0 ${w} ${hgt}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' },
      svg('line', { x1: 0, y1: zero, x2: w, y2: zero, class: 'plainline-zero' }),
      svg('polyline', { points: pts, class: 'plainline-path' }),
    ),
    h('span', { class: 'plainline-note' }, 'Ton compte, mois par mois, sur trois ans'),
  )
}
