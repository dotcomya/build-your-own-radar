/**
 * Parler la langue du banquier.
 *
 * Un restaurant emprunte 90 000 €. On vérifie que le dossier dit ce que le
 * banquier recalculera lui-même, avec l'échéancier réel :
 *
 *   1. le mot est « EBE », pas « EBITDA », partout où le fondateur lit ;
 *   2. « Ce que ton banquier va vérifier » tient en cinq lignes — apport,
 *      couverture des échéances par la CAF, endettement, trésorerie, point
 *      mort —, chacune « Validé », « Juste » ou « À revoir » ;
 *   3. la couverture vient de l'échéancier du moteur, pas d'une dette
 *      divisée par sept ;
 *   4. le tableau du banquier donne EBE, CAF, échéances, couverture et dette
 *      restante, année par année ;
 *   5. un prêt d'honneur ajouté améliore l'apport.
 */
export const nom = 'Banquier — EBE, CAF, échéances réelles, cinq vérifications'

export default async function (t) {
  const p = await t.page('bureau')
  await t.exemple(p, 'Restaurant')

  // Un prêt bancaire de 90 000 € sur sept ans, saisi comme un fondateur.
  await t.aller(p, 'financement')
  const pret = p.locator('.source', { hasText: 'Emprunt bancaire' }).first()
  if (!(await pret.evaluate((e) => e.classList.contains('is-on')))) await pret.locator('.source-act').click()
  else await pret.click()
  await p.locator('.source-line .field').first().waitFor({ timeout: 3000 }).catch(() => {})
  await t.pose(p)
  const champ = (nomChamp) => p.locator('.source-line .field', { has: p.locator('label', { hasText: nomChamp }) }).locator('input').first()
  await champ(/^Montant/).fill('90000')
  await champ(/^Montant/).blur()
  await t.pose(p)
  await champ(/^Durée/).fill('84')
  await champ(/^Durée/).blur()
  await t.pose(p)

  await t.aller(p, 'business-case')
  const texte = await p.locator('.content').innerText()
  t.verifie(!/EBITDA/.test(texte) && /EBE/.test(texte), 'le business case parle d’EBE, pas d’EBITDA')
  const bk = p.locator('[data-banquier]').first()
  t.verifie(await bk.count() === 1, 'le bloc « Ce que ton banquier va vérifier » est là')
  const lignes = await bk.locator('.bk-ligne').evaluateAll((els) => els.map((e) => ({ cle: e.dataset.cle, etat: e.querySelector('.bk-etat')?.textContent, valeur: e.querySelector('.bk-valeur')?.textContent })))
  t.verifie(lignes.map((l) => l.cle).join(',') === 'apport,couverture,endettement,tresorerie,pointmort', 'cinq vérifications, dans l’ordre du banquier', lignes)
  t.verifie(lignes.every((l) => ['Validé', 'Juste', 'À revoir', 'Sans objet'].includes(l.etat)), 'chacune validée, juste ou à revoir', lignes.map((l) => l.etat))

  // La couverture vient de l'échéancier.
  const calc = await p.evaluate(async () => {
    const st = (await import('./js/state/store.js')).default
    const r = st.result, s = st.scenario
    const dette = (s.financing.loans || []).reduce((a, x) => a + (Number(x.amount) || 0), 0)
    const c = r.bank.checks.find((x) => x.cle === 'couverture')
    const cap = r.bank.capitalY[c.annee]
    const echeancier = r.financing.repayment.slice(c.annee * 12, c.annee * 12 + 12).reduce((a, b) => a + b, 0)
    return { ratio: c.ratio, cap, echeancier, dette, septieme: dette / 7, caf: r.bank.cafY[c.annee], net: r.pnl.netResult[c.annee], amort: r.pnl.amortisation[c.annee] }
  })
  t.verifie(Math.abs(calc.cap - calc.echeancier) < 1 && Math.abs(calc.cap - calc.septieme) > 100, 'le capital remboursé vient de l’échéancier, pas de la dette divisée par sept', calc)
  t.verifie(Math.abs(calc.caf - (calc.net + calc.amort)) < 1 && Math.abs(calc.ratio - calc.caf / calc.cap) < 0.001, 'CAF = résultat net + amortissements, couverture = CAF ÷ capital', calc)

  const tableau = await p.locator('.bk-table').first().innerText().catch(() => '')
  t.verifie(/CAF/.test(tableau) && /Échéances de prêt/.test(tableau) && /Couverture/.test(tableau) && /Dette bancaire restante/.test(tableau), 'le tableau du banquier donne EBE, CAF, échéances, couverture, dette', tableau.slice(0, 160))

  // Le financement : le même bloc, là où l'on règle l'apport et le prêt.
  await t.aller(p, 'financement')
  t.verifie(await p.locator('[data-banquier]').count() === 1, 'le bloc se lit aussi dans Financement')
  const avant = await p.evaluate(async () => (await import('./js/state/store.js')).default.result.bank.apportShare)
  await p.locator('.source', { hasText: 'Prêt d’honneur' }).or(p.locator('.source', { hasText: "Prêt d'honneur" })).first().locator('.source-act').click()
  await p.locator('.card', { hasText: 'Réseau' }).first().waitFor({ timeout: 3000 }).catch(() => {})
  await t.pose(p)
  const montant = p.locator('.card', { hasText: 'Réseau' }).locator('.source-line .field', { has: p.locator('label', { hasText: /^Montant/ }) }).locator('input').first()
  await montant.fill('20000')
  await montant.blur()
  await t.pose(p)
  const apres = await p.evaluate(async () => (await import('./js/state/store.js')).default.result.bank.apportShare)
  t.verifie(apres > avant, 'un prêt d’honneur améliore l’apport lu par le banquier', `${(avant * 100).toFixed(0)} % → ${(apres * 100).toFixed(0)} %`)

  // Les états financiers parlent aussi d'EBE.
  await t.aller(p, 'resultats')
  const res = await p.locator('.content').innerText()
  t.verifie(!/EBITDA/.test(res), 'les états financiers ne disent plus EBITDA')

  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()
}
