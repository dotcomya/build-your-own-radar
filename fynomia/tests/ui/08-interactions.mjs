/**
 * Les gestes qui doivent se voir.
 *
 * Le voyage vers une page, la carte qu'on travaille, une suggestion acceptée,
 * les cases de l'avancement, la rangée du financement, la disposition de Mon
 * projet, le bilan qui s'équilibre.
 */
export const nom = 'Interactions et dispositions'

export default async function (t) {
  const p = await t.page('bureau')
  await t.exemple(p)

  // Le voyage : depuis le pilotage, « Renseigner… » joue une vraie transition.
  await t.aller(p, 'tableau-de-bord')
  await t.onglet(p, 'Pilotage')
  await p.locator('.sy-ink .sy-btn.is-accent').click()
  // On regarde pendant le voyage : dès que sa classe et ses images sont là.
  await p.waitForFunction(() => /is-move-page/.test(document.documentElement.className)
    && document.getAnimations().some((a) => String(a.effect?.pseudoElement || '').includes('view-transition')), null, { timeout: 3000 }).catch(() => {})
  const voyage = await p.evaluate(() => ({
    classes: document.documentElement.className,
    anims: document.getAnimations().map((a) => String(a.effect?.pseudoElement || '')).filter((x) => x.includes('view-transition')).length,
  }))
  t.verifie(/is-move-page/.test(voyage.classes) && voyage.anims > 0, 'le voyage se joue vers la page visée', voyage)
  await p.waitForFunction(() => !/tableau-de-bord/.test(location.hash), null, { timeout: 4000 }).catch(() => {})
  await t.pose(p)
  t.verifie(!/tableau-de-bord/.test(await p.evaluate(() => location.hash)), 'on arrive sur une autre page')

  // Les cases de l'avancement, dans le pilotage : survol, puis clic.
  await t.aller(p, 'tableau-de-bord')
  await t.onglet(p, 'Pilotage')
  const n = await p.locator('.sy-cell').count()
  t.verifie(n >= 20, 'une case par ligne du dossier', `${n}`)
  await p.locator('.sy-cell').nth(2).hover(); await p.locator('.ctip.is-on').waitFor({ timeout: 3000 }).catch(() => {})
  const bulle = await p.evaluate(() => { const b = document.querySelector('.ctip.is-on'); return b ? b.innerText : '' })
  t.verifie(bulle.length > 10, 'le survol d’une case dit ce qu’elle est', bulle.slice(0, 80))
  await p.locator('.sy-cell:not(.is-done)').first().click()
  await p.waitForFunction(() => !/tableau-de-bord/.test(location.hash), null, { timeout: 4000 }).catch(() => {})
  await t.pose(p)
  t.verifie(!/tableau-de-bord/.test(await p.evaluate(() => location.hash)), 'le clic sur une case emmène à sa page')

  // La carte qu'on travaille : pas de fond jaune, une mise en relief.
  for (const route of ['equipe', 'offre']) {
    await t.aller(p, route)
    if (!(await p.locator('.item.open').count())) { await p.locator('.item-head').first().click(); await p.locator('.item.open').first().waitFor(); await t.pose(p) }
    const st = await p.evaluate(() => {
      const it = document.querySelector('.item.open'); if (!it) return null
      const fond = (el) => el ? getComputedStyle(el).backgroundColor : ''
      return { corps: fond(it.querySelector('.item-body')), carte: fond(it), ombre: getComputedStyle(it).boxShadow }
    })
    t.verifie(st && !/214, 240, 52/.test(st.corps + st.carte), `${route} : la carte ouverte n’a pas de fond jaune`, st)
    t.verifie(st && st.ombre && st.ombre !== 'none', `${route} : la carte ouverte ressort`, st && st.ombre.slice(0, 60))
  }

  // Une suggestion acceptée : l'éclat, la pastille qui vole, la ligne éclairée.
  await t.aller(p, 'achats')
  const pastille = p.locator('.tradetip-item').first()
  if (await pastille.count()) {
    await pastille.click()
    await p.waitForFunction(() => document.querySelectorAll('.burst-bit').length >= 10 && !!document.querySelector('.burst-ghost'), null, { timeout: 3000 }).catch(() => {})
    const eclat = await p.evaluate(() => ({ bits: document.querySelectorAll('.burst-bit').length, fantome: !!document.querySelector('.burst-ghost') }))
    t.verifie(eclat.bits >= 10 && eclat.fantome, 'une suggestion acceptée fait jaillir ses icônes', eclat)
    await p.locator('.is-just-added').first().waitFor({ timeout: 3000 }).catch(() => {})
    t.verifie(await p.locator('.is-just-added').count() === 1, 'la ligne créée s’éclaire')
  } else t.verifie(false, 'des suggestions sont proposées dans Achats et coûts')

  // Financement : les sept sources sur une rangée.
  await t.aller(p, 'financement')
  const rangees = await p.evaluate(() => new Set([...document.querySelectorAll('.sources > .source')].map((x) => Math.round(x.getBoundingClientRect().top))).size)
  t.verifie(rangees === 1, 'les sources de financement tiennent sur une ligne', `${rangees} rangées`)

  // Mon projet : nom et cadre juridique, puis métier et date.
  await t.aller(p, 'projet')
  const champs = await p.evaluate(() => [...document.querySelectorAll('.slab')[0].querySelectorAll(':scope > .grid > .field')]
    .map((f) => [f.querySelector('label')?.textContent, Math.round(f.getBoundingClientRect().top)]))
  const ligne = (l) => champs.find((c) => c[0] && c[0].startsWith(l))?.[1]
  t.verifie(ligne('Nom du projet') === ligne('Statut juridique'), 'nom et statut juridique sur la même ligne', champs)
  t.verifie(ligne('Type d') === ligne('Début d') && ligne('Type d') > ligne('Nom du projet'), 'métier et date sur la ligne suivante', champs)

  // Le bilan : les deux côtés affichent le même total.
  await t.aller(p, 'resultats')
  await t.onglet(p, 'Bilan')
  const totaux = await p.evaluate(() => [...document.querySelectorAll('.bil-side-total')].map((x) => x.textContent))
  t.verifie(totaux.length === 2 && totaux[0] === totaux[1], 'actif et passif affichent le même total', totaux)

  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()
}
