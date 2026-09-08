/**
 * Génération d'un fichier PowerPoint (.pptx) sans bibliothèque externe.
 *
 * Un .pptx est une archive ZIP contenant du XML au format OpenXML. On construit
 * ici les quelques parties indispensables — présentation, thème, masque,
 * disposition, diapositives — puis on assemble le tout.
 *
 * Unité de mesure : l'EMU (English Metric Unit), 914 400 par pouce.
 * Format 16:9 : 12 192 000 × 6 858 000 EMU.
 */

import { createZip, xml, download } from './zip.js'
import { verdict } from '../engine/verdict.js'
import { milestones } from '../engine/milestones.js'
import { suggestActions } from '../engine/simulate.js'
import { founderIncome } from '../engine/founder.js'
import { monthLabel, num } from '../format.js'

// Le « coût d'un euro net » vaut 2,14 et non 2 : arrondi à l'unité, le chiffre
// perd ce qu'il a d'intéressant.
const formatRatioEuro = (v) => `${num(v, 2)} €`

const W = 12192000, H = 6858000
const EMU = 12700              // 1 point = 12 700 EMU
const pt = (v) => Math.round(v * EMU)

// La même palette qu'à l'écran : un document qui sort de Fizzy doit ressembler
// à Fizzy. Encre presque noire, un seul bleu de signal, et le vert / rouge /
// ambre réservés au sens — gagné, perdu, à surveiller.
const INK = '0B0E10', MUTED = '78838C', BRAND = '1B3BFF', MINT = '0A7A54', ROSE = 'C4142F', AMBER = '9A5B00', LINE = 'D8DCD8', SOFT = 'F2F3F0'

let shapeId = 1
const nextId = () => ++shapeId

/**
 * Une coordonnée OpenXML est un entier.
 *
 * Les positions se calculent en fractions de la largeur utile — 0,62 de la
 * colonne, 0,36 du reste — et une multiplication flottante produit tôt ou tard
 * 8002560.000000001, que PowerPoint refuse. On arrondit donc au seul endroit
 * où la valeur devient du XML, plutôt qu'à chaque appel.
 */
const emu = (v) => Math.round(Number(v) || 0)

/** Zone de texte. */
function textBox({ x, y, w, h, text, size = 18, bold = false, color = INK, align = 'l', anchor = 't', italic = false, lineSpacing = 100 }) {
  const paragraphs = String(text).split('\n').map((lineText) => {
    const runs = String(lineText) === '' ? '<a:endParaRPr lang="fr-FR"/>' :
      `<a:r><a:rPr lang="fr-FR" sz="${Math.round(size * 100)}" b="${bold ? 1 : 0}" i="${italic ? 1 : 0}" dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Aptos"/></a:rPr><a:t>${xml(lineText)}</a:t></a:r>`
    return `<a:p><a:pPr algn="${align}"><a:lnSpc><a:spcPct val="${lineSpacing * 1000}"/></a:lnSpc></a:pPr>${runs}</a:p>`
  }).join('')
  return `<p:sp><p:nvSpPr><p:cNvPr id="${nextId()}" name="txt"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
<p:txBody><a:bodyPr wrap="square" anchor="${anchor}" lIns="0" tIns="0" rIns="0" bIns="0"><a:normAutofit/></a:bodyPr><a:lstStyle/>${paragraphs}</p:txBody></p:sp>`
}

/** Rectangle plein ou bordé. */
function rect({ x, y, w, h, fill, line, radius = false, lineWidth = 1 }) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${nextId()}" name="rect"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>
<a:prstGeom prst="${radius ? 'roundRect' : 'rect'}"><a:avLst>${radius ? '<a:gd name="adj" fmla="val 8000"/>' : ''}</a:avLst></a:prstGeom>
${fill ? `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>` : '<a:noFill/>'}
${line ? `<a:ln w="${pt(lineWidth)}"><a:solidFill><a:srgbClr val="${line}"/></a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>'}
</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`
}

/**
 * Polyligne libre.
 *
 * Les formes prédéfinies d'OpenXML ne comptent pas la ligne brisée ; il faut
 * une géométrie personnalisée. Le chemin s'exprime dans un repère local dont
 * on déclare les dimensions, ce qui évite d'avoir à convertir soi-même.
 */
function polyline({ x, y, w, h, points, color, width = 2, close = false, fill = null }) {
  const path = points.map(([px, py], i) =>
    `<a:${i === 0 ? 'moveTo' : 'lnTo'}><a:pt x="${emu(px)}" y="${emu(py)}"/></a:${i === 0 ? 'moveTo' : 'lnTo'}>`).join('')
  return `<p:sp><p:nvSpPr><p:cNvPr id="${nextId()}" name="line"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>
<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/>
<a:pathLst><a:path w="${emu(w)}" h="${emu(h)}">${path}${close ? '<a:close/>' : ''}</a:path></a:pathLst></a:custGeom>
${fill ? `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>` : '<a:noFill/>'}
<a:ln w="${pt(width)}" cap="rnd"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:round/></a:ln>
</p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`
}

/** Diapositive complète à partir de ses formes. */
function slideXml(shapes) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
${shapes.join('\n')}
</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
}

// ────────────────────────── Composants de mise en page ─────────────────────

const M = 800000                        // marge latérale
const CONTENT_W = W - M * 2

function slideHeader(title, subtitle) {
  const shapes = [
    rect({ x: 0, y: 0, w: W, h: pt(6), fill: BRAND }),
    textBox({ x: M, y: 560000, w: CONTENT_W, h: 420000, text: title, size: 30, bold: true }),
  ]
  if (subtitle) shapes.push(textBox({ x: M, y: 1000000, w: CONTENT_W, h: 300000, text: subtitle, size: 13, color: MUTED }))
  return shapes
}

function footer(pageNo, projectName) {
  return [
    rect({ x: M, y: H - 560000, w: CONTENT_W, h: pt(0.75), fill: LINE }),
    textBox({ x: M, y: H - 470000, w: CONTENT_W / 2, h: 250000, text: projectName, size: 9, color: MUTED }),
    textBox({ x: M + CONTENT_W / 2, y: H - 470000, w: CONTENT_W / 2, h: 250000, text: String(pageNo), size: 9, color: MUTED, align: 'r' }),
  ]
}

/** Rangée de cartes d'indicateurs. */
function kpiRow(items, y, height = 1150000) {
  const gap = 200000
  const w = (CONTENT_W - gap * (items.length - 1)) / items.length
  const shapes = []
  items.forEach((item, i) => {
    const x = M + (w + gap) * i
    shapes.push(rect({ x, y, w, h: height, fill: 'FFFFFF', line: LINE, radius: true }))
    shapes.push(rect({ x, y: y + 180000, w: pt(3), h: height - 360000, fill: item.color || BRAND }))
    shapes.push(textBox({ x: x + 280000, y: y + 200000, w: w - 400000, h: 230000, text: item.label, size: 10, color: MUTED, bold: true }))
    shapes.push(textBox({ x: x + 280000, y: y + 450000, w: w - 400000, h: 400000, text: item.value, size: 21, bold: true, color: item.color || INK }))
    if (item.sub) shapes.push(textBox({ x: x + 280000, y: y + 850000, w: w - 400000, h: 220000, text: item.sub, size: 9, color: MUTED }))
  })
  return shapes
}

