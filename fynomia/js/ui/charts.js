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

const GRID = '#ECEDE7'
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

/* ─────────────────────────── L'entrée en scène ─────────────────────────── */

/**
 * Un graphique se trace quand on arrive dessus.
 *
 * La synthèse essai faisait monter ses barres et tirer ses courbes au moment
 * où le lecteur les atteignait ; tous les autres graphiques du logiciel
 * apparaissaient d'un bloc, déjà finis, souvent hors de l'écran. Ils entrent
 * maintenant tous de la même façon : les barres poussent depuis leur ligne de
 * base, les courbes se tracent, les anneaux se remplissent, les valeurs
 * arrivent en dernier.
 *
 * Une fois par visite de page : un graphique qu'on a déjà vu ne se rejoue pas
 * à chaque saisie — il se met à jour sur place. Changer de page remet les
 * compteurs à zéro.
 */
const vus = new Set()
const guettes = new Map()
let pageVue = null
let guetteur = null
const reduit = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }

export function entree(el, cle, { classe = 'ch', min = 0.55 } = {}) {
  if (!el) return el
  // Deux familles : les graphiques (« ch ») et les parties qui les portent
  // (« rv »). Une partie qui se révèle ne doit pas lancer les graphiques
  // qu'elle contient : ils attendent qu'on les voie eux-mêmes.
  el.classList.add(classe)
  const page = typeof location !== 'undefined' ? String(location.hash).split('?')[0] : ''
  if (page !== pageVue) { vus.clear(); pageVue = page }
  if (vus.has(cle) || reduit() || typeof IntersectionObserver !== 'function') {
    el.classList.add('is-seen')
    return el
  }
  el.classList.add(`${classe}-watch`)
  el.dataset.ch = cle
  el.dataset.min = String(min)
  if (!guetteur) {
    guetteur = new IntersectionObserver((entrees) => {
      for (const e of entrees) {
        if (!e.isIntersecting) continue
        // Un graphique se joue quand on le voit presque entier — pas quand son
        // bord supérieur passe le bas de l'écran. Un élément plus haut que la
        // fenêtre se déclenche dès qu'il en occupe une bonne moitié.
        const t = e.target
        const m = Number(t.dataset.min) || 0.55
        if (e.intersectionRatio < m && e.intersectionRect.height < window.innerHeight * 0.5) continue
        vus.add(t.dataset.ch)
        t.classList.add('is-seen', 'is-play')
        guetteur.unobserve(t)
        guettes.delete(t)
      }
    }, { threshold: [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 0.95, 1], rootMargin: '0px 0px -4% 0px' })
  }
  // Les graphiques remplacés par un rendu ne seront jamais vus : on cesse de
  // les guetter, sans quoi l'observateur les retiendrait indéfiniment. Un
  // élément tout juste construit n'est pas encore dans la page — le rendu
  // l'y pose ensuite — : on ne relâche que ceux détachés depuis une seconde.
  const maintenant = Date.now()
  for (const [x, quand] of guettes) if (!x.isConnected && maintenant - quand > 1000) { guetteur.unobserve(x); guettes.delete(x) }
  guettes.set(el, maintenant)
  guetteur.observe(el)
  return el
}

/**
 * Survoler une catégorie éteint les autres.
 *
 * `groupes[i]` liste les éléments de la catégorie i ; `fonds[i]` est le pan
 * clair posé derrière elle.
 */
