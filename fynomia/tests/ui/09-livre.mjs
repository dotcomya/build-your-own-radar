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
  await p.waitForTimeout(700)
  await p.locator('.welcome-go').click({ timeout: 1500 }).catch(() => {})
  await p.waitForTimeout(300)
  await p.locator('.setup-search-input').fill('Restaurant'); await p.waitForTimeout(300)
  await p.locator('.setup-sector:has-text("Restaurant")').first().click(); await p.waitForTimeout(600)
  for (const r of PAGES) {
    await p.goto(`${url}#/${r}`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(350)
    const titre = await p.evaluate(() => (document.querySelector('h1') || {}).textContent || '')
    t.verifie(!!titre, `le fichier livré rend « ${r} »`)
  }
  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript dans le fichier livré', p.erreurs.slice(0, 2))
  await p.fermer()
}