/** Tableau à colonnes fixes. */
function table({ x, y, w, headers, rows, colWidths, rowHeight = 300000, headerFill = SOFT }) {
  const shapes = []
  const widths = colWidths || headers.map((_, i) => (i === 0 ? w * 0.34 : (w * 0.66) / (headers.length - 1)))
  let cursorY = y

  shapes.push(rect({ x, y: cursorY, w, h: rowHeight, fill: headerFill }))
  let cx = x
  headers.forEach((head, i) => {
    shapes.push(textBox({ x: cx + 100000, y: cursorY + 80000, w: widths[i] - 200000, h: rowHeight, text: head, size: 9.5, bold: true, color: MUTED, align: i === 0 ? 'l' : 'r' }))
    cx += widths[i]
  })
  cursorY += rowHeight

  rows.forEach((row) => {
    const emphasis = row.emphasis
    if (emphasis) shapes.push(rect({ x, y: cursorY, w, h: rowHeight, fill: 'F6F3FF' }))
    shapes.push(rect({ x, y: cursorY + rowHeight, w, h: pt(0.5), fill: LINE }))
    cx = x
    row.cells.forEach((cell, i) => {
      const negative = typeof cell === 'string' && cell.trim().startsWith('-')
      shapes.push(textBox({
        x: cx + 100000, y: cursorY + 75000, w: widths[i] - 200000, h: rowHeight,
        text: cell, size: 10, bold: !!emphasis,
        color: i === 0 ? INK : negative ? ROSE : INK,
        align: i === 0 ? 'l' : 'r',
      }))
      cx += widths[i]
    })
    cursorY += rowHeight
  })
  return { shapes, height: cursorY - y }
}

/** Histogramme dessiné à partir de rectangles. */
function barChartShapes({ x, y, w, h, categories, series, formatter }) {
  const shapes = []
  const values = series.flatMap((s) => s.values)
  const max = Math.max(1, ...values, 0)
  const min = Math.min(0, ...values)
  const span = max - min || 1
  const zeroY = y + h * (max / span)
  const groupW = w / categories.length
  const barW = Math.min(groupW * 0.7 / series.length, 460000)

  // Ligne de base
  shapes.push(rect({ x, y: zeroY, w, h: pt(0.75), fill: LINE }))

  categories.forEach((cat, i) => {
    const cx = x + groupW * (i + 0.5)
    series.forEach((s, j) => {
      const v = s.values[i] || 0
      const barH = Math.abs(v) / span * h
      const bx = cx - (barW * series.length) / 2 + barW * j
      const by = v >= 0 ? zeroY - barH : zeroY
      if (barH > 1000) shapes.push(rect({ x: Math.round(bx), y: Math.round(by), w: Math.round(barW - 40000), h: Math.round(barH), fill: s.color }))
    })
    shapes.push(textBox({ x: cx - groupW / 2, y: y + h + 90000, w: groupW, h: 220000, text: cat, size: 9, color: MUTED, align: 'ctr' }))
  })

  // Légende
  let lx = x
  series.forEach((s) => {
    shapes.push(rect({ x: lx, y: y + h + 380000, w: 130000, h: 130000, fill: s.color, radius: true }))
    shapes.push(textBox({ x: lx + 200000, y: y + h + 350000, w: 2200000, h: 220000, text: s.label, size: 9, color: MUTED }))
    lx += 2500000
  })
  return shapes
}

/** Courbe de trésorerie approchée par de fines colonnes. */
function areaChartShapes({ x, y, w, h, values, color }) {
  const shapes = []
  const max = Math.max(0, ...values), min = Math.min(0, ...values)
  const span = max - min || 1
  const zeroY = y + h * (max / span)
  const step = w / values.length
  shapes.push(rect({ x, y: zeroY, w, h: pt(0.75), fill: LINE }))
  values.forEach((v, i) => {
    const barH = Math.abs(v) / span * h
    if (barH < 800) return
    shapes.push(rect({
      x: Math.round(x + step * i), y: Math.round(v >= 0 ? zeroY - barH : zeroY),
      w: Math.max(20000, Math.round(step * 0.82)), h: Math.round(barH),
      fill: v >= 0 ? color : ROSE,
    }))
  })
  return shapes
}

/**
 * Courbe de trésorerie annotée — la frise du tableau de bord, en OpenXML.
 *
 * PowerPoint ne dessine pas de polyligne dans les formes simples dont on
 * dispose ici : on approche la courbe par une suite de segments fins. À
 * soixante points sur la largeur d'une diapositive, l'œil ne voit qu'un trait.
 */
