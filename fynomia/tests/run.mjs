/**
 * Tous les contrôles de Fynomia, d'une seule commande.
 *
 *   cd fynomia/tests && npm install && npm test
 *
 * Trois étages, dans l'ordre où une erreur coûte le plus cher :
 *
 *   1. le paquet     — l'application se construit en un fichier unique, et ce
 *                      fichier est en ASCII pur (un caractère accentué dans une
 *                      expression régulière le corromprait sans bruit) ;
 *   2. les comptes   — les contrôles comptables et fiscaux de verification/ ;
 *   3. l'interface   — chaque suite de ui/, dans un vrai navigateur : rendus
 *                      sur quatorze métiers et trois formats, onglets,
 *                      défilement, propagation d'un changement, paie en
 *                      direct, synthèses, interactions, fichier livré.
 *
 * Options :
 *   --rapide        trois métiers au lieu de quatorze dans la matrice de rendus
 *   --seul=nom      ne jouer que les suites dont le nom contient « nom »
 *   --sans-paquet   ne pas reconstruire (utile pendant qu'on écrit un test)
 *
 * Le code de sortie vaut 1 à la première croix : une seule doit suffire à
 * arrêter une mise en ligne.
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { serveur, navigateur, outils } from './lib/harnais.mjs'

const ici = dirname(fileURLToPath(import.meta.url))
const app = join(ici, '..')
const args = process.argv.slice(2)
const rapide = args.includes('--rapide')
const seul = (args.find((a) => a.startsWith('--seul=')) || '').slice(7)
const sansPaquet = args.includes('--sans-paquet')

const lignes = []
let echecs = 0
const t0 = Date.now()
const dire = (s) => { process.stdout.write(`${s}\n`) }

/* ───────────────────────────── 1. Le paquet ───────────────────────────── */

if (!sansPaquet && !seul) {
  dire('\n━━ 1. Le paquet')
  try {
    execFileSync('node', ['build.mjs'], { cwd: app, stdio: 'pipe' })
    const bundle = readFileSync(join(app, 'dist', 'bundle.js'))
    const nonAscii = bundle.reduce((n, b) => n + (b > 127 ? 1 : 0), 0)
    const html = existsSync(join(app, 'dist', 'fynomia.html'))
    const ok = html && nonAscii === 0
    dire(`   ${ok ? '✓' : '✗'} construit — dist/fynomia.html ${html ? 'présent' : 'ABSENT'}, ${nonAscii} octet(s) non ASCII`)
    if (!ok) { echecs++; lignes.push(`paquet : ${nonAscii} octet(s) non ASCII`) }
  } catch (e) {
    echecs++
    dire(`   ✗ la construction a échoué : ${String(e.stderr || e.message).slice(0, 300)}`)
  }
}

/* ───────────────────────────── 2. Les comptes ─────────────────────────── */

if (!seul) {
  dire('\n━━ 2. Les comptes')
  const dossier = join(app, 'verification')
  let total = 0
  for (const f of readdirSync(dossier).filter((x) => /^\d.*\.mjs$/.test(x)).sort()) {
    const r = spawnSync('node', [f], { cwd: dossier, encoding: 'utf8' })
    const out = r.stdout || ''
    const bons = (out.match(/✓/g) || []).length
    const croix = out.split('\n').filter((l) => /✗/.test(l))
    total += bons
    const ok = r.status === 0 && croix.length === 0 && bons > 0
    dire(`   ${ok ? '✓' : '✗'} ${f} — ${bons} contrôles${croix.length ? `, ${croix.length} en échec` : ''}${r.status ? ` (code ${r.status})` : ''}`)
    if (!ok) { echecs++; lignes.push(...croix.map((c) => `${f} : ${c.trim()}`)) ; if (r.stderr) lignes.push(r.stderr.split('\n').find((l) => /Error/.test(l)) || '') }
  }
  dire(`   = ${total} contrôles comptables`)
}

/* ───────────────────────────── 3. L'interface ─────────────────────────── */

dire('\n━━ 3. L\'interface')
const srv = await serveur(app)
const browser = await navigateur()
const suites = readdirSync(join(ici, 'ui')).filter((f) => f.endsWith('.mjs')).sort()
  .filter((f) => !seul || f.includes(seul))
for (const f of suites) {
  const journal = []
  const t = outils(browser, srv.base, journal)
  const debut = Date.now()
  let mod
  try {
    mod = await import(pathToFileURL(join(ici, 'ui', f)).href)
    await mod.default(t, { rapide })
  } catch (e) {
    journal.push(`✗ la suite s'est interrompue : ${String(e && e.message || e).split('\n')[0].slice(0, 240)}`)
    t.verifie(false, 'suite complète')
  }
  const { ok, ko } = t.bilan()
  const duree = Math.round((Date.now() - debut) / 1000)
  dire(`   ${ko ? '✗' : '✓'} ${(mod && mod.nom) || f} — ${ok} contrôles${ko ? `, ${ko} en échec` : ''} (${duree} s)`)
  for (const l of journal.slice(0, 12)) dire(`       ${l}`)
  if (journal.length > 12) dire(`       … et ${journal.length - 12} autres`)
  if (ko) { echecs += ko; lignes.push(...journal.map((l) => `${f} : ${l}`)) }
}
await browser.close()
await srv.fermer()

/* ─────────────────────────────── Le verdict ───────────────────────────── */

const duree = Math.round((Date.now() - t0) / 1000)
dire(`\n${echecs ? `✗ ${echecs} échec(s)` : '✓ tout est vert'} — ${duree} s`)
process.exit(echecs ? 1 : 0)
