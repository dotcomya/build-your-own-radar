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
  await t.aller(p, 'tableau-de-bord')
  await t.onglet(p, 'Pitch investisseur')

  // « Récit » (par défaut) : l'analyse stratégique, en cinq chapitres qui
  // ont chacun un objectif, deux cartes — le diagnostic et la courbe — et la
  // phrase à dire au banquier, à l'investisseur, à l'équipe.
  t.verifie(await p.locator('.pitch-mise.is-on', { hasText: 'Récit' }).count() === 1, 'le récit est la mise en page par défaut')
  const chapitres = await p.$$eval('.as-chap', (e) => e.map((x) => ({
    titre: (x.querySelector('.as-titre')?.textContent || '').trim(),
    objectif: (x.querySelector('.as-objectif')?.textContent || '').trim().length,
    meta: (x.querySelector('.as-meta')?.textContent || '').trim(),
    diag: !!x.querySelector('.as-diag'), courbe: !!x.querySelector('.as-courbe'),
    cote: (() => { const d = x.querySelector('.as-diag'), c = x.querySelector('.as-courbe'); return !!d && !!c && c.getBoundingClientRect().left >= d.getBoundingClientRect().right - 1 })(),
    dire: x.querySelectorAll('.as-dire-case').length,
  })))
  t.verifie(chapitres.length === 5, 'cinq chapitres d’analyse stratégique', chapitres.map((c) => c.titre))
  t.verifie(/modèle/i.test(chapitres[0]?.titre) && /coûts/i.test(chapitres[1]?.titre) && /financement/i.test(chapitres[2]?.titre) && /équipe/i.test(chapitres[3]?.titre) && /risques/i.test(chapitres[4]?.titre),
    'le modèle, les coûts, le financement, l’équipe, les risques', chapitres.map((c) => c.titre))
  t.verifie(chapitres.every((c) => c.objectif > 30 && /facteur/.test(c.meta)), 'chaque chapitre a un objectif et compte ses facteurs bloquants', chapitres.map((c) => c.meta))
  t.verifie(chapitres.every((c) => c.diag && c.courbe && c.cote), 'deux cartes par chapitre : le diagnostic à gauche, la courbe à droite')
  t.verifie(chapitres.every((c) => c.dire >= 2), 'chaque chapitre dit quoi dire au banquier, à l’investisseur, à l’équipe', chapitres.map((c) => c.dire))
  const diags = await p.$$eval('.as-diag', (e) => e.map((x) => ({
    tag: (x.querySelector('.as-tag')?.textContent || '').trim(),
    titre: (x.querySelector('.as-carte-titre')?.textContent || '').trim(),
    lien: !!x.querySelector('.as-lien'),
  })))
  t.verifie(diags.every((d) => /\/\//.test(d.tag) && d.titre.length > 10 && d.lien), 'chaque diagnostic : sa gravité, son titre, le module où agir', diags.map((d) => d.tag))
  const couts = await p.locator('.as-chap[data-chapitre="2"] .as-ratio').first().innerText().catch(() => '')
  t.verifie(/charges fixes \/ CA/i.test(couts), 'les coûts se lisent en ratio charges fixes / chiffre d’affaires', couts)
  t.verifie(await p.locator('.as-chap[data-chapitre="2"] svg.as-j .as-j-aire').count() === 1, 'la trésorerie se dessine en courbe en J, avec son aire')
  t.verifie(await p.locator('.as-chap[data-chapitre="1"] .chart polyline.ch-line').count() >= 1, 'le résultat net est une courbe sur les barres du chiffre d’affaires')
  t.verifie(await p.locator('.as-chap[data-chapitre="3"] .as-bk-ligne').count() === 5, 'le financement donne les cinq vérifications du banquier')
  t.verifie(await p.locator('.as-chap[data-chapitre="5"] .as-courbe .as-barre').count() === 4, 'les risques sont rejoués en stress test : quatre imprévus')
  const questions = await p.$$eval('.as-question em', (e) => e.map((x) => x.textContent.trim().length))
  t.verifie(questions.length >= 4 && questions.every((l) => l > 25), 'la question qu’on te posera, chapitre par chapitre', questions)
  t.verifie(!(await p.locator('.module-nav .hnav-tab', { hasText: 'essai' }).count()), 'la synthèse essai n’est plus un onglet à part')
  t.verifie(!(await p.locator('.pitch .sy-hero, .pitch .pitch-dossier').count()), 'l’avancement du dossier a quitté le pitch pour le Pilotage')

  // Le besoin de la couverture est celui du moteur.
  const besoin = await p.evaluate(async () => {
    const st = (await import('./js/state/store.js')).default
    return Math.round(st.result.kpis.fundingNeed)
  })
  const ask = (await p.locator('.pitch-ask b').innerText()).replace(/\D/g, '')
  t.verifie(besoin > 0 && Number(ask) === besoin, 'le montant de la couverture est le besoin calculé', `${ask} / ${besoin}`)
  t.verifie(/investisseur/i.test(await p.locator('.pitch-hero .rvl-kicker').innerText()), 'un logiciel parle à un investisseur')
  t.verifie(await p.locator('.pitch-hero .rvl-bar').count() === 5 && await p.locator('.pitch-hero .rvl-line').count() === 1, 'la couverture trace cinq ans de chiffre d’affaires et la trésorerie')
  // Aucun pourcentage absurde.
  const absurdes = await p.evaluate(() => (document.querySelector('.pitch').innerText.match(/-?\d[\d \u00a0\u202f]{3,}[ \u00a0]?%/g) || []).filter((x) => Math.abs(Number(x.replace(/[^\d-]/g, ''))) > 1000))
  t.verifie(absurdes.length === 0, 'aucun pourcentage au-delà de 1 000 %', absurdes)
  // Sans phrase d'accroche, la couverture le dit et y emmène.
  t.verifie(await p.locator('.pitch-cover .pitch-manque').count() === 1, 'sans description, la couverture propose de l’écrire')

  // Tableau : en clair, huit tuiles.
  await p.locator('.pitch-mise', { hasText: 'Tableau' }).click()
  await p.locator('.pitch-mise.is-on', { hasText: 'Tableau' }).waitFor({ timeout: 3000 }).catch(() => {})
  await t.pose(p)
  const tuiles = await p.$$eval('.pz-cockpit .pitch-tuile', (e) => e.map((x) => ({
    chiffre: (x.querySelector('.pz-chiffre b')?.textContent || '').trim(),
    verdict: (x.querySelector('.pz-verdict')?.textContent || '').trim(),
    ton: !!x.querySelector('.pz-ton'),
    fond: getComputedStyle(x).backgroundColor,
  })))
  t.verifie(tuiles.length === 8 && tuiles.every((x) => x.chiffre && x.verdict && x.ton), 'tableau : huit tuiles, chacune avec son chiffre, son verdict et son ton', tuiles.length)
  t.verifie(tuiles.every((x) => x.fond === 'rgb(255, 255, 255)'), 'tableau : des tuiles claires, plus de noir partout', tuiles.map((x) => x.fond))
  await p.locator('.pz-cockpit .pz-ouvrir').nth(2).click()
  await p.locator('.pz-cockpit .pitch-tuile.is-open').first().waitFor({ timeout: 3000 }).catch(() => {})
  await t.pose(p)
  t.verifie(await p.locator('.pz-cockpit .pitch-tuile.is-open .pitch-avis').count() === 1 && await p.locator('.pz-cockpit .pitch-tuile.is-open .sx-card').count() >= 1, 'tableau : une tuile s’ouvre sur tout son contenu, avis compris')
  const avant = await p.locator('.pitch-tuile.is-open .sx-card .sx-big-val').first().innerText()
  await p.locator('.pitch-tuile.is-open .sx-year', { hasText: 'A4' }).first().click()
  await p.locator('.pitch-tuile.is-open .sx-year.is-on', { hasText: 'A4' }).first().waitFor({ timeout: 3000 }).catch(() => {})
  await t.pose(p)
  const apres = await p.locator('.pitch-tuile.is-open .sx-card .sx-big-val').first().innerText().catch(() => avant)
  t.verifie(avant !== apres, 'choisir A4 change les chiffres affichés', `${avant} → ${apres}`)

  // Diapos : blanches, et quatre intercalaires sombres entre les parties.
  await p.locator('.pitch-mise', { hasText: 'Diapos' }).click()
  await p.locator('.pitch-mise.is-on', { hasText: 'Diapos' }).waitFor({ timeout: 3000 }).catch(() => {})
  await t.pose(p)
  const deck = await p.evaluate(() => ({
    claires: document.querySelectorAll('.pitch-deck .pitch-diapo.is-clair').length,
    sombres: document.querySelectorAll('.pitch-deck .pitch-diapo.is-sombre').length,
    inter: document.querySelectorAll('.pitch-deck .pitch-diapo.is-intercalaire').length,
    notes: document.querySelectorAll('.pitch-deck .pz-note').length,
    premier: document.querySelector('.pitch-deck .pitch-diapo')?.classList.contains('is-intercalaire'),
  }))
  t.verifie(deck.claires === 8 && deck.sombres === 0 && deck.notes === 8, 'diapos : huit diapositives blanches, chacune avec sa note d’orateur', deck)
  t.verifie(deck.inter === 4 && deck.premier, 'diapos : le noir ne sert qu’aux intercalaires, qui ouvrent chaque partie', deck)
  t.verifie(await p.locator('.pitch-offre').count() >= 1 && await p.locator('.pitch-poste').count() >= 1, 'les offres et l’équipe sont listées')
  t.verifie(await p.locator('.pitch-risques > li').count() >= 2 && await p.locator('.pitch-ratio').count() === 7, 'les risques et les sept ratios qu’on te demandera')
  await p.locator('.pitch-fleche[aria-label="Diapositive suivante"]').click()
  await p.waitForFunction(() => (document.querySelector('.pitch-compteur')?.innerText || '').startsWith('2'), null, { timeout: 3000 }).catch(() => {})
  await t.pose(p)
  t.verifie((await p.locator('.pitch-compteur').innerText()).startsWith('2'), 'diapos : la flèche passe à la suivante')

  // En détail : un sommaire, des chapitres détachés, le texte replié.
  await p.locator('.pitch-mise', { hasText: 'En détail' }).click()
  await p.locator('.pitch-mise.is-on', { hasText: 'En détail' }).waitFor({ timeout: 3000 }).catch(() => {})
  await t.pose(p)
  const detail = await p.evaluate(() => ({
    sommaire: document.querySelectorAll('.pitch.is-detail .sy-sommaire button').length,
    chapitres: document.querySelectorAll('.pitch.is-detail .sy-chapitre').length,
    clairs: document.querySelectorAll('.pitch.is-detail .sy-clair').length,
    pourquoi: document.querySelectorAll('.pitch.is-detail details.sy-why').length,
    ouverts: document.querySelectorAll('.pitch.is-detail details.sy-why[open]').length,
  }))
  t.verifie(detail.sommaire === 5 && detail.chapitres >= 5, '« En détail » : un sommaire de cinq parties, chacune dans son panneau', detail)
  t.verifie(detail.clairs >= 3 && detail.pourquoi >= 3 && detail.ouverts === 0, '« en clair » sous chaque acte, « pourquoi c’est important » replié', detail)
  await p.locator('.pitch-mise', { hasText: 'Récit' }).click()
  await p.locator('.pitch-mise.is-on', { hasText: 'Récit' }).waitFor({ timeout: 3000 }).catch(() => {})
  await t.pose(p)
  // Le voyage : la page s'ouvre en haut (on lit son titre), puis la zone
  // s'éclaire d'un reflet qui la traverse.
  await p.locator('.pitch-cover .pitch-manque').click()
  // On regarde image par image, jusqu'à avoir vu le reflet et l'anneau (trois secondes au plus).
  const vu = await p.evaluate(() => new Promise((ok) => {
    const vu = { haut: false, reflet: false, anneau: false }
    const t0 = performance.now()
    const regarder = () => {
      const z = document.querySelector('[data-gap="pitch"]')
      const e = { hash: location.hash, y: window.scrollY, reflet: !!z && z.classList.contains('is-shine'), anneau: !!z && z.classList.contains('spotlit') }
      if (e.hash === '#/projet' && e.y === 0 && !e.reflet) vu.haut = true
      if (e.reflet) vu.reflet = true
      if (e.anneau) vu.anneau = true
      if ((vu.reflet && vu.anneau) || performance.now() - t0 > 3000) ok(vu)
      else requestAnimationFrame(regarder)
    }
    regarder()
  }))
  t.verifie(await p.evaluate(() => location.hash) === '#/projet', 'et emmène à Mon projet')
  t.verifie(vu.haut, 'la page s’ouvre d’abord en haut, sur son titre')
  t.verifie(vu.reflet && vu.anneau, 'puis la zone s’éclaire d’un reflet et de l’anneau')
  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()

  if (!rapide) {
    const q = await t.page('telephone')
    await t.exemple(q)
    await t.aller(q, 'tableau-de-bord')
    await q.locator('.module-nav .hnav-tab', { hasText: 'Pitch' }).first().click().catch(() => {})
    await q.locator('.pitch').first().waitFor({ timeout: 3000 }).catch(() => {})
    await t.pose(q)
    await t.defiler(q, 500)
    const d = await debordements(q)
    t.verifie(!d.page && d.coupes.length === 0, 'téléphone : ni débordement ni chiffre coupé', d)
    t.verifie(q.erreurs.length === 0, 'téléphone : aucune erreur JavaScript', q.erreurs.slice(0, 2))
    await q.fermer()
  }
}
