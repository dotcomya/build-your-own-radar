/**
 * Chaque onglet de chaque module s'ouvre, et devient l'onglet actif.
 */
import { PAGES } from '../lib/harnais.mjs'

export const nom = 'Onglets de tous les modules'

export default async function (t) {
  const p = await t.page('bureau')
  await t.exemple(p)
  let clics = 0
  for (const r of PAGES) {
    await t.aller(p, r)
    const n = await p.locator('.module-nav .hnav-tab').count()
    for (let i = 0; i < n; i++) {
      const avant = p.erreurs.length
      const tab = p.locator('.module-nav .hnav-tab').nth(i)
      const libelle = ((await tab.textContent()) || '').trim()
      await tab.click()
      await p.locator('.module-nav .hnav-tab.active', { hasText: libelle }).first().waitFor({ timeout: 3000 }).catch(() => {})
      await t.pose(p, { voyage: false })
      clics++
      const actif = ((await p.locator('.module-nav .hnav-tab.active').first().textContent()) || '').trim()
      t.verifie(actif === libelle && p.erreurs.length === avant, `${r} / ${libelle}`, { actif, erreurs: p.erreurs.slice(avant) })
    }
  }
  t.verifie(clics >= 20, 'au moins vingt onglets parcourus', `${clics}`)
  await p.fermer()
}
