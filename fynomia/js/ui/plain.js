/**
 * La synthèse : ton plan, en français.
 *
 * L'analyse existe déjà — six chiffres, quatre courbes, un compte de résultat.
 * Elle répond à un lecteur qui sait quoi y chercher. Le fondateur pressé, lui,
 * veut trois réponses, et une seule à la fois :
 *
 *   1. Rentabilité   — le modèle dégage-t-il un résultat, et à partir de quand ;
 *   2. Trésorerie    — le compte tient-il jusque-là, et sinon de combien ;
 *   3. Rémunération  — ce qui revient au fondateur, une fois tout payé.
 *
 * Cette page ne calcule rien de neuf. Elle prend ce que le moteur a produit et
 * l'écrit en phrases : un titre qui est déjà la réponse, trois lignes pour la
 * justifier, un seul chiffre, une image qui le confirme. Le titre ne pose pas
 * la question — il y répond ; c'est la différence entre un sommaire et une
 * synthèse.
 */

import { h, svg, euro, monthLabel } from './dom.js'
import { goToGap } from './spotlight.js'
import { icon } from './icons.js'
import { checklist } from './checklist.js'
import store from '../state/store.js'

const n = (v) => Number(v) || 0

/** Combien de lignes du dossier restent à poser. */
const left = () => { try { const c = checklist(store.scenario); return c.total - c.done } catch { return 0 } }
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
      'Ton plan en trois phrases : ce que le modèle dégage, ce que le compte encaisse, ce qui te revient.'),
    h('div', { class: 'plain-cards' }, money, cash, mine),
    h('div', { class: 'plain-foot' },
      h('p', {},
        'Mêmes chiffres que l’onglet Analyse, sans le vocabulaire. Si l’une des trois te surprend, la réponse est là-bas — ou dans ce qu’il te reste à poser.'),
      h('div', { class: 'plain-foot-go' },
        // Une synthèse qui se lit au sortir du parcours doit dire la suite :
        // il reste des lignes à poser, et chacune resserre ces trois phrases.
        goRefine
          ? h('button', { class: 'btn btn-primary btn-sm', onClick: goRefine }, left() > 0
              ? `Affiner : ${left()} ligne${left() > 1 ? 's' : ''} à poser`
              : 'Ce qu’il me reste à poser')
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

/* ────────────────────────────── 1. Rentabilité ───────────────────────────── */

function profitCard(r) {
  const net = r.pnl.netResult
  const first = net.findIndex((v) => v > 0)
  const y1 = n(net[0])

  let tone = 'bad', title = 'Aucun bénéfice sur cinq ans', body
  if (first === 0) {
    tone = 'good'
    title = 'Rentable dès la première année'
    body = `L'exercice se referme sur ${euro(y1)} de résultat net. C'est rare dès la première année : vérifie surtout qu'aucune charge ne manque à l'appel.`
  } else if (first > 0) {
    tone = 'watch'
    title = `Rentable à partir de l'année ${first + 1}`
    body = `${first === 1 ? 'Le premier exercice coûte' : `Les ${first} premiers exercices coûtent`} plus qu'${first === 1 ? 'il ne rapporte' : 'ils ne rapportent'} — ${euro(Math.abs(y1))} de perte la première année. Le résultat passe au vert en année ${first + 1}, à ${euro(n(net[first]))}.`
  } else {
    body = `Aucun des cinq exercices ne dégage de bénéfice ; la première année perd ${euro(Math.abs(y1))}. Trois leviers, dans cet ordre : le prix, le coût de revient, les volumes.`
  }

  return card({
    tone, kicker: 'Rentabilité', title, body,
    ico: 'argent',
    bars: net.slice(0, 5).map((v, i) => ({ label: `A${i + 1}`, value: n(v) })),
    figure: { label: 'Résultat net — année 1', value: euro(y1), good: y1 >= 0 },
  })
}

/* ────────────────────────────── 2. Trésorerie ───────────────────────────── */

function cashCard(r) {
  const low = r.kpis.cashLow
  const need = n(r.kpis.fundingNeed)
  const when = low && low.month != null ? monthLabel(low.month, r.startDate) : null

  let tone = 'good', title = 'La trésorerie tient', body
  if (need > 0) {
    tone = 'bad'
    title = `Il te manque ${euro(need)}`
    body = `Le compte touche son point bas en ${when}, à ${euro(n(low.value))}. Il faut avoir réuni ${euro(need)} avant cette date : apport, emprunt, ou moins de dépenses au démarrage. Tant que ce trou n'est pas comblé, le reste du plan reste théorique.`
  } else if (n(low?.value) < 5000) {
    tone = 'watch'
    title = 'Ça passe, sans marge'
    body = `Le point bas s'établit à ${euro(n(low.value))} en ${when}. C'est positif, mais un client qui paie avec un mois de retard suffit à te mettre à découvert.`
  } else {
    body = `Le point bas s'établit à ${euro(n(low?.value))}${when ? `, en ${when}` : ''}. Tu traverses les cinq ans sans avoir à chercher d'argent.`
  }

  return card({
    tone, kicker: 'Trésorerie', title, body,
    ico: 'cible',
    line: (r.cash?.balance || []).slice(0, 36).map((v) => n(v)),
    figure: { label: 'Point bas du compte', value: euro(n(low?.value)), good: n(low?.value) >= 0 },
  })
}

/* ─────────────────────────── 3. Ta rémunération ───────────────────────── */

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
      tone: 'watch', kicker: 'Ta rémunération',
      title: 'Tu ne te verses rien', ico: 'commerce',
      body: "Aucune rémunération n'est saisie à ton nom. Un plan où le fondateur ne se paie pas n'est pas prudent : il est incomplet, et un financeur le lit comme tel. Pose ce que tu comptes prendre, même modeste.",
      figure: { label: 'Brut annuel', value: '—', good: false },
    })
  }

  const yearly = gross * 12
  const marge = n(r.pnl.netResult[0])
  return card({
    tone: marge >= 0 ? 'good' : 'watch',
    kicker: 'Ta rémunération',
    title: `${euro(yearly)} brut par an`,
    ico: 'commerce',
    body: marge >= 0
      ? `Elle est déjà déduite du résultat : l'entreprise dégage ${euro(marge)} au-delà de ce que tu prends. Ce surplus reste en réserve ou se distribue en dividendes.`
      : `Elle est déjà déduite du résultat : l'entreprise perd ${euro(Math.abs(marge))} la première année en te payant. C'est courant au démarrage, à condition d'avoir de quoi financer cette perte.`,
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