function cashStoryShapes({ x, y, w, h, values, events, startDate, topLimit = 0, bottomLimit = H }) {
  const shapes = []
  const max = Math.max(0, ...values), min = Math.min(0, ...values)
  const span = max - min || 1
  const px = (m) => x + (w * m) / Math.max(1, values.length - 1)
  const py = (v) => y + h * (1 - (v - min) / span)
  const zeroY = py(0)

  // Trame : une graduation par exercice.
  for (let yr = 0; yr <= 5; yr++) {
    shapes.push(rect({ x: Math.round(px(yr * 12)), y, w: pt(0.75), h, fill: LINE }))
    if (yr < 5) {
      shapes.push(textBox({ x: Math.round(px(yr * 12)) + 40000, y: y + h + 40000, w: 700000, h: 200000,
        text: `A${yr + 1}`, size: 9, color: MUTED }))
    }
  }
  shapes.push(rect({ x, y: Math.round(zeroY), w, h: pt(1), fill: INK }))
  shapes.push(textBox({ x: x - 700000, y: Math.round(zeroY) - 100000, w: 620000, h: 220000, text: '0', size: 9, color: MUTED, align: 'r' }))

  // Deux bornes suffisent à donner l'échelle, mais elles ne valent que si on
  // les lit : une borne à moins d'une hauteur de ligne du zéro s'y superpose,
  // et vaut mieux ne pas être écrite.
  const clearOfZero = 240000
  if (Math.abs(py(max) - zeroY) > clearOfZero) {
    shapes.push(textBox({ x: x - 700000, y: Math.round(py(max)) - 100000, w: 620000, h: 220000,
      text: formatCompact(max), size: 9, color: MUTED, align: 'r' }))
  }
  if (min < 0 && Math.abs(py(min) - zeroY) > clearOfZero) {
    shapes.push(textBox({ x: x - 700000, y: Math.round(py(min)) - 100000, w: 620000, h: 220000,
      text: formatCompact(min), size: 9, color: ROSE, align: 'r' }))
  }

  // La courbe : une seule polyligne, dans un repère local à la zone de dessin.
  // La partie négative est retracée par-dessus, en rouge, pour qu'un passage
  // sous zéro se voie sans avoir à lire l'axe.
  const local = (m) => [px(m) - x, py(values[m]) - y]
  shapes.push(polyline({ x, y, w, h, points: values.map((_, m) => local(m)), color: BRAND, width: 2.25 }))

  let run = []
  const flushNegative = () => {
    if (run.length > 1) shapes.push(polyline({ x, y, w, h, points: run, color: ROSE, width: 2.75 }))
    run = []
  }
  values.forEach((v, m) => {
    if (v < 0) run.push(local(m))
    else flushNegative()
  })
  flushNegative()

  // Repères : trait, pastille, titre, légende.
  //
  // Quatre couloirs — deux au-dessus du dessin, deux en dessous — bornés par
  // ce qui occupe déjà la diapositive : le titre en haut, le pavé de
  // conclusion en bas. On vérifie l'emprise réelle de chaque étiquette avant
  // de la poser ; un repère qui ne trouve pas sa place est abandonné plutôt
  // que superposé, comme à l'écran.
  const kindColor = { danger: ROSE, low: AMBER, win: MINT, break: BRAND, money: BRAND, hire: MUTED }
  const LANE_STEP = 470000
  const BLOCK_H = 450000
  const labelW = 3000000

  // Les couloirs se déduisent de la place réellement libre au-dessus et en
  // dessous du dessin, plutôt que de décalages fixes : ainsi la frise s'adapte
  // au reste de la diapositive au lieu d'écrire par-dessus.
  const lanes = []
  for (let top = y - 210000 - BLOCK_H; top >= topLimit; top -= LANE_STEP) lanes.push(top)
  for (let top = y + h + 330000; top + BLOCK_H <= bottomLimit; top += LANE_STEP) lanes.push(top)
  // Alterner haut et bas : deux repères voisins se séparent mieux ainsi.
  lanes.sort((a, b) => Math.abs(a - y) - Math.abs(b - y))
  const occupancy = lanes.map(() => [])

  for (const e of events) {
    const cx = Math.round(px(e.month))
    const wanted = cx - labelW / 2
    const boxX = Math.min(Math.max(wanted, M), W - M - labelW)

    const laneIndex = occupancy.findIndex((taken) =>
      taken.every((t) => boxX + labelW + 120000 < t || boxX > t + labelW + 120000))
    if (laneIndex === -1) continue
    occupancy[laneIndex].push(boxX)

    const labelY = lanes[laneIndex]
    const cy = Math.round(py(values[e.month] ?? 0))
    const color = kindColor[e.kind] || MUTED
    // L'étiquette s'aligne du côté du repère quand le cadre l'a fait glisser.
    const align = boxX > wanted ? 'l' : boxX < wanted ? 'r' : 'ctr'

    const anchorY = labelY < y ? labelY + BLOCK_H : labelY
    shapes.push(rect({ x: cx, y: Math.min(cy, anchorY), w: pt(1), h: Math.abs(cy - anchorY), fill: color }))
    shapes.push(rect({ x: cx - 50000, y: cy - 50000, w: 100000, h: 100000, fill: color }))
    shapes.push(textBox({ x: boxX, y: labelY, w: labelW, h: 230000, text: e.short || e.label, size: 11, bold: true, align }))
    shapes.push(textBox({ x: boxX, y: labelY + 240000, w: labelW, h: 210000,
      text: `${monthLabel(e.month, startDate).toUpperCase()} \u00B7 ${e.shortDetail || e.detail}`,
      size: 8, color: MUTED, align }))
  }

  return shapes
}

// ─────────────────────────────── Diapositives ──────────────────────────────

