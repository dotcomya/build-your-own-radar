/**
 * Le pitch investisseur : l'essentiel du plan, juste et lisible.
 *
 * On ouvre l'onglet sur l'exemple et on vérifie qu'il dit ce qu'un
 * investisseur cherche, dans l'ordre, et que ses chiffres sont ceux du
 * moteur : le besoin affiché en couverture est celui des états financiers,
 * la trajectoire suit l'exercice choisi, chaque partie dit pourquoi elle
 * compte. Puis la même page au téléphone, sans débordement.
 */
import { debordements } from '../lib/harnais.mjs'

export const nom = 'Pitch investisseur — l’essentiel du plan'

export default async function (t, { rapide } = {}) {
  const p = await t.page('bureau')
  await t.exemple(p)
  await t.aller(p, 'tableau-de-bord', 800)
  await t.onglet(p, 'Pitch investisseur', 1200)

  const parties = await p.$$eval('.pitch .sx > .sx-head .sx-no > span', (e) => e.map((x) => x.textContent))
  t.verifie(parties.length === 7, 'sept parties, dans l’ordre où un investisseur les lit', parties)
  t.verifie(/vends/.test(parties[0] || '') && /financer/.test(parties[3] || '') && /demandera/.test(parties[6] || ''), 'l’offre d’abord, le besoin au milieu, les ratios à la fin', parties)
  const dits = await p.$$eval('.pitch .sx-say', (e) => e.map((x) => x.textContent.trim()))
  t.verifie(dits.length === 7 && dits.every((d) => d.length > 40), 'chaque partie dit pourquoi elle compte', dits.map((d) => d.length))

  // Le besoin de la couverture est celui du moteur.
  const besoin = await p.evaluate(async () => {
    const st = (await import('./js/state/store.js')).default
    return Math.round(st.result.kpis.fundingNeed)
  })
  const ask = (await p.locator('.pitch-ask b').innerText()).replace(/\D/g, '')
  t.verifie(besoin > 0 && Number(ask) === besoin, 'le montant de la couverture est le besoin calculé', `${ask} / ${besoin}`)

  // Les quatre chiffres suivent l'exercice.
  const avant = await p.locator('.pitch .sx-card .sx-big-val').first().innerText()
  await p.locator('.pitch .sx-year', { hasText: 'A4' }).first().click()
  await p.waitForTimeout(700)
  const apres = await p.locator('.pitch .sx-card .sx-big-val').first().innerText()
  t.verifie(avant !== apres, 'choisir A4 change la trajectoire affichée', `${avant} → ${apres}`)

  // La même tête que la synthèse essai, pour comparer les deux onglets.
  t.verifie(await p.locator('.pitch-dossier .sy-hero').count() === 1, 'l’avancement du dossier est en tête, comme dans l’essai')
  t.verifie(await p.locator('.pitch-dossier .sy-dossier').count() === 1, 'ce qui est fait et ce qui reste, page par page')
  // L'avis d'un consultant sous chaque partie.
  const avis = await p.$$eval('.pitch-avis p', (e) => e.map((x) => x.textContent.trim()))
  t.verifie(avis.length === 7 && avis.every((x) => x.length > 40), 'l’avis de Fynomia sous chacune des sept parties', avis.length)
  // Aucun pourcentage absurde.
  const absurdes = await p.evaluate(() => (document.querySelector('.pitch').innerText.match(/-?\d[\d \u00a0\u202f]{3,}[ \u00a0]?%/g) || []).filter((x) => Math.abs(Number(x.replace(/[^\d-]/g, ''))) > 1000))
  t.verifie(absurdes.length === 0, 'aucun pourcentage au-delà de 1 000 %', absurdes)
  t.verifie(await p.locator('.pitch-offre').count() >= 1, 'les offres sont listées avec leur prix')
  t.verifie(await p.locator('.pitch-poste').count() >= 1, 'l’équipe est listée')
  t.verifie(await p.locator('.pitch-risques > li').count() >= 2, 'les risques sont nommés')
  t.verifie(await p.locator('.pitch-ratio').count() === 7, 'les sept ratios qu’on te demandera')
  // Sans phrase d'accroche, la couverture le dit et y emmène.
  t.verifie(await p.locator('.pitch-cover .pitch-manque').count() === 1, 'sans description, la couverture propose de l’écrire')
  // Le voyage : la page s'ouvre en haut (on lit son titre), puis la zone
  // s'éclaire d'un reflet qui la traverse.
  await p.locator('.pitch-cover .pitch-manque').click()
  let vu = { haut: false, reflet: false, anneau: false }
  for (let k = 0; k < 30 && !(vu.reflet && vu.anneau); k++) {
    await p.waitForTimeout(100)
    const e = await p.evaluate(() => {
      const z = document.querySelector('[data-gap="pitch"]')
      return { hash: location.hash, y: window.scrollY, reflet: !!z && z.classList.contains('is-shine'), anneau: !!z && z.classList.contains('spotlit') }
    })
    if (e.hash === '#/projet' && e.y === 0 && !e.reflet) vu.haut = true
    if (e.reflet) vu.reflet = true
    if (e.anneau) vu.anneau = true
  }
  t.verifie(await p.evaluate(() => location.hash) === '#/projet', 'et emmène à Mon projet')
  t.verifie(vu.haut, 'la page s’ouvre d’abord en haut, sur son titre')
  t.verifie(vu.reflet && vu.anneau, 'puis la zone s’éclaire d’un reflet et de l’anneau')
  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()

  if (!rapide) {
    const q = await t.page('telephone')
    await t.exemple(q)
    await t.aller(q, 'tableau-de-bord', 800)
    await q.locator('.module-nav .hnav-tab', { hasText: 'Pitch' }).first().click().catch(() => {})
    await q.waitForTimeout(1000)
    await t.defiler(q, 500, 120)
    const d = await debordements(q)
    t.verifie(!d.page && d.coupes.length === 0, 'téléphone : ni débordement ni chiffre coupé', d)
    t.verifie(q.erreurs.length === 0, 'téléphone : aucune erreur JavaScript', q.erreurs.slice(0, 2))
    await q.fermer()
  }
}
