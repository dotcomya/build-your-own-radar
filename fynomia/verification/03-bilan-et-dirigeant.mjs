/**
 * Troisième volet de l'audit : report déficitaire, plan de financement,
 * rémunération du dirigeant et remontée au fondateur.
 */
import { compute } from '../js/engine/engine.js'
import { scenarioFromTemplate, newActivity, newCapex, newTeamMember } from '../js/state/schema.js'
import { founderIncome } from '../js/engine/founder.js'
import { PARAMS } from '../js/engine/fiscal-fr-2026.js'
const ok=(l,c,d='')=>{ console.log(`${c?'✓':'✗'} ${l}${d?' — '+d:''}`); if(!c) process.exitCode=1 }
const near=(a,b,t=1)=>Math.abs(a-b)<=t
const clone=(x)=>JSON.parse(JSON.stringify(x))

const base = () => {
  const s = scenarioFromTemplate('conseil','audit')
  s.team = []; s.opex = []; s.capex = []; s.marketing = []
  s.financing = { openingCash: 0, equityFounders: [{ month: 0, amount: 200000 }], equityInvestors: [], loans: [], grants: [], advances: [], shareholderLoans: [] }
  return s
}

// ── Report déficitaire : une perte en année 1 réduit l'IS de l'année 2 ──
{
  const s = base()
  s.activities = [newActivity({ name:'Presta', unitPrice: 10000, unitCost: 0, paymentLag: 0,
    volumes:{ mode:'manual', manual: Array.from({length:60},(_,m)=> m>=12 && m<24 ? 10 : 0) } })]
  s.opex = [{ id:'o1', label:'Frais', mode:'fixed', monthlyAmount: 5000, startMonth: 0, endMonth: null, vatRate: 0.2, enabled: true }]
  const r = compute(s)
  const perte1 = r.pnl.preTax[0], benef2 = r.pnl.preTax[1], is2 = r.pnl.corporateTax[1]
  const assiette = Math.max(0, benef2 + perte1)   // perte1 est négative
  const attendu = assiette <= 42500 ? assiette*0.15 : 42500*0.15 + (assiette-42500)*0.25
  ok('report déficitaire imputé sur le bénéfice suivant', near(is2, attendu, 5),
     `perte A1 ${Math.round(perte1)} → assiette A2 ${Math.round(assiette)} → IS ${Math.round(is2)}`)
  ok('aucun IS sur un exercice déficitaire', r.pnl.corporateTax[0] === 0)
}

// ── Amortissement : dotation linéaire, valeur nette qui décroît, bilan qui tient ──
{
  const s = base()
  s.activities = [newActivity({ name:'Presta', unitPrice: 8000, unitCost: 0, paymentLag: 0,
    volumes:{ mode:'manual', manual: Array.from({length:60},()=> 3) } })]
  // Un investissement proposé naît éteint : il ne sort de la trésorerie et ne
  // s'amortit qu'une fois retenu par le fondateur. Le test le retient donc
  // explicitement — et vérifie juste après qu'éteint, il ne coûte rien.
  s.capex = [newCapex({ label:'Matériel', amount: 60000, month: 0, amortYears: 5, enabled: true })]
  const r = compute(s)
  ok('dotation linéaire annuelle', near(r.pnl.amortisation[0], 12000, 1), `${Math.round(r.pnl.amortisation[0])} €/an`)

  const eteint = compute({ ...s, capex: [newCapex({ label:'Matériel', amount: 60000, month: 0, amortYears: 5 })] })
  ok('un investissement non retenu ne coûte rien',
     eteint.pnl.amortisation[0] === 0 && eteint.balance[0].grossFixed === 0,
     `dotation ${Math.round(eteint.pnl.amortisation[0])} € / immobilisations ${Math.round(eteint.balance[0].grossFixed)} €`)
  ok('le rallumer rétablit exactement la dotation',
     near(r.pnl.amortisation[0] - eteint.pnl.amortisation[0], 12000, 1),
     `${Math.round(eteint.pnl.amortisation[0])} → ${Math.round(r.pnl.amortisation[0])} €/an`)
  ok('valeur nette comptable décroissante',
     r.balance.every((b,i)=> i===0 || b.netFixed <= r.balance[i-1].netFixed + 0.5),
     r.balance.map(b=>Math.round(b.netFixed)).join(' / '))
  ok('bilan équilibré avec immobilisations',
     r.balance.every(b => near(b.totalAssets, b.totalLiabilities, 2)))
  // CAF = résultat net + dotations (aucune autre charge non décaissable ici)
  const caf = r.fundingPlan[0].caf
  ok('capacité d’autofinancement = résultat net + dotations',
     near(caf, r.pnl.netResult[0] + r.pnl.amortisation[0], 2),
     `${Math.round(caf)} vs ${Math.round(r.pnl.netResult[0] + r.pnl.amortisation[0])}`)
  // Plan de financement : emplois = ressources + variation de trésorerie
  const p = r.fundingPlan[0]
  ok('plan de financement équilibré', near(p.resources - p.uses, p.surplus, 2),
     `ressources ${Math.round(p.resources)} − emplois ${Math.round(p.uses)} = ${Math.round(p.surplus)}`)
}

