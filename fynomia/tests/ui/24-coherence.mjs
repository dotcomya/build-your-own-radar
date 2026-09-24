/**
 * Un changement se lit partout, et nulle part l'ancien chiffre ne reste.
 *
 * Des cas concrets, saisis comme un fondateur :
 *
 *   1. le prix de l'abonnement monte : le chiffre d'affaires de l'offre suit
 *      exactement le rapport des prix, le résultat affiché est celui d'un
 *      calcul neuf, et aucun écran — synthèse, pitch, états financiers,
 *      dossier — ne garde un ancien montant ;
 *   2. une rafale : un prix, la croissance aussitôt, une autre page aussitôt,
 *      sans jamais laisser passer la seconde de pause — le plan prend les
 *      deux, et les écrans les deux ;
 *   3. la simulation suit le plan : un prix changé dans Offre n'y devient pas
 *      un « changement » fantôme qui le remettrait à l'ancien ;
 *   4. un redessin qui tombe pendant la frappe écrit d'abord ce qui est tapé ;
 *   5. l'infobulle d'un graphique s'éteint quand le graphique est redessiné.
 */
export const nom = 'Cohérence — un changement se lit partout, rien de périmé'

/** Les écrans où se lisent les chiffres du plan. */
const ECRANS = [
  ['tableau-de-bord', 'Synthèse'], ['tableau-de-bord', 'Pitch investisseur', 'Récit'], ['tableau-de-bord', 'Pitch investisseur', 'Tableau'],
  ['resultats', 'Compte de résultat'], ['resultats', 'Trésorerie'], ['business-case'],
]

/** Les montants qui comptent, au format de l'écran. */
const montants = (p) => p.evaluate(async () => {
  const { euro } = await import('./js/ui/dom.js')
  const r = (await import('./js/state/store.js')).default.result
  const out = {}
  const mettre = (k, v) => { if (Number.isFinite(v) && Math.abs(v) >= 1000) out[k] = euro(v) }
  for (let y = 0; y < 5; y++) {
    mettre(`CA A${y + 1}`, r.pnl.revenue[y]); mettre(`EBE A${y + 1}`, r.pnl.ebe[y]); mettre(`Net A${y + 1}`, r.pnl.netResult[y])
    mettre(`Marge brute A${y + 1}`, r.pnl.grossMargin[y]); mettre(`Trésorerie A${y + 1}`, r.cash.yearEnd[y])
  }
  mettre('Besoin', r.kpis.fundingNeed)
  return out
})

/** Le résultat affiché est-il celui d'un calcul neuf du plan affiché ? */
const frais = (p) => p.evaluate(async () => {
  const st = (await import('./js/state/store.js')).default
  const { compute } = await import('./js/engine/engine.js')
  const cle = (r) => JSON.stringify([r.pnl, r.cash.balance, r.kpis.fundingNeed, r.kpis.breakEven])
  return cle(st.result) === cle(compute(st.scenario))
})

async function lireEcrans(t, p) {
  const out = {}
  for (const [route, onglet, mise] of ECRANS) {
    await t.aller(p, route)
    if (onglet) await t.onglet(p, onglet)
    if (mise) { await p.locator('.pitch-mise', { hasText: mise }).first().click(); await t.pose(p, { voyage: false }) }
    out[[route, onglet, mise].filter(Boolean).join(' / ')] = await p.evaluate(() => {
      const root = document.getElementById('app')
      const parts = [root.innerText]
      root.querySelectorAll('svg text').forEach((x) => parts.push(x.textContent))
      root.querySelectorAll('[aria-label], [title]').forEach((x) => parts.push(x.getAttribute('aria-label') || '', x.getAttribute('title') || ''))
      return parts.join('\n')
    })
  }
  return out
}

/** Les anciens montants qui ont changé ne doivent plus se lire nulle part. */
function perimes(avant, apres, ecrans) {
  const changes = Object.entries(avant).filter(([k, v]) => apres[k] !== v && !Object.values(apres).includes(v))
  const restes = []
  for (const [ecran, texte] of Object.entries(ecrans)) {
    for (const [k, v] of changes) if (texte.includes(v)) restes.push(`${ecran} : ${k} = ${v}`)
  }
  return { changes: changes.length, restes }
}

