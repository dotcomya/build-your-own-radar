/**
 * Chaque offre compte ce qu'elle vend.
 *
 * Une garde d'animaux vend des heures, mais aussi des laisses à la pièce et
 * une formule de promenades au mois. L'offre principale garde le mot du
 * métier ; une autre offre compte en ventes tant qu'on ne choisit rien, en
 * produits si on le choisit, ou dans le mot qu'on écrit. Ce qui additionne
 * toutes les offres dit « ventes » dès qu'elles ne comptent pas la même chose.
 */
export const nom = 'Unités — chaque offre compte ce qu’elle vend'

const libelles = (p) => p.evaluate(() => [...document.querySelectorAll('.item.open .field label')].map((x) => x.textContent))

async function ouvrirVolumes(t, p, i) {
  const offre = p.locator('.item').nth(i)
  if (!(await offre.evaluate((e) => e.classList.contains('open')))) await offre.locator('.item-head').click()
  await p.locator('.item.open').first().waitFor()
  await p.locator('.item.open button', { hasText: 'Volumes' }).first().click()
  await p.locator('.item.open select').first().waitFor()
  await t.pose(p)
}

export default async function (t) {
  const p = await t.page('bureau')
  await t.metier(p, 'Garde d’animaux')
  await p.evaluate(async () => {
    const st = (await import('./js/state/store.js')).default
    const { newActivity } = await import('./js/state/schema.js')
    st.update((s) => {
      s.activities[0].name = 'Garde à domicile'
      s.activities[0].unitPrice = 18
      s.activities.push(newActivity({ name: 'Laisses et accessoires', unitPrice: 15, unitCost: 6 }))
    })
  })
  await t.aller(p, 'offre')

  // L'offre principale : le mot du métier.
  await ouvrirVolumes(t, p, 0)
  t.verifie((await libelles(p)).includes('Heures le premier mois'), 'l’offre principale compte dans le mot du métier', await libelles(p))

  // Une autre offre : « ventes » tant qu'on ne choisit rien, puis ce qu'on choisit.
  await ouvrirVolumes(t, p, 1)
  t.verifie((await libelles(p)).includes('Ventes le premier mois'), 'une autre offre compte en ventes par défaut', await libelles(p))
  await p.locator('.item.open select').first().selectOption('produit')
  await p.locator('.item.open .field label', { hasText: 'Produits le premier mois' }).waitFor({ timeout: 3000 }).catch(() => {})
  t.verifie((await libelles(p)).includes('Produits le premier mois'), 'choisir « produits » change les volumes de cette offre', await libelles(p))
  t.verifie(/15 € par produit/.test(await p.locator('.item-meta').nth(1).innerText()), 'son prix se lit par produit', await p.locator('.item-meta').nth(1).innerText())

  // Un mot à soi.
  await p.locator('.item.open select').first().selectOption('libre')
  const mot = p.locator('.item.open .field', { hasText: 'Ton mot' }).locator('input')
  await mot.waitFor({ timeout: 3000 })
  await mot.fill('sortie'); await mot.blur(); await t.pose(p)
  t.verifie((await libelles(p)).includes('Sorties le premier mois'), 'un mot écrit à la main se met au pluriel', await libelles(p))

  // Le total : ni heures ni sorties, des ventes.
  const unites = await p.evaluate(async () => {
    const { vocabulaireDuPlan, uniteOffre } = await import('./js/state/sectors.js')
    const st = (await import('./js/state/store.js')).default
    return { plan: vocabulaireDuPlan(st.scenario).many, offres: st.scenario.activities.map((a) => uniteOffre(st.scenario, a).many) }
  })
  t.verifie(unites.plan === 'ventes' && unites.offres.join() === 'heures,sorties', 'ce qui additionne les offres dit « ventes »', unites)

  // Une seule offre, un seul mot : le métier revient partout.
  await p.evaluate(async () => {
    const st = (await import('./js/state/store.js')).default
    st.update((s) => { s.activities = s.activities.slice(0, 1) })
  })
  const seul = await p.evaluate(async () => (await import('./js/state/sectors.js')).vocabulaireDuPlan((await import('./js/state/store.js')).default.scenario).many)
  t.verifie(seul === 'heures', 'avec une seule offre, le total parle en heures', seul)

  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()
}
