/**
 * Graphiques en SVG pur : pas de dépendance, rendu net à toute densité,
 * lisibles sur mobile. Palette accessible, cohérente d'un graphique à l'autre.
 */

import { svg, h, euro, num, monthLabel, yearLabel } from './dom.js'

export const PALETTE = ['#5f3fee', '#05a578', '#d97a06', '#1a7fd4', '#e0335a', '#7d4bd1', '#0d9488', '#b45309']
const GRID = '#e6eaf0'
const AXIS = '#8290a6'

function scaleY(min, max, height, pad) {
  const span = max - min || 1
  return (v) => pad.t + (height - pad.t - pad.b) * (1 - (v - min) / span)
}

function niceTicks(min, max, count = 4) {
  const span = max - min || 1
  const raw = span / count
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(raw) || 1)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || mag * 10
  const ticks = []
  for (let v = Math.ceil(min / step) * step; v <= max + step * 0.001; v += step) ticks.push(v)
  return ticks
}

/** Barres groupées avec optionnellement une ligne superposée. */
export function barChart({ series, categories, height = 220, line = null, formatter = (v) => euro(v, { compact: true }) }) {
  const width = 720
  const pad = { t: 14, r: 14, b: 30, l: 58 }
  const all = series.flatMap((s) => s.values).concat(line ? line.values : [])
  let max = Math.max(0, ...all), min = Math.min(0, ...all)
  const ticks = niceTicks(min, max, 4)
  max = Math.max(max, ...ticks); min = Math.min(min, ...ticks)
  const y = scaleY(min, max, height, pad)
  const innerW = width - pad.l - pad.r
  const groupW = innerW / categories.length
  const barW = Math.min(38, (groupW * 0.66) / series.length)

  const nodes = []
  for (const t of ticks) {
    nodes.push(svg('line', { x1: pad.l, x2: width - pad.r, y1: y(t), y2: y(t), stroke: t === 0 ? AXIS : GRID, 'stroke-width': t === 0 ? 1 : 1 }))
    nodes.push(svg('text', { x: pad.l - 8, y: y(t) + 4, 'text-anchor': 'end', fill: AXIS, 'font-size': 11 }, formatter(t)))
  }
  categories.forEach((cat, i) => {
    const cx = pad.l + groupW * (i + 0.5)
    nodes.push(svg('text', { x: cx, y: height - 9, 'text-anchor': 'middle', fill: AXIS, 'font-size': 11.5 }, cat))
    series.forEach((s, j) => {
      const v = s.values[i] || 0
      const x = cx - (barW * series.length) / 2 + barW * j
      const top = Math.min(y(v), y(0)), hgt = Math.abs(y(v) - y(0))
      nodes.push(svg('rect', { x, y: top, width: barW - 2, height: Math.max(1, hgt), rx: 3, fill: s.color || PALETTE[j % PALETTE.length] },
        svg('title', {}, `${s.label} · ${cat} : ${euro(v)}`)))
    })
  })
  if (line) {
    const pts = line.values.map((v, i) => `${pad.l + groupW * (i + 0.5)},${y(v)}`).join(' ')
    nodes.push(svg('polyline', { points: pts, fill: 'none', stroke: line.color || '#0a0f1c', 'stroke-width': 2, 'stroke-dasharray': line.dashed ? '5 4' : null, 'stroke-linejoin': 'round' }))
    line.values.forEach((v, i) => nodes.push(svg('circle', { cx: pad.l + groupW * (i + 0.5), cy: y(v), r: 3.5, fill: '#fff', stroke: line.color || '#0a0f1c', 'stroke-width': 2 },
      svg('title', {}, `${line.label} · ${categories[i]} : ${euro(v)}`))))
  }
  const chart = svg('svg', { class: 'chart', viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'xMidYMid meet', role: 'img' }, ...nodes)
  return h('div', {}, chart, legend([...series, ...(line ? [{ ...line, dashed: true }] : [])]))
}

