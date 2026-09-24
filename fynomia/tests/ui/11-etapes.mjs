/**
 * Chaque étape du dossier mène quelque part — au bon endroit.
 *
 * Le pilotage range les trente lignes du dossier page par page : ce qui
 * est fait, ce qui reste. Une ligne qui emmène sur une page où son champ
 * n'existe pas laisse le fondateur chercher. On les clique donc toutes, une à
 * une, sur deux plans (un métier neuf et l'exemple complet), et on vérifie
 * trois choses : la page d'arrivée, la présence du champ visé, et l'anneau
 * posé dessus. Une ligne « sans objet » n'a pas de champ à montrer : on
 * vérifie seulement qu'elle emmène sur la bonne page.
 */
export const nom = 'Étapes — chaque ligne du dossier mène à son champ'

/** Les lignes du dossier, telles que l'application les calcule. */
const lignes = (p) => p.evaluate(async () => {
  const m = await import('./js/ui/checklist.js')
  return m.checklist().items.map((i) => ({ label: i.label, go: i.go, done: i.done, na: !!i.na }))
})

async function ouvrirDossier(t, p) {
  await t.aller(p, 'tableau-de-bord', 700)
  await t.onglet(p, 'Pilotage', 700)
  const d = p.locator('.sy-dossier')
  if (!(await d.count())) return false
  await d.scrollIntoViewIfNeeded()
  await p.waitForTimeout(250)
  // Tout déplier : les colonnes longues cachent leurs dernières lignes.
  for (let k = 0; k < 12; k++) {
    const plus = p.locator('.sy-dossier-more').first()
    if (!(await plus.count())) break
    await plus.click()
  }
  return true
}

async function jouer(t, p, plan) {
  const items = await lignes(p)
  t.verifie(items.length >= 25, `${plan} : le dossier compte ses lignes`, String(items.length))
  if (!(await ouvrirDossier(t, p))) {
    t.verifie(false, `${plan} : la section « ce qu’il te reste » est affichée`)
    return
  }
  const affiches = await p.evaluate(() => [...document.querySelectorAll('.sy-dossier .sy-todo, .sy-dossier .sy-done')].length)
  t.verifie(affiches === items.length, `${plan} : chaque ligne apparaît une fois dans le dossier`, `${affiches} / ${items.length}`)

  for (const it of items) {
    if (!(await ouvrirDossier(t, p))) break
    const bouton = p.locator('.sy-dossier .sy-todo, .sy-dossier .sy-done')
      .filter({ has: p.locator(`text="${it.label}"`) }).first()
    if (!(await bouton.count())) { t.verifie(false, `${plan} : « ${it.label} » est cliquable`); continue }
    await bouton.click()
    // Le voyage, le rendu, puis l'anneau (posé à l'image suivante).
    let arrive = null
    for (let k = 0; k < 26 && !arrive?.spot; k++) {
      await p.waitForTimeout(150)
      arrive = await p.evaluate((a) => {
        const el = a ? document.querySelector(`[data-gap="${a}"]`) : null
        return { hash: location.hash, existe: !!el, spot: !!el && el.classList.contains('spotlit') }
      }, it.go.anchor || null)
    }
    t.verifie(arrive.hash === `#/${it.go.route}`, `${plan} : « ${it.label} » mène à ${it.go.route}`, arrive.hash)
    if (it.go.anchor && !it.na) {
      t.verifie(arrive.existe, `${plan} : « ${it.label} » trouve son champ (${it.go.anchor})`)
      t.verifie(arrive.spot, `${plan} : « ${it.label} » pose l’anneau sur son champ`)
    }
  }
}

export default async function (t, { rapide } = {}) {
  const p = await t.page('bureau')
  await t.metier(p, 'Pizzeria')
  await jouer(t, p, 'Pizzeria')
  if (!rapide) {
    await t.exemple(p)
    await jouer(t, p, 'Exemple')
  }
  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()
}
