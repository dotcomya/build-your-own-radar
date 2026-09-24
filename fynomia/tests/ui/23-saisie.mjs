/**
 * Taper un nombre, c'est taper un nombre.
 *
 * Le plan s'écrit une seconde après la dernière frappe, chaque frappe
 * relançant l'attente ; quitter le champ écrit tout de suite. Pendant ce
 * temps le champ reste à celui qui tape : ni perte de focus, ni curseur
 * renvoyé au début, ni chiffres qui s'écrivent à l'envers — même quand le
 * recalcul redessine la page entre deux salves de frappe. L'effet sur le
 * résultat s'affiche après le recalcul, pas avant.
 *
 * Trois champs de natures différentes : l'abonnement d'une offre (montant à
 * unité), un salaire (champ numérique borné), le montant d'une charge (case
 * d'une ligne d'Achats).
 */
export const nom = 'Saisie — une seconde après la dernière frappe, sans perdre le fil'

/** Le journal de la page : frappes, écritures du plan, pastilles d'effet. */
async function journaliser(p) {
  await p.evaluate(async () => {
    if (window.__journal) return
    const st = (await import('./js/state/store.js')).default
    const j = window.__journal = []
    document.addEventListener('input', () => j.push({ k: 'frappe', t: performance.now() }), true)
    document.addEventListener('keydown', (e) => { if (e.key === 'Tab') j.push({ k: 'tab', t: performance.now() }) }, true)
    st.subscribe((_, raison) => { if (raison === 'data' || raison === 'saisie') j.push({ k: raison, t: performance.now() }) })
    let vu = ''
    new MutationObserver(() => {
      const e = document.querySelector('.effet')
      const texte = e ? e.textContent : ''
      if (texte && texte !== vu) j.push({ k: 'effet', t: performance.now(), texte })
      vu = texte
    }).observe(document.body, { childList: true, subtree: true, characterData: true })
  })
}
const viderJournal = (p) => p.evaluate(() => { window.__journal.length = 0 })
const journal = (p) => p.evaluate(() => window.__journal.slice())

/** Chaque écriture du plan vient après une seconde sans frappe. */
function ecrituresDifferees(j) {
  let derniere = -Infinity
  const fautes = []
  for (const e of j) {
    if (e.k === 'frappe') derniere = e.t
    if (e.k === 'data' && e.t - derniere < 990) fautes.push(Math.round(e.t - derniere))
  }
  return fautes
}

/** Ce que voit celui qui tape : la valeur, le focus, la place du curseur. */
const etatChamp = (champ) => champ.evaluate((e) => ({
  valeur: e.value, focus: document.activeElement === e, debut: e.selectionStart, fin: e.selectionEnd,
}))

async function carteOuverte(t, p) {
  if (!(await p.locator('.item.open').count())) {
    await p.locator('.item-head').first().click()
    await p.locator('.item.open').first().waitFor()
    await t.pose(p)
  }
}

/**
 * Le protocole, sur un champ : deux salves de frappe séparées par un
 * recalcul, puis Tab.
 *
 * `champ()` retrouve la case après chaque redessin ; `lire()` donne la valeur
 * du plan ; `salves` sont deux morceaux du même nombre.
 */