/** Courbe de trésorerie ou de tout flux mensuel, avec zone sous la courbe. */
export function areaChart({ values, startDate, height = 220, color = '#5f3fee', label = 'Trésorerie', markZero = true, formatter = (v) => euro(v, { compact: true }) }) {
  const width = 720
  const pad = { t: 14, r: 14, b: 28, l: 58 }
  let max = Math.max(0, ...values), min = Math.min(0, ...values)
  const ticks = niceTicks(min, max, 4)
  max = Math.max(max, ...ticks); min = Math.min(min, ...ticks)
  const y = scaleY(min, max, height, pad)
  const innerW = width - pad.l - pad.r
  const x = (i) => pad.l + (innerW * i) / Math.max(1, values.length - 1)

  const nodes = []
  for (const t of ticks) {
    nodes.push(svg('line', { x1: pad.l, x2: width - pad.r, y1: y(t), y2: y(t), stroke: t === 0 && markZero ? '#e0335a' : GRID, 'stroke-width': 1, 'stroke-dasharray': t === 0 && markZero ? '4 3' : null }))
    nodes.push(svg('text', { x: pad.l - 8, y: y(t) + 4, 'text-anchor': 'end', fill: AXIS, 'font-size': 11 }, formatter(t)))
  }
  for (let i = 0; i < values.length; i += 6) {
    nodes.push(svg('text', { x: x(i), y: height - 8, 'text-anchor': 'middle', fill: AXIS, 'font-size': 10.5 }, monthLabel(i, startDate)))
  }
  const id = `g${Math.random().toString(36).slice(2, 7)}`
  const line = values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  nodes.push(svg('defs', {}, svg('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 },
    svg('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': .26 }),
    svg('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': .02 }))))
  nodes.push(svg('polygon', { points: `${x(0)},${y(Math.max(min, 0))} ${line} ${x(values.length - 1)},${y(Math.max(min, 0))}`, fill: `url(#${id})` }))
  nodes.push(svg('polyline', { points: line, fill: 'none', stroke: color, 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }))

  // Point bas signalé : c'est le chiffre qui détermine le besoin de financement.
  const lowIndex = values.indexOf(Math.min(...values))
  if (values[lowIndex] < 0) {
    nodes.push(svg('circle', { cx: x(lowIndex), cy: y(values[lowIndex]), r: 4.5, fill: '#e0335a', stroke: '#fff', 'stroke-width': 2 },
      svg('title', {}, `Point bas : ${euro(values[lowIndex])} en ${monthLabel(lowIndex, startDate)}`)))
  }
  values.forEach((v, i) => nodes.push(svg('rect', { x: x(i) - innerW / values.length / 2, y: pad.t, width: innerW / values.length, height: height - pad.t - pad.b, fill: 'transparent' },
    svg('title', {}, `${monthLabel(i, startDate)} : ${euro(v)}`))))

  return h('div', {}, svg('svg', { class: 'chart', viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'xMidYMid meet', role: 'img' }, ...nodes))
}

/** Barres empilées : structure de coûts, mix d'activités. */
export function stackedBar({ series, categories, height = 220, formatter = (v) => euro(v, { compact: true }) }) {
  const width = 720
  const pad = { t: 14, r: 14, b: 30, l: 58 }
  const totals = categories.map((_, i) => series.reduce((a, s) => a + Math.max(0, s.values[i] || 0), 0))
  let max = Math.max(1, ...totals)
  const ticks = niceTicks(0, max, 4); max = Math.max(max, ...ticks)
  const y = scaleY(0, max, height, pad)
  const innerW = width - pad.l - pad.r
  const groupW = innerW / categories.length
  const barW = Math.min(56, groupW * 0.55)
  const nodes = []
  for (const t of ticks) {
    nodes.push(svg('line', { x1: pad.l, x2: width - pad.r, y1: y(t), y2: y(t), stroke: GRID }))
    nodes.push(svg('text', { x: pad.l - 8, y: y(t) + 4, 'text-anchor': 'end', fill: AXIS, 'font-size': 11 }, formatter(t)))
  }
  categories.forEach((cat, i) => {
    const cx = pad.l + groupW * (i + 0.5)
    nodes.push(svg('text', { x: cx, y: height - 9, 'text-anchor': 'middle', fill: AXIS, 'font-size': 11.5 }, cat))
    let acc = 0
    series.forEach((s, j) => {
      const v = Math.max(0, s.values[i] || 0)
      if (v <= 0) return
      const top = y(acc + v), bottom = y(acc)
      nodes.push(svg('rect', { x: cx - barW / 2, y: top, width: barW, height: Math.max(1, bottom - top), fill: s.color || PALETTE[j % PALETTE.length] },
        svg('title', {}, `${s.label} · ${cat} : ${euro(v)}`)))
      acc += v
    })
  })
  return h('div', {}, svg('svg', { class: 'chart', viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'xMidYMid meet', role: 'img' }, ...nodes), legend(series))
}

