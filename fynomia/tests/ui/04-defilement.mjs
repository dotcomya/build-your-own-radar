/**
 * La page ne se raccourcit pas sous le doigt et ne bloque pas le défilement.
 *
 * Une hauteur de document qui change pendant qu'on défile fait sauter
 * l'écran ; un défilement qui s'arrête avant le bas cache la fin de la page.
 */
import { PAGES } from '../lib/harnais.mjs'

export const nom = 'Défilement et débordements'

/**
 * Attendre que la molette ait fait son effet : la page a défilé, ou elle est
 * déjà en bas. Sous charge, le défilement peut commencer bien après le geste ;
 * un écran immobile ne prouve donc pas qu'il a eu lieu.
 */
const avance = (p, depuis = 0) => p.waitForFunction((y0) => window.scrollY > y0 + 4
  || window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 4, depuis, { timeout: 3000 }).catch(() => {})

export default async function (t) {
  for (const format of ['large', 'telephone']) {
    const p = await t.page(format)
    await t.exemple(p)
    const hFenetre = format === 'large' ? 1000 : 844
    for (const k of PAGES) {
      await t.aller(p, k)
      const h0 = await p.evaluate(() => document.documentElement.scrollHeight)
      await p.mouse.wheel(0, 700); await avance(p); await t.pose(p)
      const h1 = await p.evaluate(() => document.documentElement.scrollHeight)
      const y1 = await p.evaluate(() => Math.round(window.scrollY))
      await p.mouse.wheel(0, 900); await avance(p, y1); await t.pose(p)
      const y2 = await p.evaluate(() => Math.round(window.scrollY))
      const h2 = await p.evaluate(() => document.documentElement.scrollHeight)
      t.verifie(Math.abs(h0 - h1) <= 2 && Math.abs(h1 - h2) <= 2, `${format} / ${k} : hauteur stable`, `${h0}/${h1}/${h2}`)
      const max = h0 - hFenetre
      t.verifie(!(y1 < max - 4 && y2 <= y1 + 4), `${format} / ${k} : le défilement avance`, `${y1}→${y2} (max ${max})`)
      const ov = await p.evaluate(() => [...document.querySelectorAll('.module, .module-top, .card, .slab, .metric-value')]
        .filter((e) => e.scrollWidth > e.clientWidth + 2).map((e) => e.className).slice(0, 3))
      t.verifie(!ov.length, `${format} / ${k} : aucun bloc ne déborde`, ov)
      t.verifie(!(await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), `${format} / ${k} : pas de défilement horizontal`)
    }
    t.verifie(p.erreurs.length === 0, `${format} : aucune erreur JavaScript`, p.erreurs.slice(0, 2).join(' | '))
    await p.fermer()
  }
}
