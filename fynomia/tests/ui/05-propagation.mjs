/**
 * Un changement en amont se voit en aval.
 *
 * On change une entrée — un prix, un salaire, une charge — et on relit les
 * états financiers : les lignes qui dépendent de cette entrée doivent bouger.
 * C'est le test qui prouve que le modèle est un modèle, pas une maquette.
 */
export const nom = 'Propagation d’un changement jusqu’aux états financiers'

const ONGLETS = ['Compte de résultat', 'Trésorerie', 'Bilan', 'BFR']

async function lire(t, p) {
  const out = {}
  for (const tab of ONGLETS) {
    await t.aller(p, 'resultats', 650)
    await t.onglet(p, tab, 750).catch(() => {})
    out[tab] = await p.evaluate(() => {
      const g = {}
      for (const tr of document.querySelectorAll('table.data tr')) {
        const c = [...tr.children].map((td) => td.textContent.trim())
        if (c.length < 2) continue
        const k = c[0].replace(/\s+/g, ' ').replace(/\?$/, '')
        if (k && !(k in g)) g[k] = c.slice(1).join('|')
      }
      return g
    })
  }
  return out
}

function diff(avant, apres) {
  const bouge = []
  for (const tab of Object.keys(avant)) {
    for (const k of Object.keys(avant[tab])) {
      if (apres[tab]?.[k] !== undefined && avant[tab][k] !== apres[tab][k]) bouge.push(`${tab}/${k}`)
    }
  }
  return bouge
}

async function cas(t, libelle, action, attendues) {
  const p = await t.page('large')
  await t.exemple(p)
  const avant = await lire(t, p)
  await action(p)
  const apres = await lire(t, p)
  const bouge = diff(avant, apres)
  t.verifie(bouge.length >= 5, `${libelle} : des lignes bougent`, `${bouge.length}`)
  for (const a of attendues) t.verifie(bouge.some((b) => b.startsWith(a)), `${libelle} : ${a} bouge`, bouge.slice(0, 8))
  t.verifie(p.erreurs.length === 0, `${libelle} : aucune erreur JavaScript`, p.erreurs.slice(0, 2))
  await p.fermer()
}

export default async function (t) {
  await cas(t, 'Prix de l’abonnement 49 → 99', async (p) => {
    await t.aller(p, 'offre', 1000)
    const f = p.locator('.item-body input[inputmode=decimal], .item-body input[inputmode=numeric]').first()
    await f.fill('99'); await f.blur(); await p.waitForTimeout(900)
  }, ['Compte de résultat/Chiffre d', 'Compte de résultat/EBE', 'Compte de résultat/Résultat net', 'Trésorerie/'])

  await cas(t, 'Salaire du fondateur → 90 000', async (p) => {
    await t.aller(p, 'equipe', 1000)
    if (!(await p.locator('.item.open').count())) { await p.locator('.item-head').first().click(); await p.waitForTimeout(700) }
    const libelles = await p.$$eval('.item.open .item-body input', (e) => e.map((x) => (x.closest('.field')?.querySelector('label')?.textContent || '').trim()))
    const i = libelles.findIndex((l) => /brut/i.test(l))
    const f = p.locator('.item.open .item-body input').nth(Math.max(0, i))
    await f.fill('90000'); await f.blur(); await p.waitForTimeout(900)
  }, ['Compte de résultat/Charges de personnel', 'Compte de résultat/EBE', 'Trésorerie/'])

  await cas(t, 'Première charge × 10', async (p) => {
    await t.aller(p, 'achats', 1000)
    const f = p.locator('.cost-row input[inputmode=decimal], .cost-row input[inputmode=numeric]').first()
    const v = Number((await f.inputValue()).replace(',', '.')) || 300
    await f.fill(String(v * 10)); await f.blur(); await p.waitForTimeout(900)
  }, ['Compte de résultat/Charges externes', 'Compte de résultat/EBE', 'Trésorerie/'])
}
