/**
 * Graphiques en SVG pur : pas de dépendance, rendu net à toute densité,
 * lisibles sur mobile. Palette accessible, cohérente d'un graphique à l'autre.
 */

import { svg, h, euro, num, monthLabel, yearLabel } from './dom.js'

/**
 * Palette catégorielle, validée : bande de clarté, plancher de chroma,
 * séparation sous déficience de vision des couleurs et contraste sur fond
 * clair. L'ordre est fixe — une série garde sa teinte quel que soit le nombre
 * de séries affichées.
 */
export const PALETTE = ['#1B3BFF', '#C2410C', '#0E9A6B', '#9333EA', '#A16207', '#0891B2', '#BE123C', '#0369A1']

/** Couleurs de statut, réservées : jamais employées comme teinte de série. */
export const STATUS = { gain: '#0A7A54', loss: '#C4142F', warn: '#9A5B00', signal: '#1B3BFF' }

const GRID = '#E2E5E2'
const AXIS = '#78838C'
const SURFACE = '#FFFFFF'

/* ─────────────────────────── L'infobulle ──────────────────────────────── */

/**
 * Une seule infobulle pour toute l'application.
 *
 * Les `<title>` SVG que les graphiques portaient jusqu'ici s'affichaient au
 * bout d'une seconde, dans la police du système, hors de toute mise en forme.
 * Un graphique qu'on interroge doit répondre tout de suite et dans la langue
 * du reste : un repère vertical, la date ou la catégorie, et chaque série
 * avec sa pastille et son montant.
 */
let tipEl = null
function tip() {
  if (tipEl && tipEl.isConnected) return tipEl
  tipEl = h('div', { class: 'ctip', role: 'tooltip', 'aria-hidden': 'true' })
  document.body.appendChild(tipEl)
  return tipEl
}

/** Place l'infobulle près du curseur, sans jamais la laisser sortir de l'écran. */
function showTip(event, title, rows) {
  const el = tip()
  el.replaceChildren(
    h('div', { class: 'ctip-head' }, title),
    ...rows.filter(Boolean).map((r) => h('div', { class: `ctip-row ${r.strong ? 'is-strong' : ''}` },
      r.color ? h('span', { class: 'ctip-dot', style: { background: r.color } }) : null,
      h('span', { class: 'ctip-label' }, r.label),
      h('span', { class: 'ctip-value num' }, r.value),
    )),
  )
  el.classList.add('is-on')
  el.setAttribute('aria-hidden', 'false')
  const pad = 12
  const box = el.getBoundingClientRect()
  let x = event.clientX + 14
  let y = event.clientY - box.height - 12
  if (x + box.width + pad > window.innerWidth) x = event.clientX - box.width - 14
  if (y < pad) y = event.clientY + 18
  el.style.transform = `translate(${Math.max(pad, x)}px, ${Math.max(pad, y)}px)`
}

function hideTip() {
  if (!tipEl) return
  tipEl.classList.remove('is-on')
  tipEl.setAttribute('aria-hidden', 'true')
}

/**
 * Rend une zone sensible : elle appelle `rows()` au survol et fait disparaître
 * l'infobulle quand on la quitte. Le pointeur reste fin — la zone est
 * transparente, elle ne se voit pas, elle s'utilise.
 */
