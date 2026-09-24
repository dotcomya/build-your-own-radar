/**
 * Chaque ajout se voit.
 *
 * Accepter une suggestion faisait jaillir des icônes, voler une pastille
 * jusqu'à la ligne créée et l'éclairer à l'arrivée ; ajouter une charge à la
 * main ne faisait rien de tout cela, et la ligne arrivait sans qu'on la
 * trouve. On clique chaque bouton d'ajout — charge, charge « souvent
 * oubliée », investissement, poste, offre — et on vérifie les trois temps :
 * l'éclat, la ligne créée, l'arrivée éclairée.
 */
export const nom = 'Ajouts — chaque ajout jaillit et arrive éclairé'

async function essai(t, p, libelle, route, bouton, lignes, onglet = null) {
  await t.aller(p, route)
  if (onglet) await t.onglet(p, onglet)
  const avant = await p.locator(lignes).count()
  const b = typeof bouton === 'string' ? p.locator(bouton).first() : bouton(p)
  if (!(await b.count())) { t.verifie(false, `${libelle} : le bouton existe`); return }
  await b.click()
  await p.waitForFunction(() => document.querySelectorAll('.burst-bit').length >= 8, null, { timeout: 2000 }).catch(() => {})
  const eclats = await p.locator('.burst-bit').count()
  t.verifie(eclats >= 8, `${libelle} : des icônes jaillissent du bouton`, String(eclats))
  await p.locator(`${lignes}.is-just-added`).first().waitFor({ timeout: 2000 }).catch(() => {})
  const eclairee = await p.locator(`${lignes}.is-just-added`).count()
  const apres = await p.locator(lignes).count()
  t.verifie(apres === avant + 1, `${libelle} : une ligne de plus`, `${avant} → ${apres}`)
  t.verifie(eclairee === 1, `${libelle} : la ligne créée arrive éclairée`)
  await p.waitForFunction(() => !document.querySelector('.burst-bit, .burst-ghost'), null, { timeout: 2000 }).catch(() => {})
  t.verifie(!(await p.locator('.burst-bit, .burst-ghost').count()), `${libelle} : tout s'efface de lui-même`)
}

export default async function (t) {
  const p = await t.page('bureau')
  await t.exemple(p)
  await essai(t, p, 'Charge', 'achats', (q) => q.locator('.module-head button, button', { hasText: 'Ajouter une charge' }), '.cost-row')
  t.verifie(await p.locator('.cost-row.open').count() >= 1, 'Charge : la nouvelle charge s’ouvre, prête à être renseignée')
  await essai(t, p, 'Investissement', 'achats', (q) => q.locator('button', { hasText: 'Ajouter un investissement' }), '.capexcard', 'Investissements')
  await essai(t, p, 'Poste', 'equipe', (q) => q.locator('button', { hasText: 'Ajouter un poste' }), '.item')
  await essai(t, p, 'Offre', 'offre', (q) => q.locator('button', { hasText: 'Ajouter une offre' }), '.item')

  // La carte ouverte se soulève : un trait d'encre et une ombre portée, rien
  // qui tourne ni ne teinte le fond.
  // L'éclat de la dernière ligne ajoutée terminé, la carte est au repos.
  await p.waitForFunction(() => !document.querySelector('.is-just-added'), null, { timeout: 4000 }).catch(() => {})
  await t.pose(p)
  const carte = await p.evaluate(() => {
    const c = document.querySelector('.item.open')
    if (!c) return null
    const st = getComputedStyle(c)
    return { ombre: st.boxShadow, fond: st.backgroundColor, anim: st.animationIterationCount, transform: st.transform }
  })
  t.verifie(!!carte, 'une carte est ouverte')
  if (carte) {
    t.verifie(/rgba\(14, 15, 12/.test(carte.ombre) && !/214, 240, 52/.test(carte.ombre), 'la carte ouverte porte une ombre neutre, pas un halo coloré', carte.ombre.slice(0, 80))
    t.verifie(carte.anim !== 'infinite', 'rien ne tourne pendant qu’on saisit', carte.anim)
    t.verifie(carte.fond === 'rgb(255, 255, 255)', 'le fond reste blanc', carte.fond)
    t.verifie(carte.transform !== 'none', 'la carte est soulevée', carte.transform)
  }
  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()
}