function focaliser(groupes, fonds, i) {
  groupes.forEach((g, k) => g.forEach((el) => el.classList.toggle('is-dim', i !== null && k !== i)))
  fonds.forEach((f, k) => f && f.classList.toggle('is-on', k === i))
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

/**
 * `largeur` : la largeur de dessin. Les pages de saisie dessinent plus large
 * pour la même hauteur : le graphique s'étire sans grandir, et laisse la
 * place aux champs qu'on y remplit.
 */
/** Dessin à plat, pour les pages de saisie : large et bas. */
export const A_PLAT = { largeur: 1180, height: 170 }

/**
 * Barres groupées avec optionnellement une ligne superposée.
 *
 * Une seule série : chaque barre porte sa valeur, comme dans la synthèse —
 * on lit le chiffre sans viser la barre. Plusieurs séries : les valeurs se
 * lisent au survol, qui éteint les autres années.
 */
export function barChart({ series, categories, height = 220, line = null, formatter = (v) => euro(v, { compact: true }), largeur = 720 }) {
  const width = largeur
  const seule = series.length === 1 && !line
  const pad = { t: seule ? 24 : 14, r: 14, b: 30, l: 58 }
  const all = series.flatMap((s) => s.values).concat(line ? line.values : [])
  let max = Math.max(0, ...all), min = Math.min(0, ...all)
  const ticks = niceTicks(min, max, 4)
  max = Math.max(max, ...ticks); min = Math.min(min, ...ticks)
  const y = scaleY(min, max, height, pad)
  const innerW = width - pad.l - pad.r
  const groupW = innerW / categories.length
  const barW = Math.min(38, (groupW * 0.66) / series.length)

  const nodes = []
  const groupes = categories.map(() => [])
  const fonds = categories.map((_, i) => svg('rect', {
    x: pad.l + groupW * i + 2, y: pad.t - 6, width: groupW - 4, height: height - pad.t - pad.b + 6, rx: 6, class: 'ch-hl',
  }))
  nodes.push(...fonds)
  for (const t of ticks) {
    nodes.push(svg('line', { x1: pad.l, x2: width - pad.r, y1: y(t), y2: y(t), stroke: t === 0 ? AXIS : GRID, 'stroke-width': 1, opacity: t === 0 ? 0.55 : 1 }))
    nodes.push(svg('text', { x: pad.l - 8, y: y(t) + 4, 'text-anchor': 'end', fill: AXIS, 'font-size': 10.5, class: 'ch-num' }, formatter(t)))
  }
  categories.forEach((cat, i) => {
    const cx = pad.l + groupW * (i + 0.5)
    nodes.push(svg('text', { x: cx, y: height - 9, 'text-anchor': 'middle', fill: AXIS, 'font-size': 11, class: 'ch-num' }, cat))
    series.forEach((s, j) => {
      const v = s.values[i] || 0
      const x = cx - (barW * series.length) / 2 + barW * j
      const top = Math.min(y(v), y(0)), hgt = Math.abs(y(v) - y(0))
      const bar = svg('rect', {
        x, y: top, width: Math.max(2, barW - 3), height: Math.max(1, hgt), rx: 3,
        fill: s.color || PALETTE[j % PALETTE.length], class: `ch-bar ${v < 0 ? 'is-neg' : ''}`,
        style: `--i:${i * series.length + j}`,
      })
      nodes.push(bar)
      groupes[i].push(bar)
      if (seule && Math.abs(v) > 0) {
        const val = svg('text', {
          x: x + (barW - 3) / 2, y: v >= 0 ? top - 7 : top + hgt + 14, 'text-anchor': 'middle',
          fill: '#0B0E10', 'font-size': 10.5, 'font-weight': 600, class: 'ch-num ch-val', style: `--i:${i}`,
        }, formatter(v))
        nodes.push(val)
        groupes[i].push(val)
      }
    })
  })

  if (line) {
    const pts = line.values.map((v, i) => `${pad.l + groupW * (i + 0.5)},${y(v)}`).join(' ')
    nodes.push(svg('polyline', {
      points: pts, fill: 'none', stroke: line.color || '#0B0E10', 'stroke-width': 2, 'stroke-dasharray': line.dashed ? '5 4' : null,
      'stroke-linejoin': 'round', class: line.dashed ? 'ch-ref' : 'ch-line', pathLength: line.dashed ? null : 1,
    }))
    line.values.forEach((v, i) => {
      const dot = svg('circle', { cx: pad.l + groupW * (i + 0.5), cy: y(v), r: 3.5, fill: '#fff', stroke: line.color || '#0B0E10', 'stroke-width': 2, class: 'ch-dot', style: `--i:${i}` })
      nodes.push(dot)
      groupes[i].push(dot)
    })
  }

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
    ], () => focaliser(groupes, fonds, i), () => focaliser(groupes, fonds, null))
    nodes.push(band)
  })
  const chart = svg('svg', { class: 'chart', viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'xMidYMid meet', role: 'img' }, ...nodes)
  return entree(h('div', {}, chart, legend([...series, ...(line ? [{ ...line, dashed: true }] : [])])),
    `bar:${series.map((x) => x.label).join('|')}:${line ? line.label : ''}:${categories.length}`)
}

