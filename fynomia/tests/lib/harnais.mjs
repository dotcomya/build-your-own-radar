/**
 * Le harnais des tests d'interface.
 *
 * Un serveur de fichiers minimal, un navigateur, et trois gestes répétés par
 * toutes les suites : ouvrir une page propre, choisir un métier, charger
 * l'exemple. Chaque suite reçoit ces outils et un `verifie(condition,
 * libellé, détail)` qui compte les réussites et garde le détail des échecs.
 *
 * Rien ici ne dépend du réseau : les polices et toute requête sortante sont
 * coupées, pour qu'un test ne passe ni n'échoue selon la connexion du jour.
 */

import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { existsSync, readdirSync } from 'node:fs'
import { join, extname, normalize } from 'node:path'

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
}

/** Sert un dossier en lecture seule, sur un port libre. */
export async function serveur(racine) {
  const srv = http.createServer(async (req, res) => {
    try {
      const chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname)
      let fichier = normalize(join(racine, chemin))
      if (!fichier.startsWith(racine)) { res.writeHead(403).end(); return }
      if ((await stat(fichier).catch(() => null))?.isDirectory()) fichier = join(fichier, 'index.html')
      const corps = await readFile(fichier)
      res.writeHead(200, { 'content-type': TYPES[extname(fichier)] || 'application/octet-stream', 'cache-control': 'no-store' })
      res.end(corps)
    } catch {
      res.writeHead(404).end()
    }
  })
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok))
  const { port } = srv.address()
  return { base: `http://127.0.0.1:${port}`, fermer: () => new Promise((ok) => srv.close(ok)) }
}

/**
 * Le navigateur.
 *
 * CHROMIUM_PATH l'emporte ; sinon on cherche un Chromium déjà installé par
 * Playwright ; sinon on laisse Playwright trouver le sien.
 */
export async function navigateur() {
  const { chromium } = await import('playwright-core')
  let executablePath = process.env.CHROMIUM_PATH
  if (!executablePath) {
    const dossiers = ['/opt/pw-browsers', join(process.env.HOME || '', '.cache/ms-playwright')]
    for (const d of dossiers) {
      if (!existsSync(d)) continue
      for (const sous of readdirSync(d).filter((x) => /^chromium-\d+$/.test(x)).sort().reverse()) {
        const exe = join(d, sous, 'chrome-linux', 'chrome')
        if (existsSync(exe)) { executablePath = exe; break }
      }
      if (executablePath) break
    }
  }
  return chromium.launch({ executablePath, args: ['--no-sandbox'] })
}

export const FORMATS = {
  bureau: { width: 1440, height: 1000 },
  large: { width: 1580, height: 1000 },
  tablette: { width: 820, height: 1180 },
  telephone: { width: 390, height: 844, isMobile: true, hasTouch: true },
}

/**
 * Les outils d'une suite.
 *
 * `page(format)` ouvre un contexte neuf — stockage vide, aucun plan — et
 * relève les erreurs JavaScript de la page dans `page.erreurs`.
 */
export function outils(browser, base, journal) {
  const url = `${base}/index.html`

  async function page(format = 'bureau') {
    const f = typeof format === 'string' ? FORMATS[format] : format
    const ctx = await browser.newContext({
      viewport: { width: f.width, height: f.height }, isMobile: !!f.isMobile, hasTouch: !!f.hasTouch, locale: 'fr-FR',
    })
    // Aucune requête hors du serveur de test : pas de police, pas de réseau.
    await ctx.route('**/*', (r) => (r.request().url().startsWith(base) ? r.continue() : r.abort()))
    const p = await ctx.newPage()
    p.erreurs = []
    p.on('pageerror', (e) => p.erreurs.push(e.message))
    p.fermer = () => ctx.close()
    return p
  }

  /**
   * Aller à une route de l'application et attendre que la page soit rendue.
   *
   * Rendue : la racine de l'application a été remplacée — une nouvelle page,
   * pas l'ancienne encore affichée — puis le DOM s'est tu. Le fondu de la
   * transition de vue peut encore jouer, et les courbes se tracer : l'un
   * n'anime que des images de l'écran, l'autre l'intérieur des SVG ; aucun
   * des deux ne déplace un élément de la page. Un test qui les regarde
   * appelle `pose`.
   */
  async function aller(p, route) { await ouvrir(p, `${url}#/${route}`) }

  /** La même chose pour une adresse complète (le fichier livré, par exemple). */
  async function ouvrir(p, adresse) {
    const meme = await p.evaluate((a) => {
      window.__racine = document.querySelector('#app > *')
      return location.href === a
    }, adresse).catch(() => false)
    await p.goto(adresse, { waitUntil: 'domcontentloaded' })
    if (!meme) await p.waitForFunction(() => { const x = document.querySelector('#app > *'); return !!x && x !== window.__racine })
    await pose(p, { voyage: false, svg: false })
  }

  /** Choisir un métier dans le parcours de création. */
  async function metier(p, nom) {
    await p.goto(`${url}#/creer`, { waitUntil: 'load' })
    // Premier écran du parcours : l'accueil (« Commencer ») ou déjà les étapes.
    await p.locator('.welcome-go, .setup-search-input, .setup-step').first().waitFor()
    if (await p.locator('.welcome-go').count()) await p.locator('.welcome-go').click()
    await p.locator('.setup-search-input, .setup-step').first().waitFor()
    if (!(await p.locator('.setup-search-input').count())) {
      await p.locator('.setup-step', { hasText: 'Ton métier' }).first().click()
    }
    await p.locator('.setup-search-input').fill(nom)
    const avant = await p.evaluate(() => localStorage.getItem('fynomia.current'))
    await p.locator(`.setup-sector:has-text("${nom}")`).first().click()
    // Le plan est né : un nouveau plan courant, enregistré.
    await p.waitForFunction((a) => { const c = localStorage.getItem('fynomia.current'); return !!c && c !== a }, avant)
    await pose(p)
  }

  /** Charger le plan d'exemple (Nova Analytics, logiciel en abonnement). */
  async function exemple(p, nom = 'Logiciel en abonnement') {
    await metier(p, nom)
    await aller(p, 'demarrer')
    await p.locator('.landing-example').first().click()
    await p.waitForFunction(() => location.hash === '#/tableau-de-bord')
    await pose(p)
  }

  /** Cliquer un onglet de module par son libellé. */
  async function onglet(p, texte) {
    // La synthèse essai vit désormais dans le pitch, sous « En détail ».
    if (/essai/i.test(texte)) {
      await p.locator('.module-nav .hnav-tab', { hasText: 'Synthèse' }).first().click()
      await p.locator('.pitch-mise', { hasText: 'En détail' }).first().click()
      await p.locator('.pitch-mise.is-on', { hasText: 'En détail' }).first().waitFor()
      await pose(p)
      return
    }
    await p.locator('.module-nav .hnav-tab', { hasText: texte }).first().click()
    await p.locator('.module-nav .hnav-tab.active', { hasText: texte }).first().waitFor()
    await pose(p)
  }

  /** Descendre jusqu'en bas, par pas, pour que tout ce qui se guette se déclenche. */
  async function defiler(p, pas = 600) {
    const H = await p.evaluate(() => document.documentElement.scrollHeight)
    for (let y = 0; y < H; y += pas) {
      await p.evaluate((yy) => window.scrollTo(0, yy), y)
      await pose(p, { calme: 60 })
    }
  }

  let ok = 0, ko = 0
  function verifie(condition, libelle, detail = '') {
    if (condition) { ok++; return true }
    ko++
    journal.push(`✗ ${libelle}${detail ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`)
    return false
  }
  const bilan = () => ({ ok, ko })

  return { url, page, aller, ouvrir, metier, exemple, onglet, defiler, pose, verifie, bilan }
}