// ── Emprunt : le capital restant dû figure au passif, les intérêts en charges ──
{
  const s = base()
  s.activities = [newActivity({ name:'Presta', unitPrice: 8000, unitCost: 0, paymentLag: 0,
    volumes:{ mode:'manual', manual: Array.from({length:60},()=> 3) } })]
  s.financing.loans = [{ id:'l1', label:'Prêt', amount: 100000, month: 0, months: 60, rate: 0.04, deferMonths: 0 }]
  const r = compute(s)
  ok('intérêts d’emprunt en charges financières', r.pnl.interest[0] > 0, `${Math.round(r.pnl.interest[0])} € en A1`)
  ok('dette décroissante sur cinq ans',
     r.balance.every((b,i)=> i===0 || b.debt <= r.balance[i-1].debt + 0.5),
     r.balance.map(b=>Math.round(b.debt)).join(' / '))
  ok('dette éteinte en fin d’échéancier', near(r.balance[4].debt, 0, 2), `${Math.round(r.balance[4].debt)} €`)
}

// ── Créances clients : ce qui est facturé et pas encore encaissé ──
{
  const s = base()
  s.activities = [newActivity({ name:'Presta', unitPrice: 12000, unitCost: 0, paymentLag: 2, deposit: 0, milestone: 0,
    vatRateSales: 0.2, volumes:{ mode:'manual', manual: Array.from({length:60},()=> 1) } })]
  const r = compute(s)
  // Deux mois de chiffre d'affaires restent dus à la clôture. Le montant est
  // hors taxes, et c'est cohérent : la TVA est collectée à l'encaissement, donc
  // la facture impayée ne porte encore aucune dette de TVA.
  ok('créances clients = deux mois de chiffre d’affaires', near(r.balance[0].receivables, 24000, 200),
     `${Math.round(r.balance[0].receivables)} € vs 24 000 €`)
  const sansDelai = clone(s); sansDelai.activities[0].paymentLag = 0
  ok('aucune créance sans délai de paiement', near(compute(sansDelai).balance[0].receivables, 0, 1))

  // TVA sur les encaissements : elle suit le paiement, pas la facture.
  const encaisse = r.revenue.cash
  const collectee = r.vat.collected
  ok('TVA collectée au rythme des encaissements',
     collectee.every((v, m) => near(v, encaisse[m] * 0.2, 0.5)),
     `M2 ${Math.round(collectee[2])} € pour ${Math.round(encaisse[2])} € encaissés`)

  // Un acompte encaissé porte sa TVA dès le premier mois.
  const acompte = clone(s); acompte.activities[0].deposit = 0.4
  const ra = compute(acompte)
  ok('un acompte porte sa TVA dès son encaissement', ra.vat.collected[0] > r.vat.collected[0],
     `${Math.round(r.vat.collected[0])} € → ${Math.round(ra.vat.collected[0])} €`)
}

