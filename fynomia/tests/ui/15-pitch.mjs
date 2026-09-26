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
  await t.onglet(p, 'Synthèse')

  // « Récit » (par défaut) : le projet expliqué en neuf chapitres, dans
  // l'ordre où on le demande — d'abord ce que tout le monde veut savoir, puis
  // pourquoi. Chacun : une conclusion, deux à quatre chiffres, une phrase qui
  // l'interprète, le détail replié.
  t.verifie(await p.locator('.pitch-mise.is-on', { hasText: 'Récit' }).count() === 1, 'le récit est la mise en page par défaut')
  const TITRES = ['Chiffre d’affaires', 'Résultat et rentabilité', 'Répartition des ventes', 'Économie d’une vente', 'Masse salariale',
    'Structure des coûts', 'Trésorerie', 'Besoin de financement', 'Principales hypothèses']
  const chapitres = await p.$$eval('.as-chap', (e) => e.map((x) => ({
    titre: (x.querySelector('.as-titre')?.textContent || '').trim(),
    sous: (x.querySelector('.as-sous-titre')?.textContent || '').trim(),
    conclusion: (x.querySelector('.as-conclusion')?.textContent || '').trim(),
    chiffres: x.querySelectorAll(':scope > .as-chiffres-bloc .as-chiffre').length,
    clair: (x.querySelector(':scope > .as-clair')?.textContent || '').trim(),
    detail: (() => { const d = x.querySelector(':scope > .as-detail'); return d ? { ouvert: d.open, dit: d.querySelector('summary')?.textContent.trim() } : null })(),
    rupture: (x.querySelector('.as-rupture')?.textContent || '').trim(),
  })))
  t.verifie(chapitres.length === 9 && chapitres.every((c, i) => c.titre === TITRES[i]), 'neuf chapitres, dans l’ordre demandé', chapitres.map((c) => c.titre))
  t.verifie(chapitres.every((c) => c.sous.length > 30 && c.conclusion.length > 30 && /\d/.test(c.conclusion)), 'chaque chapitre : ce qu’il couvre, et une conclusion chiffrée', chapitres.map((c) => c.conclusion.slice(0, 50)))
  t.verifie(chapitres.every((c) => c.chiffres >= 2 && c.chiffres <= 4), 'deux à quatre chiffres au premier niveau', chapitres.map((c) => c.chiffres))
  t.verifie(chapitres.every((c) => c.clair.length > 40 && !/\bje\b|\bj’|\bnous\b/i.test(c.clair)), 'une phrase qui interprète, sans « je » ni « nous »', chapitres.map((c) => c.clair.slice(0, 40)))
  t.verifie(chapitres.every((c) => c.detail && !c.detail.ouvert && c.detail.dit === 'Voir le détail'), 'le détail est replié sous « Voir le détail »')
  t.verifie(new Set(chapitres.map((c) => c.conclusion)).size === 9, 'aucune conclusion ne se répète')
  t.verifie(/^Être rentable et avoir de la trésorerie sont deux choses différentes/.test(chapitres[6]?.rupture), 'la trésorerie s’ouvre sur la rupture : rentable n’est pas en caisse', chapitres[6]?.rupture)
  t.verifie(!/trésorerie|financement|BFR/i.test(chapitres[0]?.conclusion + chapitres[0]?.clair), 'le chiffre d’affaires ne parle ni de trésorerie ni de financement')
  const recit = await p.evaluate(() => {
    const as = document.querySelector('.as')
    const vus = [...as.querySelectorAll('.as-chap > :not(.as-detail)')].map((x) => x.innerText).join(' ')
    return { mots: vus.split(/\s+/).filter((m) => /[a-zà-ÿ]{2,}/i.test(m)).length, texte: as.innerText }
  })
  t.verifie(recit.mots > 350 && recit.mots < 1100, 'la première lecture tient en deux à trois minutes', `${recit.mots} mots hors détail`)
  t.verifie(!/\bCAF\b/.test(recit.texte) && !/Ce n’est pas|Pas seulement|mais aussi/i.test(recit.texte), 'ni « CAF », ni formules toutes faites')
  t.verifie(/avant amortissements, intérêts et impôts/.test(recit.texte) && /Ce qui reste des ventes après leurs coûts directs/.test(recit.texte) && /couvre toutes les charges fixes/.test(recit.texte),
    'EBE, marge brute et point mort expliqués à leur première apparition')

  // Les chiffres des dessins sont ceux du moteur.
  const moteur = await p.evaluate(async () => {
    const { euro } = await import('./js/ui/dom.js')
    const r = (await import('./js/state/store.js')).default.result
    const c = (v) => euro(v, { compact: Math.abs(v) >= 100000 })
    return { net: c(r.pnl.netResult[0]), besoin: euro(r.kpis.fundingNeed), besoinC: c(r.kpis.fundingNeed) }
  })
  const finCascade = await p.locator('.as-chap[data-chapitre="2"] .as-cascade-l').last().locator('.as-cascade-val').innerText()
  t.verifie(finCascade === moteur.net, 'la cascade du résultat tombe sur le résultat net', { finCascade, net: moteur.net })
  const sous = await p.$$eval('.as-chap[data-chapitre="3"] .as-barre-sous', (e) => e.map((x) => x.textContent))
  t.verifie(sous.length >= 1 && sous.every((x) => /×.*=/.test(x)), 'chaque offre : prix × volume = revenu', sous)
  t.verifie(await p.locator('.as-chap[data-chapitre="4"] .as-equation .as-eq-bloc').count() === 3, 'l’économie d’une vente : prix − coût direct = marge')
  t.verifie(await p.locator('.as-chap[data-chapitre="7"] > .as-dessin svg.as-j .as-j-aire').count() === 1 && await p.locator('.as-chap[data-chapitre="7"] > .as-dessin svg.as-j .as-j-neg').count() === 1,
    'la trésorerie : ce qui passe sous zéro se voit')
  const resteFin = await p.locator('.as-chap[data-chapitre="8"] .as-cascade-l').last().locator('.as-cascade-val').innerText().catch(() => '')
  t.verifie((resteFin === moteur.besoinC || resteFin === moteur.besoin) && chapitres[7].conclusion.includes(`Il faut donc financer ${moteur.besoin}`),
    'le besoin : consommation − ressources = reste à financer, celui du moteur', { resteFin, besoin: moteur.besoin })
  const hyp = await p.$$eval('.as-chap[data-chapitre="9"] .as-barre', (e) => e.map((x) => x.querySelector('.as-barre-sous')?.textContent || ''))
  t.verifie(hyp.length >= 4 && hyp.every((x) => /^Plan : .+ · test : /.test(x)), 'les hypothèses : la valeur du plan, la variation testée, l’effet', hyp)
  await p.locator('.as-chap[data-chapitre="5"] .as-detail summary').click()
  t.verifie(await p.locator('.as-chap[data-chapitre="5"] .as-detail[open] table').count() >= 1, 'le détail s’ouvre sur ses tableaux')
  t.verifie(!(await p.locator('.module-nav .hnav-tab', { hasText: 'essai' }).count()), 'la synthèse essai n’est plus un onglet à part')
  t.verifie(!(await p.locator('.pitch .sy-hero, .pitch .pitch-dossier').count()), 'l’avancement du dossier a quitté le pitch pour le Pilotage')

  // Le besoin de la couverture est celui du moteur.
  const besoin = await p.evaluate(async () => {
    const st = (await import('./js/state/store.js')).default
    return Math.round(st.result.kpis.fundingNeed)
  })
  const ask = (await p.locator('.pitch-ask b').innerText()).replace(/\D/g, '')
  t.verifie(besoin > 0 && Number(ask) === besoin, 'le montant de la couverture est le besoin calculé', `${ask} / ${besoin}`)
  t.verifie(/le projet expliqué/i.test(await p.locator('.pitch-hero .rvl-kicker').innerText()) && !/investisseur|banquier|financeur/i.test(await p.locator('.pitch-hero .rvl-kicker').innerText()),
    'la couverture annonce la forme qu’on lit, pas un lecteur', await p.locator('.pitch-hero .rvl-kicker').innerText())
  t.verifie(await p.locator('.pitch-hero .rvl-bar').count() === 5 && await p.locator('.pitch-hero .rvl-line').count() === 1, 'la couverture trace cinq ans de chiffre d’affaires et la trésorerie')
  // Aucun pourcentage absurde.
  const absurdes = await p.evaluate(() => (document.querySelector('.pitch').innerText.match(/-?\d[\d \u00a0\u202f]{3,}[ \u00a0]?%/g) || []).filter((x) => Math.abs(Number(x.replace(/[^\d-]/g, ''))) > 1000))
  t.verifie(absurdes.length === 0, 'aucun pourcentage au-delà de 1 000 %', absurdes)
  // Sans phrase d'accroche, la couverture le dit et y emmène.
  t.verifie(await p.locator('.pitch-cover .pitch-manque').count() === 1, 'sans description, la couverture propose de l’écrire')

  // « Tableau » est retiré : sa lecture financière vit dans les états
  // financiers et dans « En détail ».
  const mises = await p.locator('.pitch-mise b').allTextContents()
  t.verifie(JSON.stringify(mises) === JSON.stringify(['Récit', 'En détail', 'Diapos']), 'trois lectures : récit, détail, diapos — plus de « Tableau »', mises)

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
  const ratios = await p.locator('.pitch-ratio-l').allInnerTexts()
  t.verifie(await p.locator('.pitch-risques > li').count() >= 2 && ratios.length === 8 && ratios.some((l) => /^EBITDA/.test(l)) && ratios.some((l) => /EBE/.test(l)),
    'les risques et les huit chiffres qu’on te demandera, l’EBE et l’EBITDA compris', ratios)
  await p.locator('.pitch-fleche[aria-label="Diapositive suivante"]').click()
  await p.waitForFunction(() => (document.querySelector('.pitch-compteur')?.innerText || '').startsWith('2'), null, { timeout: 3000 }).catch(() => {})
  await t.pose(p)
  t.verifie((await p.locator('.pitch-compteur').innerText()).startsWith('2'), 'diapos : la flèche passe à la suivante')

  // En détail : un sommaire, neuf parties, le texte replié.
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
  t.verifie(detail.sommaire === 9 && detail.chapitres === 9, '« En détail » : un sommaire de neuf parties, de l’ouverture à l’analyse détaillée', detail)
  t.verifie(detail.clairs >= 7 && detail.pourquoi >= 7 && detail.ouverts === 0, 'une explication courte avant les chiffres, « pourquoi c’est important » replié', detail)
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
