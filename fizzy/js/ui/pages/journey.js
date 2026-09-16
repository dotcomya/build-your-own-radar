/**
 * Le parcours — la page d'accueil du fondateur.
 *
 * Un business plan fait peur parce qu'on ne sait pas quand il est fini. Cette
 * page répond à ça et à rien d'autre : voilà les neuf étapes, voilà où tu en
 * es, voilà la suivante, et voilà ce qu'elle va débloquer.
 *
 * Le rail de gauche est la colonne vertébrale : un rond par étape, reliés par
 * des flèches, chacun cliquable. L'état d'un rond n'est jamais déclaré — il est
 * lu dans les données. On ne peut donc pas se mentir sur son avancement.
 */

import { h, svg, euro } from '../dom.js'
import { journey, points } from '../../engine/journey.js'
import { verdict } from '../../engine/verdict.js'
import { suggestActions, applyAction } from '../../engine/simulate.js'
import { getSector } from '../../state/sectors.js'
import { toast } from '../dom.js'
import store from '../../state/store.js'

export function renderJourney(navigate, refresh) {
  const s = store.scenario
  const r = store.result
  if (!s) return h('div', { class: 'content' }, h('p', {}, 'Aucun scénario.'))

  const j = journey(s, r)
  const sector = getSector(s.meta?.sectorKey)

  return h('div', { class: 'content journey' },
    hero(j, s, r, sector, navigate),

    h('div', { class: 'journey-body' },
      rail(j, navigate),
      h('div', { class: 'journey-main' },
        nextCard(j, navigate),
        j.completion > 0.25 ? snapshot(j, s, r, navigate) : null,
        trophyCase(j),
        j.completion >= 0.5 ? quickWins(s, r, navigate, refresh) : null,
      ),
    ),
  )
}

/* ────────────────────────────────── Hero ────────────────────────────────── */

/**
 * L'anneau de progression et le rang.
 *
 * Le pourcentage n'est pas un score de remplissage déguisé : une étape ne
 * compte comme faite que si le modèle sait quoi en faire.
 */
function hero(j, s, r, sector, navigate) {
  const pts = points(j)
  const R = 54, C = 2 * Math.PI * R

  return h('section', { class: `hero-journey tone-${j.rank.tone}` },
    h('div', { class: 'hero-journey-glow', 'aria-hidden': 'true' }),
    h('div', { class: 'hero-journey-inner' },
      h('div', { class: 'hero-ring' },
        svg('svg', { viewBox: '0 0 128 128', class: 'ring', role: 'img', 'aria-label': `Business plan complet à ${pts} %` },
          svg('circle', { cx: 64, cy: 64, r: R, fill: 'none', stroke: 'rgba(255,255,255,.12)', 'stroke-width': 9 }),
          svg('circle', {
            cx: 64, cy: 64, r: R, fill: 'none', stroke: 'currentColor', 'stroke-width': 9,
            'stroke-linecap': 'round', 'stroke-dasharray': `${C}`,
            'stroke-dashoffset': `${C * (1 - j.completion)}`,
            transform: 'rotate(-90 64 64)', class: 'ring-progress',
          }),
        ),
        h('div', { class: 'hero-ring-label' },
          h('span', { class: 'hero-ring-value num' }, String(pts)),
          h('span', { class: 'hero-ring-unit' }, '%'),
        ),
      ),

      h('div', { class: 'hero-journey-text' },
        h('div', { class: 'hero-journey-eyebrow' },
          sector ? sector.label : 'Mon business plan',
          h('span', { class: 'dot' }, '·'),
          `${j.done}/${j.total} étapes`,
        ),
        h('h1', { class: 'hero-journey-rank' }, j.rank.label),
        h('p', { class: 'hero-journey-line' }, j.rank.line),
        h('div', { class: 'hero-journey-actions' },
          h('button', {
            class: 'btn btn-primary btn-lg',
            onClick: () => navigate(`#/${j.current.page}`),
          }, j.done === 0 ? 'Commencer →' : `Continuer : ${j.current.label} →`),
          j.remainingMinutes > 0
            ? h('span', { class: 'hero-journey-eta' }, `≈ ${j.remainingMinutes} min pour tout boucler`)
            : h('span', { class: 'hero-journey-eta' }, 'Tout est rempli.'),
        ),
      ),

      r ? h('div', { class: 'hero-journey-stats' },
        ...heroStats(r).map((st) => h('div', { class: 'hero-stat' },
          h('span', { class: 'hero-stat-label' }, st.label),
          h('span', { class: `hero-stat-value num ${st.tone || ''}` }, st.value),
        )),
      ) : null,
    ),
  )
}

