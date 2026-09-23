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

  // Mise en page « Récit » (celle par défaut) : huit parties, le titre et
  // sa phrase sur une même ligne, l'avis de Fynomia à droite de chacune.
  t.verifie(await p.locator('.pitch-mise.is-on', { hasText: 'Récit' }).count() === 1, 'le récit est la mise en page par défaut')
  const parties = await p.$$eval('.pitch .sx > .sx-head .sx-no > .sx-name', (e) => e.map((x) => x.textContent))
  t.verifie(parties.length === 8, 'huit parties, dans l’ordre où un investisseur les lit', parties)
  t.verifie(/trajectoire/i.test(parties[0] || '') && /vends/.test(parties[1] || '') && /demandera/.test(parties[7] || ''), 'la trajectoire d’abord, l’offre ensuite, les ratios à la fin', parties)
  const lignes = await p.$$eval('.pitch .sx > .sx-head .sx-no', (e) => e.map((x) => {
    const n = x.querySelector('.sx-name'), d = x.querySelector('.sx-say')
    return { dit: d ? d.textContent.trim().length : 0, meme: !!n && !!d && d.getBoundingClientRect().top < n.getBoundingClientRect().bottom }
  }))
  t.verifie(lignes.every((l) => l.dit > 30), 'chaque partie dit pourquoi elle compte', lignes.map((l) => l.dit))
  t.verifie(lignes.every((l) => l.meme), 'le titre et sa phrase sont sur la même ligne')
  const cote = await p.$$eval('.pitch-ligne-corps', (e) => e.map((x) => {
    const m = x.querySelector('.pitch-ligne-main'), a = x.querySelector('.pitch-avis')
    return !!m && !!a && a.getBoundingClientRect().left >= m.getBoundingClientRect().right - 1
  }))
  t.verifie(cote.length === 8 && cote.every(Boolean), 'l’avis de Fynomia est un bloc à droite de chaque partie', cote)
  // Des courbes : la trésorerie et ses jalons, le chiffre d'affaires et le
  // résultat ; et le récit de la trajectoire, en toutes lettres.
  t.verifie(await p.locator('.pitch .pitch-traj svg').count() >= 1, 'la trajectoire de trésorerie est tracée, avec ses jalons')
  t.verifie(await p.locator('.pitch .pitch-croiss .chart polyline.ch-line').count() >= 1, 'le résultat net est une courbe sur les barres du chiffre d’affaires')
  const recitTraj = await p.locator('.pitch-traj-dit').innerText().catch(() => '')
  t.verifie(/année 5/i.test(recitTraj) && /exercice bénéficiaire|trésorerie/i.test(recitTraj), 'la trajectoire se raconte en toutes lettres', recitTraj.slice(0, 90))

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
  // L'avis d'un consultant pour chaque partie.
  const avis = await p.$$eval('.pitch-avis p', (e) => e.map((x) => x.textContent.trim()))
  t.verifie(avis.length === 8 && avis.every((x) => x.length > 40), 'l’avis de Fynomia pour chacune des huit parties', avis.length)
  // Ce qui reste à faire : les colonnes alignées, et un bouton pour voir le reste.
  const dossier = await p.evaluate(() => {
    const cols = [...document.querySelectorAll('.pitch-dossier .sy-dossier-col')]
    const hauts = cols.map((c) => c.querySelector('.sy-dossier-bloc, .sy-dossier-ok')?.getBoundingClientRect().top).filter((x) => x !== undefined)
    return { ecart: hauts.length ? Math.max(...hauts) - Math.min(...hauts) : 0, plus: document.querySelectorAll('.pitch-dossier .sy-dossier-more').length }
  })
  t.verifie(dossier.ecart < 2, 'ce qui reste commence à la même hauteur dans chaque colonne', `${Math.round(dossier.ecart)} px`)
  t.verifie(dossier.plus >= 1, 'un bouton « Voir les autres » ouvre ce qui n’est pas affiché', String(dossier.plus))
  // Aucun pourcentage absurde.
  const absurdes = await p.evaluate(() => (document.querySelector('.pitch').innerText.match(/-?\d[\d \u00a0\u202f]{3,}[ \u00a0]?%/g) || []).filter((x) => Math.abs(Number(x.replace(/[^\d-]/g, ''))) > 1000))
  t.verifie(absurdes.length === 0, 'aucun pourcentage au-delà de 1 000 %', absurdes)
  t.verifie(await p.locator('.pitch-offre').count() >= 1, 'les offres sont listées avec leur prix')
  t.verifie(await p.locator('.pitch-poste').count() >= 1, 'l’équipe est listée')
  t.verifie(await p.locator('.pitch-risques > li').count() >= 2, 'les risques sont nommés')
  t.verifie(await p.locator('.pitch-ratio').count() === 7, 'les sept ratios qu’on te demandera')
  // Sans phrase d'accroche, la couverture le dit et y emmène.
  t.verifie(await p.locator('.pitch-cover .pitch-manque').count() === 1, 'sans description, la couverture propose de l’écrire')

  // Les deux autres mises en page portent le même contenu.
  await p.locator('.pitch-mise', { hasText: 'Tableau' }).click()
  await p.waitForTimeout(800)
  const tuiles = await p.$$eval('.pitch-bento .pitch-tuile', (e) => e.map((x) => ({ titre: x.querySelector('h3')?.textContent, avis: !!x.querySelector('.pitch-avis') })))
  t.verifie(tuiles.length === 8 && tuiles.every((x) => x.avis), 'tableau : huit tuiles, chacune avec son avis', tuiles.length)
  await p.locator('.pitch-mise', { hasText: 'Diapos' }).click()
  await p.waitForTimeout(800)
  t.verifie(await p.locator('.pitch-deck .pitch-diapo').count() === 8, 'diapos : huit diapositives')
  await p.locator('.pitch-fleche[aria-label="Diapositive suivante"]').click()
  await p.waitForTimeout(900)
  t.verifie((await p.locator('.pitch-compteur').innerText()).startsWith('2'), 'diapos : la flèche passe à la suivante')
  await p.locator('.pitch-mise', { hasText: 'Récit' }).click()
  await p.waitForTimeout(700)
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