export function buildDeck(scenario, result, profile) {
  const slides = []
  const meta = scenario.meta
  const p = result.pnl, k = result.kpis
  const name = meta.name || 'Business plan'
  const company = meta.company || name
  const bestYear = p.netResult.findIndex((v) => v > 0)
  const refYear = bestYear >= 0 ? bestYear : 2
  const YEARS = ['Année 1', 'Année 2', 'Année 3', 'Année 4', 'Année 5']
  const eur = (v) => formatEuro(v)
  const eurC = (v) => formatCompact(v)

  // 1 — Couverture
  slides.push(slideXml([
    rect({ x: 0, y: 0, w: W, h: H, fill: '0A0F1C' }),
    rect({ x: 0, y: 0, w: pt(10), h: H, fill: BRAND }),
    textBox({ x: M, y: 2200000, w: CONTENT_W, h: 400000, text: 'BUSINESS PLAN', size: 12, bold: true, color: '8168F4' }),
    textBox({ x: M, y: 2650000, w: CONTENT_W, h: 900000, text: company, size: 44, bold: true, color: 'FFFFFF' }),
    textBox({ x: M, y: 3700000, w: CONTENT_W, h: 400000, text: meta.sector || 'Prévisionnel financier sur cinq exercices', size: 15, color: 'AEB9C9' }),
    rect({ x: M, y: 4350000, w: 1200000, h: pt(2.5), fill: BRAND }),
    textBox({ x: M, y: 4700000, w: CONTENT_W, h: 400000,
      text: [profile?.name, new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })].filter(Boolean).join(' · '),
      size: 11, color: '8290A6' }),
  ]))

  // 2 — Le verdict
  //
  // Un business plan qui s'ouvre sur un tableau demande au lecteur de faire le
  // travail. Celui-ci s'ouvre sur la conclusion, et le reste l'étaye.
  const health = verdict(result, scenario)
  const toneColor = { good: MINT, watch: AMBER, bad: ROSE, neutral: MUTED }[health.tone] || BRAND
  slides.push(slideXml([
    rect({ x: 0, y: 0, w: W, h: H, fill: INK }),
    rect({ x: 0, y: 0, w: W, h: pt(6), fill: toneColor }),
    textBox({ x: M, y: 900000, w: CONTENT_W, h: 300000, text: 'CE QUE DIT LE MODÈLE', size: 11, bold: true, color: '8E99A2' }),
    textBox({ x: M, y: 1350000, w: CONTENT_W, h: 1000000, text: health.word.toUpperCase(), size: 54, bold: true, color: toneColor }),
    textBox({ x: M, y: 2500000, w: CONTENT_W * 0.62, h: 800000, text: health.line, size: 24, bold: true, color: 'FFFFFF', lineSpacing: 108 }),
    textBox({ x: M, y: 3450000, w: CONTENT_W * 0.62, h: 1400000, text: health.body, size: 13, color: 'AEB9C9', lineSpacing: 128 }),
    rect({ x: M + CONTENT_W * 0.68, y: 2500000, w: CONTENT_W * 0.32, h: 1500000, fill: '15191C', line: '2C3238' }),
    rect({ x: M + CONTENT_W * 0.68, y: 2500000, w: CONTENT_W * 0.32, h: pt(3), fill: toneColor }),
    textBox({ x: M + CONTENT_W * 0.68 + 300000, y: 2800000, w: CONTENT_W * 0.32 - 600000, h: 400000,
      text: health.figure.label.toUpperCase(), size: 10, bold: true, color: '8E99A2' }),
    textBox({ x: M + CONTENT_W * 0.68 + 300000, y: 3250000, w: CONTENT_W * 0.32 - 600000, h: 600000,
      text: health.figure.value, size: 30, bold: true, color: 'FFFFFF' }),
    ...footer(slides.length + 1, name),
  ]))

  // 3 — Chiffres clés
  slides.push(slideXml([
    ...slideHeader('Les chiffres clés', `Exercice de référence : ${YEARS[refYear].toLowerCase()}`),
    ...kpiRow([
      { label: "CHIFFRE D'AFFAIRES", value: eurC(p.revenue[refYear]), sub: YEARS[refYear] },
      { label: 'EBITDA', value: eurC(p.ebitda[refYear]), sub: `${formatPct(k.ebitdaMargin[refYear])} du CA`, color: p.ebitda[refYear] >= 0 ? MINT : ROSE },
      { label: 'RÉSULTAT NET', value: eurC(p.netResult[refYear]), sub: `${formatPct(k.netMargin[refYear])} du CA`, color: p.netResult[refYear] >= 0 ? MINT : ROSE },
      { label: 'POINT MORT', value: k.breakEven[refYear] ? eurC(k.breakEven[refYear]) : '—', sub: k.breakEven[refYear] && p.revenue[refYear] >= k.breakEven[refYear] ? 'Atteint' : 'Non atteint', color: AMBER },
    ], 1650000),
    ...kpiRow([
      { label: 'BESOIN DE FINANCEMENT', value: k.fundingNeed > 0 ? eurC(k.fundingNeed) : 'Aucun', sub: k.fundingNeed > 0 ? 'Au point bas de trésorerie' : 'Trésorerie toujours positive', color: k.fundingNeed > 0 ? AMBER : MINT },
      { label: 'PREMIER EXERCICE RENTABLE', value: bestYear >= 0 ? YEARS[bestYear] : 'Au-delà de 5 ans', sub: 'Résultat net positif' },
      { label: 'EFFECTIF FIN ANNÉE 5', value: `${Math.round(result.payroll.headcount[59])}`, sub: 'Personnes employées' },
      { label: "CA CUMULÉ 5 ANS", value: eurC(p.revenue.reduce((a, b) => a + b, 0)), sub: 'Tous exercices confondus', color: BRAND },
    ], 3050000),
    ...footer(slides.length + 1, name),
  ]))

  // 3 — Trajectoire
  slides.push(slideXml([
    ...slideHeader('Trajectoire financière', "Chiffre d'affaires, EBITDA et résultat net sur cinq exercices"),
    ...barChartShapes({
      x: M, y: 1600000, w: CONTENT_W, h: 2900000, categories: YEARS.map((y) => y.replace('Année ', 'A')),
      series: [
        { label: "Chiffre d'affaires", values: p.revenue, color: BRAND },
        { label: 'EBITDA', values: p.ebitda, color: MINT },
        { label: 'Résultat net', values: p.netResult, color: AMBER },
      ],
    }),
    ...footer(slides.length + 1, name),
  ]))

  // 4 — Compte de résultat
  const pnlTable = table({
    x: M, y: 1500000, w: CONTENT_W,
    headers: ['Compte de résultat', ...YEARS],
    rows: [
      { cells: ["Chiffre d'affaires", ...p.revenue.map(eur)], emphasis: true },
      { cells: ['Achats et charges variables', ...p.variableCost.map((v) => eur(-v))] },
      { cells: ['Marge brute', ...p.grossMargin.map(eur)], emphasis: true },
      { cells: ['Charges externes', ...p.external.map((v) => eur(-v))] },
      { cells: ['Charges de personnel', ...p.payroll.map((v) => eur(-v))] },
      { cells: ['Impôts et taxes', ...p.duties.map((v) => eur(-v))] },
      { cells: ['EBITDA', ...p.ebitda.map(eur)], emphasis: true },
      { cells: ['Amortissements', ...p.amortisation.map((v) => eur(-v))] },
      { cells: ["Résultat d'exploitation", ...p.ebit.map(eur)] },
      ...(p.credits.some((v) => v) ? [{ cells: ["Crédits d'impôt", ...p.credits.map(eur)] }] : []),
      { cells: ['Impôt sur les sociétés', ...p.corporateTax.map((v) => eur(-v))] },
      { cells: ['Résultat net', ...p.netResult.map(eur)], emphasis: true },
    ],
    rowHeight: 285000,
  })
  slides.push(slideXml([
    ...slideHeader('Compte de résultat prévisionnel', 'Montants en euros hors taxes'),
    ...pnlTable.shapes,
    ...footer(slides.length + 1, name),
  ]))

  // 5 — Trésorerie, annotée
  //
  // Une courbe nue oblige le lecteur à deviner ce qui s'y passe. Les mêmes
  // repères qu'à l'écran sont posés dessus : l'embauche, le point bas, le mois
  // où l'exploitation s'autofinance, le premier exercice bénéficiaire.
  slides.push(slideXml([
    ...slideHeader('Les cinq ans qui viennent', 'Trésorerie de fin de mois et moments qui comptent'),
    ...cashStoryShapes({
      x: M + 700000, y: 2620000, w: CONTENT_W - 700000, h: 1280000,
      values: result.cash.balance, startDate: result.startDate,
      events: milestones(result, scenario, { max: 4 }),
      topLimit: 1350000, bottomLimit: 5200000,
    }),
    rect({ x: M, y: 5340000, w: CONTENT_W, h: 780000, fill: k.fundingNeed > 0 ? 'FBEBD2' : 'D8F0E5' }),
    rect({ x: M, y: 5340000, w: pt(3), h: 780000, fill: k.fundingNeed > 0 ? AMBER : MINT }),
    textBox({
      x: M + 300000, y: 5490000, w: CONTENT_W - 600000, h: 560000,
      text: k.fundingNeed > 0
        ? `Besoin de financement : ${eur(k.fundingNeed)}\nLe solde atteint son point bas en ${monthLabel(k.cashLow.month, result.startDate)}. Ce montant doit être couvert avant cette échéance.`
        : `Trésorerie couverte sur tout l'horizon\nLe solde reste positif, au plus bas à ${eur(k.cashLow.value)} en ${monthLabel(k.cashLow.month, result.startDate)}.`,
      size: 11.5, color: k.fundingNeed > 0 ? AMBER : MINT, bold: false, lineSpacing: 130,
    }),
    ...footer(slides.length + 1, name),
  ]))

  // 6 — Point mort
  const beTable = table({
    x: M, y: 1550000, w: CONTENT_W,
    headers: ['Point mort', ...YEARS],
    rows: [
      { cells: ['Charges fixes', ...k.fixedCosts.map(eur)] },
      { cells: ['Taux de marge sur coûts variables', ...k.marginRate.map((v) => formatPct(v))] },
      { cells: ['Point mort', ...k.breakEven.map((v) => (v ? eur(v) : '—'))], emphasis: true },
      { cells: ["Chiffre d'affaires prévu", ...p.revenue.map(eur)] },
      { cells: ['Taux de couverture', ...p.revenue.map((v, i) => (k.breakEven[i] ? formatPct(v / k.breakEven[i]) : '—'))], emphasis: true },
    ],
    rowHeight: 300000,
  })
  slides.push(slideXml([
    ...slideHeader('Seuil de rentabilité', "Le chiffre d'affaires à partir duquel l'activité couvre ses charges"),
    ...beTable.shapes,
    rect({ x: M, y: 3600000, w: CONTENT_W, h: 1100000, fill: SOFT, radius: true }),
    textBox({
      x: M + 300000, y: 3780000, w: CONTENT_W - 600000, h: 800000,
      text: k.breakEven[refYear]
        ? `Avec un taux de marge de ${formatPct(k.marginRate[refYear])}, chaque euro vendu dégage ${formatEuro(k.marginRate[refYear] * 1)} pour couvrir des charges fixes de ${eur(k.fixedCosts[refYear])}.\nIl faut donc réaliser ${eur(k.breakEven[refYear])} de chiffre d'affaires en ${YEARS[refYear].toLowerCase()} pour atteindre l'équilibre.`
        : "Le point mort n'est pas calculable : la marge sur coûts variables est nulle ou négative.",
      size: 11.5, color: MUTED, lineSpacing: 135,
    }),
    ...footer(slides.length + 1, name),
  ]))

  // 7 — Équipe
  if (scenario.team.length > 0) {
    const teamRows = scenario.team.slice(0, 9).map((m) => ({
      cells: [
        m.role || 'Poste',
        contractLabel(m.contractType),
        `M${(Number(m.startMonth) || 0) + 1}`,
        String(Number(m.count) || 1),
        formatEuro(Number(m.monthlyGross) || 0),
      ],
    }))
    const teamTable = table({
      x: M, y: 1550000, w: CONTENT_W,
      headers: ['Poste', 'Contrat', 'Arrivée', 'Nb', 'Brut mensuel'],
      colWidths: [CONTENT_W * 0.34, CONTENT_W * 0.18, CONTENT_W * 0.14, CONTENT_W * 0.12, CONTENT_W * 0.22],
      rows: teamRows, rowHeight: 300000,
    })
    slides.push(slideXml([
      ...slideHeader('Équipe et masse salariale', `${Math.round(result.payroll.headcount[11])} personnes en fin d'année 1, ${Math.round(result.payroll.headcount[59])} en fin d'année 5`),
      ...teamTable.shapes,
      ...(() => {
        const y = 1550000 + teamTable.height + 400000
        const t = table({
          x: M, y, w: CONTENT_W,
          headers: ['Masse salariale', ...YEARS],
          rows: [
            { cells: ['Salaires bruts', ...yearly(result.payroll.gross).map(eur)] },
            { cells: ['Cotisations patronales', ...yearly(result.payroll.employerCharges).map(eur)] },
            { cells: ['Coût total employeur', ...yearly(result.payroll.cost).map(eur)], emphasis: true },
          ],
          rowHeight: 285000,
        })
        return t.shapes
      })(),
      ...footer(slides.length + 1, name),
    ]))
  }

  // 8 — Acquisition client
  if (result.revenue.campaigns.length > 0) {
    const rows = result.revenue.campaigns.map((c) => ({
      cells: [c.name, formatEuro(c.totalSpend), String(Math.round(c.totalClients)), c.cac ? formatEuro(c.cac) : '—'],
    }))
    const t = table({
      x: M, y: 1550000, w: CONTENT_W,
      headers: ['Campagne', 'Budget 5 ans', 'Clients acquis', 'CAC'],
      colWidths: [CONTENT_W * 0.4, CONTENT_W * 0.2, CONTENT_W * 0.2, CONTENT_W * 0.2],
      rows, rowHeight: 300000,
    })
    slides.push(slideXml([
      ...slideHeader('Acquisition client', "Comment le budget marketing se transforme en chiffre d'affaires"),
      ...t.shapes,
      ...kpiRow([
        { label: 'CAC MOYEN', value: k.cac ? formatEuro(k.cac) : '—', sub: "Coût d'acquisition d'un client" },
        { label: 'VALEUR CLIENT', value: k.ltv ? formatEuro(k.ltv) : '—', sub: 'Marge dégagée par client' },
        { label: 'RATIO LTV / CAC', value: k.ltvCacRatio ? `${k.ltvCacRatio.toFixed(1)}×` : '—', sub: k.ltvCacRatio >= 3 ? 'Acquisition rentable' : 'À surveiller', color: k.ltvCacRatio >= 3 ? MINT : AMBER },
      ], 1550000 + t.height + 400000, 1050000),
      ...footer(slides.length + 1, name),
    ]))
  }

  // 9 — Financement
  const totalRaised = ['equityFounders', 'equityInvestors', 'loans', 'grants', 'advances', 'shareholderLoans']
    .reduce((a, key) => a + (scenario.financing[key] || []).reduce((x, i) => x + (Number(i.amount) || 0), 0), 0)
  const finRows = []
  const addFin = (label, items) => {
    const total = (items || []).reduce((a, i) => a + (Number(i.amount) || 0), 0)
    if (total > 0) finRows.push({ cells: [label, formatEuro(total)] })
  }
  addFin('Apports des fondateurs', scenario.financing.equityFounders)
  addFin('Levée de fonds', scenario.financing.equityInvestors)
  addFin('Emprunts bancaires', scenario.financing.loans)
  addFin('Subventions', scenario.financing.grants)
  addFin('Avances remboursables', scenario.financing.advances)
  finRows.push({ cells: ['Total des financements', formatEuro(totalRaised)], emphasis: true })
  const finTable = table({
    x: M, y: 1550000, w: CONTENT_W * 0.52,
    headers: ['Source de financement', 'Montant'],
    colWidths: [CONTENT_W * 0.52 * 0.62, CONTENT_W * 0.52 * 0.38],
    rows: finRows, rowHeight: 300000,
  })
  slides.push(slideXml([
    ...slideHeader('Plan de financement', 'Ressources mobilisées et besoin résiduel'),
    ...finTable.shapes,
    rect({ x: M + CONTENT_W * 0.57, y: 1550000, w: CONTENT_W * 0.43, h: 1900000, fill: k.fundingNeed > 0 ? 'FBEBD2' : 'D8F0E5', radius: true }),
    textBox({ x: M + CONTENT_W * 0.57 + 300000, y: 1780000, w: CONTENT_W * 0.43 - 600000, h: 300000, text: k.fundingNeed > 0 ? 'BESOIN COMPLÉMENTAIRE' : 'FINANCEMENT SUFFISANT', size: 10, bold: true, color: k.fundingNeed > 0 ? AMBER : MINT }),
    textBox({ x: M + CONTENT_W * 0.57 + 300000, y: 2120000, w: CONTENT_W * 0.43 - 600000, h: 500000, text: k.fundingNeed > 0 ? eurC(k.fundingNeed) : eurC(k.cashLow.value), size: 28, bold: true, color: k.fundingNeed > 0 ? AMBER : MINT }),
    textBox({ x: M + CONTENT_W * 0.57 + 300000, y: 2750000, w: CONTENT_W * 0.43 - 600000, h: 600000, text: k.fundingNeed > 0 ? `à réunir avant le mois ${k.cashLow.month + 1}, point bas de la trésorerie` : 'de trésorerie au point le plus bas', size: 10.5, color: MUTED, lineSpacing: 130 }),
    ...footer(slides.length + 1, name),
  ]))

  // 11 — Ce qui changerait le plus
  //
  // La diapositive qui distingue un prévisionnel d'un tableur : chaque action
  // a été appliquée à une copie du scénario, le modèle rejoué, l'écart mesuré.
  // Un lecteur qui veut savoir « et si ? » a la réponse chiffrée sous les yeux.
  const suggestions = suggestActions(scenario, result, { limit: 3 })
  if (suggestions.best.length) {
    const cardH = 1180000
    const cards = suggestions.best.flatMap((a, i) => {
      const y = 1700000 + i * (cardH + 220000)
      const gains = [
        a.delta.ebitda ? { label: 'EBITDA', value: eur(a.delta.ebitda), good: a.delta.ebitda > 0 } : null,
        a.delta.fundingNeed ? { label: 'FINANCEMENT', value: eur(a.delta.fundingNeed), good: a.delta.fundingNeed < 0 } : null,
        a.delta.breakEven ? { label: 'POINT MORT', value: eur(a.delta.breakEven), good: a.delta.breakEven < 0 } : null,
      ].filter(Boolean).slice(0, 3)
      return [
        rect({ x: M, y, w: CONTENT_W, h: cardH, fill: 'FFFFFF', line: LINE }),
        rect({ x: M, y, w: 420000, h: cardH, fill: INK }),
        textBox({ x: M, y: y + cardH / 2 - 180000, w: 420000, h: 360000, text: String(i + 1), size: 22, bold: true, color: 'FFFFFF', align: 'ctr' }),
        textBox({ x: M + 600000, y: y + 190000, w: CONTENT_W * 0.5, h: 340000, text: a.label, size: 16, bold: true }),
        textBox({ x: M + 600000, y: y + 560000, w: CONTENT_W * 0.5, h: 280000, text: a.detail || '', size: 10.5, color: BRAND }),
        textBox({ x: M + 600000, y: y + 830000, w: CONTENT_W * 0.5, h: 280000, text: a.rationale, size: 10.5, color: MUTED }),
        ...gains.flatMap((g, j) => {
          const gx = M + CONTENT_W * 0.62 + j * (CONTENT_W * 0.38 / 3)
          return [
            textBox({ x: gx, y: y + 330000, w: CONTENT_W * 0.38 / 3 - 100000, h: 240000, text: g.label, size: 8.5, bold: true, color: MUTED }),
            textBox({ x: gx, y: y + 590000, w: CONTENT_W * 0.38 / 3 - 100000, h: 340000, text: g.value, size: 15, bold: true, color: g.good ? MINT : ROSE }),
          ]
        }),
      ]
    })
    slides.push(slideXml([
      ...slideHeader('Ce qui changerait le plus', suggestions.shortOfCash
        ? 'Classé par ce que cela libère en trésorerie'
        : "Classé par ce que cela ajoute à l'EBITDA"),
      ...cards,
      textBox({ x: M, y: 5750000, w: CONTENT_W, h: 300000,
        text: `Chaque estimation rejoue le modèle entier avec la modification, sur l'exercice de référence (${YEARS[suggestions.year].toLowerCase()}).`,
        size: 9.5, color: MUTED }),
      ...footer(slides.length + 1, name),
    ]))
  }

  // 12 — Ce que touche le dirigeant
  //
  // Le chiffre que les prévisionnels n'affichent jamais, et la première
  // question que pose celui qui se lance.
  let income = null
  try { income = founderIncome(scenario, result) } catch { /* pas de dirigeant modélisé */ }
  const incomeRow = income?.rows?.[refYear]
  if (incomeRow && (incomeRow.employerCost > 0 || incomeRow.grossDividends > 0)) {
    // La cascade complète, comme à l'écran : chaque marche est un prélèvement
    // nommé. Trois lignes suffiraient à donner le résultat, mais c'est le
    // chemin qui explique pourquoi l'écart est si grand.
    const steps = [
      { label: "EBITDA de l'entreprise", value: p.ebitda[refYear], kind: 'start' },
      // Votre rémunération est déjà déduite au-dessus : la rappeler en gris
      // évite de croire, trois lignes plus bas, qu'elle sort du résultat net.
      ...(incomeRow.employerCost > 0 ? [{ label: 'dont votre rémunération chargée', value: -incomeRow.employerCost, kind: 'info',
        note: `${eur(incomeRow.gross)} de brut et ${eur(incomeRow.employerCost - incomeRow.gross)} de cotisations patronales` }] : []),
      { label: 'Amortissements et frais financiers', value: -(p.amortisation[refYear] + p.interest[refYear]), kind: 'cost' },
      ...(p.credits[refYear] > 0 ? [{ label: "Crédits d'impôt", value: p.credits[refYear], kind: 'gain' }] : []),
      { label: 'Impôt sur les sociétés', value: -p.corporateTax[refYear], kind: 'cost' },
      { label: "Résultat net de l'entreprise", value: p.netResult[refYear], kind: 'sub' },
      ...(incomeRow.distributed > 0 ? [{ label: `Distribué aux associés (${formatPct(income.settings.payout)})`, value: -incomeRow.distributed, kind: 'info',
        note: incomeRow.retained > 0 ? `${eur(incomeRow.retained)} restent en réserves dans l'entreprise` : "rien n'est mis en réserve" }] : []),
      ...(incomeRow.grossDividends > 0 ? [{ label: 'Vos dividendes bruts', value: incomeRow.grossDividends, kind: 'start' }] : []),
      ...(incomeRow.dividendSocial > 0 ? [{ label: incomeRow.tnsPortion > 0 ? 'Prélèvements sociaux et cotisations TNS' : 'Prélèvements sociaux sur dividendes (17,2 %)', value: -incomeRow.dividendSocial, kind: 'cost' }] : []),
      ...(incomeRow.dividendIncomeTax > 0 ? [{ label: 'Impôt forfaitaire sur dividendes (12,8 %)', value: -incomeRow.dividendIncomeTax, kind: 'cost' }] : []),
      ...(incomeRow.gross > 0 ? [{ label: 'Votre salaire net', value: incomeRow.netBeforeTax, kind: 'gain' }] : []),
      { label: "Impôt sur le revenu", value: -incomeRow.incomeTax, kind: 'cost',
        note: `Barème progressif, tranche marginale ${formatPct(incomeRow.marginalRate)}` },
    ].filter((st) => st.kind !== 'cost' || Math.abs(st.value) >= 1)

    // La hauteur des marches s'adapte à leur nombre : la cascade occupe la
    // même bande utile qu'elle en compte huit ou onze.
    const flowTop = 1620000
    const flowBottom = 5480000
    const rowH = Math.min(430000, Math.floor((flowBottom - flowTop - 560000) / steps.length))
    const colW = CONTENT_W * 0.58

    slides.push(slideXml([
      ...slideHeader('Ce que touche le dirigeant', `Le chemin de l'argent, jusqu'à votre compte — ${YEARS[refYear].toLowerCase()}`),
      ...steps.flatMap((st, i) => {
        const y = flowTop + i * rowH
        const strong = st.kind === 'start' || st.kind === 'sub'
        return [
          rect({ x: M, y, w: colW, h: rowH - 6000, fill: strong ? SOFT : 'FFFFFF', line: LINE }),
          textBox({ x: M + (st.kind === 'info' ? 420000 : 220000), y: y + (st.note ? 60000 : rowH / 2 - 110000), w: colW * 0.6, h: 240000,
            text: st.label, size: st.kind === 'info' ? 10.5 : 11.5, bold: strong, color: st.kind === 'info' ? MUTED : INK }),
          ...(st.note ? [textBox({ x: M + (st.kind === 'info' ? 420000 : 220000), y: y + 260000, w: colW * 0.62, h: 190000, text: st.note, size: 8, color: MUTED })] : []),
          textBox({ x: M + colW - 2300000, y: y + rowH / 2 - 130000, w: 2100000, h: 260000,
            text: eur(st.value), size: st.kind === 'info' ? 11 : 12.5, bold: st.kind !== 'info', align: 'r',
            color: st.kind === 'info' ? MUTED : st.value < 0 ? ROSE : st.kind === 'gain' ? MINT : INK }),
        ]
      }),
      rect({ x: M, y: flowTop + steps.length * rowH + 80000, w: colW, h: 480000, fill: INK }),
      textBox({ x: M + 220000, y: flowTop + steps.length * rowH + 200000, w: colW * 0.6, h: 260000,
        text: 'Sur votre compte', size: 13, bold: true, color: 'FFFFFF' }),
      textBox({ x: M + colW - 2300000, y: flowTop + steps.length * rowH + 180000, w: 2100000, h: 300000,
        text: eur(incomeRow.disposable), size: 17, bold: true, align: 'r', color: 'FFFFFF' }),

      rect({ x: M + CONTENT_W * 0.64, y: flowTop, w: CONTENT_W * 0.36, h: 2200000, fill: 'FFFFFF', line: LINE }),
      rect({ x: M + CONTENT_W * 0.64, y: flowTop, w: CONTENT_W * 0.36, h: pt(3), fill: MINT }),
      textBox({ x: M + CONTENT_W * 0.64 + 300000, y: flowTop + 300000, w: CONTENT_W * 0.36 - 600000, h: 300000,
        text: 'PAR MOIS, NET DE TOUT', size: 10, bold: true, color: MUTED }),
      textBox({ x: M + CONTENT_W * 0.64 + 300000, y: flowTop + 650000, w: CONTENT_W * 0.36 - 600000, h: 600000,
        text: eur(incomeRow.monthly), size: 32, bold: true, color: MINT }),
      textBox({ x: M + CONTENT_W * 0.64 + 300000, y: flowTop + 1330000, w: CONTENT_W * 0.36 - 600000, h: 700000,
        text: incomeRow.costPerEuro > 0
          ? `L'entreprise produit ${formatRatioEuro(incomeRow.costPerEuro)} de valeur pour chaque euro qui arrive chez vous.`
          : '',
        size: 10.5, color: MUTED, lineSpacing: 130 }),
      textBox({ x: M + CONTENT_W * 0.64, y: flowTop + 2400000, w: CONTENT_W * 0.36, h: 1600000,
        text: income.settings.liberalBnc
          ? "Bénéfices non commerciaux : l'abattement de 10 % des salaires ne s'applique pas ; les frais réels sont déjà déduits du bénéfice imposable. En exercice libéral classique, le bénéfice du cabinet est imposé directement à votre nom."
          : "Barème progressif avec quotient familial et plafonnement. Ne sont pas modélisés : la CSG déductible en cas d'option pour le barème, les réductions et crédits d'impôt personnels, ni la contribution exceptionnelle sur les hauts revenus.",
        size: 9.5, color: MUTED, lineSpacing: 140 }),
      ...footer(slides.length + 1, name),
    ]))
  }

  // 13 — Hypothèses
  const assumptions = []
  scenario.activities.forEach((a) => {
    const bits = []
    if (Number(a.unitPrice) > 0) bits.push(`${formatEuro(a.unitPrice)} l'unité`)
    if (Number(a.recurringPrice) > 0) bits.push(`${formatEuro(a.recurringPrice)}/mois sur ${a.contractMonths} mois`)
    if (Number(a.unitPrice) > 0) bits.push(`coût de revient ${formatEuro(a.unitCost)}`)
    if (Number(a.paymentLag) > 0) bits.push(`paiement à ${Number(a.paymentLag) * 30} jours`)
    assumptions.push({ cells: [a.name, bits.join(' · ')] })
  })
  // Le régime de TVA se lit dans le scénario, jamais supposé : écrire « TVA
  // 20 % » sur le prévisionnel d'un cabinet dentaire — exonéré — serait faux
  // dans un document destiné à un banquier.
  const vatLine = meta.vatExempt
    ? 'activité exonérée de TVA (TVA sur achats non récupérable)'
    : (() => {
        const rates = [...new Set((scenario.activities || [])
          .map((a) => Number(a.vatRateSales))
          .filter((v) => Number.isFinite(v) && v > 0))].sort((x, z) => z - x)
        if (!rates.length) return 'hors champ de la TVA'
        // « TVA 20 % » plutôt que « TVA 20,0 % » : la décimale ne dit rien.
        return `TVA ${rates.map((v) => formatPct(v).replace(',0', '')).join(' et ')}`
      })()
  assumptions.push({ cells: ['Fiscalité appliquée', `France ${new Date(meta.startDate).getFullYear()} — IS 15 % jusqu'à 42 500 € puis 25 %, ${vatLine}`] })
  assumptions.push({ cells: ['Cotisations patronales', 'Taux moyens avec réduction générale dégressive jusqu\'à 3 SMIC'] })
  // Le modèle impose l'association comme une société : hypothèse prudente, mais
  // qui doit être dite plutôt que subie par le lecteur.
  if (meta.nonProfit) {
    assumptions.push({ cells: ['Régime associatif', "Le prévisionnel applique l'impôt sur les sociétés de droit commun. Une association dont la gestion est désintéressée et l'activité non lucrative en est exonérée : faites qualifier votre situation."] })
  }
  if (scenario.meta.jeiClaimed) assumptions.push({ cells: ['Statut JEI', result.jei.some((j) => j.eligible) ? 'Éligible : exonération de cotisations patronales sur la R&D' : 'Revendiqué mais seuil de R&D non atteint'] })

  const assumpTable = table({
    x: M, y: 1550000, w: CONTENT_W,
    headers: ['Poste', 'Hypothèse retenue'],
    colWidths: [CONTENT_W * 0.3, CONTENT_W * 0.7],
    rows: assumptions.slice(0, 10), rowHeight: 320000,
  })
  slides.push(slideXml([
    ...slideHeader('Hypothèses du modèle', 'Les paramètres sur lesquels repose ce prévisionnel'),
    ...assumpTable.shapes,
    textBox({
      x: M, y: H - 1150000, w: CONTENT_W, h: 500000,
      text: "Prévisionnel établi avec Fizzy. Les montants sont exprimés hors taxes. Les paramètres fiscaux et sociaux sont des valeurs de référence à confirmer auprès d'un expert-comptable avant tout usage officiel.",
      size: 9, color: MUTED, italic: true, lineSpacing: 130,
    }),
    ...footer(slides.length + 1, name),
  ]))

  return slides
}