function heroStats(r) {
  const k = r.kpis, p = r.pnl
  const y = k.firstProfitableYear !== null ? k.firstProfitableYear : 2
  return [
    { label: "Chiffre d'affaires", value: p.revenue[y] > 0 ? euro(p.revenue[y], { compact: true }) : '—' },
    { label: 'Point mort', value: k.breakEven[y] ? euro(k.breakEven[y], { compact: true }) : '—' },
    {
      label: 'À financer',
      value: k.fundingNeed > 0 ? euro(k.fundingNeed, { compact: true }) : 'Rien',
      tone: k.fundingNeed > 0 ? 'warn' : 'pos',
    },
  ]
}

/* ──────────────────────── Le rail de ronds et flèches ───────────────────── */

/**
 * Les ronds reliés par des flèches.
 *
 * C'est la pièce qui donne au parcours sa forme : on voit d'un coup d'œil ce
 * qui est fait, où on en est, et ce qui reste. Chaque rond mène à sa page.
 */
/** « Validé le 12 mars » — la date écrite au franchissement, pas une déduction. */
function validatedOn(key) {
  const at = store.scenario?.meta?.stepsDoneAt?.[key]
  if (!at) return null
  return `Validé le ${new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
}

function rail(j, navigate) {
  const nodes = []
  let index = 0

  for (const act of j.acts) {
    nodes.push(h('div', { class: `rail-act ${act.done ? 'done' : ''}` },
      h('span', { class: 'rail-act-title' }, act.title),
      h('span', { class: 'rail-act-tag' }, act.tagline),
    ))

    for (const step of act.steps) {
      index += 1
      const isCurrent = step.key === j.current.key
      nodes.push(h('button', {
        class: `node node-${step.status} ${isCurrent ? 'is-current' : ''}`,
        onClick: () => navigate(`#/${step.page}`),
        'aria-current': isCurrent ? 'step' : null,
      },
        h('span', { class: 'node-dot' },
          h('span', { class: 'node-glyph' },
            step.status === 'done' ? '✓' : String(index)),
          isCurrent ? h('span', { class: 'node-pulse', 'aria-hidden': 'true' }) : null,
        ),
        h('span', { class: 'node-text' },
          h('span', { class: 'node-label' }, step.label),
          h('span', { class: 'node-detail' },
            step.status === 'done' ? (validatedOn(step.key) || step.detail) : step.detail),
        ),
        h('span', { class: 'node-arrow', 'aria-hidden': 'true' }, '→'),
      ))
    }
  }

  return h('nav', { class: 'journey-rail', 'aria-label': 'Les étapes de ton business plan' }, ...nodes)
}

/* ──────────────────────────── L'étape en cours ──────────────────────────── */

function nextCard(j, navigate) {
  const step = j.current
  return h('section', { class: 'next-card' },
    h('div', { class: 'next-card-head' },
      h('span', { class: 'next-card-tag' }, step.status === 'todo' ? 'Prochaine étape' : 'À terminer'),
      h('span', { class: 'next-card-time' }, `≈ ${step.minutes} min`),
    ),
    h('h2', { class: 'next-card-q' }, step.question),
    h('p', { class: 'next-card-promise' }, step.promise),

    h('div', { class: 'next-card-unlock' },
      h('span', { class: 'next-card-unlock-tag' }, 'Ça débloque'),
      h('span', {}, step.unlocks),
    ),

    h('div', { class: 'next-card-tips' },
      ...step.tips.slice(0, 1).map((tip) => h('div', { class: 'mini-tip' },
        h('div', { class: 'mini-tip-title' }, tip.title),
        h('p', {}, tip.body),
      )),
    ),

    h('button', {
      class: 'btn btn-primary btn-block btn-lg', onClick: () => navigate(`#/${step.page}`),
    }, `${step.label} →`),
  )
}

