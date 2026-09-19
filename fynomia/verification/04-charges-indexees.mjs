/** Une charge indexée sur une offre suit ses volumes, pas le CA total. */
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

// 1 % sur la glace seulement
s.opex=[newOpex({ label:'Commission glace', mode:'pctRevenue', pctRevenue:0.01, monthlyAmount:0, activityId: glace.id })]
let r = compute(s)
const attendu1 = 100*8*0.01*12
ok('1 % indexé sur une seule offre', near(r.pnl.external[0], attendu1, 1),
   `${Math.round(r.pnl.external[0])} € vs ${attendu1} € attendus`)

// la même commission sur tout le CA
s.opex=[newOpex({ label:'Commission', mode:'pctRevenue', pctRevenue:0.01, monthlyAmount:0, activityId: null })]
r = compute(s)
const attendu2 = (100*8 + 500*2)*0.01*12
ok('1 % sur toutes les offres', near(r.pnl.external[0], attendu2, 1),
   `${Math.round(r.pnl.external[0])} € vs ${attendu2} € attendus`)

// un montant par unité vendue d'une offre
s.opex=[newOpex({ label:'Cornet', mode:'perUnit', perUnit:0.3, monthlyAmount:0, activityId: glace.id })]
r = compute(s)
const attendu3 = 100*0.3*12
ok('0,30 € par glace vendue', near(r.pnl.external[0], attendu3, 1),
   `${Math.round(r.pnl.external[0])} € vs ${attendu3} € attendus`)

// par unité, toutes offres confondues
s.opex=[newOpex({ label:'Serviette', mode:'perUnit', perUnit:0.05, monthlyAmount:0, activityId: null })]
r = compute(s)
const attendu4 = (100+500)*0.05*12
ok('0,05 € par unité vendue, toutes offres', near(r.pnl.external[0], attendu4, 1),
   `${Math.round(r.pnl.external[0])} € vs ${attendu4} € attendus`)

// la charge suit le volume : doubler les glaces double la commission
s.opex=[newOpex({ label:'Commission glace', mode:'pctRevenue', pctRevenue:0.01, monthlyAmount:0, activityId: glace.id })]
const s2 = JSON.parse(JSON.stringify(s))
s2.activities[0].volumes.manual = s2.activities[0].volumes.manual.map(()=>200)
const r2 = compute(s2)
ok('doubler les volumes double la charge indexée',
   near(r2.pnl.external[0], compute(s).pnl.external[0]*2, 1),
   `${Math.round(compute(s).pnl.external[0])} → ${Math.round(r2.pnl.external[0])}`)

// un montant fixe reste fixe
s.opex=[newOpex({ label:'Loyer', mode:'fixed', monthlyAmount:1000 })]
ok('un montant fixe ne bouge pas avec les ventes', near(compute(s).pnl.external[0], 12000, 1))
