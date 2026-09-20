import { compute } from '../js/engine/engine.js'
import { scenarioFromTemplate, newActivity } from '../js/state/schema.js'
import { monthlyCost } from '../js/engine/payroll.js'
const ok=(l,c,d='')=>console.log(`${c?'✓':'✗'} ${l}${d?' — '+d:''}`)
const near=(a,b,t=1)=>Math.abs(a-b)<=t

// ── Barème IS : 15 % jusqu'à 42 500 €, 25 % au-delà ──
const s = scenarioFromTemplate('conseil','is')
s.team = []; s.opex = []; s.capex = []; s.marketing = []
s.activities = [newActivity({ name:'Presta', unitPrice: 10000, unitCost: 0, paymentLag: 0,
  volumes:{ mode:'manual', manual: Array.from({length:60},(_,m)=> m<12 ? 5 : 0) } })]
let r = compute(s)
const pre = r.pnl.preTax[0], is = r.pnl.corporateTax[0]
const attendu = pre <= 42500 ? pre*0.15 : 42500*0.15 + (pre-42500)*0.25
ok('barème IS 15 % / 25 %', near(is, attendu, 5), `bénéfice ${Math.round(pre)} → IS ${Math.round(is)} (attendu ${Math.round(attendu)})`)

// ── Décalage de TVA : la TVA due d'un mois se paie le mois suivant ──
const paid = r.vat.paid.reduce((a,b)=>a+b,0)
const due = r.vat.collected.reduce((a,b)=>a+b,0) - r.vat.deductible.reduce((a,b)=>a+b,0)
ok('TVA payée ≈ TVA due sur 5 ans', near(paid, Math.max(0,due), Math.max(200, Math.abs(due)*0.05)),
   `payée ${Math.round(paid)} vs due ${Math.round(due)}`)

// ── BFR : un délai client allongé doit creuser la trésorerie ──
// Le point de départ est posé ici, pas hérité du schéma : depuis que tout est
// payé à la commande par défaut, un délai sans acompte nul n'a aucun effet —
// et un contrôle qui dépend d'un défaut ne vérifie plus le moteur, il vérifie
// le défaut.
const sansAcompte = JSON.parse(JSON.stringify(s))
sansAcompte.activities[0].deposit = 0
sansAcompte.activities[0].paymentLag = 0
const r0 = compute(sansAcompte)

const a = JSON.parse(JSON.stringify(sansAcompte)); a.activities[0].paymentLag = 3
const rb = compute(a)
ok('un délai client de 3 mois dégrade le point bas',
   rb.kpis.cashLow.value < r0.kpis.cashLow.value,
   `${Math.round(r0.kpis.cashLow.value)} → ${Math.round(rb.kpis.cashLow.value)}`)

// ── Acompte : il doit améliorer la trésorerie ──
const c = JSON.parse(JSON.stringify(a)); c.activities[0].deposit = 0.5
const rc = compute(c)
ok('un acompte de 50 % améliore le point bas', rc.kpis.cashLow.value > rb.kpis.cashLow.value,
   `${Math.round(rb.kpis.cashLow.value)} → ${Math.round(rc.kpis.cashLow.value)}`)

// Et tout payé à la commande neutralise le délai : c'est le nouveau défaut.
const plein = JSON.parse(JSON.stringify(a)); plein.activities[0].deposit = 1
ok('un acompte de 100 % rend le délai client sans effet',
   Math.abs(compute(plein).kpis.cashLow.value - r0.kpis.cashLow.value) < 1,
   `${Math.round(compute(plein).kpis.cashLow.value)} vs ${Math.round(r0.kpis.cashLow.value)}`)

// ── Réduction générale : dégressive, nulle au-delà de 3 SMIC ──
const smic = 11.88*151.67
const bas = monthlyCost({contractType:'cdi',status:'non-cadre',monthlyGross:smic,count:1},{headcount:5})
const haut = monthlyCost({contractType:'cdi',status:'non-cadre',monthlyGross:smic*3.2,count:1},{headcount:5})
ok('réduction générale au SMIC', bas.reduction > 0, `${Math.round(bas.reduction)} €/mois`)
ok('réduction nulle au-delà de 3 SMIC', near(haut.reduction,0,0.5))

// ── Dirigeant assimilé salarié : pas de chômage, pas de réduction générale ──
const dir = monthlyCost({contractType:'dirigeant',monthlyGross:3000,count:1},{headcount:1})
const cadre = monthlyCost({contractType:'cdi',status:'cadre',monthlyGross:3000,count:1},{headcount:1})
ok('dirigeant moins chargé qu’un cadre (chômage non dû)', dir.employerBase < cadre.employerBase,
   `${Math.round(dir.employerBase)} vs ${Math.round(cadre.employerBase)}`)
ok('dirigeant sans réduction générale', near(dir.reduction,0,0.5))

// ── TNS : cotisations sur la rémunération, pas de part salariale ──
const tns = monthlyCost({contractType:'tns',monthlyGross:3000,count:1},{headcount:1})
ok('TNS ≈ 45 % de cotisations', near(tns.employerCharges/3000, 0.45, 0.02), `${(tns.employerCharges/3000*100).toFixed(1)} %`)
ok('TNS sans cotisations salariales', near(tns.employeeCharges,0,0.01))

// ── Amortissement : total amorti = montant investi sur la durée ──
const d = JSON.parse(JSON.stringify(s))
d.capex = [{ id:'c1', label:'Matériel', amount: 12000, month: 0, amortYears: 3, leasing:false }]
const rd = compute(d)
const totalAmort = rd.pnl.amortisation.reduce((x,y)=>x+y,0)
ok('amortissement total = montant investi', near(totalAmort, 12000, 5), `${Math.round(totalAmort)} €`)

// ── Franchise en base : ni TVA collectée ni déductible ──
const e = JSON.parse(JSON.stringify(s)); e.meta.vatExempt = true
e.activities.forEach(x=>{ x.vatRateSales = 0 })
const re_ = compute(e)
ok('franchise en base : aucune TVA collectée', re_.vat.collected.every(v=>near(v,0,0.01)))
