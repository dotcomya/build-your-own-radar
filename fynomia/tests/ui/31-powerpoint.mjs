/**
 * Le PowerPoint se télécharge à côté des diapos et s'ouvre dans PowerPoint.
 *
 * « Je télécharge mais ça ne s'ouvre pas dans PPT. » Le paquet n'avait pas
 * de propriétés de présentation (ppt/presProps.xml), que la norme exige
 * (ECMA-376, partie 1, § 13.3.6) et sans lesquelles PowerPoint refuse le
 * fichier — quand LibreOffice et Keynote l'ouvraient sans rien dire. On
 * télécharge donc le fichier comme un fondateur, depuis la synthèse, et on
 * vérifie le paquet lui-même :
 *
 *   1. le bouton est à côté de « Diapos » et le fichier est un .pptx ;
 *   2. les parties qu'un fichier PowerPoint porte toujours sont là ;
 *   3. chaque relation mène à une partie qui existe, et chaque partie XML a
 *      son type déclaré — une référence cassée suffit à faire refuser un
 *      fichier.
 */
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const nom = 'PowerPoint — à côté des diapos, un paquet complet'

/** Les entrées d'une archive ZIP non compressée, lues par son répertoire central. */
function entrees(buf) {
  let fin = buf.length - 22
  while (fin >= 0 && buf.readUInt32LE(fin) !== 0x06054b50) fin--
  const nb = buf.readUInt16LE(fin + 10)
  let p = buf.readUInt32LE(fin + 16)
  const out = new Map()
  for (let i = 0; i < nb; i++) {
    const methode = buf.readUInt16LE(p + 10)
    const taille = buf.readUInt32LE(p + 20)
    const lNom = buf.readUInt16LE(p + 28), lExtra = buf.readUInt16LE(p + 30), lCom = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const nomEntree = buf.toString('utf8', p + 46, p + 46 + lNom)
    const debut = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    out.set(nomEntree, methode === 0 ? buf.toString('utf8', debut, debut + taille) : null)
    p += 46 + lNom + lExtra + lCom
  }
  return out
}

export default async function (t) {
  const p = await t.page('bureau')
  await t.exemple(p)
  await t.aller(p, 'tableau-de-bord')

  // 1. À côté des diapos.
  const place = await p.evaluate(() => {
    const d = document.querySelector('.pitch-mise.is-diapos')?.getBoundingClientRect()
    const b = document.querySelector('.pitch-pptx')?.getBoundingClientRect()
    return d && b ? { ecart: Math.round(b.left - d.right), memeLigne: Math.abs(b.top + b.height / 2 - (d.top + d.height / 2)) < 20 } : null
  })
  t.verifie(place && place.memeLigne && place.ecart >= 0 && place.ecart < 60, 'le bouton PowerPoint est juste à côté de « Diapos »', place)
  const attente = p.waitForEvent('download', { timeout: 20000 })
  await p.locator('.pitch-pptx').click()
  const fichier = await attente
  t.verifie(/\.pptx$/.test(fichier.suggestedFilename()), 'le fichier est un .pptx', fichier.suggestedFilename())
  const chemin = join(tmpdir(), `fynomia-${Date.now()}.pptx`)
  await fichier.saveAs(chemin)
  const parts = entrees(readFileSync(chemin))

  // 2. Les parties qu'un fichier PowerPoint porte toujours.
  const requises = ['[Content_Types].xml', '_rels/.rels', 'ppt/presentation.xml', 'ppt/_rels/presentation.xml.rels',
    'ppt/presProps.xml', 'ppt/viewProps.xml', 'ppt/tableStyles.xml', 'ppt/theme/theme1.xml',
    'ppt/slideMasters/slideMaster1.xml', 'ppt/slideLayouts/slideLayout1.xml', 'docProps/core.xml', 'docProps/app.xml']
  const manquent = requises.filter((n) => !parts.has(n))
  t.verifie(!manquent.length, 'les parties d’un fichier PowerPoint sont toutes là, propriétés de présentation comprises', manquent)
  t.verifie([...parts.values()].every((v) => v !== null), 'toutes les entrées sont lisibles')
  t.verifie(/<p:txStyles>/.test(parts.get('ppt/slideMasters/slideMaster1.xml') || ''), 'le masque porte ses styles de texte')

  // 3. Aucune référence cassée, aucun type manquant.
  const cassees = []
  for (const [n, contenu] of parts) {
    if (!n.endsWith('.rels')) continue
    const dossier = n.replace(/_rels\/[^/]*\.rels$/, '')
    for (const m of contenu.matchAll(/Target="([^"]+)"/g)) {
      const segs = (dossier + m[1]).split('/')
      const res = []
      for (const s of segs) { if (s === '..') res.pop(); else if (s && s !== '.') res.push(s) }
      if (!parts.has(res.join('/'))) cassees.push(`${n} → ${m[1]}`)
    }
  }
  t.verifie(!cassees.length, 'chaque relation mène à une partie qui existe', cassees.slice(0, 3))
  const types = parts.get('[Content_Types].xml') || ''
  const sansType = [...parts.keys()].filter((n) => n.endsWith('.xml') && n !== '[Content_Types].xml' && !types.includes(`PartName="/${n}"`))
  t.verifie(!sansType.length, 'chaque partie a son type déclaré', sansType.slice(0, 3))
  const diapos = [...parts.keys()].filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).length
  t.verifie(diapos >= 10, 'la présentation compte ses diapositives', String(diapos))

  t.verifie(p.erreurs.length === 0, 'aucune erreur JavaScript', p.erreurs.slice(0, 2))
  await p.fermer()
}
