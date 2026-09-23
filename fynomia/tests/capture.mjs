// Captures d'écran ponctuelles (outil de travail, hors suite).
import { serveur, navigateur, outils } from './lib/harnais.mjs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const ici = dirname(fileURLToPath(import.meta.url))
const app = join(ici, '..')
const out = process.argv[2]
const script = process.argv[3]
const srv = await serveur(app)
const browser = await navigateur()
const t = outils(browser, srv.base, [])
const mod = await import(script)
await mod.default(t, out)
await browser.close()
await srv.fermer()
