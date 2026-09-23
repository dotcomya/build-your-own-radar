/**
 * Le plan d'exemple, complet, sur les neuf pages et trois formats.
 *
 * Un plan neuf est presque vide ; l'exemple remplit tout — offres, équipe,
 * financement, campagnes — et c'est là que se cachent les débordements de
 * valeurs longues.
 */
import { PAGES, debordements } from '../lib/harnais.mjs'

export const nom = 'Rendus — plan d’exemple complet'

export default async function (t) {
  for (const format of ['bureau', 'telephone', 'tablette']) {
    const p = await t.page(format)
    await t.exemple(p, 'Restaurant')
    for (const r of PAGES) {
      await t.aller(p, r, 260)
      const titre = await p.evaluate(() => (document.querySelector('h1') || {}).textContent || '')
      const d = await debordements(p)
      t.verifie(titre && !d.page && !d.coupes.length, `${format} / exemple / ${r}`, { titre: titre.slice(0, 30), ...d })
    }
    t.verifie(p.erreurs.length === 0, `${format} : aucune erreur JavaScript`, [...new Set(p.erreurs)].slice(0, 3).join(' | '))
    await p.fermer()
  }
}
