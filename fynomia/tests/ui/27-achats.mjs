/**
 * Une charge coupée, rallumée ou rechiffrée se lit partout, tout de suite.
 *
 * « Quand je déclique une charge, ça ne modifie pas forcément les calculs. »
 * Le moteur recalculait, mais une charge par vente comptait dans les charges
 * externes : ni le coût de ce qu'on vend, ni la marge de l'offre, ni la marge
 * brute ne bougeaient, et le point mort la traitait comme un loyer. On vérifie
 * donc, en cliquant comme un fondateur :
 *
 *   1. couper une charge par vente baisse le coût des ventes de son montant
 *      exact, relève la marge brute d'autant, laisse les charges externes en
 *      place — et le bandeau de la page le dit ;
 *   2. la rallumer et changer son taux : le coût d'une vente affiché sur
 *      l'offre suit, au centime ;
 *   3. le coût de revient d'une offre se saisit dans Achats et coûts, et
 *      l'offre l'affiche aussitôt ;
 *   4. couper une charge générale baisse les charges externes, pas la marge
 *      brute.
 */
export const nom = 'Achats — une charge coupée ou rechiffrée se lit partout'

const lire = (p) => p.evaluate(async () => {
  const st = (await import('./js/state/store.js')).default
  const { coutDUneVente } = await import('./js/engine/engine.js')
  const r = st.result, s = st.scenario
  const a = s.activities[0]
  const com = s.opex.find((o) => o.label === 'Commission de paiement')
  return {
    variable: r.pnl.variableCost[0], externe: r.pnl.external[0], marge: r.pnl.grossMargin[0], ebe: r.pnl.ebe[0],
    commission: r.opex.perItem.find((x) => x.id === com?.id)?.yearly[0] || 0,
    cout: coutDUneVente(s, a).total, unitCost: Number(a.unitCost) || 0, recurringCost: Number(a.recurringCost) || 0,
  }
})
const ruban = (p) => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-chiffres="achats"] .sx-ribbon-item')]
  .map((x) => [x.querySelector('.sx-ribbon-label')?.textContent || '', x.querySelector('.sx-ribbon-val')?.textContent || ''])))
const proche = (a, b) => Math.abs(a - b) < 0.01

export default async function (t) {
  const p = await t.page('bureau')
  await t.exemple(p)
  await t.aller(p, 'achats')

  // Une charge par vente : la commission de paiement du métier.
  const sugg = p.locator('.tradetip-item', { hasText: 'Commission de paiement' }).first()
  if (await sugg.count()) { await sugg.click(); await t.pose(p) }
  const ligne = p.locator('.costblock.is-variable .cost-row:not(.is-revient)').first()
  await ligne.waitFor({ timeout: 3000 })

  // 1. La couper.
  const v0 = await lire(p)
  const r0 = await ruban(p)
  t.verifie(v0.commission > 0, 'la commission compte dans le plan', v0.commission)
  await ligne.locator('.onoff').click()
  await t.pose(p)
  const v1 = await lire(p)
  const r1 = await ruban(p)
  t.verifie(proche(v0.variable - v1.variable, v0.commission) && proche(v1.marge - v0.marge, v0.commission),
    'coupée : le coût des ventes baisse du montant exact, la marge brute monte d’autant', { avant: v0.variable, apres: v1.variable, commission: v0.commission })
  t.verifie(proche(v0.externe, v1.externe), 'coupée : les charges externes ne bougent pas — une commission n’est pas un loyer', { avant: v0.externe, apres: v1.externe })
  t.verifie(v1.cout < v0.cout, 'coupée : le coût d’une vente de l’offre baisse', { avant: v0.cout, apres: v1.cout })
  t.verifie(r0['Coût de ce que tu vends'] && r1['Coût de ce que tu vends'] !== r0['Coût de ce que tu vends'] && r1['Charges externes'] === r0['Charges externes'],
    'coupée : le bandeau de la page suit, sur la bonne ligne', { avant: r0, apres: r1 })

  // 2. La rallumer, puis passer de 1,5 % à 3 %.
  await ligne.locator('.onoff').click()
  await t.pose(p)
  const v2 = await lire(p)
  t.verifie(proche(v2.variable, v0.variable), 'rallumée : le coût des ventes revient au centime', { v0: v0.variable, v2: v2.variable })
  const taux = ligne.locator('input[aria-label="Part des ventes"]')
  await taux.click()
  await p.keyboard.press('ControlOrMeta+a')
  await p.keyboard.type('3', { delay: 40 })
  await p.keyboard.press('Tab')
  await t.pose(p)
  const v3 = await lire(p)
  t.verifie(proche(v3.commission, v0.commission * 2) && proche(v3.variable - v0.variable, v0.commission),
    'le taux doublé double la commission, et le coût des ventes prend la différence', { commission: v3.commission, attendu: v0.commission * 2 })

  // Sur l'offre, le coût d'une vente affiché est le nouveau.
  await t.aller(p, 'offre')
  if (!(await p.locator('.item.open').count())) { await p.locator('.item-head').first().click(); await p.locator('.item.open').first().waitFor() }
  const lien = await p.locator('.item.open .costlink').first().innerText().catch(() => '')
  const attendu = await p.evaluate(async (v) => {
    const { num, euro } = await import('./js/ui/dom.js')
    return Math.abs(v) < 100 && Math.round(v * 100) % 100 !== 0 ? `${num(v, 2)} €` : euro(v)
  }, v3.cout)
  t.verifie(/commission de paiement 3,0\s%/.test(lien) && lien.includes(attendu), 'l’offre affiche le coût d’une vente recalculé, commission à 3 % comprise', { lien, attendu })

  // 3. Le coût de revient de l'offre, saisi dans Achats et coûts.
  await t.aller(p, 'achats')
  const revient = p.locator('.costblock.is-variable .cost-row.is-revient').first()
  t.verifie(await revient.count() === 1, 'le coût de revient de chaque offre se saisit dans les charges par vente')
  const champ = revient.locator('input').first()
  const avant = await lire(p)
  const cible = Math.round((avant.recurringCost || avant.unitCost) + 5)
  await champ.click()
  await p.keyboard.press('ControlOrMeta+a')
  await p.keyboard.type(String(cible), { delay: 40 })
  await p.keyboard.press('Tab')
  await t.pose(p)
  const apres = await lire(p)
  t.verifie((apres.recurringCost || apres.unitCost) === cible && apres.variable > avant.variable && proche(apres.cout - avant.cout, cible - (avant.recurringCost || avant.unitCost)),
    'le coût de revient saisi entre dans le plan, dans le coût des ventes et dans le coût d’une vente', { avant: avant.cout, apres: apres.cout, cible })

  // 4. Une charge générale : les charges externes bougent, pas la marge brute.
  const generale = p.locator('.costblock:not(.is-variable) .cost-row').first()
  const g0 = await lire(p)
  await generale.locator('.onoff').click()
  await t.pose(p)
  const g1 = await lire(p)
  t.verifie(!proche(g0.externe, g1.externe) && proche(g0.marge, g1.marge) && !proche(g0.ebe, g1.ebe),
    'une charge générale coupée ou rallumée : les charges externes et l’EBE bougent, la marge brute non', { externe: [g0.externe, g1.externe], marge: [g0.marge, g1.marge] })

  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()
}
