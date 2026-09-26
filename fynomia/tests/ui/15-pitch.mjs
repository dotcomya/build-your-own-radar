/**
 * Le pitch investisseur : l'essentiel du plan, juste et lisible.
 *
 * On ouvre l'onglet sur l'exemple et on vérifie qu'il dit ce qu'un
 * investisseur cherche, dans l'ordre, et que ses chiffres sont ceux du
 * moteur : le récit en neuf scènes, son tiroir « Comprendre ce chiffre », sa
 * surimpression « Voir les données » ; le besoin affiché en couverture est
 * celui des états financiers. Puis la même page au téléphone, sans
 * débordement.
 */
import { debordements } from '../lib/harnais.mjs'

export const nom = 'Pitch investisseur — l’essentiel du plan'

export default async function (t, { rapide } = {}) {
  const p = await t.page('bureau')
  await t.exemple(p)
  await t.aller(p, 'tableau-de-bord')
  await t.onglet(p, 'Synthèse')

  // « Récit » (par défaut) : le projet expliqué en neuf scènes, dans l'ordre
  // où on le demande — d'abord ce que tout le monde veut savoir, puis
  // pourquoi. Une scène à la fois : la question, le grand chiffre, la
  // conclusion, trois repères, le dessin sur son panneau sombre.
  t.verifie(await p.locator('.pitch-mise.is-on', { hasText: 'Récit' }).count() === 1, 'le récit est la mise en page par défaut')
  const TITRES = ['Chiffre d’affaires', 'Résultat et rentabilité', 'Répartition des ventes', 'Économie d’une vente', 'Masse salariale',
    'Structure des coûts', 'Trésorerie', 'Besoin de financement', 'Principales hypothèses']
  const ETAPES = ['01 Chiffre d’affaires', '02 Résultat', '03 Ventes', '04 Économie d’une vente', '05 Équipe', '06 Coûts', '07 Trésorerie', '08 Financement', '09 Hypothèses']
  const chapitres = await p.$$eval('.as-chap', (e) => e.map((x) => ({
    titre: (x.querySelector('.as-titre')?.textContent || '').trim(),
    question: (x.querySelector('.as-question')?.textContent || '').trim(),
    une: (x.querySelector('.as-une-v')?.textContent || '').trim(),
    conclusion: (x.querySelector('.as-conclusion')?.textContent || '').trim(),
    reperes: x.querySelectorAll('.as-reperes .as-repere-case').length,
    gestes: [...x.querySelectorAll('.as-geste')].map((b) => b.textContent.trim()),
    rupture: (x.querySelector('.as-rupture')?.textContent || '').trim(),
    visible: x.getBoundingClientRect().height > 0,
    fond: getComputedStyle(x.querySelector('.as-scene-dessin')).backgroundColor,
  })))
  const etapes = await p.locator('.as-progres .as-etape').allTextContents()
  t.verifie(chapitres.length === 9 && chapitres.every((c, i) => c.titre === TITRES[i]), 'neuf scènes, dans l’ordre demandé', chapitres.map((c) => c.titre))
  t.verifie(JSON.stringify(etapes.map((x) => x.replace(/\s+/g, ' ').trim())) === JSON.stringify(ETAPES), 'la barre des étapes : de « 01 Chiffre d’affaires » à « 09 Hypothèses »', etapes)
  t.verifie(chapitres.filter((c) => c.visible).length === 1 && chapitres[0].visible, 'une scène à la fois, la première d’abord', chapitres.map((c) => c.visible))
  t.verifie(chapitres.every((c) => /\?$/.test(c.question) && /\d/.test(c.une) && c.conclusion.length > 30 && /\d/.test(c.conclusion)), 'chaque scène : sa question, son grand chiffre, une conclusion chiffrée', chapitres.map((c) => [c.question, c.une]))
  t.verifie(chapitres.every((c) => c.reperes >= 2 && c.reperes <= 3), 'deux ou trois repères sous la conclusion', chapitres.map((c) => c.reperes))
  t.verifie(chapitres.every((c) => c.gestes.join('|') === 'Comprendre ce chiffre|Voir les données'), 'deux gestes : « Comprendre ce chiffre », « Voir les données »')
  t.verifie(chapitres.every((c) => c.fond === 'rgb(14, 15, 12)'), 'le dessin, sur un panneau sombre', chapitres[0].fond)
  t.verifie(new Set(chapitres.map((c) => c.conclusion)).size === 9, 'aucune conclusion ne se répète')
  t.verifie(/^Être rentable et avoir de la trésorerie sont deux choses différentes/.test(chapitres[6]?.rupture), 'la trésorerie s’ouvre sur la rupture : rentable n’est pas en caisse', chapitres[6]?.rupture)
  t.verifie(!/trésorerie|financement|BFR/i.test(chapitres[0]?.conclusion), 'le chiffre d’affaires ne parle ni de trésorerie ni de financement')

  // Précédent, suivant, les flèches du clavier, la barre des étapes.
  const ouverte = () => p.evaluate(() => document.querySelector('.as-scene.is-on')?.dataset.chapitre)
  await p.locator('.as-nav-btn.is-suiv').click()
  const apresSuivant = await ouverte()
  await p.keyboard.press('ArrowRight')
  const apresFleche = await ouverte()
  await p.locator('.as-nav-btn.is-prec').click()
  const apresPrec = await ouverte()
  await p.locator('.as-etape').nth(6).click()
  const apresEtape = await ouverte()
  t.verifie(apresSuivant === '2' && apresFleche === '3' && apresPrec === '2' && apresEtape === '7', '« Suivant », la flèche, « Précédent » et la barre des étapes tournent les scènes', { apresSuivant, apresFleche, apresPrec, apresEtape })
  const compteur = await p.locator('.as-nav-compteur').textContent()
  t.verifie(compteur.trim() === '07 / 09', 'le compteur dit où l’on en est', compteur)

  // « Comprendre ce chiffre », scène par scène : un tiroir sur le côté.
  const tiroirs = []
  for (let i = 0; i < 9; i++) {
    await p.locator('.as-etape').nth(i).click()
    await p.locator('.as-scene.is-on .as-geste.is-comprendre').click()
    await p.locator('.as-couche.is-tiroir.is-on').waitFor({ timeout: 3000 }).catch(() => {})
    // Le tiroir glisse depuis la droite : on le mesure une fois posé.
    await p.waitForFunction(() => { const c = document.querySelector('.as-couche.is-tiroir'); return c && getComputedStyle(c).transform === 'none' }, null, { timeout: 2000 }).catch(() => {})
    tiroirs.push(await p.evaluate(() => {
      const c = document.querySelector('.as-couche.is-tiroir')
      if (!c) return null
      const r = c.getBoundingClientRect()
      const l = document.documentElement.clientWidth
      return {
        droite: Math.abs(r.right - l) < 2 && r.width < l * 0.6,
        kicker: c.querySelector('.as-couche-kicker')?.textContent.replace(/\s+/g, ' ').trim(),
        titre: c.querySelector('.as-couche-titre')?.textContent.trim(),
        tuiles: c.querySelectorAll('.as-tuiles .as-chiffre').length,
        evolution: [...c.querySelectorAll('.as-couche-bloc thead th')].map((x) => x.textContent.trim()).join(' '),
        lecture: c.querySelector('.as-clair')?.textContent.trim() || '',
        source: !!c.querySelector('.as-couche-btn.is-accent'),
        texte: c.innerText,
      }
    }))
    await p.keyboard.press('Escape')
  }
  t.verifie(tiroirs.every((x) => x && x.droite && x.kicker === 'Comprendre / Analyse'), 'le tiroir s’ouvre sur le côté droit, « Comprendre / Analyse »', tiroirs.map((x) => x && x.droite))
  t.verifie(tiroirs.every((x, i) => x.titre === TITRES[i] && x.tuiles >= 2), 'chaque tiroir : le titre de la scène et ses chiffres commentés', tiroirs.map((x) => [x.titre, x.tuiles]))
  t.verifie(tiroirs.slice(0, 8).every((x) => /A1 A2 A3 A4 A5/.test(x.evolution)), 'l’évolution sur cinq ans, de A1 à A5', tiroirs.map((x) => x.evolution.slice(0, 30)))
  t.verifie(tiroirs.every((x) => x.lecture.length > 40 && !/\bje\b|\bj’|\bnous\b/i.test(x.lecture)), 'une lecture qui interprète, sans « je » ni « nous »', tiroirs.map((x) => x.lecture.slice(0, 40)))
  t.verifie(tiroirs.every((x) => x.source), 'chaque tiroir mène au module source')
  const lu = tiroirs.map((x) => x.texte).join(' ')
  t.verifie(/avant amortissements, intérêts et impôts/.test(lu) && /Ce qui reste des ventes après leurs coûts directs/.test(lu) && /couvre toutes les charges fixes/.test(lu),
    'EBE, marge brute et point mort expliqués dans leur tiroir')
  t.verifie(!(await p.locator('.as-couche').count()), 'Échap referme le tiroir')
  const recit = await p.evaluate(() => {
    const as = document.querySelector('.as')
    const vus = [...as.querySelectorAll('.as-scene-texte')].map((x) => x.textContent).join(' ')
    return { mots: vus.split(/\s+/).filter((m) => /[a-zà-ÿ]{2,}/i.test(m)).length, texte: as.textContent }
  })
  t.verifie(recit.mots > 300 && recit.mots < 1100, 'les neuf scènes se lisent en deux à trois minutes', `${recit.mots} mots`)
  t.verifie(!/\bCAF\b/.test(recit.texte + lu) && !/Ce n’est pas|Pas seulement|mais aussi/i.test(recit.texte + lu), 'ni « CAF », ni formules toutes faites')

  // Les chiffres des dessins sont ceux du moteur.
  const moteur = await p.evaluate(async () => {
    const { euro } = await import('./js/ui/dom.js')
    const r = (await import('./js/state/store.js')).default.result
    const c = (v) => euro(v, { compact: Math.abs(v) >= 100000 })
    return { net: c(r.pnl.netResult[0]), netExact: r.pnl.netResult.map((v) => euro(v)), besoin: euro(r.kpis.fundingNeed), besoinC: c(r.kpis.fundingNeed) }
  })
  const dernier = (sel) => p.$$eval(sel, (e) => (e.length ? e[e.length - 1].querySelector('.as-cascade-val')?.textContent : ''))
  const finCascade = await dernier('.as-chap[data-chapitre="2"] .as-cascade-l')
  t.verifie(finCascade === moteur.net, 'la cascade du résultat tombe sur le résultat net', { finCascade, net: moteur.net })
  const sous = await p.$$eval('.as-chap[data-chapitre="3"] .as-barre-sous', (e) => e.map((x) => x.textContent))
  t.verifie(sous.length >= 1 && sous.every((x) => /×.*=/.test(x)), 'chaque offre : prix × volume = revenu', sous)
  t.verifie(await p.locator('.as-chap[data-chapitre="4"] .as-equation .as-eq-bloc').count() === 3, 'l’économie d’une vente : prix − coût direct = marge')
  t.verifie(await p.locator('.as-chap[data-chapitre="7"] .as-scene-dessin svg.as-j .as-j-aire').count() === 1 && await p.locator('.as-chap[data-chapitre="7"] .as-scene-dessin svg.as-j .as-j-neg').count() === 1,
    'la trésorerie : ce qui passe sous zéro se voit')
  const resteFin = await dernier('.as-chap[data-chapitre="8"] .as-cascade-l')
  t.verifie((resteFin === moteur.besoinC || resteFin === moteur.besoin) && chapitres[7].conclusion.includes(`Il faut donc financer ${moteur.besoin}`),
    'le besoin : consommation − ressources = reste à financer, celui du moteur', { resteFin, besoin: moteur.besoin })
  const hyp = await p.$$eval('.as-chap[data-chapitre="9"] .as-barre', (e) => e.map((x) => x.querySelector('.as-barre-sous')?.textContent || ''))
  t.verifie(hyp.length >= 4 && hyp.every((x) => /^Plan : .+ · test : /.test(x)), 'les hypothèses : la valeur du plan, la variation testée, l’effet', hyp)

  // « Voir les données » : l'état financier, par-dessus la page, fond flouté.
  await p.locator('.as-etape').nth(1).click()
  await p.locator('.as-scene.is-on .as-geste.is-donnees').click()
  await p.locator('.as-couche.is-donnees.is-on').waitFor({ timeout: 3000 }).catch(() => {})
  const donnees = await p.evaluate(() => {
    const c = document.querySelector('.as-couche.is-donnees')
    const v = document.querySelector('.as-voile.is-donnees')
    return c && {
      flou: /blur/.test(getComputedStyle(v).backdropFilter || getComputedStyle(v).webkitBackdropFilter || ''),
      etat: c.querySelector('.as-couche-bloc h3')?.textContent.trim(),
      vises: [...c.querySelectorAll('tr.is-vise')].map((x) => x.dataset.ligne),
      net: [...c.querySelectorAll('tr[data-ligne="netResult"] td.num')].map((x) => x.textContent),
      tableaux: c.querySelectorAll('table').length,
    }
  })
  t.verifie(donnees && donnees.flou && donnees.etat === 'Compte de résultat', '« Voir les données » pose le compte de résultat sur un fond flouté', donnees && { flou: donnees.flou, etat: donnees.etat })
  t.verifie(donnees && ['grossMargin', 'ebe', 'netResult'].every((k) => donnees.vises.includes(k)) && JSON.stringify(donnees.net) === JSON.stringify(moteur.netExact),
    'les lignes du chapitre sont surlignées, le résultat net est celui du moteur', donnees && { vises: donnees.vises, net: donnees.net })
  t.verifie(donnees && donnees.tableaux >= 2, 'suivi des tableaux du chapitre', donnees?.tableaux)
  await p.locator('.as-voile.is-donnees').click({ position: { x: 5, y: 5 } })
  t.verifie(!(await p.locator('.as-couche').count()), 'un clic sur le voile referme la surimpression')

  // La trésorerie de l'exercice : l'ouverture, les flux, la clôture, au centime.
  await p.locator('.as-etape').nth(6).click()
  await p.locator('.as-scene.is-on .as-geste.is-donnees').click()
  await p.locator('.as-couche.is-donnees.is-on').waitFor({ timeout: 3000 }).catch(() => {})
  const treso = await p.evaluate(() => {
    const nb = (x) => Number(String(x).replace(/[^\d,−-]/g, '').replace('−', '-').replace(',', '.')) || 0
    const ligne = (k) => [...document.querySelectorAll(`.as-couche tr[data-ligne="${k}"] td.num`)].map((x) => nb(x.textContent))
    const zero = [0, 0, 0, 0, 0]
    const somme = ['debut', 'activite', 'apports', 'emprunts', 'remboursements', 'subventions'].map((k) => (ligne(k).length ? ligne(k) : zero))
    const fin = ligne('fin')
    return { ecarts: fin.map((v, y) => Math.abs(somme.reduce((t, l) => t + l[y], 0) - v)), fin, etat: document.querySelector('.as-couche .as-couche-bloc h3')?.textContent.trim() }
  })
  t.verifie(treso.etat === 'Tableau de trésorerie' && treso.fin.length === 5 && treso.ecarts.every((e) => e <= 5), 'la trésorerie : ouverture + activité + financement = clôture, chaque année', treso)

  // « Ouvrir le module source » : la page où le chiffre se règle.
  await p.keyboard.press('Escape')
  await p.locator('.as-etape').nth(4).click()
  await p.locator('.as-scene.is-on .as-geste.is-comprendre').click()
  await p.locator('.as-couche.is-tiroir .as-couche-btn.is-accent').click()
  await p.waitForFunction(() => location.hash === '#/equipe', null, { timeout: 3000 }).catch(() => {})
  t.verifie(await p.evaluate(() => location.hash) === '#/equipe' && !(await p.locator('.as-couche').count()), '« Ouvrir le module source » mène à l’équipe, tiroir refermé')
  await t.aller(p, 'tableau-de-bord')
  t.verifie(await p.evaluate(() => document.querySelector('.as-scene.is-on')?.dataset.chapitre) === '1', 'revenu au tableau de bord, le récit repart de la première scène')

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
    await q.locator('.module-nav .hnav-tab', { hasText: 'Synthèse' }).first().click().catch(() => {})
    await q.locator('.pitch').first().waitFor({ timeout: 3000 }).catch(() => {})
    await t.pose(q)
    await t.defiler(q, 500)
    const d = await debordements(q)
    t.verifie(!d.page && d.coupes.length === 0, 'téléphone : ni débordement ni chiffre coupé', d)
    t.verifie(q.erreurs.length === 0, 'téléphone : aucune erreur JavaScript', q.erreurs.slice(0, 2))
    await q.fermer()
  }
}
