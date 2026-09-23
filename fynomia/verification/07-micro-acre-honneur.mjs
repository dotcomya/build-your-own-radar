/**
 * Septième volet : les créateurs qui ne ressemblent pas à une SAS.
 *
 * La micro-entreprise cotise sur ce qu'elle encaisse et ne paie pas d'impôt
 * sur les sociétés ; l'ACRE efface une partie des cotisations la première
 * année ; le prêt d'honneur entre comme un apport et se rembourse sur les
 * revenus du fondateur. Chaque règle est rejouée sur un plan dont on connaît
 * le résultat à l'euro près.
 */
import { compute } from '../js/engine/engine.js'
import { scenarioFromTemplate, newActivity, newTeamMember } from '../js/state/schema.js'
import { founderIncome } from '../js/engine/founder.js'
import { PARAMS } from '../js/engine/fiscal-fr-2026.js'
import { anneesCiviles, acreMicroMonths } from '../js/engine/micro.js'
const ok = (l, c, d = '') => { console.log(`${c ? '✓' : '✗'} ${l}${d ? ' — ' + d : ''}`); if (!c) process.exitCode = 1 }
const near = (a, b, t = 1) => Math.abs(a - b) <= t
const somme = (a) => a.reduce((x, y) => x + y, 0)

/** Un coiffeur en micro-entreprise : 4 000 € encaissés par mois, 300 € de charges. */
const micro = (patch = {}) => {
  const s = scenarioFromTemplate('coiffeur', 'audit', { sample: false })
  s.meta.legalForm = 'MICRO'
  s.meta.vatExempt = true
  s.meta.startDate = '2026-01-01'
  s.meta.microActivity = 'services'
  s.activities = [newActivity({ name: 'Coupe', unitPrice: 40, unitCost: 0, paymentLag: 0, vatRateSales: 0.2,
    volumes: { mode: 'manual', manual: Array.from({ length: 60 }, () => 100) } })]
  s.opex = [{ id: 'o1', label: 'Fauteuil loué', mode: 'fixed', monthlyAmount: 300, startMonth: 0, endMonth: '', enabled: true }]
  s.team = [newTeamMember({ role: 'Moi', contractType: 'micro', monthlyGross: 1500 })]
  s.financing = { openingCash: 0, equityFounders: [], equityInvestors: [], loans: [], grants: [], advances: [], shareholderLoans: [], honourLoans: [] }
  Object.assign(s.meta, patch)
  return s
}
const taux = PARAMS.microSocialRates.value.services
const cfp = PARAMS.microTrainingRates.value.services

// ── Micro-entreprise : cotisations sur le chiffre d'affaires, pas d'IS ──
{
  const s = micro()
  const r = compute(s)
  const ca = r.pnl.revenue[1]
  ok('le chiffre d’affaires encaissé est celui qu’on attend', near(ca, 48000, 1), String(Math.round(ca)))
  ok('aucune TVA collectée en franchise', somme(r.vat.collected) === 0 && somme(r.vat.paid) === 0)
  const cot = r.micro.socialY[1] + r.micro.trainingY[1]
  ok(`cotisations = ${(taux * 100).toFixed(1)} % + formation ${(cfp * 100).toFixed(1)} % du CA encaissé`, near(cot, 48000 * (taux + cfp), 1), `${Math.round(cot)} €`)
  ok('les cotisations sont des charges de personnel', near(r.pnl.payroll[1], cot, 1))
  ok('pas d’impôt sur les sociétés', r.pnl.corporateTax.every((t) => t === 0))
  ok('le prélèvement du fondateur n’est pas une charge', near(r.pnl.payroll[1], cot, 1) && r.payroll.headcount[0] === 0)
  // Résultat = CA − charges − cotisations − CFE éventuelle.
  const attendu = 48000 - 3600 - cot - r.pnl.duties[1]
  ok('résultat = CA − charges − cotisations − taxes', near(r.pnl.netResult[1], attendu, 2), `${Math.round(r.pnl.netResult[1])} €`)
  // Trésorerie : les prélèvements sortent chaque mois.
  let run = r.financing.openingCash, cashOk = true
  for (let m = 0; m < 60; m++) { run += r.cash.inflow[m] - r.cash.outflow[m]; if (!near(run, r.cash.balance[m], 2)) { cashOk = false; break } }
  ok('trésorerie = cumul des flux, prélèvements compris', cashOk)
  ok('les prélèvements sortent de la trésorerie', near(somme(r.cash.rows.draws.slice(0, 12)), 18000, 1))
  ok('bilan équilibré avec les prélèvements de l’exploitant', r.balance.every((b) => near(b.totalAssets, b.totalLiabilities, 2)),
    r.balance.map((b) => Math.round(b.gap)).join(' / '))
  // Impôt sur le revenu au barème après 50 % d'abattement.
  const inc = founderIncome(s, r)
  ok('le revenu du micro-entrepreneur est son résultat', near(inc.rows[1].microIncome, r.pnl.netResult[1], 1))
  ok('imposable = CA × (1 − 50 %)', near(inc.rows[1].taxableIncome, 24000, 1), String(Math.round(inc.rows[1].taxableIncome)))
  ok('ce qui reste = revenu − impôt', near(inc.rows[1].disposable, inc.rows[1].microIncome - inc.rows[1].incomeTax, 1))
}