/** Assemble le fichier .pptx et le remet à l'utilisateur. */
export async function exportPptx(scenario, result, profile) {
  shapeId = 1
  const slides = buildDeck(scenario, result, profile)
  const n = slides.length

  const files = [
    { name: '[Content_Types].xml', data: contentTypes(n) },
    { name: '_rels/.rels', data: rootRels() },
    { name: 'docProps/app.xml', data: appProps(scenario, n) },
    { name: 'docProps/core.xml', data: coreProps(scenario, profile) },
    { name: 'ppt/presentation.xml', data: presentation(n) },
    { name: 'ppt/_rels/presentation.xml.rels', data: presentationRels(n) },
    { name: 'ppt/theme/theme1.xml', data: theme() },
    { name: 'ppt/slideMasters/slideMaster1.xml', data: slideMaster() },
    { name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: slideMasterRels() },
    { name: 'ppt/slideLayouts/slideLayout1.xml', data: slideLayout() },
    { name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: slideLayoutRels() },
  ]
  slides.forEach((content, i) => {
    files.push({ name: `ppt/slides/slide${i + 1}.xml`, data: content })
    files.push({ name: `ppt/slides/_rels/slide${i + 1}.xml.rels`, data: slideRels() })
  })

  const blob = createZip(files)
  // Plage À-ÿ écrite en échappements : le littéral reste en ASCII et
  // ne dépend pas de l'encodage sous lequel le fichier est lu ou servi.
  const safe = (scenario.meta.name || 'business-plan').replace(/[^\w\s\u00C0-\u00FF-]/g, '').replace(/\s+/g, '-').toLowerCase()
  const outcome = await download(blob, `${safe}-business-plan.pptx`)
  return { slides: n, outcome }
}

