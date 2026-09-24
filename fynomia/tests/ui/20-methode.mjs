/**
 * Un repère cite sa source, et une page dit comment il est construit.
 *
 *   1. « 75 % à 90 % dans ton métier » porte, à côté, l'éditeur et l'année
 *      des données, et mène à la page Méthode ;
 *   2. la page Méthode donne les repères du métier ouvert — fourchette et
 *      calcul —, la façon dont une fourchette est construite, ce que Fynomia
 *      en fait, et toutes les sources avec leur année et leur lien ;
 *   3. on y arrive aussi depuis la position dans le métier et depuis Réglages.
 */
export const nom = 'Méthode — chaque repère cite sa source'

export default async function (t) {
  const p = await t.page('bureau')
  await t.exemple(p)

  // 1. Dans l'avis du pitch.
  await t.aller(p, 'tableau-de-bord')
  await t.onglet(p, 'Pitch')
  await p.locator('.pitch-mise', { hasText: /R[ée]cit/ }).first().click({ timeout: 3000 }).catch(() => {})
  await p.locator('.pitch-mise.is-on', { hasText: /R[ée]cit/ }).first().waitFor({ timeout: 3000 }).catch(() => {})
  await t.pose(p)
  await t.defiler(p)
  const mention = p.locator('.repere-src').first()
  const texte = (await mention.count()) ? await mention.innerText() : ''
  t.verifie(/KeyBanc 2024/.test(texte) && /méthode/.test(texte), 'la fourchette du métier cite sa source et son année', texte)

  // 2. La page Méthode.
  await t.aller(p, 'methode')
  const titre = await p.locator('.module-title').first().innerText().catch(() => '')
  t.verifie(/D’où viennent les repères/.test(titre), 'la page Méthode s’ouvre', titre)
  const ratios = await p.locator('.mt-table tr[data-ratio]').evaluateAll((els) => els.map((e) => e.dataset.ratio))
  t.verifie(ratios.includes('grossMargin') && ratios.includes('churn'), 'elle donne les repères du métier, un par ligne', ratios)
  const calc = await p.locator('.mt-table tr[data-ratio="grossMargin"] .mt-calcul').innerText().catch(() => '')
  t.verifie(/achats consommés/.test(calc), 'avec leur calcul', calc)
  const sources = await p.locator('.mt-sources li').evaluateAll((els) => els.map((e) => ({ cle: e.dataset.source, annee: e.querySelector('.mt-annee')?.textContent, lien: e.querySelector('a')?.getAttribute('href') })))
  t.verifie(sources.length >= 5 && sources.every((x) => /données 20\d\d/.test(x.annee) && /^https:\/\//.test(x.lien)), 'toutes les sources, avec l’année des données et un lien', sources)
  const blocs = await p.locator('.mt-bloc-titre').allInnerTexts()
  t.verifie(blocs.some((b) => /construite/.test(b)) && blocs.some((b) => /ne disent pas/.test(b)), 'elle dit comment une fourchette est construite, et ce qu’elle ne dit pas', blocs)

  // 3. Depuis Réglages.
  await t.aller(p, 'reglages')
  t.verifie(await p.locator('a[href="#/methode"]').count() >= 1, 'Réglages mène à la méthode')

  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()
}