// ── Versement libératoire : 1,7 % du CA en services, payé avec les cotisations ──
{
  const s = micro({ microVL: true })
  const r = compute(s)
  const inc = founderIncome(s, r)
  const vl = PARAMS.microFlatIncomeTax.value.services
  ok('versement libératoire = 1,7 % du CA encaissé', near(inc.rows[1].incomeTax, 48000 * vl, 1), `${Math.round(inc.rows[1].incomeTax)} €`)
  ok('il sort de la trésorerie chaque mois', near(somme(r.cash.rows.draws.slice(12, 24)), 18000 + 48000 * vl, 1))
  ok('le bilan tient encore', r.balance.every((b) => near(b.totalAssets, b.totalLiabilities, 2)))
}

// ── ACRE en micro : moitié avant juillet 2026, un quart ensuite ──
{
  const r1 = compute(micro({ acre: true, startDate: '2026-01-01' }))
  ok('ACRE micro avant juillet 2026 : cotisations divisées par deux pendant 12 mois',
    near(r1.micro.social[0], 4000 * taux * 0.5, 0.5) && near(r1.micro.social[11], 4000 * taux * 0.5, 0.5) && near(r1.micro.social[12], 4000 * taux, 0.5))
  const s2 = micro({ acre: true, startDate: '2026-08-01' })
  const r2 = compute(s2)
  const n = acreMicroMonths(s2)
  ok('début en août : ACRE jusqu’à la fin du 3e trimestre civil suivant — 11 mois', n === 11, String(n))
  ok('ACRE micro à partir de juillet 2026 : un quart de cotisations en moins',
    near(r2.micro.social[0], 4000 * taux * 0.75, 0.5) && near(r2.micro.social[10], 4000 * taux * 0.75, 0.5) && near(r2.micro.social[11], 4000 * taux, 0.5))
  const r3 = compute(micro({ acre: false }))
  ok('sans ACRE déclarée, rien n’est effacé', somme(r3.micro.acreSaving) === 0)
}

// ── Plafond : 83 600 € en services, au prorata la première année civile ──
{
  const s = micro({ startDate: '2026-07-01' })
  const annees = anneesCiviles(s, compute(s).revenue.monthly, PARAMS.microRevenueCeilings.value.services)
  ok('première année civile ramenée au prorata du temps d’activité',
    near(annees[0].plafond, 83600 * 184 / 365, 1) && annees[1].plafond === 83600, `${Math.round(annees[0].plafond)} € pour 6 mois`)
}

