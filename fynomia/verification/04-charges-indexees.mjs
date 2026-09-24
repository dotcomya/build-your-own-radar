/**
 * Une charge indexée sur une offre suit ses volumes, pas le CA total.
 *
 * Une charge par vente — une commission, un emballage — est un coût
 * variable : elle se lit dans « Achats et charges variables », avec le coût
 * de revient des offres, et non dans les charges externes.
 */
import { compute } from '../js/engine/engine.js'
import { scenarioFromTemplate, newActivity, newOpex } from '../js/state/schema.js'
const ok=(l,c,d='')=>{console.log(`${c?'✓':'✗'} ${l}${d?' — '+d:''}`); if(!c) process.exitCode=1}
const near=(a,b,t=1)=>Math.abs(a-b)<=t

const s = scenarioFromTemplate('restaurant','glaces')
s.team=[]; s.opex=[]; s.capex=[]; s.marketing=[]
const glace = newActivity({ name:'Glace', unitPrice: 8, unitCost: 2, paymentLag: 0, deposit: 1,
  volumes:{ mode:'manual', manual: Array.from({length:60},()=> 100) } })
const cafe = newActivity({ name:'Café', unitPrice: 2, unitCost: 0.4, paymentLag: 0, deposit: 1,
  volumes:{ mode:'manual', manual: Array.from({length:60},()=> 500) } })
s.activities=[glace, cafe]
// Le coût de revient propre des offres, sur l'année : 100 glaces à 2 € et
// 500 cafés à 0,40 € par mois. Une charge par vente s'y ajoute.
const achats = (100*2 + 500*0.4)*12
const parVente = (r) => r.pnl.variableCost[0] - achats

// 1 % sur la glace seulement
s.opex=[newOpex({ label:'Commission glace', mode:'pctRevenue', pctRevenue:0.01, monthlyAmount:0, activityId: glace.id })]
let r = compute(s)
const attendu1 = 100*8*0.01*12
ok('1 % indexé sur une seule offre', near(parVente(r), attendu1, 1),
   `${Math.round(parVente(r))} € vs ${attendu1} € attendus`)
ok('une charge par vente est un coût variable, pas une charge externe', near(r.pnl.external[0], 0, 0.01), `${Math.round(r.pnl.external[0])} € en charges externes`)

// la même commission sur tout le CA
s.opex=[newOpex({ label:'Commission', mode:'pctRevenue', pctRevenue:0.01, monthlyAmount:0, activityId: null })]
r = compute(s)
const attendu2 = (100*8 + 500*2)*0.01*12
ok('1 % sur toutes les offres', near(parVente(r), attendu2, 1),
   `${Math.round(parVente(r))} € vs ${attendu2} € attendus`)

// un montant par unité vendue d'une offre
s.opex=[newOpex({ label:'Cornet', mode:'perUnit', perUnit:0.3, monthlyAmount:0, activityId: glace.id })]
r = compute(s)
const attendu3 = 100*0.3*12
ok('0,30 € par glace vendue', near(parVente(r), attendu3, 1),
   `${Math.round(parVente(r))} € vs ${attendu3} € attendus`)

// par unité, toutes offres confondues
s.opex=[newOpex({ label:'Serviette', mode:'perUnit', perUnit:0.05, monthlyAmount:0, activityId: null })]
r = compute(s)
const attendu4 = (100+500)*0.05*12
ok('0,05 € par unité vendue, toutes offres', near(parVente(r), attendu4, 1),
   `${Math.round(parVente(r))} € vs ${attendu4} € attendus`)

// la charge suit le volume : doubler les glaces double la commission
s.opex=[newOpex({ label:'Commission glace', mode:'pctRevenue', pctRevenue:0.01, monthlyAmount:0, activityId: glace.id })]
const s2 = JSON.parse(JSON.stringify(s))
s2.activities[0].volumes.manual = s2.activities[0].volumes.manual.map(()=>200)
const r2 = compute(s2)
const achats2 = (200*2 + 500*0.4)*12
ok('doubler les volumes double la charge indexée',
   near(r2.pnl.variableCost[0] - achats2, parVente(compute(s))*2, 1),
   `${Math.round(parVente(compute(s)))} → ${Math.round(r2.pnl.variableCost[0] - achats2)}`)

// un montant fixe reste fixe
s.opex=[newOpex({ label:'Loyer', mode:'fixed', monthlyAmount:1000 })]
ok('un montant fixe ne bouge pas avec les ventes', near(compute(s).pnl.external[0], 12000, 1))
ok('un montant fixe reste une charge externe, hors marge brute', near(compute(s).pnl.variableCost[0], achats, 1))

// Changer de ligne ne change ni la valeur ajoutée, ni l'EBE, ni le résultat,
// et le point mort ne compte plus la commission comme un frais fixe.
{
  const a = JSON.parse(JSON.stringify(s)); a.opex=[newOpex({ label:'Loyer', mode:'fixed', monthlyAmount:1000 }), newOpex({ label:'Commission', mode:'pctRevenue', pctRevenue:0.05, monthlyAmount:0 })]
  const ra = compute(a)
  const va = ra.pnl.revenue[0] - ra.pnl.variableCost[0] - ra.pnl.external[0]
  ok('valeur ajoutée = CA − achats et charges variables − charges externes', near(va, ra.pnl.valueAdded[0], 1))
  const taux = ra.pnl.grossMargin[0] / ra.pnl.revenue[0]
  const fixes = ra.pnl.external[0] + ra.pnl.payroll[0] + ra.pnl.duties[0] + ra.pnl.amortisation[0] + ra.pnl.interest[0]
  ok('point mort = charges fixes ÷ taux de marge, commission comptée dans la marge', near(ra.kpis.breakEven[0], fixes / taux, 1),
    `${Math.round(ra.kpis.breakEven[0])} € vs ${Math.round(fixes / taux)} €`)
}