/** Répartition en anneau. */
export function donut({ items, size = 170, formatter = (v) => euro(v, { compact: true }) }) {
  const total = items.reduce((a, i) => a + Math.max(0, i.value), 0)
  const r = size / 2, thickness = size * 0.21
  const nodes = []
  if (total <= 0) {
    nodes.push(svg('circle', { cx: r, cy: r, r: r - thickness / 2, fill: 'none', stroke: GRID, 'stroke-width': thickness }))
  } else {
    // Un arc SVG dont les extrémités coïncident ne dessine rien : lorsqu'un
    // seul secteur représente la totalité, on trace un cercle.
    const single = items.filter((i) => i.value > 0).length === 1
    if (single) {
      const only = items.find((i) => i.value > 0)
      const idx = items.indexOf(only)
      nodes.push(svg('circle', { cx: r, cy: r, r: r - thickness / 2, fill: 'none', stroke: only.color || PALETTE[idx % PALETTE.length], 'stroke-width': thickness },
        svg('title', {}, `${only.label} : ${formatter(only.value)} (100 %)`)))
    }
    let angle = -Math.PI / 2
    items.forEach((item, i) => {
      if (single) return
      const v = Math.max(0, item.value)
      if (v <= 0) return
      const sweep = (v / total) * Math.PI * 2
      const end = angle + sweep
      const rr = r - thickness / 2
      const p0 = [r + rr * Math.cos(angle), r + rr * Math.sin(angle)]
      const p1 = [r + rr * Math.cos(end), r + rr * Math.sin(end)]
      nodes.push(svg('path', {
        d: `M ${p0[0]} ${p0[1]} A ${rr} ${rr} 0 ${sweep > Math.PI ? 1 : 0} 1 ${p1[0]} ${p1[1]}`,
        fill: 'none', stroke: item.color || PALETTE[i % PALETTE.length], 'stroke-width': thickness,
      }, svg('title', {}, `${item.label} : ${formatter(v)} (${Math.round((v / total) * 100)} %)`)))
      angle = end
    })
  }
  return h('div', { class: 'row', style: { gap: '16px', flexWrap: 'wrap' } },
    svg('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, style: 'flex:none' }, ...nodes),
    h('div', { class: 'stack', style: { gap: '5px', flex: '1', minWidth: '150px' } },
      ...items.filter((i) => i.value > 0).map((i, idx) => h('div', { class: 'row', style: { gap: '7px', fontSize: '12.5px' } },
        h('span', { class: 'swatch', style: { background: i.color || PALETTE[idx % PALETTE.length] } }),
        h('span', { class: 'spacer' }, i.label),
        h('strong', { class: 'num' }, formatter(i.value)),
        h('span', { class: 'muted tiny num', style: { width: '38px', textAlign: 'right' } }, total > 0 ? `${Math.round((i.value / total) * 100)} %` : '—'),
      )),
    ),
  )
}

/** Ligne simple, utile pour une évolution d'effectif ou de volumes. */
export function sparkline({ values, width = 120, height = 32, color = '#5f3fee' }) {
  const max = Math.max(...values, 1), min = Math.min(...values, 0)
  const span = max - min || 1
  const pts = values.map((v, i) => `${(width * i) / Math.max(1, values.length - 1)},${height - ((v - min) / span) * height}`).join(' ')
  return svg('svg', { class: 'spark', viewBox: `0 0 ${width} ${height}`, width, height, style: `display:block;width:${width}px;height:${height}px;flex:none` },
    svg('polyline', { points: pts, fill: 'none', stroke: color, 'stroke-width': 1.8, 'stroke-linejoin': 'round' }))
}

function legend(series) {
  return h('div', { class: 'chart-legend' },
    ...series.map((s, i) => h('span', {},
      h('span', { class: 'swatch', style: { background: s.color || PALETTE[i % PALETTE.length], ...(s.dashed ? { borderRadius: '0', height: '2px' } : {}) } }),
      s.label)),
  )
}

export const YEAR_CATEGORIES = Array.from({ length: 5 }, (_, y) => yearLabel(y).replace('Année ', 'A'))
