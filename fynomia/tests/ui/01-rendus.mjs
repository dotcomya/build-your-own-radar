/**
 * Chaque page, pour chaque métier, sur trois formats.
 *
 * Un plan neuf de chaque métier, rendu sur les neuf pages : un titre présent,
 * aucun défilement horizontal, aucune valeur clé coupée, aucune erreur
 * JavaScript. C'est la matrice qui attrape les régressions de mise en page.
 */
import { METIERS, PAGES, debordements } from '../lib/harnais.mjs'

export const nom = 'Rendus — métiers × pages × formats'

export default async function (t, { rapide }) {
  const metiers = rapide ? ['Restaurant', 'Cabinet de conseil', 'E-commerce'] : METIERS
  for (const format of ['bureau', 'telephone', 'tablette']) {
    const p = await t.page(format)
    for (const m of metiers) {
      await t.metier(p, m)
      for (const r of PAGES) {
        await t.aller(p, r)
        const titre = await p.evaluate(() => (document.querySelector('h1') || {}).textContent || '')
        const d = await debordements(p)
        t.verifie(titre && !d.page && !d.coupes.length, `${format} / ${m} / ${r}`, { titre: titre.slice(0, 30), ...d })
      }
    }
    t.verifie(p.erreurs.length === 0, `${format} : aucune erreur JavaScript`, [...new Set(p.erreurs)].slice(0, 3).join(' | '))
    await p.fermer()
  }
}