// ─────────────────────────── Parties fixes du paquet ───────────────────────

const contentTypes = (n) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
${Array.from({ length: n }, (_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`

const rootRels = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`

const presentation = (n) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" saveSubsetFonts="1">
<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
<p:sldIdLst>${Array.from({ length: n }, (_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('')}</p:sldIdLst>
<p:sldSz cx="${W}" cy="${H}"/><p:notesSz cx="${H}" cy="${W}"/>
</p:presentation>`

const presentationRels = (n) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
${Array.from({ length: n }, (_, i) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join('')}
<Relationship Id="rId${n + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
</Relationships>`

const slideRels = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`

const slideMasterRels = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`

const slideLayoutRels = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`

const EMPTY_TREE = `<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>`
const CLR_MAP = `<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" hlink="hlink" folHlink="folHlink"/>`

const slideMaster = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
${EMPTY_TREE}${CLR_MAP}
<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`

const slideLayout = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
${EMPTY_TREE}<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`

const theme = () => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Fizzy">
<a:themeElements>
<a:clrScheme name="Fizzy"><a:dk1><a:srgbClr val="0A0F1C"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F2940"/></a:dk2><a:lt2><a:srgbClr val="F5F7FA"/></a:lt2>
<a:accent1><a:srgbClr val="5F3FEE"/></a:accent1><a:accent2><a:srgbClr val="05A578"/></a:accent2><a:accent3><a:srgbClr val="D97A06"/></a:accent3><a:accent4><a:srgbClr val="1A7FD4"/></a:accent4><a:accent5><a:srgbClr val="E0335A"/></a:accent5><a:accent6><a:srgbClr val="7D4BD1"/></a:accent6>
<a:hlink><a:srgbClr val="4C2FD4"/></a:hlink><a:folHlink><a:srgbClr val="8290A6"/></a:folHlink></a:clrScheme>
<a:fontScheme name="Fizzy"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>
<a:fmtScheme name="Fizzy">
<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
<a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
</a:fmtScheme></a:themeElements></a:theme>`

const appProps = (scenario, n) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
<Application>Fizzy</Application><Slides>${n}</Slides><Company>${xml(scenario.meta.company || '')}</Company>
</Properties>`

const coreProps = (scenario, profile) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${xml(scenario.meta.name || 'Business plan')}</dc:title>
<dc:creator>${xml(profile?.name || 'Fizzy')}</dc:creator>
<cp:lastModifiedBy>${xml(profile?.name || 'Fizzy')}</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created>
<dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:modified>
</cp:coreProperties>`

// ────────────────────────────────── Formats ────────────────────────────────
const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
function formatEuro(v) {
  if (!Number.isFinite(v)) return '—'
  return `${nf.format(Math.round(v))} €`
}
function formatCompact(v) {
  if (!Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a >= 1000000) return `${(v / 1000000).toFixed(1).replace('.', ',')} M€`
  if (a >= 1000) return `${nf.format(Math.round(v / 1000))} k€`
  return formatEuro(v)
}
const formatPct = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1).replace('.', ',')} %` : '—')
const yearly = (arr) => Array.from({ length: 5 }, (_, y) => arr.slice(y * 12, y * 12 + 12).reduce((a, b) => a + b, 0))
const contractLabel = (t) => ({ cdi: 'CDI', cdd: 'CDD', alternance: 'Alternance', stage: 'Stage', tns: 'Dirigeant TNS', freelance: 'Freelance' }[t] || t)
