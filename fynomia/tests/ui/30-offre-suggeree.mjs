/**
 * Une offre suggérée par le métier s'ouvre et s'éclaire, elle et pas une autre.
 *
 * « Quand j'ajoute un nouveau produit que tu proposes, l'animation ne m'emmène
 * pas vers le nouveau produit ni ne fait de reflet sur lui, mais sur le premier
 * produit de la liste. » Le reflet visait la première zone « prix » de la page.
 */
export const nom = 'Offre suggérée — la nouvelle offre s’ouvre et s’éclaire'
export default async function (t) {
  const p = await t.page('bureau')
  await t.metier(p, 'Glacier')
  await t.aller(p, 'offre')
  const pastilles = p.locator('.tradetip.is-offers .tradetip-item')
  const n = await pastilles.count()
  t.verifie(n > 0, 'des offres sont suggérées', n)
  const avant = await p.evaluate(async () => (await import('./js/state/store.js')).default.scenario.activities.map((a) => a.id))
  await pastilles.first().click()
  // Le départ attend que l'éclat ait joué, puis le reflet se pose.
  await p.waitForFunction(() => document.querySelector('.spotlit'), null, { timeout: 5000 }).catch(() => {})
  await t.pose(p)
  const r = await p.evaluate(async (avant) => {
    const st = (await import('./js/state/store.js')).default
    const nouvelle = st.scenario.activities.find((a) => !avant.includes(a.id))
    const carte = nouvelle && document.querySelector(`[data-row="${nouvelle.id}"]`)
    const lit = [...document.querySelectorAll('.spotlit')]
    const rect = carte?.getBoundingClientRect()
    return {
      nb: st.scenario.activities.length, id: nouvelle?.id, nom: nouvelle?.name,
      carteOuverte: !!carte && (carte.classList.contains('open') || !!carte.closest('.item.open')),
      ouvertes: document.querySelectorAll('.item.open').length,
      eclaireDansNouvelle: lit.length > 0 && lit.every((e) => carte && carte.contains(e)),
      eclaires: lit.map((e) => (e.closest('[data-row]')?.dataset.row || '?') + ':' + e.className),
      visible: rect ? rect.top < innerHeight && rect.bottom > 0 : false,
      premiere: st.scenario.activities[0].id,
    }
  }, avant)
  t.verifie(r.nb === avant.length + 1, 'l’offre est ajoutée', r)
  t.verifie(r.carteOuverte && r.ouvertes === 1, 'seule la carte de la nouvelle offre est ouverte', r)
  t.verifie(r.eclaireDansNouvelle, 'le reflet est sur la nouvelle offre, pas la première', r)
  t.verifie(r.visible, 'la nouvelle offre est à l’écran', r)
  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()
}
