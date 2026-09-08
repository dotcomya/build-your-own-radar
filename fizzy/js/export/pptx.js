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

const W = 12192000, H = 6858000
const EMU = 12700              // 1 point = 12 700 EMU
const pt = (v) => Math.round(v * EMU)

const INK = '0A0F1C', MUTED = '5B6880', BRAND = '5F3FEE', MINT = '05A578', ROSE = 'E0335A', AMBER = 'D97A06', LINE = 'D7DDE6', SOFT = 'F5F7FA'

let shapeId = 1
const nextId = () => ++shapeId

/** Zone de texte. */
function textBox({ x, y, w, h, text, size = 18, bold = false, color = INK, align = 'l', anchor = 't', italic = false, lineSpacing = 100 }) {
  const paragraphs = String(text).split('\n').map((lineText) => {
    const runs = String(lineText) === '' ? '<a:endParaRPr lang="fr-FR"/>' :
      `<a:r><a:rPr lang="fr-FR" sz="${Math.round(size * 100)}" b="${bold ? 1 : 0}" i="${italic ? 1 : 0}" dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Aptos"/></a:rPr><a:t>${xml(lineText)}</a:t></a:r>`
    return `<a:p><a:pPr algn="${align}"><a:lnSpc><a:spcPct val="${lineSpacing * 1000}"/></a:lnSpc></a:pPr>${runs}</a:p>`
  }).join('')
  return `<p:sp><p:nvSpPr><p:cNvPr id="${nextId()}" name="txt"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>
<p:txBody><a:bodyPr wrap="square" anchor="${anchor}" lIns="0" tIns="0" rIns="0" bIns="0"><a:normAutofit/></a:bodyPr><a:lstStyle/>${paragraphs}</p:txBody></p:sp>`
}

/** Rectangle plein ou bordé. */
function rect({ x, y, w, h, fill, line, radius = false, lineWidth = 1 }) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${nextId()}" name="rect"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>
<a:prstGeom prst="${radius ? 'roundRect' : 'rect'}"><a:avLst>${radius ? '<a:gd name="adj" fmla="val 8000"/>' : ''}</a:avLst></a:prstGeom>
${fill ? `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>` : '<a:noFill/>'}
${line ? `<a:ln w="${pt(lineWidth)}"><a:solidFill><a:srgbClr val="${line}"/></a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>'}
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

  // 2 — Chiffres clés
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
    ...footer(2, name),
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
    ...footer(3, name),
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
    ...footer(4, name),
  ]))

  // 5 — Trésorerie
  slides.push(slideXml([
    ...slideHeader('Plan de trésorerie', 'Solde de fin de mois sur soixante mois'),
    ...areaChartShapes({ x: M, y: 1600000, w: CONTENT_W, h: 2500000, values: result.cash.balance, color: k.fundingNeed > 0 ? AMBER : MINT }),
    rect({ x: M, y: 4450000, w: CONTENT_W, h: 900000, fill: k.fundingNeed > 0 ? 'FDEFD4' : 'D6F5EB', radius: true }),
    textBox({
      x: M + 300000, y: 4620000, w: CONTENT_W - 600000, h: 600000,
      text: k.fundingNeed > 0
        ? `Besoin de financement : ${eur(k.fundingNeed)}\nLe solde atteint son point bas au mois ${k.cashLow.month + 1}. Ce montant doit être couvert avant cette échéance.`
        : `Trésorerie couverte sur tout l'horizon\nLe solde reste positif, au plus bas à ${eur(k.cashLow.value)} au mois ${k.cashLow.month + 1}.`,
      size: 11.5, color: k.fundingNeed > 0 ? 'A35C00' : '047A5B', bold: false, lineSpacing: 130,
    }),
    ...footer(5, name),
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
    ...footer(6, name),
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
    rect({ x: M + CONTENT_W * 0.57, y: 1550000, w: CONTENT_W * 0.43, h: 1900000, fill: k.fundingNeed > 0 ? 'FDEFD4' : 'D6F5EB', radius: true }),
    textBox({ x: M + CONTENT_W * 0.57 + 300000, y: 1780000, w: CONTENT_W * 0.43 - 600000, h: 300000, text: k.fundingNeed > 0 ? 'BESOIN COMPLÉMENTAIRE' : 'FINANCEMENT SUFFISANT', size: 10, bold: true, color: k.fundingNeed > 0 ? 'A35C00' : '047A5B' }),
    textBox({ x: M + CONTENT_W * 0.57 + 300000, y: 2120000, w: CONTENT_W * 0.43 - 600000, h: 500000, text: k.fundingNeed > 0 ? eurC(k.fundingNeed) : eurC(k.cashLow.value), size: 28, bold: true, color: k.fundingNeed > 0 ? 'A35C00' : '047A5B' }),
    textBox({ x: M + CONTENT_W * 0.57 + 300000, y: 2750000, w: CONTENT_W * 0.43 - 600000, h: 600000, text: k.fundingNeed > 0 ? `à réunir avant le mois ${k.cashLow.month + 1}, point bas de la trésorerie` : 'de trésorerie au point le plus bas', size: 10.5, color: MUTED, lineSpacing: 130 }),
    ...footer(slides.length + 1, name),
  ]))

  // 10 — Hypothèses
  const assumptions = []
  scenario.activities.forEach((a) => {
    const bits = []
    if (Number(a.unitPrice) > 0) bits.push(`${formatEuro(a.unitPrice)} l'unité`)
    if (Number(a.recurringPrice) > 0) bits.push(`${formatEuro(a.recurringPrice)}/mois sur ${a.contractMonths} mois`)
    if (Number(a.unitPrice) > 0) bits.push(`coût de revient ${formatEuro(a.unitCost)}`)
    if (Number(a.paymentLag) > 0) bits.push(`paiement à ${Number(a.paymentLag) * 30} jours`)
    assumptions.push({ cells: [a.name, bits.join(' · ')] })
  })
  assumptions.push({ cells: ['Fiscalité appliquée', `France ${new Date(meta.startDate).getFullYear()} — IS 15 % jusqu'à 42 500 € puis 25 %, TVA 20 %`] })
  assumptions.push({ cells: ['Cotisations patronales', 'Taux moyens avec réduction générale dégressive jusqu\'à 3 SMIC'] })
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
