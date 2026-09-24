/**
 * Le fichier livré fonctionne seul.
 *
 * C'est dist/fynomia.html qu'on publie : un seul fichier, CSS et JavaScript
 * intégrés. On l'ouvre, on crée un plan, on parcourt les pages — sans les
 * sources à côté.
 */
import { PAGES } from '../lib/harnais.mjs'

export const nom = 'Fichier livré (dist/fynomia.html)'

export default async function (t) {
  const p = await t.page('bureau')
  const url = t.url.replace('/index.html', '/dist/fynomia.html')
  await p.goto(`${url}#/creer`, { waitUntil: 'load' })
  await p.locator('.welcome-go, .setup-search-input').first().waitFor()
  if (await p.locator('.welcome-go').count()) await p.locator('.welcome-go').click()
  await p.locator('.setup-search-input').fill('Restaurant')
  await p.locator('.setup-sector:has-text("Restaurant")').first().click()
  await p.waitForFunction(() => !!localStorage.getItem('fynomia.current'))
  for (const r of PAGES) {
    await t.ouvrir(p, `${url}#/${r}`)
    const titre = await p.evaluate(() => (document.querySelector('h1') || {}).textContent || '')
    t.verifie(!!titre, `le fichier livré rend « ${r} »`)
  }
  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript dans le fichier livré', p.erreurs.slice(0, 2))
  await p.fermer()
}
