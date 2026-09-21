/**
 * La construction du modèle, et ce qu'elle débloque.
 *
 * Une barre « étape 4 sur 12 » ne dit rien : elle mesure le remplissage d'un
 * formulaire, pas l'avancement d'un projet. Ce module mesure autre chose — ce
 * que le modèle sait calculer à cet instant. Renseigner un prix et des volumes
 * rend le chiffre d'affaires calculable ; y ajouter les coûts rend la
 * rentabilité calculable ; les délais et les apports rendent le besoin de
 * financement calculable. Chaque réponse débloque une capacité, pas un
 * pourcentage.
 *
 * L'ordre est celui de la dépendance réelle : on ne peut pas calculer une
 * rentabilité sans coûts, ni un besoin de financement sans calendrier.
 */

const num = (v) => Number(v) || 0
const any = (arr, fn) => (arr || []).some(fn)

/** Les six briques à poser, dans l'ordre où elles se tiennent. */
const BRICKS = [
  {
    key: 'projet', label: 'Projet', page: 'projet',
    done: (s) => !!(s.meta?.company || s.meta?.name) && !!s.meta?.sectorKey && !!s.meta?.legalForm,
  },
  {
    key: 'prix', label: 'Offre et prix', page: 'offre',
    done: (s) => any(s.activities, (a) => num(a.unitPrice) > 0 || num(a.recurringPrice) > 0),
  },
  {
    key: 'clients', label: 'Clients et volumes', page: 'offre',
    done: (s) => any(s.activities, (a) => num(a.volumes?.startUnits) > 0 || (a.volumes?.manual || []).some((v) => num(v) > 0)),
  },
  {
    key: 'couts', label: 'Achats et coûts', page: 'achats',
    done: (s) => (s.opex || []).length > 0,
  },
  {
    key: 'equipe', label: 'Équipe', page: 'equipe',
    done: (s) => (s.team || []).some((m) => num(m.monthlyGross) > 0),
  },
  {
    key: 'financement', label: 'Financement', page: 'financement',
    done: (s) => {
      const f = s.financing || {}
      return num(f.openingCash) > 0
        || ['equityFounders', 'equityInvestors', 'loans', 'grants', 'advances', 'shareholderLoans']
          .some((k) => (f[k] || []).length > 0)
    },
  },
]

/**
 * Les capacités que la saisie débloque.
 * `needs` liste les briques nécessaires : une capacité n'est jamais annoncée
 * comme acquise tant que ce qu'elle suppose n'est pas là.
 */
const UNLOCKS = [
  { key: 'ca', needs: ['prix', 'clients'], label: 'Ton chiffre d’affaires est calculable.' },
  { key: 'marge', needs: ['prix', 'clients', 'couts'], label: 'Ta marge est calculable.' },
  { key: 'rentabilite', needs: ['prix', 'clients', 'couts', 'equipe'], label: 'Ta rentabilité est calculable.' },
  { key: 'financement', needs: ['prix', 'clients', 'couts', 'equipe', 'financement'], label: 'Ton besoin de financement est calculable.' },
  { key: 'dossier', needs: ['projet', 'prix', 'clients', 'couts', 'equipe', 'financement'], label: 'Ton business plan est prêt.' },
]

/**
 * L'état de construction.
 * @returns {{bricks:Array,unlocks:Array,current,next,done:number,total:number,ratio:number,latest,upcoming}}
 */
export function buildState(scenario) {
  const s = scenario || {}
  const bricks = BRICKS.map((b) => {
    let ok = false
    try { ok = !!b.done(s) } catch { ok = false }
    return { key: b.key, label: b.label, page: b.page, done: ok }
  })
  const byKey = Object.fromEntries(bricks.map((b) => [b.key, b.done]))
  const current = bricks.find((b) => !b.done) || null
  if (current) current.current = true

  const unlocks = UNLOCKS.map((u) => ({
    key: u.key, label: u.label,
    done: u.needs.every((k) => byKey[k]),
    missing: u.needs.filter((k) => !byKey[k]).map((k) => bricks.find((b) => b.key === k)?.label),
  }))

  const done = bricks.filter((b) => b.done).length
  // La dernière capacité acquise, et la première qui manque : ce sont les deux
  // seules phrases qui valent la peine d'être affichées.
  const latest = [...unlocks].reverse().find((u) => u.done) || null
  const upcoming = unlocks.find((u) => !u.done) || null

  return {
    bricks, unlocks, current, next: current,
    done, total: bricks.length, ratio: done / bricks.length,
    latest, upcoming,
  }
}