/* ─────────────────────── Ce que le modèle sait déjà ─────────────────────── */

/**
 * Ce que Fizzy peut déjà dire.
 *
 * Répondre tôt, même partiellement, est ce qui donne envie de continuer : le
 * fondateur voit que ses chiffres produisent quelque chose avant d'avoir tout
 * saisi.
 */
function snapshot(j, s, r, navigate) {
  if (!r) return null
  const v = verdict(r, s)
  return h('section', { class: `panel snapshot tone-${v.tone}` },
    h('div', { class: 'panel-head' },
      h('h2', {}, 'Ce que vos chiffres disent déjà'),
      h('p', { class: 'panel-sub' }, j.completion < 0.85
        ? "Provisoire : il reste des étapes qui peuvent tout changer."
        : "Le modèle est complet — voilà le verdict."),
    ),
    h('div', { class: 'panel-body' },
      h('div', { class: 'snapshot-word' }, v.word),
      h('p', { class: 'snapshot-line' }, v.line),
      h('div', { class: 'snapshot-figure' },
        h('span', { class: 'snapshot-figure-label' }, v.figure.label),
        h('span', { class: 'snapshot-figure-value num' }, v.figure.value),
      ),
      h('button', { class: 'btn btn-sm btn-quiet mt', onClick: () => navigate('#/tableau-de-bord') },
        'Voir le détail →'),
    ),
  )
}

/* ─────────────────────────────── Trophées ───────────────────────────────── */

/**
 * Ce qui est démontré, sur une seule ligne.
 *
 * Sept cartes occupaient un écran pour dire sept mots. Une rangée de jetons dit
 * la même chose et laisse la place au reste.
 */
function trophyCase(j) {
  const won = j.trophies.filter((t) => t.won).length
  return h('section', { class: 'proof mt' },
    h('span', { class: 'proof-tag' }, `Démontré ${won}/${j.trophies.length}`),
    h('div', { class: 'proof-row' },
      ...j.trophies.map((t) => h('span', {
        class: `proof-chip ${t.won ? 'won' : ''}`,
        title: t.won && t.value ? `${t.label} — ${t.value}` : t.hint,
      }, t.glyph, ' ', t.label)),
    ),
  )
}

/* ──────────────────────── Les gains à portée de main ────────────────────── */

function quickWins(s, r, navigate, refresh) {
  let best = []
  try { best = suggestActions(s, r, { limit: 2 }).best } catch { return null }
  if (!best.length) return null

  return h('section', { class: 'panel mt' },
    h('div', { class: 'panel-head' },
      h('h2', {}, 'Deux leviers, tout de suite'),
      h('p', { class: 'panel-sub' }, "Chaque estimation rejoue le modèle entier. Appliquer reste réversible."),
    ),
    h('div', { class: 'wins' },
      ...best.map((a) => h('div', { class: 'win' },
        h('div', { class: 'win-main' },
          h('div', { class: 'win-label' }, a.label),
          a.detail ? h('div', { class: 'win-detail num' }, a.detail) : null,
        ),
        h('div', { class: 'win-gain' },
          a.delta.ebitda ? h('span', { class: `num ${a.delta.ebitda > 0 ? 'pos' : 'neg'}` }, `EBITDA ${euro(a.delta.ebitda, { sign: true })}`) : null,
          a.delta.fundingNeed ? h('span', { class: `num ${a.delta.fundingNeed < 0 ? 'pos' : 'neg'}` }, `Financement ${euro(a.delta.fundingNeed, { sign: true })}`) : null,
        ),
        h('button', {
          class: 'btn btn-sm',
          onClick: () => {
            store.update((sc) => applyAction(sc, a.key), { label: a.label })
            toast(`${a.label} — appliqué`, 'ok')
            refresh()
          },
        }, 'Appliquer'),
      )),
    ),
  )
}
