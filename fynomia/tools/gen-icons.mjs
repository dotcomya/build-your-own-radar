/**
 * Encode les icônes 3D en un module JavaScript.
 *
 * Fynomia se construit en un fichier HTML autonome : une image référencée par
 * son chemin le rendrait dépendant d'un serveur. Les WebP sont donc encodés en
 * base64 et livrés dans le paquet, au prix d'un tiers de poids en plus.
 *
 *   node tools/gen-icons.mjs   →  js/ui/icons3d.js
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'assets/icons3d')
const files = readdirSync(src).filter((f) => f.endsWith('.webp')).sort()

const entries = files.map((f) => {
  const key = basename(f, '.webp')
  const b64 = readFileSync(join(src, f)).toString('base64')
  return `  ${key}: 'data:image/webp;base64,${b64}',`
})

const out = `/**
 * Les icônes 3D, encodées dans le paquet.
 *
 * Elles viennent de 3dicons.co, sous licence CC0 : réutilisables sans
 * attribution, pour un usage personnel comme commercial. Ce sont de vrais
 * rendus — pas des dessins vectoriels — ce qui leur donne la matière et la
 * lumière qu'un SVG ne sait pas produire.
 *
 * Le catalogue est générique : il n'existe pas d'icône « pizzeria » ni
 * « salon de coiffure ». Chaque famille de métiers a donc reçu l'objet qui
 * s'en approche le plus — un gobelet pour la restauration, une valise pour
 * l'hébergement, des ciseaux pour la beauté. L'association est écrite dans
 * assets/icons3d/, un fichier par famille.
 *
 * Le CDN de 3dicons ne sert que du WebP aplati sur blanc : chaque icône posait
 * un carré blanc sur le papier crème. La transparence a été rétablie — fond
 * détouré par diffusion depuis les bords, contour fondu, couleur démultipliée
 * du blanc — avant l'encodage ci-dessous.
 *
 * FICHIER GÉNÉRÉ — ne pas éditer à la main.
 * Régénérer avec : node tools/gen-icons.mjs
 */

export const ICONS_3D = {
${entries.join('\n')}
}

/** L'image d'une clé, ou rien si elle n'existe pas. */
export const icon3d = (key) => ICONS_3D[key] || null
`
writeFileSync(join(root, 'js/ui/icons3d.js'), out)
console.log(`js/ui/icons3d.js — ${files.length} icônes, ${Math.round(out.length / 1024)} Ko`)
