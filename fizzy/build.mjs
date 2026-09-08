/**
 * Construit une version en fichier unique de Fizzy.
 *
 * Utile pour héberger l'application sans serveur de modules, la publier telle
 * quelle ou l'ouvrir depuis une clé USB. Le résultat est un HTML autonome :
 * CSS et JavaScript intégrés, aucune requête réseau hormis la police.
 *
 *   node build.mjs            → dist/fizzy.html (document complet)
 *   node build.mjs --body     → dist/fizzy-body.html (sans <html>/<head>,
 *                               pour un hôte qui fournit son propre en-tête)
 *
 * Requiert esbuild : npx esbuild --version
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const dist = join(root, 'dist')
mkdirSync(dist, { recursive: true })

// Pas de --charset=utf8 : esbuild échappe alors tout caractère non ASCII, ce
// qui rend le script insensible à l'encodage sous lequel il sera servi.
const bundlePath = join(dist, 'bundle.js')
execFileSync('npx', ['--yes', 'esbuild', join(root, 'js/app.js'),
  '--bundle', '--format=iife', '--minify', '--target=es2020',
  `--outfile=${bundlePath}`], { stdio: 'inherit' })

const js = readFileSync(bundlePath, 'utf8')
const css = readFileSync(join(root, 'css/app.css'), 'utf8')

const stray = [...js].filter((c) => c.codePointAt(0) > 127)
if (stray.length) {
  console.warn(`Attention : ${stray.length} caractère(s) non ASCII dans le paquet.`)
  console.warn("Servez-le avec un en-tête de jeu de caractères UTF-8, sinon les expressions régulières concernées seront mal interprétées.")
}

const body = `<title>Fizzy</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<style>
${css}
</style>

<div id="app">
  <div style="display:grid;place-items:center;min-height:100dvh;font-family:Inter,system-ui,sans-serif;color:#5b6880">
    <div style="text-align:center">
      <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#8168f4,#4c2fd4);display:grid;place-items:center;color:#fff;font-weight:800;font-size:24px;margin:0 auto 14px">F</div>
      <div>Chargement...</div>
    </div>
  </div>
</div>

<script>
${js}
</script>
`

if (process.argv.includes('--body')) {
  writeFileSync(join(dist, 'fizzy-body.html'), body)
  console.log(`dist/fizzy-body.html — ${Math.round(Buffer.byteLength(body) / 1024)} Ko`)
} else {
  const doc = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light">
<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${body}
</body>
</html>
`
  writeFileSync(join(dist, 'fizzy.html'), doc)
  console.log(`dist/fizzy.html — ${Math.round(Buffer.byteLength(doc) / 1024)} Ko`)
}