async function offre(t, p, onglet) {
  await t.aller(p, 'offre')
  if (await p.locator('.module-nav .hnav-tab').count()) { await p.locator('.module-nav .hnav-tab').first().click(); await t.pose(p) }
  if (!(await p.locator('.item.open').count())) { await p.locator('.item-head').first().click(); await p.locator('.item.open').first().waitFor() }
  await p.locator('.item.open button', { hasText: new RegExp(`^${onglet}$`) }).first().click({ timeout: 3000 }).catch(() => {})
  await t.pose(p)
}
const champ = (p, libelle) => p.locator('.item.open .field', { has: p.locator('label', { hasText: libelle }) }).first().locator('input').first()
/** Le prix de l'abonnement — pas « Abonnements le premier mois », dans Volumes. */
const ABO = /^Abonnement (mensuel|annuel|trimestriel|par)/
async function taper(p, loc, texte, fin = 'Tab') {
  await loc.click()
  await p.keyboard.press('ControlOrMeta+a')
  await p.keyboard.type(texte, { delay: 60 })
  if (fin) await p.keyboard.press(fin)
}
const plan = (p) => p.evaluate(async () => {
  const a = (await import('./js/state/store.js')).default.scenario.activities[0]
  return { prix: Number(a.recurringPrice), croissance: Number(a.volumes.monthlyGrowth) }
})
const recurrentAnnuel = (p) => p.evaluate(async () => {
  const r = (await import('./js/state/store.js')).default.result
  const m = r.revenue.perActivity[0].recurring
  return [0, 1, 2, 3, 4].map((y) => m.slice(y * 12, y * 12 + 12).reduce((a, b) => a + b, 0))
})