/**
 * Attendre que l'écran soit posé — une condition, pas une durée.
 *
 * Posé veut dire : aucune transition de page en cours (la classe
 * `is-travelling` est tombée), aucune animation d'état encore en train de
 * jouer, et ni le DOM ni le défilement n'ont bougé depuis `calme`
 * millisecondes. `max`
 * borne l'attente : un écran qui ne se pose jamais laisse le test constater
 * ce qu'il voit.
 *
 * Une animation d'état — une entrée, un volet qui s'ouvre, une transition —
 * dure au plus une seconde et demie. Au-delà, ce sont des effets d'attention
 * (l'appel du « i », l'éclat d'un ajout, l'anneau posé sur un champ, la
 * révélation) ou des boucles : l'écran est lisible pendant qu'ils jouent, et
 * les tests qui les concernent les guettent eux-mêmes.
 */
export async function pose(p, { calme = 120, max = 5000, voyage = true, svg = true } = {}) {
  await p.evaluate(({ calme, max, voyage, svg }) => new Promise((ok) => {
    const t0 = performance.now()
    let dernier = t0
    const obs = new MutationObserver(() => { dernier = performance.now() })
    obs.observe(document, { subtree: true, childList: true, attributes: true, characterData: true })
    // Un défilement en cours (molette, défilement doux) compte comme un mouvement.
    const bouge = () => { dernier = performance.now() }
    addEventListener('scroll', bouge, { capture: true, passive: true })
    const ETAT = 1500
    const fondu = (a) => String(a.effect && a.effect.pseudoElement || '').startsWith('::view-transition')
    const dessin = (a) => typeof SVGElement === 'function' && a.effect && a.effect.target instanceof SVGElement
    const anime = () => document.getAnimations().some((a) => a.playState === 'running' && (voyage || !fondu(a)) && (svg || !dessin(a))
      && (a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming().endTime : Infinity) <= ETAT)
    const voit = () => {
      const t = performance.now()
      const fini = t - dernier >= calme && !anime() && (!voyage || !document.documentElement.classList.contains('is-travelling'))
      if (fini || t - t0 > max) { obs.disconnect(); removeEventListener('scroll', bouge, { capture: true }); ok(); return }
      setTimeout(voit, 20)
    }
    voit()
  }), { calme, max, voyage, svg })
}

/** Le débordement horizontal d'une page, et les valeurs coupées. */
export async function debordements(p, selecteurs = '.metric-value,.kpi-value,.figure-value,.takehome-value,.verdict-word,.sy-big-val,.bil-side-total,.sx-big-val,.sx-big-cap') {
  return p.evaluate((sel) => ({
    page: document.documentElement.scrollWidth > window.innerWidth + 1,
    coupes: [...document.querySelectorAll(sel)].filter((v) => v.scrollWidth > v.clientWidth + 1).map((v) => v.className).slice(0, 3),
  }), selecteurs)
}

/** Les métiers et les pages sur lesquels on rejoue tout. */
export const METIERS = ['Pizzeria', 'Cabinet de conseil', 'Médecin généraliste', 'Restaurant', 'E-commerce', 'Association', 'Dentiste',
  'Salon de coiffure', 'Glacier', 'Spa / Centre de bien-être', 'Location Airbnb', 'Boulangerie', 'Plombier', 'Aide à domicile']
export const PAGES = ['projet', 'offre', 'achats', 'equipe', 'financement', 'tableau-de-bord', 'resultats', 'reglages']