async function eprouver(t, p, quoi, { champ, conteneur, lire, salves, attendu, sortie }) {
  await champ().click()
  await p.keyboard.press('ControlOrMeta+a')
  await viderJournal(p)

  // Première salve : rien ne s'écrit tant qu'on tape.
  await p.keyboard.type(salves[0], { delay: 110 })
  let e = await etatChamp(champ())
  t.verifie(e.valeur === salves[0] && e.focus && e.debut === salves[0].length,
    `${quoi} : pendant la frappe, les chiffres s'écrivent dans l'ordre, curseur au bout`, e)

  // Puis, une seconde après la dernière frappe, le plan s'écrit.
  await p.waitForFunction(() => window.__journal.some((x) => x.k === 'data'), null, { timeout: 5000 }).catch(() => {})
  await p.waitForFunction(() => window.__journal.some((x) => x.k === 'effet'), null, { timeout: 5000 }).catch(() => {})
  await t.pose(p)
  let j = await journal(p)
  t.verifie(j.some((x) => x.k === 'data') && ecrituresDifferees(j).length === 0,
    `${quoi} : le plan s'écrit une seconde après la dernière frappe, jamais avant`, ecrituresDifferees(j))
  e = await etatChamp(champ())
  t.verifie(e.focus && e.valeur === salves[0] && e.debut === salves[0].length && e.fin === salves[0].length,
    `${quoi} : après le recalcul, même champ, même valeur, curseur au bout`, e)
  const ecrit = j.find((x) => x.k === 'data')
  const effet = j.find((x) => x.k === 'effet')
  t.verifie(!!effet && !!ecrit && effet.t >= ecrit.t && /de résultat en année\s\d/.test(effet.texte),
    `${quoi} : l'effet sur le résultat s'affiche après le recalcul`, effet?.texte || j.map((x) => x.k).join(' '))
  const pastille = conteneur().locator('.effet')
  t.verifie(await pastille.count() === 1, `${quoi} : la pastille est sous le champ qu'on tape`)

  // Deuxième salve, après le redessin : la suite du nombre s'écrit au bout.
  await viderJournal(p)
  await p.keyboard.type(salves[1], { delay: 110 })
  e = await etatChamp(champ())
  t.verifie(e.valeur === salves.join('') && e.focus, `${quoi} : la suite s'écrit derrière, pas devant`, e)
  await p.waitForFunction(() => window.__journal.some((x) => x.k === 'data'), null, { timeout: 5000 }).catch(() => {})
  await t.pose(p)
  j = await journal(p)
  t.verifie(ecrituresDifferees(j).length === 0 && Math.abs((await lire()) - attendu) < 1e-6,
    `${quoi} : le plan prend le nombre entier`, { plan: await lire(), attendu })

  // Tab : on a fini, on n'attend pas.
  await viderJournal(p)
  await p.keyboard.type(sortie.frappe, { delay: 50 })
  await p.keyboard.press('Tab')
  await p.waitForFunction(() => window.__journal.some((x) => x.k === 'data'), null, { timeout: 3000 }).catch(() => {})
  j = await journal(p)
  const tab = j.find((x) => x.k === 'tab')
  const apres = j.find((x) => x.k === 'data' && tab && x.t >= tab.t)
  t.verifie(!!apres && apres.t - tab.t < 900 && Math.abs((await lire()) - sortie.attendu) < 1e-6,
    `${quoi} : quitter le champ écrit tout de suite`, { delai: apres && tab ? Math.round(apres.t - tab.t) : null, plan: await lire() })
  await t.pose(p)
}

export default async function (t) {
  const p = await t.page('bureau')
  await t.exemple(p)
  await journaliser(p)
  const plan = (f) => () => p.evaluate(f)

  // L'abonnement de la première offre.
  await t.aller(p, 'offre')
  await carteOuverte(t, p)
  const abo = () => p.locator('.item.open .field', { has: p.locator('label', { hasText: /^Abonnement/ }) }).first()
  await eprouver(t, p, 'abonnement', {
    champ: () => abo().locator('input').first(), conteneur: abo,
    lire: plan(async () => (await import('./js/state/store.js')).default.scenario.activities[0].recurringPrice),
    salves: ['12', '9'], attendu: 129, sortie: { frappe: '0', attendu: 1290 },
  })

  // Un salaire, lu en brut annuel ou mensuel selon l'unité affichée.
  await t.aller(p, 'equipe')
  await carteOuverte(t, p)
  const salaire = () => p.locator('.item.open .field', { has: p.locator('label', { hasText: /Salaire brut|Rémunération/ }) }).first()
  const poste = await p.locator('.item.open').first().getAttribute('data-row')
  const facteur = /annuel|par an/i.test(await salaire().locator('label').innerText()) ? 12 : 1
  await eprouver(t, p, 'salaire', {
    champ: () => salaire().locator('input').first(), conteneur: salaire,
    lire: () => p.evaluate(async (id) => Number((await import('./js/state/store.js')).default.scenario.team.find((x) => x.id === id).monthlyGross), poste)
      .then((v) => v * facteur),
    salves: ['42', '000'], attendu: 42000, sortie: { frappe: '0', attendu: 420000 },
  })

  // Le montant d'une charge.
  await t.aller(p, 'achats')
  const ligne = () => p.locator('.cost-row').first()
  const annuelle = /annuel/i.test(await ligne().locator('.cost-amount input').getAttribute('aria-label'))
  const id = await ligne().getAttribute('data-row')
  await eprouver(t, p, 'charge', {
    champ: () => p.locator(`.cost-row[data-row="${id}"] .cost-amount input`), conteneur: () => p.locator(`.cost-row[data-row="${id}"]`),
    lire: () => p.evaluate(async (id) => Number((await import('./js/state/store.js')).default.scenario.opex.find((x) => x.id === id).monthlyAmount), id),
    salves: ['24', '0'], attendu: annuelle ? 20 : 240, sortie: { frappe: '0', attendu: annuelle ? 200 : 2400 },
  })

  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()
}