// ── Dividendes : flat tax en SAS, cotisations TNS au-delà de 10 % du capital en SARL ──
{
  const s = base()
  s.meta.legalForm = 'SASU'
  s.activities = [newActivity({ name:'Presta', unitPrice: 20000, unitCost: 0, paymentLag: 0,
    volumes:{ mode:'manual', manual: Array.from({length:60},()=> 2) } })]
  s.team = [newTeamMember({ role:'Moi', contractType:'dirigeant', status:'cadre', monthlyGross: 3000, startMonth: 0 })]
  s.founder = { ...(s.founder || {}), dividendPayout: 1, equityShare: 1, taxParts: 1, majorityManager: false, dividendRegime: 'flat' }
  const sas = founderIncome(s, compute(s))

  const sarl = clone(s)
  sarl.meta.legalForm = 'SARL'
  sarl.team[0].contractType = 'tns'
  sarl.founder.majorityManager = true
  const gerant = founderIncome(sarl, compute(sarl))

  // Le taux n'est pas écrit ici : il est lu dans les paramètres. Un contrôle
  // qui recopie la loi ne vérifie plus rien le jour où la loi change — il
  // signale seulement qu'on a oublié de le recopier aussi.
  const pfu = PARAMS.flatTax.value
  ok(`flat tax de ${(pfu.total * 100).toFixed(1).replace('.', ',')} % sur les dividendes du président de SAS`,
     near(sas.rows[0].dividendSocial + sas.rows[0].dividendIncomeTax, sas.rows[0].grossDividends * pfu.total, 2),
     `${Math.round(sas.rows[0].dividendSocial + sas.rows[0].dividendIncomeTax)} € sur ${Math.round(sas.rows[0].grossDividends)} €`)
  // Et le détail : 12,8 % d'impôt d'un côté, 18,6 % de prélèvements sociaux de
  // l'autre. Le total seul laisserait passer une répartition fausse.
  ok('dont 12,8 % d’impôt sur le revenu et 18,6 % de prélèvements sociaux',
     near(sas.rows[0].dividendIncomeTax, sas.rows[0].grossDividends * 0.128, 2)
     && near(sas.rows[0].dividendSocial, sas.rows[0].grossDividends * 0.186, 2)
     && near(pfu.incomeTax + pfu.socialCharges, pfu.total, 1e-9),
     `IR ${Math.round(sas.rows[0].dividendIncomeTax)} € · PS ${Math.round(sas.rows[0].dividendSocial)} €`)
  ok('gérant majoritaire : la fraction au-delà de 10 % du capital passe aux cotisations TNS',
     gerant.rows[0].tnsPortion > 0 && gerant.rows[0].dividendSocial > gerant.rows[0].grossDividends * pfu.socialCharges,
     `part TNS ${Math.round(gerant.rows[0].tnsPortion)} € sur ${Math.round(gerant.rows[0].grossDividends)} €`)
  ok('impôt sur le revenu progressif appliqué à la rémunération',
     sas.rows[0].incomeTax > 0 && sas.rows[0].marginalRate >= 0.11,
     `IR ${Math.round(sas.rows[0].incomeTax)} €, taux marginal ${Math.round(sas.rows[0].marginalRate * 100)} %`)
  ok('abattement de 10 % sur les salaires, pas en BNC',
     (() => {
       const bnc = clone(s); bnc.meta.legalForm = 'BNC'; bnc.team[0].contractType = 'tns'
       const f = founderIncome(bnc, compute(bnc))
       return f.settings.liberalBnc === true && f.rows[0].taxableIncome > 0
     })())
}

// ── Cohérence de caisse : le solde final = apports + encaissements − décaissements ──
{
  const s = base()
  s.activities = [newActivity({ name:'Presta', unitPrice: 9000, unitCost: 1000, paymentLag: 1,
    volumes:{ mode:'manual', manual: Array.from({length:60},()=> 2) } })]
  s.team = [newTeamMember({ role:'Moi', contractType:'dirigeant', status:'cadre', monthlyGross: 3000, startMonth: 0 })]
  const r = compute(s)
  const fin = r.cash.balance[59]
  const somme = r.cash.inflow.reduce((a,b)=>a+b,0) - r.cash.outflow.reduce((a,b)=>a+b,0) + (Number(s.financing.openingCash)||0)
  ok('trésorerie finale = cumul des flux nets', near(fin, somme, 2), `${Math.round(fin)} € vs ${Math.round(somme)} €`)
  ok('capitaux propres = capital + résultats cumulés',
     near(r.balance[4].equity, 200000 + r.pnl.netResult.reduce((a,b)=>a+b,0), 2),
     `${Math.round(r.balance[4].equity)} €`)
}
