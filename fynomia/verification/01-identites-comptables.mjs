import { compute } from '../js/engine/engine.js'
import { scenarioFromTemplate } from '../js/state/schema.js'

const ok = (label, cond, detail='') => console.log(`${cond ? '✓' : '✗'} ${label}${detail ? ' — ' + detail : ''}`)
const near = (a,b,tol=1) => Math.abs(a-b) <= tol

for (const tpl of ['logiciel','conseil','ecommerce','restaurant','coiffeur']) {
  const s = scenarioFromTemplate(tpl, 'audit')
  const r = compute(s)
  const p = r.pnl
  console.log(`\n── ${tpl} ──`)
  // 1. Identité du compte de résultat
  let idOk = true
  for (let y=0;y<5;y++){
    // EBE, par le haut : le solde intermédiaire de gestion.
    const ebe = p.revenue[y] - p.variableCost[y] - p.external[y] - p.duties[y] - p.payroll[y] + p.grants[y]
    if (!near(ebe, p.ebe[y], 2)) { idOk=false; console.log(`   y${y+1} EBE calc=${ebe.toFixed(0)} vs ${p.ebe[y].toFixed(0)}`) }
    const ebit = p.ebe[y] - p.amortisation[y]
    if (!near(ebit, p.ebit[y], 2)) { idOk=false; console.log(`   y${y+1} EBIT`) }
    const net = p.preTax[y] - p.corporateTax[y] + p.credits[y]
    if (!near(net, p.netResult[y], 2)) { idOk=false; console.log(`   y${y+1} net calc=${net.toFixed(0)} vs ${p.netResult[y].toFixed(0)}`) }
  }
  ok('compte de résultat cohérent', idOk)
  // 1 bis. EBITDA, par le bas : résultat d'exploitation + dotations aux
  // amortissements. Il ne s'écarte de l'EBE que des autres produits et
  // charges de gestion courante et des provisions, que le plan ne modélise
  // pas : l'écart doit être nul, année par année.
  const parLeBas = p.ebit.map((v, y) => v + p.amortisation[y])
  ok('EBITDA = résultat d’exploitation + amortissements', parLeBas.every((v, y) => near(v, p.ebitda[y], 0.01)))
  ok('EBITDA − EBE = autres produits et charges de gestion (aucun) = 0', p.ebitda.every((v, y) => near(v - p.ebe[y], 0, 0.01)),
    p.ebitda.map((v, y) => Math.round(v - p.ebe[y])).join(' / '))
  ok('marges d’EBE et d’EBITDA sur le même chiffre d’affaires', r.kpis.ebeMargin.every((m, y) => p.revenue[y] <= 0 || near(m * p.revenue[y], p.ebe[y], 1)) && r.kpis.ebitdaMargin.every((m, y) => p.revenue[y] <= 0 || near(m * p.revenue[y], p.ebitda[y], 1)))
  // 2. Trésorerie = solde cumulé des flux
  let cashOk = true, run = r.financing.openingCash
  for (let m=0;m<60;m++){ run += r.cash.inflow[m]-r.cash.outflow[m]; if (!near(run, r.cash.balance[m], 2)) { cashOk=false; break } }
  ok('trésorerie = cumul des flux', cashOk)
  // 3. Bilan équilibré
  let balOk = true
  for (const b of r.balance) { if (!near(b.totalAssets, b.totalLiabilities, 2)) { balOk=false; console.log(`   actif ${b.totalAssets?.toFixed(0)} ≠ passif ${b.totalLiabilities?.toFixed(0)}`) } }
  ok('bilan équilibré', balOk)
  // 4. IS : jamais négatif, nul si perte
  const isOk = r.tax.every((t,y)=> t.tax >= -0.5 && (p.preTax[y] > 0 || near(t.tax,0,0.5)))
  ok('IS nul en perte, jamais négatif', isOk, r.tax.map(t=>Math.round(t.tax)).join(' / '))
  // 5. TVA : collectée ≥ 0, déductible ≥ 0
  const vatOk = r.vat.collected.every(v=>v>=-0.01) && r.vat.deductible.every(v=>v>=-0.01)
  ok('TVA non négative', vatOk)
  // 6. Point mort cohérent : au point mort, résultat d'exploitation ≈ 0
  const beOk = r.kpis.breakEven.every((v,y)=> v===null || v>=0)
  ok('point mort positif ou absent', beOk, r.kpis.breakEven.map(v=>v?Math.round(v/1000)+'k':'—').join(' / '))
  // 7. Masse salariale cohérente avec le P&L
  const payY = Array.from({length:5},(_,y)=>r.payroll.cost.slice(y*12,y*12+12).reduce((a,b)=>a+b,0))
  ok('masse salariale = charges de personnel', payY.every((v,y)=>near(v,p.payroll[y],2)))
}