/** Courbe de trésorerie ou de tout flux mensuel, avec zone sous la courbe. */
export function areaChart({ values, startDate, height = 220, color = '#1B3BFF', label = 'Trésorerie', markZero = true, threshold = null, compare = null, formatter = (v) => euro(v, { compact: true }), largeur = 720 }) {
  const width = largeur
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
    nodes.push(svg('text', { x: pad.l - 8, y: y(t) + 4, 'text-anchor': 'end', fill: AXIS, 'font-size': 10.5, class: 'ch-num' }, formatter(t)))
  }
  for (let i = 0; i < values.length; i += 6) {
    nodes.push(svg('text', { x: x(i), y: height - 8, 'text-anchor': 'middle', fill: AXIS, 'font-size': 10.5, class: 'ch-num' }, monthLabel(i, startDate)))
  }
  const id = `g${Math.random().toString(36).slice(2, 7)}`
  const line = values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  nodes.push(svg('defs', {}, svg('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 },
    svg('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': .26 }),
    svg('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': .02 }))))
  nodes.push(svg('polygon', { points: `${x(0)},${y(Math.max(min, 0))} ${line} ${x(values.length - 1)},${y(Math.max(min, 0))}`, fill: `url(#${id})`, class: 'ch-fill' }))

  // La courbe de référence : le plan tel qu'il est aujourd'hui, en pointillé.
  // C'est l'écart entre les deux traits qui dit ce que la simulation change —
  // un nombre seul, même juste, ne se ressent pas.
  if (compare && compare.values) {
    const ref = compare.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
    nodes.push(svg('polyline', {
      points: ref, fill: 'none', stroke: compare.color || AXIS,
      'stroke-width': 1.6, 'stroke-dasharray': '5 4', opacity: .75, class: 'ch-ref',
    }))
  }
  nodes.push(svg('polyline', { points: line, fill: 'none', stroke: color, 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', class: 'ch-line', pathLength: 1 }))

  // Le seuil à dépasser : un trait pointillé nommé. Annoncer une ligne sans la
  // tracer — ce que faisait le tableau de bord — ne trompe personne longtemps.
  if (threshold && Number.isFinite(threshold.value)) {
    const ty = y(threshold.value)
    nodes.push(svg('line', {
      x1: pad.l, x2: width - pad.r, y1: ty, y2: ty,
      stroke: STATUS.loss, 'stroke-width': 1.5, 'stroke-dasharray': '6 4', class: 'ch-fade',
    }))
    nodes.push(svg('text', {
      x: width - pad.r, y: ty - 6, 'text-anchor': 'end',
      fill: STATUS.loss, 'font-size': 10.5, 'font-weight': 600, class: 'ch-fade',
    }, threshold.label || ''))
  }

  // Point bas signalé : c'est le chiffre qui détermine le besoin de financement.
  const lowIndex = values.indexOf(Math.min(...values))
  // Il se lit sans survol : la valeur et le mois sont écrits à côté du point.
  if (values[lowIndex] < 0) {
    const lx = x(lowIndex), ly = y(values[lowIndex])
    const aDroite = lx < width - 190
    nodes.push(svg('circle', { cx: lx, cy: ly, r: 5, fill: STATUS.loss, stroke: SURFACE, 'stroke-width': 2, class: 'ch-dot' }))
    const dessous = ly + 20 <= height - pad.b - 2
    nodes.push(svg('text', {
      x: aDroite ? lx + 10 : lx - 10, y: dessous ? ly + 18 : ly - 12, 'text-anchor': aDroite ? 'start' : 'end',
      fill: STATUS.loss, 'font-size': 10.5, 'font-weight': 600, class: 'ch-num ch-val',
      stroke: SURFACE, 'stroke-width': 4, 'stroke-linejoin': 'round', 'paint-order': 'stroke',
    }, `Point bas ${formatter(values[lowIndex])} · ${monthLabel(lowIndex, startDate)}`))
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

  return entree(h('div', {}, svg('svg', { class: 'chart', viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'xMidYMid meet', role: 'img' }, ...nodes)),
    `area:${label}:${values.length}:${compare ? 'cmp' : ''}`)
}

/**
 * Barres empilées : structure de coûts, mix d'activités.
 *
 * Chaque colonne pousse d'un bloc depuis la base et porte son total au
 * sommet ; le survol donne le détail et éteint les autres exercices.
 */
export function stackedBar({ series, categories, height = 220, formatter = (v) => euro(v, { compact: true }), largeur = 720 }) {
  const width = largeur
  const pad = { t: 24, r: 14, b: 30, l: 58 }
  const totals = categories.map((_, i) => series.reduce((a, s) => a + Math.max(0, s.values[i] || 0), 0))
  let max = Math.max(1, ...totals)
  const ticks = niceTicks(0, max, 4); max = Math.max(max, ...ticks)
  const y = scaleY(0, max, height, pad)
  const innerW = width - pad.l - pad.r
  const groupW = innerW / categories.length
  const barW = Math.min(56, groupW * 0.55)
  const nodes = []
  const groupes = categories.map(() => [])
  const fonds = categories.map((_, i) => svg('rect', {
    x: pad.l + groupW * i + 2, y: pad.t - 6, width: groupW - 4, height: height - pad.t - pad.b + 6, rx: 6, class: 'ch-hl',
  }))
  nodes.push(...fonds)
  for (const t of ticks) {
    nodes.push(svg('line', { x1: pad.l, x2: width - pad.r, y1: y(t), y2: y(t), stroke: GRID }))
    nodes.push(svg('text', { x: pad.l - 8, y: y(t) + 4, 'text-anchor': 'end', fill: AXIS, 'font-size': 10.5, class: 'ch-num' }, formatter(t)))
  }
  categories.forEach((cat, i) => {
    const cx = pad.l + groupW * (i + 0.5)
    nodes.push(svg('text', { x: cx, y: height - 9, 'text-anchor': 'middle', fill: AXIS, 'font-size': 11, class: 'ch-num' }, cat))
    const col = svg('g', { class: 'ch-col', style: `--i:${i}` })
    let acc = 0
    series.forEach((s, j) => {
      const v = Math.max(0, s.values[i] || 0)
      if (v <= 0) return
      const top = y(acc + v), bottom = y(acc)
      // 2 px de fond entre deux segments : sans cela les aplats se confondent.
      const hgt = Math.max(1, bottom - top - 2)
      col.appendChild(svg('rect', { x: cx - barW / 2, y: top, width: barW, height: hgt, rx: 2, fill: s.color || PALETTE[j % PALETTE.length] }))
      acc += v
    })
    nodes.push(col)
    groupes[i].push(col)
    if (totals[i] > 0) {
      const val = svg('text', { x: cx, y: y(totals[i]) - 8, 'text-anchor': 'middle', fill: '#0B0E10', 'font-size': 10.5, 'font-weight': 600, class: 'ch-num ch-val', style: `--i:${i}` }, formatter(totals[i]))
      nodes.push(val)
      groupes[i].push(val)
    }
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
    ], () => focaliser(groupes, fonds, i), () => focaliser(groupes, fonds, null))
    nodes.push(band)
  })
  return entree(h('div', {}, svg('svg', { class: 'chart', viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'xMidYMid meet', role: 'img' }, ...nodes), legend(series)),
    `stack:${series.map((x) => x.label).join('|')}:${categories.length}`)
}

/**
 * Répartition en anneau.
 *
 * Le total s'écrit au centre — c'est le premier chiffre qu'on cherche — et
 * les secteurs se remplissent l'un après l'autre à l'arrivée. Survoler un
 * secteur ou sa ligne de légende éteint les autres.
 */
export function donut({ items, size = 170, formatter = (v) => euro(v, { compact: true }) }) {
  const total = items.reduce((a, i) => a + Math.max(0, i.value), 0)
  const r = size / 2, thickness = size * 0.21
  const nodes = []
  const arcs = []
  const lignes = []
  const eteindre = (k) => {
    arcs.forEach((a, j) => a.classList.toggle('is-dim', k !== null && j !== k))
    lignes.forEach((l, j) => l.classList.toggle('is-dim', k !== null && j !== k))
  }
  const visibles = items.filter((i) => i.value > 0)
  if (total <= 0) {
    nodes.push(svg('circle', { cx: r, cy: r, r: r - thickness / 2, fill: 'none', stroke: GRID, 'stroke-width': thickness }))
  } else {
    // Un arc SVG dont les extrémités coïncident ne dessine rien : lorsqu'un
    // seul secteur représente la totalité, on trace un cercle.
    const single = visibles.length === 1
    if (single) {
      const only = visibles[0]
      const colour = only.color || PALETTE[items.indexOf(only) % PALETTE.length]
      const c = svg('circle', { cx: r, cy: r, r: r - thickness / 2, fill: 'none', stroke: colour, 'stroke-width': thickness, class: 'ch-arc', pathLength: 1, transform: `rotate(-90 ${r} ${r})` })
      arcs.push(c)
      nodes.push(c)
      nodes.push(hot(
        svg('circle', { cx: r, cy: r, r: r - thickness / 2, fill: 'none', stroke: 'transparent', 'stroke-width': thickness + 14, class: 'chart-hot' }),
        only.label, () => [{ label: '100 % du total', value: formatter(only.value), color: colour }]))
    }
    let angle = -Math.PI / 2
    let rang = 0
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
      const k = rang++
      const arc = svg('path', { d, fill: 'none', stroke: colour, 'stroke-width': thickness, class: 'ch-arc', pathLength: 1, style: `--i:${k}` })
      arcs.push(arc)
      nodes.push(arc)
      // Un second tracé, transparent et plus large, sert de cible : viser un
      // arc de vingt pixels à la souris ne doit pas être un exercice d'adresse.
      nodes.push(hot(
        svg('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': thickness + 14, class: 'chart-hot' }),
        item.label,
        () => [
          { label: 'Montant', value: formatter(v), color: colour },
          { label: 'Part du total', value: `${Math.round((v / total) * 100)} %` },
        ], () => eteindre(k), () => eteindre(null)))
      angle = end
    })
    // Le total, au centre de l'anneau.
    nodes.push(svg('text', { x: r, y: r + 2, 'text-anchor': 'middle', fill: '#0B0E10', 'font-size': Math.round(size * 0.1), 'font-weight': 650, class: 'ch-num ch-val' }, formatter(total)))
    nodes.push(svg('text', { x: r, y: r + 2 + Math.round(size * 0.1), 'text-anchor': 'middle', fill: AXIS, 'font-size': Math.max(9, Math.round(size * 0.058)), class: 'ch-val' }, 'au total'))
  }
  return entree(h('div', { class: 'row ch-donut', style: { gap: '16px', flexWrap: 'wrap' } },
    svg('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, style: 'flex:none' }, ...nodes),
    h('div', { class: 'stack', style: { gap: '5px', flex: '1', minWidth: '150px' } },
      ...visibles.map((i, idx) => {
        const l = h('div', { class: 'row ch-leg', style: { gap: '7px', fontSize: '12.5px', '--i': String(idx) } },
          h('span', { class: 'swatch', style: { background: i.color || PALETTE[items.indexOf(i) % PALETTE.length] } }),
          h('span', { class: 'spacer' }, i.label),
          h('strong', { class: 'num' }, formatter(i.value)),
          h('span', { class: 'muted tiny num', style: { width: '38px', textAlign: 'right' } }, total > 0 ? `${Math.round((i.value / total) * 100)} %` : '—'),
        )
        lignes.push(l)
        l.addEventListener('mouseenter', () => eteindre(idx))
        l.addEventListener('mouseleave', () => eteindre(null))
        return l
      }),
    ),
  ), `donut:${visibles.map((x) => x.label).join('|')}`)
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
    nodes.push(svg('text', { x: pad.l - 8, y: y(t) + 4, 'text-anchor': 'end', fill: AXIS, 'font-size': 10.5, class: 'ch-num' }, formatter(t)))
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
        x: cx - barW / 2, y: top, width: barW, height: hgt, rx: 3,
        fill: colour, 'fill-opacity': b.total ? 1 : 0.86,
        class: `chart-hot ch-bar ${(b.total ? b.to < 0 : b.value < 0) ? 'is-neg' : ''}`, style: `--i:${i}`,
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
      'font-size': 11, 'font-weight': b.total ? 650 : 500, class: 'ch-num ch-val', style: `--i:${i}`,
    }, `${!b.total && b.value > 0 ? '+' : ''}${formatter(b.value)}`))

    // Trait de liaison vers la barre suivante.
    const next = bars[i + 1]
    if (next && !next.total) {
      nodes.push(svg('line', {
        x1: cx + barW / 2, x2: pad.l + slot * (i + 1.5) - barW / 2,
        y1: y(b.to), y2: y(b.to), stroke: AXIS, 'stroke-width': 1, 'stroke-dasharray': '3 3', class: 'ch-fade', style: `--i:${i}`,
      }))
    }

    for (const [k, part] of wrapLabel(b.label).entries()) {
      nodes.push(svg('text', {
        x: cx, y: height - 34 + k * 12, 'text-anchor': 'middle',
        fill: b.total ? '#0B0E10' : AXIS, 'font-size': 10, 'font-weight': b.total ? 600 : 400,
      }, part))
    }
  })

  return entree(h('div', {}, svg('svg', { class: 'chart', viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'xMidYMid meet', role: 'img' }, ...nodes)),
    `waterfall:${items.map((x) => x.label).join('|')}`)
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
  // Elle se retrace quand ses valeurs changent : c'est le signe, dans une
  // liste, que la ligne qu'on vient de modifier a bien été prise en compte.
  const signature = `spark:${color}:${values.length}:${Math.round(values.reduce((a, v) => a + (Number(v) || 0), 0))}`
  return entree(svg('svg', { class: 'spark', viewBox: `0 0 ${width} ${height}`, width, height, style: `display:block;width:${width}px;height:${height}px;flex:none` },
    svg('polyline', { points: pts, fill: 'none', stroke: color, 'stroke-width': 1.8, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', class: 'ch-line', pathLength: 1 })), signature)
}

function legend(series) {
  return h('div', { class: 'chart-legend' },
    ...series.map((s, i) => h('span', {},
      h('span', { class: 'swatch', style: { background: s.color || PALETTE[i % PALETTE.length], ...(s.dashed ? { borderRadius: '0', height: '2px' } : {}) } }),
      s.label)),
  )
}

export const YEAR_CATEGORIES = Array.from({ length: 5 }, (_, y) => yearLabel(y).replace('Année ', 'A'))
