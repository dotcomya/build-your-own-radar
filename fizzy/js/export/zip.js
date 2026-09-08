/**
 * Écriture d'archives ZIP, sans dépendance.
 *
 * Les entrées sont stockées sans compression (méthode 0). Un fichier PPTX
 * étant un ZIP d'XML, cela suffit : PowerPoint, Keynote, Google Slides et
 * LibreOffice lisent parfaitement les archives non compressées.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const encoder = new TextEncoder()

/**
 * @param {Array<{name:string, data:string|Uint8Array}>} files
 * @returns {Blob} archive prête à être téléchargée
 */
export function createZip(files) {
  const chunks = []
  const central = []
  let offset = 0

  const now = new Date()
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff

  for (const file of files) {
    const nameBytes = encoder.encode(file.name)
    const data = typeof file.data === 'string' ? encoder.encode(file.data) : file.data
    const crc = crc32(data)

    const local = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)   // signature d'en-tête local
    lv.setUint16(4, 20, true)           // version minimale
    lv.setUint16(6, 0, true)            // drapeaux
    lv.setUint16(8, 0, true)            // méthode : stockage
    lv.setUint16(10, dosTime, true)
    lv.setUint16(12, dosDate, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, data.length, true)
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true)
    local.set(nameBytes, 30)

    chunks.push(local, data)

    const dir = new Uint8Array(46 + nameBytes.length)
    const dv = new DataView(dir.buffer)
    dv.setUint32(0, 0x02014b50, true)   // signature d'entrée centrale
    dv.setUint16(4, 20, true)
    dv.setUint16(6, 20, true)
    dv.setUint16(8, 0, true)
    dv.setUint16(10, 0, true)
    dv.setUint16(12, dosTime, true)
    dv.setUint16(14, dosDate, true)
    dv.setUint32(16, crc, true)
    dv.setUint32(20, data.length, true)
    dv.setUint32(24, data.length, true)
    dv.setUint16(28, nameBytes.length, true)
    dv.setUint32(42, offset, true)
    dir.set(nameBytes, 46)
    central.push(dir)

    offset += local.length + data.length
  }

  const centralSize = central.reduce((a, c) => a + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)     // fin du répertoire central
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)

  return new Blob([...chunks, ...central, end], { type: 'application/octet-stream' })
}

/** Échappe une chaîne pour insertion dans du XML. */
export function xml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
}

/**
 * Remet un fichier à l'utilisateur.
 *
 * Deux contextes possibles : servie depuis un serveur classique, la page
 * déclenche un téléchargement par lien ; publiée sur claude.ai, elle passe par
 * la capacité `downloads` de l'hôte, qui demande confirmation au visiteur.
 * On tente d'abord l'hôte, et l'on retombe sur le lien s'il est absent.
 *
 * @returns {Promise<'saved'|'downloaded'|'declined'>}
 */
export async function download(blob, filename) {
  const host = await hostDownloads()
  if (host) {
    try {
      await host.save({ filename, data: blob })
      return 'saved'
    } catch (err) {
      // Un refus explicite du visiteur n'est pas une erreur à contourner.
      if (err && err.code === 'declined') return 'declined'
      if (err && ['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].includes(err.code)) {
        return linkDownload(blob, filename)
      }
      throw err
    }
  }
  return linkDownload(blob, filename)
}

/** Capacité de téléchargement de l'hôte, ou null hors de ce contexte. */
async function hostDownloads() {
  try {
    if (typeof window === 'undefined' || !window.claude || typeof window.claude.use !== 'function') return null
    return await window.claude.use('downloads')
  } catch { return null }
}

function linkDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'downloaded'
}
