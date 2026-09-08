/**
 * Le film des cinq ans.
 *
 * Un tableau de chiffres oblige à reconstruire mentalement l'histoire. Une
 * courbe de trésorerie annotée la raconte : voici quand vous embauchez, quand
 * la caisse touche le fond, quand vous franchissez le point mort, quand vous
 * devenez rentable. Un seul axe, une seule échelle, des repères posés dessus.
 *
 * Le choix des repères appartient au moteur (engine/milestones.js) ; ici on
 * ne fait que les placer sans qu'ils se marchent dessus.
 */

import { h, svg, euro, num, pct, monthLabel } from './dom.js'
import { milestones } from '../engine/milestones.js'
import { STATUS } from './charts.js'

const KIND_COLOR = {
  danger: STATUS.loss, low: STATUS.warn, win: STATUS.gain,
  break: STATUS.signal, money: STATUS.signal, hire: '#78838C',
}

/**
 * La frise : courbe de trésorerie sur soixante mois, repères annotés.
 * Les étiquettes alternent au-dessus et en dessous pour ne pas se chevaucher.
 */
export function storyline(result, scenario, { compact = false } = {}) {
  const cash = result.cash.balance
  // Un écran étroit ne rétrécit pas la typographie : il rétrécit le dessin.
  // On raconte donc la même histoire avec moins de repères, sur un cadre plus
  // étroit — le texte occupe alors la même part de l'image que sur un bureau.
  const events = milestones(result, scenario, { max: compact ? 3 : 5 })
  const width = compact ? 430 : 1000
  const height = compact ? 450 : 380
  const pad = compact
    ? { t: 104, r: 12, b: 130, l: 62 }
    : { t: 92, r: 20, b: 108, l: 62 }
  const innerW = width - pad.l - pad.r
  const innerH = height - pad.t - pad.b
  const fs = compact
    ? { axis: 11, label: 15, caption: 10.5, step: 42 }
    : { axis: 10, label: 13, caption: 9.5, step: 34 }

  const max = Math.max(0, ...cash)
  const min = Math.min(0, ...cash)
  const span = max - min || 1
  const x = (m) => pad.l + (innerW * m) / Math.max(1, cash.length - 1)
  const y = (v) => pad.t + innerH * (1 - (v - min) / span)
  const zero = y(0)

  const nodes = []

  // Repères d'année : la trame de lecture.
  for (let yr = 0; yr <= 5; yr++) {
    const px = x(yr * 12)
    nodes.push(svg('line', { x1: px, x2: px, y1: pad.t - 8, y2: pad.t + innerH, stroke: '#E2E5E2', 'stroke-width': 1 }))
    if (yr < 5) {
      nodes.push(svg('text', {
        x: px + 6, y: pad.t + innerH + 18, fill: '#78838C',
        'font-family': 'IBM Plex Mono, monospace', 'font-size': fs.axis, 'letter-spacing': '.08em',
      }, `A${yr + 1}`))
    }
  }

  // Ligne de zéro : la frontière qui compte.
  nodes.push(svg('line', { x1: pad.l, x2: width - pad.r, y1: zero, y2: zero, stroke: '#0B0E10', 'stroke-width': 1 }))
  nodes.push(svg('text', { x: pad.l - 8, y: zero + 4, 'text-anchor': 'end', fill: '#0B0E10', 'font-family': 'IBM Plex Mono, monospace', 'font-size': fs.axis }, '0'))

  // Bornes chiffrées, plutôt qu'une échelle complète : on lit une forme.
  const clearOfZero = fs.axis + 5
  if (Math.abs(y(max) - zero) > clearOfZero) {
    nodes.push(svg('text', { x: pad.l - 8, y: y(max) + 4, 'text-anchor': 'end', fill: '#78838C', 'font-family': 'IBM Plex Mono, monospace', 'font-size': fs.axis }, euro(max, { compact: true })))
  }
  // Le minimum ne s'affiche que s'il ne vient pas se coller au zéro.
  if (min < 0 && Math.abs(y(min) - zero) > clearOfZero) {
    nodes.push(svg('text', { x: pad.l - 8, y: y(min) + 4, 'text-anchor': 'end', fill: STATUS.loss, 'font-family': 'IBM Plex Mono, monospace', 'font-size': fs.axis }, euro(min, { compact: true })))
  }

  const line = cash.map((v, m) => `${x(m)},${y(v)}`).join(' ')
  const gradId = `story${Math.random().toString(36).slice(2, 7)}`
  nodes.push(svg('defs', {}, svg('linearGradient', { id: gradId, x1: 0, y1: 0, x2: 0, y2: 1 },
    svg('stop', { offset: '0%', 'stop-color': STATUS.signal, 'stop-opacity': .18 }),
    svg('stop', { offset: '100%', 'stop-color': STATUS.signal, 'stop-opacity': .01 }))))

  // Surface sous la courbe, bornée au zéro pour que le négatif se voie.
  nodes.push(svg('polygon', { points: `${x(0)},${zero} ${line} ${x(cash.length - 1)},${zero}`, fill: `url(#${gradId})` }))

  // La partie négative, marquée sans ambiguïté.
  const negative = cash.map((v, m) => (v < 0 ? `${x(m)},${y(v)}` : null)).filter(Boolean)
  if (negative.length) {
    nodes.push(svg('polygon', {
      points: `${negative[0].split(',')[0]},${zero} ${negative.join(' ')} ${negative[negative.length - 1].split(',')[0]},${zero}`,
      fill: STATUS.loss, 'fill-opacity': .12,
    }))
  }

  nodes.push(svg('polyline', { points: line, fill: 'none', stroke: STATUS.signal, 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }))

  // Placement des étiquettes.
  //
  // Deux repères proches se chevauchent si on se contente d'alterner haut et
  // bas : on répartit donc dans des couloirs, en vérifiant l'emprise réelle de
  // chaque étiquette avant de l'y poser. Un repère qui ne trouve pas de place
  // est abandonné plutôt que superposé — mieux vaut quatre repères lisibles
  // que cinq illisibles.
  const placed = []
  const lanes = [
    { side: 'above', offset: 0 }, { side: 'below', offset: 0 },
    { side: 'above', offset: 1 }, { side: 'below', offset: 1 },
  ]
  const occupancy = lanes.map(() => [])

  for (const e of events) {
    const px = x(e.month)
    const title = compact ? (e.short || e.label) : e.label
    const detail = compact ? (e.shortDetail || e.detail) : e.detail
    const caption = `${monthLabel(e.month, result.startDate).toUpperCase()} · ${detail}`
    // Emprise estimée, dans le repère du dessin : le titre en Bricolage, la
    // légende en mono. Les deux polices tournent autour de 0,57 em de chasse.
    const w = Math.max(title.length * fs.label * 0.57, caption.length * fs.caption * 0.59)
    const anchor = px > width - w / 2 - pad.r ? 'end' : px < pad.l + w / 2 ? 'start' : 'middle'
    const left = anchor === 'end' ? px - w : anchor === 'start' ? px : px - w / 2
    const right = left + w

    const laneIndex = occupancy.findIndex((slots) =>
      slots.every((s) => right + 12 < s.left || left > s.right + 12))
    if (laneIndex === -1) continue
    occupancy[laneIndex].push({ left, right })
    placed.push({ ...e, px, title, caption, anchor, lane: lanes[laneIndex] })
  }

  for (const e of placed) {
    const py = y(cash[e.month] ?? 0)
    const color = KIND_COLOR[e.kind] || '#78838C'
    const step = fs.step
    const labelY = e.lane.side === 'above'
      ? pad.t - 30 - e.lane.offset * step
      : pad.t + innerH + 40 + e.lane.offset * step

    nodes.push(svg('line', {
      x1: e.px, x2: e.px,
      y1: e.lane.side === 'above' ? labelY + 8 : py,
      y2: e.lane.side === 'above' ? py : labelY - 22,
      stroke: color, 'stroke-width': 1, 'stroke-dasharray': '3 3',
    }))
    nodes.push(svg('circle', { cx: e.px, cy: py, r: 5, fill: '#fff', stroke: color, 'stroke-width': 2.5 }))
    nodes.push(svg('text', {
      x: e.px, y: labelY, 'text-anchor': e.anchor, fill: '#0B0E10',
      'font-family': "'Bricolage Grotesque', sans-serif", 'font-size': fs.label, 'font-weight': 700,
    }, e.title))
    nodes.push(svg('text', {
      x: e.px, y: labelY + fs.caption + 4.5, 'text-anchor': e.anchor, fill: '#78838C',
      'font-family': 'IBM Plex Mono, monospace', 'font-size': fs.caption, 'letter-spacing': '.05em',
    }, e.caption))
  }

  // Zone de survol par mois : la valeur exacte reste accessible.
  cash.forEach((v, m) => {
    nodes.push(svg('rect', { x: x(m) - innerW / cash.length / 2, y: pad.t, width: innerW / cash.length, height: innerH, fill: 'transparent' },
      svg('title', {}, `${monthLabel(m, result.startDate)} : ${euro(v)}`)))
  })

  return h('div', { class: 'story' },
    svg('svg', { class: 'chart', viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'xMidYMid meet', role: 'img',
      'aria-label': `Trésorerie sur cinq ans, ${events.length} moments clés` }, ...nodes),
  )
}

