/**
 * Les suggestions du métier, comme sur la maquette.
 *
 * « La partie où tu suggères des éléments à ajouter doit être un peu plus
 * jolie. » Un titre qui nomme le métier, un compteur, trois pastilles
 * blanches au « + » jaune, puis « +N » ; le montant passe dans l'infobulle.
 *
 *   1. un glacier lit « Suggestions pour un glacier », « N disponibles »,
 *      trois pastilles et « +N » ; chaque pastille ne porte que son nom ;
 *   2. « +N » déplie tout, sur place ; « Voir moins » replie ;
 *   3. changer de page et revenir : la liste est repliée ;
 *   4. une pizzeria lit « Suggestions pour une pizzeria ».
 */
export const nom = 'Suggestions — un titre, un compteur, trois pastilles'

export default async function (t) {
  const p = await t.page('bureau')
  await t.metier(p, 'Glacier')
  await t.aller(p, 'offre')

  const lire = () => p.evaluate(() => {
    const b = document.querySelector('.tradetip.is-offers')
    if (!b) return null
    const items = [...b.querySelectorAll('.tradetip-item')]
    const plus = b.querySelector('.tradetip-plus')
    return {
      titre: b.querySelector('.tradetip-title')?.textContent.trim(),
      compte: b.querySelector('.tradetip-count')?.textContent.trim(),
      total: items.length,
      visibles: items.filter((x) => x.getBoundingClientRect().width > 0).length,
      plus: b.querySelector('.tradetip-more')?.getBoundingClientRect().width > 0 ? b.querySelector('.tradetip-more').textContent.trim() : null,
      lien: b.querySelector('.tradetip-all')?.textContent.trim() || null,
      fondPlus: plus ? getComputedStyle(plus).backgroundColor : null,
      fondPastille: items[0] ? getComputedStyle(items[0]).backgroundColor : null,
      nomsSeuls: items.every((x) => x.textContent.trim() === x.querySelector('.tradetip-label').textContent.trim()),
      infobulles: items.every((x) => /€/.test(x.title)),
    }
  })

  // 1. Le bloc replié.
  const a = await lire()
  t.verifie(a && a.titre === 'Suggestions pour un glacier', 'le titre nomme le métier, avec son article', a?.titre)
  t.verifie(a && a.compte === `${a.total} disponible${a.total > 1 ? 's' : ''}`, 'le compteur dit combien de suggestions sont proposées', a && { compte: a.compte, total: a.total })
  t.verifie(a && a.total > 3 && a.visibles === 3 && a.plus === `+${a.total - 3}`, 'trois pastilles, puis « +N »', a && { visibles: a.visibles, plus: a.plus })
  t.verifie(a && a.lien === 'Voir toutes les suggestions', 'le lien « Voir toutes les suggestions » est là', a?.lien)
  t.verifie(a && a.fondPlus === 'rgb(214, 240, 52)' && a.fondPastille === 'rgb(255, 255, 255)', 'des pastilles blanches au « + » jaune', a && { plus: a.fondPlus, pastille: a.fondPastille })
  t.verifie(a && a.nomsSeuls && a.infobulles, 'chaque pastille ne porte que son nom ; le montant est dans l’infobulle')

  // 2. Déplier, replier.
  await p.locator('.tradetip.is-offers .tradetip-more').click()
  const b = await lire()
  t.verifie(b && b.visibles === b.total && !b.plus && b.lien === 'Voir moins', '« +N » déplie toutes les suggestions, sur place', b && { visibles: b.visibles, lien: b.lien })
  await p.locator('.tradetip.is-offers .tradetip-all').click()
  const c = await lire()
  t.verifie(c && c.visibles === 3 && c.lien === 'Voir toutes les suggestions', '« Voir moins » replie', c && { visibles: c.visibles })

  // 3. Déplié, puis on change de page et on revient : replié.
  await p.locator('.tradetip.is-offers .tradetip-all').click()
  await t.aller(p, 'achats')
  await t.aller(p, 'offre')
  const d = await lire()
  t.verifie(d && d.visibles === 3, 'revenu sur la page, la liste est repliée', d && { visibles: d.visibles })

  // 4. Au féminin.
  const q = await t.page('bureau')
  await t.metier(q, 'Pizzeria')
  await t.aller(q, 'achats')
  const titre = await q.locator('.tradetip-title').first().textContent().catch(() => '')
  t.verifie(titre.trim() === 'Suggestions pour une pizzeria', 'une pizzeria : « pour une pizzeria »', titre)

  t.verifie(p.erreurs.length === 0 && q.erreurs.length === 0, 'aucune erreur JavaScript', [...p.erreurs, ...q.erreurs].slice(0, 2))
  await p.fermer()
  await q.fermer()
}
