/**
 * Les impayés, saisis sur une offre, se lisent partout où ils comptent.
 *
 * On règle 3 % d'impayés sur l'abonnement de l'exemple, comme un fondateur,
 * dans « Délais de paiement et acomptes ». Puis :
 *
 *   1. le plan les porte, et le moteur les passe en pertes sur créances ;
 *   2. le compte de résultat ligne à ligne les montre sous l'EBE, et dit que
 *      c'est ce qui sépare l'EBITDA de l'EBE ;
 *   3. la cascade du récit les retranche et tombe toujours sur le résultat net.
 */
export const nom = 'Impayés — saisis sur l’offre, lus sous l’EBE'

export default async function (t) {
  const p = await t.page('bureau')
  await t.exemple(p)

  // 1. La saisie.
  await t.aller(p, 'offre')
  if (!(await p.locator('.item.open').count())) { await p.locator('.item-head').first().click(); await p.locator('.item.open').first().waitFor() }
  await p.locator('.item.open button', { hasText: /^Hypothèses avancées$/ }).first().click()
  await t.pose(p)
  const bloc = p.locator('.item.open [data-gap="tune-paiement"]').first()
  if (!(await bloc.evaluate((e) => e.classList.contains('is-on')))) {
    await bloc.locator('.onoff').first().click()
    await t.pose(p)
  }
  const champ = p.locator('.item.open [data-gap="tune-paiement"] .field', { has: p.locator('label', { hasText: /^Impayés/ }) }).locator('input').first()
  t.verifie(await champ.count() === 1, 'le champ « Impayés » est dans les délais de paiement de l’offre')
  await champ.click()
  await p.keyboard.press('ControlOrMeta+a')
  await p.keyboard.type('3', { delay: 40 })
  await p.keyboard.press('Tab')
  await t.pose(p)
  const moteur = await p.evaluate(async () => {
    const { euro } = await import('./js/ui/dom.js')
    const st = (await import('./js/state/store.js')).default
    const r = st.result
    return {
      taux: st.scenario.activities[0].badDebtRate,
      pertes: r.pnl.badDebts, ebe: r.pnl.ebe, ebitda: r.pnl.ebitda,
      net: euro(r.pnl.netResult[0], { compact: Math.abs(r.pnl.netResult[0]) >= 100000 }),
    }
  })
  t.verifie(Math.abs(moteur.taux - 0.03) < 1e-9 && moteur.pertes[1] > 0, 'le plan porte 3 % d’impayés, passés en pertes', { taux: moteur.taux, pertes: moteur.pertes })
  t.verifie(moteur.ebitda.every((v, y) => Math.abs(v - (moteur.ebe[y] - moteur.pertes[y])) < 0.01), 'EBITDA = EBE − pertes sur créances')

  // 2. Le compte de résultat.
  await t.aller(p, 'resultats')
  const sig = p.locator('details.refine', { hasText: 'Voir le compte de résultat ligne à ligne' }).first()
  if (!(await sig.evaluate((d) => d.open))) { await sig.locator('summary').click(); await t.pose(p) }
  const texte = await sig.innerText()
  t.verifie(/Pertes sur créances irrécouvrables/.test(texte), 'le compte de résultat montre les pertes sur créances')
  t.verifie(/l'EBITDA retranche les pertes sur créances/.test(texte) && !/Égal à l'EBE/.test(texte), 'et dit ce qui sépare l’EBITDA de l’EBE')

  // 3. La cascade du récit.
  await t.aller(p, 'tableau-de-bord')
  await t.onglet(p, 'Pitch investisseur')
  await p.locator('.pitch-mise', { hasText: 'Récit' }).first().click()
  await t.pose(p)
  const cascade = await p.$$eval('.as-chap[data-chapitre="2"] .as-cascade-l', (e) => e.map((x) => [x.querySelector('.as-cascade-nom')?.textContent, x.querySelector('.as-cascade-val')?.textContent]))
  t.verifie(cascade.some(([l]) => l === 'Impayés') && cascade[cascade.length - 1][1] === moteur.net, 'la cascade retranche les impayés et tombe sur le résultat net', cascade.slice(-4))

  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()
}