/**
 * Position dans la fourchette du métier.
 * Une jauge se lit d'un coup d'œil ; un pourcentage demande un référentiel.
 */
export function gauge({ label, value, range, format = (v) => pct(v), invert = false, help }) {
  const [low, high] = range
  const lo = Math.min(low, value * 0.85)
  const hi = Math.max(high, value * 1.15)
  const span = hi - lo || 1
  const at = (v) => ((v - lo) / span) * 100
  const inside = value >= low && value <= high
  const tone = inside ? 'ok' : (value < low) === invert ? 'high' : 'low'

  return h('div', { class: `gauge gauge-${tone}` },
    h('div', { class: 'gauge-top' },
      h('span', { class: 'gauge-label' }, label),
      h('span', { class: 'gauge-value num' }, format(value)),
    ),
    h('div', { class: 'gauge-track' },
      h('span', { class: 'gauge-band', style: { left: `${at(low)}%`, width: `${at(high) - at(low)}%` } }),
      h('span', { class: 'gauge-needle', style: { left: `${Math.min(100, Math.max(0, at(value)))}%` } }),
    ),
    h('div', { class: 'gauge-foot' },
      h('span', {}, `Métier : ${format(low)} – ${format(high)}`),
      h('span', { class: 'gauge-verdict' }, inside ? 'dans la norme' : value < low ? 'en dessous' : 'au-dessus'),
    ),
  )
}