export function hot(node, title, rows, onEnter, onLeave) {
  node.addEventListener('mousemove', (e) => { showTip(e, title, rows()); if (onEnter) onEnter() })
  node.addEventListener('mouseleave', () => { hideTip(); if (onLeave) onLeave() })
  node.addEventListener('touchstart', (e) => {
    const t = e.touches[0]
    if (t) showTip({ clientX: t.clientX, clientY: t.clientY }, title, rows())
    if (onEnter) onEnter()
  }, { passive: true })
  return node
}

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
      nodes.push(svg('rect', { x, y: top, width: Math.max(2, barW - 3), height: Math.max(1, hgt), rx: 2, fill: s.color || PALETTE[j % PALETTE.length] }))
    })
  })

  // Une bande sensible par catégorie, par-dessus tout le reste : on interroge
  // une année entière, pas une barre isolée.
  categories.forEach((cat, i) => {
    const cx = pad.l + groupW * (i + 0.5)
    const band = svg('rect', {
      x: cx - groupW / 2, y: pad.t, width: groupW, height: height - pad.t - pad.b,
      fill: 'transparent', class: 'chart-hot',
    })
    hot(band, cat, () => [
      ...series.map((s, j) => ({ label: s.label, value: euro(s.values[i] || 0), color: s.color || PALETTE[j % PALETTE.length] })),
      line ? { label: line.label, value: euro(line.values[i] || 0), color: line.color || '#0B0E10' } : null,
    ])
    nodes.push(band)
  })
  if (line) {
    const pts = line.values.map((v, i) => `${pad.l + groupW * (i + 0.5)},${y(v)}`).join(' ')
    nodes.push(svg('polyline', { points: pts, fill: 'none', stroke: line.color || '#0B0E10', 'stroke-width': 2, 'stroke-dasharray': line.dashed ? '5 4' : null, 'stroke-linejoin': 'round' }))
    line.values.forEach((v, i) => nodes.push(svg('circle', { cx: pad.l + groupW * (i + 0.5), cy: y(v), r: 3.5, fill: '#fff', stroke: line.color || '#0B0E10', 'stroke-width': 2 })))
  }
  const chart = svg('svg', { class: 'chart', viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'xMidYMid meet', role: 'img' }, ...nodes)
  return h('div', {}, chart, legend([...series, ...(line ? [{ ...line, dashed: true }] : [])]))
}