// ── ACRE hors micro : 25 % des cotisations de base, dégressive jusqu'au PASS ──
{
  const base = (brut) => {
    const s = scenarioFromTemplate('conseil', 'audit', { sample: false })
    s.meta.legalForm = 'SASU'
    s.meta.startDate = '2026-01-01'
    s.team = [newTeamMember({ role: 'Fondateur', contractType: 'dirigeant', monthlyGross: brut })]
    s.activities = [newActivity({ name: 'Mission', unitPrice: 10000, unitCost: 0, volumes: { mode: 'manual', manual: Array.from({ length: 60 }, () => 1) } })]
    return s
  }
  const cfg = PARAMS.acre.value
  const avec = compute(Object.assign(base(2500), {}))
  const s2 = base(2500); s2.meta.acre = true
  const r2 = compute(s2)
  const gain = avec.payroll.cost[0] - r2.payroll.cost[0]
  ok('assimilé salarié sous 75 % du PASS : 25 % de la part patronale de base effacée', near(gain, 2500 * cfg.coveredEmployer * cfg.rate, 0.5), `${gain.toFixed(0)} € par mois`)
  ok('et seulement pendant douze mois', near(avec.payroll.cost[12], r2.payroll.cost[12], 0.01))
  const s3 = base(4500); s3.meta.acre = true
  const r3 = compute(s3)
  ok('au-dessus du PASS, plus d’ACRE', near(compute(base(4500)).payroll.cost[0], r3.payroll.cost[0], 0.01))
  const s4 = base(3600); s4.meta.acre = true   // 43 200 € : entre 75 % et 100 % du PASS
  const g4 = compute(base(3600)).payroll.cost[0] - compute(s4).payroll.cost[0]
  const plein = 3600 * cfg.coveredEmployer * cfg.rate
  ok('entre 75 % et 100 % du PASS, une ACRE dégressive', g4 > 0 && g4 < plein, `${g4.toFixed(0)} € sur ${plein.toFixed(0)} € possibles`)
  const inc = founderIncome(s2, r2)
  ok('le revenu du fondateur compte l’ACRE la première année', inc.rows[0].acreSaving > 0 && inc.rows[1].acreSaving === 0)
}

// ── Prêt d'honneur : un apport pour l'entreprise, une dette pour le fondateur ──
{
  const s = scenarioFromTemplate('conseil', 'audit', { sample: false })
  s.meta.startDate = '2026-01-01'
  s.activities = [newActivity({ name: 'Mission', unitPrice: 8000, unitCost: 0, volumes: { mode: 'manual', manual: Array.from({ length: 60 }, () => 1) } })]
  s.team = [newTeamMember({ role: 'Fondateur', contractType: 'dirigeant', monthlyGross: 2000 })]
  const sans = compute(s)
  s.financing.honourLoans = [{ id: 'h1', label: 'Initiative', network: 'initiative', amount: 18000, month: 0, months: 36, graceMonths: 6 }]
  const r = compute(s)
  ok('le prêt d’honneur entre en trésorerie au mois de son versement', near(r.cash.balance[0] - sans.cash.balance[0], 18000, 1))
  ok('il ne pèse pas sur le compte de résultat', near(r.pnl.netResult[0], sans.pnl.netResult[0], 1))
  ok('il compte dans les capitaux propres, et le bilan tient', near(r.balance[0].capital - sans.balance[0].capital, 18000, 1) && r.balance.every((b) => near(b.totalAssets, b.totalLiabilities, 2)))
  const avec = founderIncome(s, r), sansInc = founderIncome(s, sans)
  ok('six mois de différé, puis 500 € par mois sur le revenu du fondateur',
    near(avec.rows[0].honourRepayment, 3000, 1) && near(avec.rows[1].honourRepayment, 6000, 1) && near(sansInc.rows[0].disposable - avec.rows[0].disposable, 3000, 1))
  ok('remboursé en entier, rien au-delà', near(somme(avec.rows.map((x) => x.honourRepayment)), 18000, 1))
  ok('il apparaît dans le plan de financement', near(r.fundingPlan[0].honour, 18000, 1))
}