export default async function (t) {
  const p = await t.page('bureau')
  await t.exemple(p)

  // 1. Le prix de l'abonnement, de 49 € à 67 €.
  const m0 = await montants(p)
  const e0 = await lireEcrans(t, p)
  const rec0 = await recurrentAnnuel(p)
  const prix0 = (await plan(p)).prix
  await offre(t, p, 'Paramètres de base')
  await taper(p, champ(p, ABO), '67')
  await t.pose(p)
  const prix1 = (await plan(p)).prix
  t.verifie(prix0 === 49 && prix1 === 67, 'le prix saisi est celui du plan', { prix0, prix1 })
  t.verifie(await frais(p), 'après le prix, le résultat affiché est celui d’un calcul neuf')
  const rec1 = await recurrentAnnuel(p)
  const rapport = rec1.map((v, y) => (rec0[y] ? v / rec0[y] : null)).filter((x) => x !== null)
  t.verifie(rapport.length > 0 && rapport.every((x) => Math.abs(x - prix1 / prix0) < 1e-9),
    'le chiffre d’affaires de l’abonnement suit exactement le rapport des prix', { rapport, attendu: prix1 / prix0 })
  const m1 = await montants(p)
  const e1 = await lireEcrans(t, p)
  let bilan = perimes(m0, m1, e1)
  t.verifie(bilan.changes >= 10 && bilan.restes.length === 0, 'aucun écran ne garde un ancien montant', bilan)
  const ligne = e1['resultats / Compte de résultat']
  t.verifie(['CA A1', 'EBE A2', 'Net A3'].every((k) => !m1[k] || ligne.includes(m1[k])), 'les états financiers donnent les nouveaux montants', { CA: m1['CA A1'], EBE: m1['EBE A2'], Net: m1['Net A3'] })

  // 2. La rafale : prix, croissance, autre page — sans une seconde de pause.
  await offre(t, p, 'Paramètres de base')
  await taper(p, champ(p, ABO), '39', null)
  await p.locator('.item.open button', { hasText: /^Volumes$/ }).first().click()
  await champ(p, 'Croissance mensuelle').waitFor({ timeout: 3000 })
  await taper(p, champ(p, 'Croissance mensuelle'), '15', null)
  await p.locator('.rail a, .rail button', { hasText: 'États financiers' }).first().click()
  await p.waitForFunction(() => location.hash === '#/resultats')
  await t.pose(p)
  const apresRafale = await plan(p)
  t.verifie(apresRafale.prix === 39 && Math.abs(apresRafale.croissance - 0.15) < 1e-12, 'la rafale : le plan prend le prix et la croissance', apresRafale)
  t.verifie(await frais(p), 'après la rafale, le résultat affiché est celui d’un calcul neuf')
  const m2 = await montants(p)
  bilan = perimes(m1, m2, await lireEcrans(t, p))
  t.verifie(bilan.changes >= 10 && bilan.restes.length === 0, 'après la rafale, aucun écran ne garde un montant intermédiaire', bilan)

  // 3. La simulation suit le plan.
  await t.aller(p, 'tableau-de-bord')
  await t.onglet(p, 'Simulation')
  await p.locator('.sim-knobs details.refine').first().locator('summary').click()
  const cout = p.locator('input.lever-range[aria-label*="Coût de revient"]').first()
  await cout.focus()
  for (let i = 0; i < 5; i++) await p.keyboard.press('ArrowRight')
  await t.pose(p)
  await offre(t, p, 'Paramètres de base')
  await taper(p, champ(p, ABO), '59')
  await t.pose(p)
  await t.aller(p, 'tableau-de-bord')
  const bac = await p.evaluate(() => ({
    note: document.querySelector('.sim-pending-note')?.textContent || '',
    marques: [...document.querySelectorAll('.knob-mark b')].map((x) => x.textContent),
  }))
  t.verifie(/Coût de revient/.test(bac.note) && !/Prix de l.abonnement/.test(bac.note), 'la simulation garde le curseur déplacé, sans changement fantôme sur le prix', bac.note)
  t.verifie(bac.marques[0] === '59 €', 'la valeur du plan posée sur le curseur est la nouvelle', bac.marques.slice(0, 2))

  // 4. Un redessin pendant la frappe écrit d'abord ce qui est tapé.
  await offre(t, p, 'Paramètres de base')
  const abo = champ(p, ABO)
  await abo.click()
  await p.keyboard.press('ControlOrMeta+a')
  await p.keyboard.type('72', { delay: 40 })
  // Un autre appareil, le guide, la fenêtre : quelque chose redessine la page.
  await p.evaluate(async () => {
    const st = (await import('./js/state/store.js')).default
    st.update((sc) => { sc.meta.touche = (sc.meta.touche || 0) + 1 }, { label: 'Ailleurs' })
  })
  await t.pose(p)
  const vu = await champ(p, ABO).evaluate((e) => ({ valeur: e.value, focus: document.activeElement === e, curseur: e.selectionStart }))
  t.verifie(vu.valeur === '72' && vu.focus && vu.curseur === 2 && (await plan(p)).prix === 72, 'un redessin pendant la frappe garde ce qui est tapé, et l’écrit', { vu, plan: await plan(p) })
  await p.keyboard.press('Tab')
  await t.pose(p)

  // 5. L'infobulle s'éteint avec le graphique qu'elle décrivait.
  await t.aller(p, 'resultats')
  const zone = p.locator('.chart-hot').first()
  await zone.scrollIntoViewIfNeeded()
  await zone.hover()
  await p.locator('.ctip.is-on').waitFor({ timeout: 3000 }).catch(() => {})
  const allumee = await p.locator('.ctip.is-on').count()
  await p.evaluate(async () => {
    const st = (await import('./js/state/store.js')).default
    st.update((sc) => { sc.activities[0].recurringPrice = 80 }, { label: 'Prix' })
  })
  await t.pose(p)
  t.verifie(allumee === 1 && (await p.locator('.ctip.is-on').count()) === 0, 'le graphique redessiné éteint l’infobulle et ses anciens montants', { allumee })

  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()
}