/** Courbe de trésorerie ou de tout flux mensuel, avec zone sous la courbe. */
export function areaChart({ values, startDate, height = 220, color = '#1B3BFF', label = 'Trésorerie', markZero = true, threshold = null, compare = null, formatter = (v) => euro(v, { compact: true }) }) {
  const width = 720
  const pad = { t: 14, r: 14, b: 28, l: 58 }
  // Le seuil fait partie de l'échelle : tracé hors cadre, il ne se verrait pas.
  const all = compare ? [...values, ...compare.values] : values
  let max = Math.max(0, ...all, threshold ? threshold.value : 0)
  let min = Math.min(0, ...all)
  const ticks = niceTicks(min, max, 4)
  max = Math.max(max, ...ticks); min = Math.min(min, ...ticks)
  const y = scaleY(min, max, height, pad)
  const innerW = width - pad.l - pad.r
  const x = (i) => pad.l + (innerW * i) / Math.max(1, values.length - 1)

  const nodes = []
  for (const t of ticks) {
    nodes.push(svg('line', { x1: pad.l, x2: width - pad.r, y1: y(t), y2: y(t), stroke: t === 0 && markZero ? STATUS.loss : GRID, 'stroke-width': 1, 'stroke-dasharray': t === 0 && markZero ? '4 3' : null }))
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

  // La courbe de référence : le plan tel qu'il est aujourd'hui, en pointillé.
  // C'est l'écart entre les deux traits qui dit ce que la simulation change —
  // un nombre seul, même juste, ne se ressent pas.
  if (compare && compare.values) {
    const ref = compare.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
    nodes.push(svg('polyline', {
      points: ref, fill: 'none', stroke: compare.color || AXIS,
      'stroke-width': 1.6, 'stroke-dasharray': '5 4', opacity: .75,
    }))
  }
  nodes.push(svg('polyline', { points: line, fill: 'none', stroke: color, 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }))

  // Le seuil à dépasser : un trait pointillé nommé. Annoncer une ligne sans la
  // tracer — ce que faisait le tableau de bord — ne trompe personne longtemps.
  if (threshold && Number.isFinite(threshold.value)) {
    const ty = y(threshold.value)
    nodes.push(svg('line', {
      x1: pad.l, x2: width - pad.r, y1: ty, y2: ty,
      stroke: STATUS.loss, 'stroke-width': 1.5, 'stroke-dasharray': '6 4',
    }))
    nodes.push(svg('text', {
      x: width - pad.r, y: ty - 6, 'text-anchor': 'end',
      fill: STATUS.loss, 'font-size': 10.5, 'font-weight': 600,
    }, threshold.label || ''))
  }

  // Point bas signalé : c'est le chiffre qui détermine le besoin de financement.
  const lowIndex = values.indexOf(Math.min(...values))
  if (values[lowIndex] < 0) {
    nodes.push(svg('circle', { cx: x(lowIndex), cy: y(values[lowIndex]), r: 5, fill: STATUS.loss, stroke: SURFACE, 'stroke-width': 2 },
      svg('title', {}, `Point bas : ${euro(values[lowIndex])} en ${monthLabel(lowIndex, startDate)}`)))
  }
  // Un repère qui suit le curseur : le mois survolé se lit sur l'axe, et la
  // valeur exacte s'affiche sans qu'on ait à viser un point de trois pixels.
  const guide = svg('line', { x1: 0, x2: 0, y1: pad.t, y2: height - pad.b, stroke: '#0B0E10', 'stroke-width': 1, 'stroke-dasharray': '3 3', opacity: 0 })
  const marker = svg('circle', { cx: 0, cy: 0, r: 4.5, fill: SURFACE, stroke: color, 'stroke-width': 2.5, opacity: 0 })
  nodes.push(guide, marker)

  values.forEach((v, i) => {
    const band = svg('rect', {
      x: x(i) - innerW / values.length / 2, y: pad.t,
      width: innerW / values.length, height: height - pad.t - pad.b,
      fill: 'transparent', class: 'chart-hot',
    })
    hot(band, monthLabel(i, startDate),
      () => [{ label, value: formatter(v), color }],
      () => {
        guide.setAttribute('x1', x(i)); guide.setAttribute('x2', x(i)); guide.setAttribute('opacity', '.35')
        marker.setAttribute('cx', x(i)); marker.setAttribute('cy', y(v)); marker.setAttribute('opacity', '1')
      },
      () => { guide.setAttribute('opacity', '0'); marker.setAttribute('opacity', '0') })
    nodes.push(band)
  })

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
      // 2 px de fond entre deux segments : sans cela les aplats se confondent.
      const height = Math.max(1, bottom - top - 2)
      nodes.push(svg('rect', { x: cx - barW / 2, y: top, width: barW, height, fill: s.color || PALETTE[j % PALETTE.length] }))
      acc += v
    })
  })

  categories.forEach((cat, i) => {
    const cx = pad.l + groupW * (i + 0.5)
    const band = svg('rect', {
      x: cx - groupW / 2, y: pad.t, width: groupW, height: height - pad.t - pad.b,
      fill: 'transparent', class: 'chart-hot',
    })
    hot(band, cat, () => [
      ...series.map((s, j) => ({ label: s.label, value: euro(Math.max(0, s.values[i] || 0)), color: s.color || PALETTE[j % PALETTE.length] })),
      { label: 'Total', value: euro(totals[i]), strong: true },
    ])
    nodes.push(band)
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
      const colour = only.color || PALETTE[idx % PALETTE.length]
      nodes.push(svg('circle', { cx: r, cy: r, r: r - thickness / 2, fill: 'none', stroke: colour, 'stroke-width': thickness }))
      nodes.push(hot(
        svg('circle', { cx: r, cy: r, r: r - thickness / 2, fill: 'none', stroke: 'transparent', 'stroke-width': thickness + 14, class: 'chart-hot' }),
        only.label, () => [{ label: '100 % du total', value: formatter(only.value), color: colour }]))
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
      const d = `M ${p0[0]} ${p0[1]} A ${rr} ${rr} 0 ${sweep > Math.PI ? 1 : 0} 1 ${p1[0]} ${p1[1]}`
      const colour = item.color || PALETTE[i % PALETTE.length]
      nodes.push(svg('path', { d, fill: 'none', stroke: colour, 'stroke-width': thickness }))
      // Un second tracé, transparent et plus large, sert de cible : viser un
      // arc de vingt pixels à la souris ne doit pas être un exercice d'adresse.
      nodes.push(hot(
        svg('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': thickness + 14, class: 'chart-hot' }),
        item.label,
        () => [
          { label: 'Montant', value: formatter(v), color: colour },
          { label: 'Part du total', value: `${Math.round((v / total) * 100)} %` },
        ]))
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

/**
 * Cascade : d'où part l'argent et ce qu'il en reste.
 *
 * C'est la représentation qui répond le plus directement à « où part chaque
 * euro ? ». Chaque barre flotte au niveau atteint par la précédente ; les
 * paliers (`total: true`) repartent du zéro et se lisent comme des soldes.
 *
 * @param {{label:string,value:number,total?:boolean}[]} items
 */
export function waterfall({ items, height = 280, formatter = (v) => euro(v, { compact: true }) }) {
  const width = 720
  const pad = { t: 22, r: 12, b: 52, l: 62 }

  // Position de chaque barre : un palier se lit depuis zéro, une variation
  // depuis le solde courant.
  let running = 0
  const bars = items.map((it) => {
    const v = Number(it.value) || 0
    if (it.total) {
      running = v
      return { ...it, from: 0, to: v, value: v }
    }
    const from = running
    running += v
    return { ...it, from, to: running, value: v }
  })

  const all = bars.flatMap((b) => [b.from, b.to])
  let max = Math.max(0, ...all), min = Math.min(0, ...all)
  const ticks = niceTicks(min, max, 4)
  max = Math.max(max, ...ticks); min = Math.min(min, ...ticks)
  const y = scaleY(min, max, height, pad)
  const innerW = width - pad.l - pad.r
  const slot = innerW / bars.length
  const barW = Math.min(52, slot * 0.62)

  const nodes = []
  for (const t of ticks) {
    nodes.push(svg('line', { x1: pad.l, x2: width - pad.r, y1: y(t), y2: y(t), stroke: t === 0 ? AXIS : GRID, 'stroke-width': 1 }))
    nodes.push(svg('text', { x: pad.l - 8, y: y(t) + 4, 'text-anchor': 'end', fill: AXIS, 'font-size': 11 }, formatter(t)))
  }

  bars.forEach((b, i) => {
    const cx = pad.l + slot * (i + 0.5)
    const top = Math.min(y(b.from), y(b.to))
    const hgt = Math.max(2, Math.abs(y(b.to) - y(b.from)))
    const colour = b.total
      ? (b.to >= 0 ? '#0B0E10' : STATUS.loss)
      : (b.value >= 0 ? STATUS.gain : STATUS.loss)
    nodes.push(hot(
      svg('rect', {
        x: cx - barW / 2, y: top, width: barW, height: hgt, rx: 2,
        fill: colour, 'fill-opacity': b.total ? 1 : 0.86, class: 'chart-hot',
      }),
      b.label,
      () => (b.total
        ? [{ label: 'Solde', value: euro(b.value), color: colour, strong: true }]
        : [
            { label: b.value >= 0 ? 'Vient s\'ajouter' : 'Vient se retrancher', value: euro(Math.abs(b.value)), color: colour },
            { label: 'Solde apr\u00e8s', value: euro(b.to), strong: true },
          ])))

    // Valeur au-dessus de la barre pour une variation, au-dessus du palier
    // pour un solde : jamais à l'intérieur, où elle deviendrait illisible.
    nodes.push(svg('text', {
      x: cx, y: top - 6, 'text-anchor': 'middle', fill: b.total ? '#0B0E10' : colour,
      'font-size': 11.5, 'font-weight': b.total ? 650 : 500,
    }, `${!b.total && b.value > 0 ? '+' : ''}${formatter(b.value)}`))

    // Trait de liaison vers la barre suivante.
    const next = bars[i + 1]
    if (next && !next.total) {
      nodes.push(svg('line', {
        x1: cx + barW / 2, x2: pad.l + slot * (i + 1.5) - barW / 2,
        y1: y(b.to), y2: y(b.to), stroke: AXIS, 'stroke-width': 1, 'stroke-dasharray': '3 3',
      }))
    }

    for (const [k, part] of wrapLabel(b.label).entries()) {
      nodes.push(svg('text', {
        x: cx, y: height - 34 + k * 12, 'text-anchor': 'middle',
        fill: b.total ? '#0B0E10' : AXIS, 'font-size': 10, 'font-weight': b.total ? 600 : 400,
      }, part))
    }
  })

  return h('div', {}, svg('svg', { class: 'chart', viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'xMidYMid meet', role: 'img' }, ...nodes))
}

/** Deux lignes au maximum : au-delà, l'étiquette est tronquée. */
function wrapLabel(label) {
  const words = String(label).split(' ')
  if (words.length === 1) return [label]
  const lines = ['']
  for (const w of words) {
    const last = lines[lines.length - 1]
    if (!last) lines[lines.length - 1] = w
    else if ((last + ' ' + w).length <= 11) lines[lines.length - 1] = last + ' ' + w
    else lines.push(w)
  }
  return lines.slice(0, 2)
}

/** Ligne simple, utile pour une évolution d'effectif ou de volumes. */
export function sparkline({ values, width = 120, height = 32, color = '#1B3BFF' }) {
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
