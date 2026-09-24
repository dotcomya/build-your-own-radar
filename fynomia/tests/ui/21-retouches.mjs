/**
 * Deux retouches demandées sur la page publiée.
 *
 *   1. Une charge par vente se chiffre de deux façons, et de deux seulement :
 *      en pourcentage du prix, ou en montant fixe par produit vendu. Pas de
 *      montant mensuel sur sa ligne, pas de forfait caché.
 *   2. Un avertissement ouvert passe devant tout, y compris le guide
 *      flottant « Prochaine étape », sur un écran de portable.
 */
export const nom = 'Retouches — charges par vente, avertissement au premier plan'

export default async function (t) {
  const p = await t.page({ width: 1280, height: 720 })
  await t.exemple(p)

  // 1. Une charge par vente.
  await t.aller(p, 'achats', 900)
  const sugg = p.locator('button', { hasText: 'Commission de paiement' }).first()
  if (await sugg.count()) { await sugg.click(); await p.waitForTimeout(900) }
  const ligne = p.locator('.costblock.is-variable .cost-row').first()
  t.verifie(await ligne.count() === 1, 'la commission arrive dans les charges par vente')
  const choix = await ligne.locator('.cost-seg-opt').allInnerTexts()
  t.verifie(choix.length === 2 && /% du prix/.test(choix[0]) && /par produit vendu/.test(choix[1]), 'deux choix seulement : % du prix, ou € par produit vendu', choix)
  t.verifie(!(await ligne.locator('.cost-amount').count()) && !(await ligne.locator('select').count()), 'ni montant mensuel ni liste de modes sur la ligne')
  const forfait = await p.evaluate(async () => {
    const st = (await import('./js/state/store.js')).default
    const o = st.scenario.opex.find((x) => x.label === 'Commission de paiement')
    return o ? { mode: o.mode, mensuel: o.monthlyAmount } : null
  })
  t.verifie(forfait && forfait.mode === 'pctRevenue' && Number(forfait.mensuel) === 0, 'aucun forfait mensuel caché derrière le pourcentage', forfait)
  await ligne.locator('.cost-seg-opt', { hasText: 'par produit vendu' }).click()
  await p.waitForTimeout(700)
  const apres = await p.evaluate(async () => {
    const st = (await import('./js/state/store.js')).default
    return st.scenario.opex.find((x) => x.label === 'Commission de paiement')?.mode
  })
  t.verifie(apres === 'perUnit' && await p.locator('.costblock.is-variable .cost-row').first().locator('.cost-extra span', { hasText: 'produit' }).count() === 1, 'l’autre choix se prend d’un clic, en € par produit', apres)

  // 2. L'avertissement devant le guide flottant.
  await t.aller(p, 'offre', 900)
  if (!(await p.locator('.item.open').count())) { await p.locator('.item-head').first().click(); await p.waitForTimeout(700) }
  const abo = p.locator('.item.open .field', { has: p.locator('label', { hasText: /^Abonnement/ }) }).locator('input').first()
  await abo.fill('12000'); await abo.blur(); await p.waitForTimeout(1000)
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300)
  await p.locator('.sx-ribbon-ctrl .garde summary').first().click(); await p.waitForTimeout(500)
  const masques = await p.evaluate(() => {
    const b = document.querySelector('.garde[open] .garde-body')
    if (!b) return ['pas de bulle']
    const R = b.getBoundingClientRect()
    const out = []
    for (let y = R.top + 10; y < Math.min(R.bottom, innerHeight) - 2; y += 20) for (let x = R.left + 10; x < R.right - 2; x += 40) {
      const e = document.elementFromPoint(x, y)
      if (e && !b.contains(e)) out.push(`${e.tagName}.${String(e.className).split(' ')[0]}`)
    }
    return [...new Set(out)]
  })
  t.verifie(masques.length === 0, 'la bulle « à vérifier » passe devant le guide flottant et tout le reste', masques)

  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()
}
