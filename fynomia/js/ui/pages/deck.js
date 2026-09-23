/**
 * La présentation : quinze écrans pour défendre le plan.
 *
 * Un business angel, un incubateur ou la BPI ne lisent pas un prévisionnel :
 * ils écoutent quelqu'un le défendre pendant dix minutes. Ce qu'il faut n'est
 * donc pas un export de tableaux, mais une suite d'écrans où chacun porte une
 * seule idée, un seul chiffre, et se comprend sans commentaire.
 *
 * Les quinze slides sont construits depuis le modèle : rien n'est saisi deux
 * fois, rien ne peut diverger de ce que disent les comptes. Modifier un prix
 * change la présentation.
 *
 * Le rythme alterne fond clair et fond d'encre : les slides sombres portent
 * les quatre moments qui décident — le chiffre d'affaires, la trésorerie, le
 * besoin de financement, la demande.
 */

import { h, euro, pct, num, monthLabel, yearLabel, CHEVRON } from '../dom.js'
import { barChart, areaChart, stackedBar, PALETTE, YEAR_CATEGORIES, STATUS } from '../charts.js'
import { getSector, vocabulary } from '../../state/sectors.js'
import { LEGAL_FORMS } from '../../state/schema.js'
import { founderIncome } from '../../engine/founder.js'
import { changed } from '../motion.js'
import store from '../../state/store.js'

const at = { i: 0 }
export function resetDeck() { at.i = 0 }

/* ────────────────────────── Les briques d'un slide ───────────────────────── */

const slide = (no, title, { dark = false, kicker = null, lead = null, body = null, foot = null } = {}) =>
  h('article', { class: `slide ${dark ? 'is-dark' : ''}`, 'data-no': String(no) },
    h('div', { class: 'slide-inner' },
      kicker ? h('div', { class: 'slide-kicker' }, kicker) : null,
      title ? h('h2', { class: 'slide-title' }, title) : null,
      lead ? h('p', { class: 'slide-lead' }, lead) : null,
      body ? h('div', { class: 'slide-body' }, body) : null,
      foot ? h('p', { class: 'slide-foot' }, foot) : null,
    ),
  )

/** Trois à quatre chiffres alignés, sans décor. */
const facts = (...rows) => h('div', { class: 'slide-facts' },
  ...rows.filter(Boolean).map((r) => h('div', { class: 'slide-fact' },
    h('div', { class: 'slide-fact-tag' }, r.tag),
    h('div', { class: 'slide-fact-value num' }, r.value),
    r.note ? h('div', { class: 'slide-fact-note' }, r.note) : null,
  )),
)

/** Le chiffre qu'on retient, seul au centre. */
const headline = (value, note) => h('div', { class: 'slide-headline' },
  h('div', { class: 'slide-headline-value num' }, value),
  note ? h('p', { class: 'slide-headline-note' }, note) : null,
)

/* ─────────────────────────────── Les quinze ──────────────────────────────── */

function build(s, r) {
  const sector = getSector(s.meta?.sectorKey)
  const voc = vocabulary(s)
  const p = r.pnl, k = r.kpis
  const a = s.activities?.[0] || {}
  const forme = LEGAL_FORMS[s.meta?.legalForm]
  const camp = r.revenue.campaigns || []
  const nom = s.meta?.company || s.meta?.name || 'Mon projet'
  const start = new Date(s.meta?.startDate || '2026-01-01').getFullYear()

  let income = null
  try { income = founderIncome(s, r) } catch { /* rien */ }

  const marge = (Number(a.unitPrice) || 0) > 0
    ? (Number(a.unitPrice) || 0) - (Number(a.unitCost) || 0)
    : (Number(a.recurringPrice) || 0) - (Number(a.recurringCost) || 0)
  const prix = (Number(a.unitPrice) || 0) > 0 ? Number(a.unitPrice) : Number(a.recurringPrice) || 0
  const tauxMarge = prix > 0 ? marge / prix : 0

  const modele = s.meta?.revenueModel === 'abonnement' ? 'Abonnement mensuel'
    : s.meta?.revenueModel === 'mixte' ? 'Vente à la signature, puis abonnement'
      : s.meta?.revenueModel === 'commission' ? 'Commission sur les transactions'
        : (Number(a.recurringPrice) || 0) > 0 ? 'Abonnement mensuel' : 'Vente à l’unité'

  const clientType = { b2b: 'Entreprises', b2c: 'Particuliers', b2b2c: 'B2B2C' }[s.meta?.clientType] || 'Entreprises'
  const payroll = (m) => (r.payroll.gross || []).slice(m * 12, m * 12 + 12).reduce((x, y) => x + y, 0)
  const charge = (m) => (r.payroll.employerCharges || []).slice(m * 12, m * 12 + 12).reduce((x, y) => x + y, 0)

  return [
    // 1 — Couverture
    slide(1, nom, {
      dark: true,
      kicker: `Business plan · ${start}–${start + 4}`,
      lead: (s.meta?.pitch || sector?.tagline || '').trim() || null,
      body: facts(
        { tag: 'Métier', value: sector?.label || 'À définir' },
        { tag: 'Forme', value: s.meta?.legalForm || '—', note: forme?.short || null },
        { tag: 'Démarrage', value: monthLabel(0, r.startDate) },
      ),
    }),

    // 2 — Ce qu'on vend
    slide(2, 'Ce que nous vendons', {
      kicker: 'L’offre',
      lead: a.name && a.name !== 'À définir' ? `« ${a.name} »` : null,
      body: facts(
        { tag: 'Modèle de revenu', value: modele },
        { tag: 'Prix', value: prix > 0 ? euro(prix) : '—', note: (Number(a.recurringPrice) || 0) > 0 ? 'par mois, hors taxes' : 'hors taxes' },
        { tag: 'Clientèle', value: clientType },
      ),
      foot: sector?.tagline || null,
    }),

    // 3 — L'économie d'une vente
    slide(3, 'Ce que rapporte une vente', {
      kicker: 'Économie unitaire',
      body: h('div', {},
        h('div', { class: 'slide-bar' },
          h('span', { class: 'slide-bar-cost', style: { width: `${Math.round(Math.min(100, prix > 0 ? ((prix - marge) / prix) * 100 : 0))}%` } }),
          h('span', { class: 'slide-bar-margin' }),
        ),
        facts(
          { tag: `Prix d’une ${voc.one}`, value: euro(prix) },
          { tag: 'Coût direct', value: euro(prix - marge) },
          { tag: 'Marge', value: euro(marge), note: prix > 0 ? `${pct(tauxMarge, 0)} du prix` : null },
        ),
      ),
      foot: tauxMarge >= 0.5
        ? 'Une marge de cette ampleur laisse de quoi financer la structure et la croissance.'
        : 'Chaque euro de coût direct économisé tombe intégralement en marge.',
    }),

    // 4 — Le marché visé
    slide(4, 'À qui nous vendons', {
      kicker: 'Le client',
      body: facts(
        { tag: 'Type de client', value: clientType },
        { tag: 'Délai de paiement', value: `${num(Number(a.paymentLag) || 0)} mois`, note: (Number(a.deposit) || 0) > 0 ? `${pct(Number(a.deposit) || 0, 0)} d’acompte` : 'sans acompte' },
        (Number(a.contractMonths) || 0) > 0
          ? { tag: 'Durée d’engagement', value: `${num(a.contractMonths)} mois`, note: (Number(a.churnMonthly) || 0) > 0 ? `${pct(a.churnMonthly, 1)} d’attrition par mois` : null }
          : null,
      ),
      foot: (Number(a.paymentLag) || 0) > 0
        ? 'Ce délai est ce qui crée le besoin en fonds de roulement : nous avançons l’argent entre la livraison et l’encaissement.'
        : 'Paiement comptant : le cycle d’exploitation ne consomme pas de trésorerie.',
    }),

    // 5 — L'acquisition
    slide(5, 'Comment nous trouvons nos clients', {
      kicker: 'Acquisition',
      body: camp.length
        ? facts(
            { tag: 'Coût d’acquisition', value: k.cac ? euro(k.cac) : '—' },
            { tag: 'Valeur d’un client', value: k.ltv ? euro(k.ltv) : '—' },
            { tag: 'Rapport valeur / coût', value: k.ltvCacRatio ? `${num(k.ltvCacRatio, 1)}×` : '—', note: k.ltvCacRatio >= 3 ? 'au-dessus du seuil de 3' : 'sous le seuil de 3' },
          )
        : headline('Réseau et bouche-à-oreille', 'Aucun budget d’acquisition n’est engagé sur cette période : les premiers clients viennent du réseau.'),
      foot: camp.length && k.ltvCacRatio >= 3
        ? 'Au-dessus de trois, dépenser davantage en acquisition accélère sans creuser.'
        : null,
    }),

    // 6 — La traction
    slide(6, 'Les volumes', {
      kicker: 'Traction',
      body: areaChart({
        values: r.revenue.units, startDate: r.startDate, height: 250,
        color: PALETTE[2], markZero: false, formatter: (v) => num(v, 0),
      }),
      foot: `De ${num(Math.round(r.revenue.units[0]))} à ${num(Math.round(r.revenue.units[59]))} ${voc.many} par mois en cinq ans.`,
    }),

    // 7 — Le chiffre d'affaires
    slide(7, 'Le chiffre d’affaires', {
      dark: true,
      kicker: 'Cinq exercices',
      body: h('div', {},
        headline(euro(p.revenue[4], { compact: true }), `en année 5, contre ${euro(p.revenue[0], { compact: true })} la première année.`),
        barChart({
          categories: YEAR_CATEGORIES,
          series: [{ label: "Chiffre d'affaires", values: p.revenue, color: PALETTE[0] }],
        }),
      ),
    }),

    // 8 — La structure de coûts
    slide(8, 'Où part l’argent', {
      kicker: 'Structure de coûts',
      body: stackedBar({
        categories: YEAR_CATEGORIES,
        series: [
          { label: 'Achats variables', values: p.variableCost, color: PALETTE[5] },
          { label: 'Charges externes', values: p.external, color: PALETTE[1] },
          { label: 'Personnel', values: p.payroll, color: PALETTE[0] },
          { label: 'Impôts et taxes', values: p.duties, color: PALETTE[4] },
          { label: 'Amortissements', values: p.amortisation, color: PALETTE[2] },
        ],
      }),
      foot: `En année 1, le personnel représente ${p.revenue[0] > 0 ? pct(p.payroll[0] / (p.variableCost[0] + p.external[0] + p.payroll[0] + p.duties[0] + p.amortisation[0] || 1), 0) : '—'} des charges.`,
    }),

    // 9 — Le point mort
    slide(9, 'Le point mort', {
      kicker: 'Seuil de rentabilité',
      body: h('div', {},
        headline(k.breakEven[0] ? euro(k.breakEven[0], { compact: true }) : '—',
          'de chiffre d’affaires annuel à réaliser pour couvrir toutes les charges.'),
        facts(
          { tag: 'Taux de marge', value: pct(k.marginRate[0] || 0, 0) },
          { tag: 'Charges fixes', value: euro(k.fixedCosts[0] || 0, { compact: true }), note: 'par an' },
          { tag: 'Franchi', value: k.breakEvenMonth?.find((m) => m) ? `M${k.breakEvenMonth.find((m) => m)}` : (k.firstProfitableYear !== null ? `Année ${k.firstProfitableYear + 1}` : 'Au-delà de 5 ans') },
        ),
      ),
    }),

    // 10 — Le compte de résultat
    slide(10, 'Le compte de résultat', {
      kicker: 'Résumé',
      body: h('div', { class: 'slide-table' },
        h('table', { class: 'data' },
          h('thead', {}, h('tr', {}, h('th', {}, ''), ...YEAR_CATEGORIES.map((c, i) => h('th', {}, `A${i + 1}`)))),
          h('tbody', {},
            row("Chiffre d'affaires", p.revenue),
            row('Marge brute', p.grossMargin),
            row('EBE', p.ebitda),
            row('Résultat net', p.netResult, 'total'),
          ),
        ),
      ),
      foot: k.firstProfitableYear !== null
        ? `Le premier exercice bénéficiaire est l’année ${k.firstProfitableYear + 1}.`
        : 'Aucun exercice n’est bénéficiaire sur l’horizon présenté.',
    }),

    // 11 — La trésorerie
    slide(11, 'La trésorerie', {
      dark: true,
      kicker: 'Mois par mois',
      body: h('div', {},
        headline(euro(k.cashLow.value, { compact: true }),
          `point bas atteint en ${monthLabel(k.cashLow.month, r.startDate)}.`),
        areaChart({
          values: r.cash.balance, startDate: r.startDate, height: 230,
          color: k.cashLow.value < 0 ? STATUS.warn : STATUS.gain,
        }),
      ),
    }),

    // 12 — Le besoin en fonds de roulement
    slide(12, 'Le besoin en fonds de roulement', {
      kicker: 'Cycle d’exploitation',
      body: h('div', {},
        headline(euro(k.peakBfr || 0, { compact: true }),
          'immobilisés en permanence entre la livraison et l’encaissement.'),
        areaChart({
          values: r.bfr.total, startDate: r.startDate, height: 200,
          color: (k.peakBfr || 0) > 0 ? PALETTE[1] : STATUS.gain,
        }),
      ),
      foot: 'Un acompte plus élevé ou un délai client plus court le réduisent sans rien changer à la rentabilité.',
    }),

    // 13 — L'équipe
    slide(13, 'L’équipe', {
      kicker: 'Moyens humains',
      body: facts(
        { tag: 'Postes', value: num((s.team || []).filter((m) => m.enabled !== false).length) },
        { tag: 'Masse salariale A1', value: euro(payroll(0), { compact: true }), note: 'brut annuel' },
        { tag: 'Coût employeur A1', value: euro(payroll(0) + charge(0), { compact: true }), note: 'cotisations comprises' },
        income && income.rows[0] ? { tag: 'Rémunération du dirigeant', value: euro(income.rows[0].gross * 12 || 0, { compact: true }), note: 'brut annuel' } : null,
      ),
      foot: (s.team || []).length > 1
        ? `L’effectif passe à ${num((s.team || []).reduce((x, m) => x + (Number(m.count) || 1), 0))} personnes sur l’horizon.`
        : null,
    }),

    // 14 — Le besoin de financement
    slide(14, k.fundingNeed > 0 ? 'Ce que nous cherchons' : 'Le plan se finance seul', {
      dark: true,
      kicker: 'Financement',
      body: k.fundingNeed > 0
        ? h('div', {},
            headline(euro(k.fundingNeed), `à réunir avant ${monthLabel(k.cashLow.month, r.startDate)}.`),
            facts(
              { tag: 'Déjà réuni', value: euro(totalRaised(s), { compact: true }) },
              { tag: 'Autonomie visée', value: k.runwayMonths ? `${num(k.runwayMonths, 0)} mois` : '—' },
              { tag: 'Premier exercice rentable', value: k.firstProfitableYear !== null ? `Année ${k.firstProfitableYear + 1}` : '—' },
            ),
          )
        : headline('Aucun besoin externe', `La trésorerie reste positive sur les cinq exercices, avec un point bas à ${euro(k.cashLow.value, { compact: true })}.`),
    }),

    // 15 — Ce que ça finance
    slide(15, 'Ce que cet argent finance', {
      dark: true,
      kicker: 'La demande',
      body: facts(
        { tag: 'Trésorerie à couvrir', value: euro(Math.max(0, -Math.min(0, k.cashLow.value)), { compact: true }) },
        { tag: 'Besoin en fonds de roulement', value: euro(k.peakBfr || 0, { compact: true }) },
        { tag: 'Investissements', value: euro((r.capex?.yearly || []).reduce((x, y) => x + y, 0), { compact: true }) },
      ),
      foot: k.firstProfitableYear !== null
        ? `Au-delà de l’année ${k.firstProfitableYear + 1}, l’exploitation s’autofinance.`
        : 'L’horizon présenté ne montre pas encore d’exercice bénéficiaire : l’enjeu est d’y parvenir.',
    }),
  ]
}

const row = (label, values, cls = '') => h('tr', { class: cls },
  h('td', {}, label),
  ...values.map((v) => h('td', { class: 'num' }, euro(v, { compact: true }))),
)

const totalRaised = (s) => {
  const f = s.financing || {}
  return ['equityFounders', 'equityInvestors', 'loans', 'grants', 'advances', 'shareholderLoans']
    .reduce((acc, k2) => acc + (f[k2] || []).reduce((x, e) => x + (Number(e.amount) || 0), 0), 0)
    + (Number(f.openingCash) || 0)
}

/* ────────────────────────────── La navigation ────────────────────────────── */

/**
 * La présentation, dans le tableau de bord.
 *
 * Elle vivait derrière un bouton, en plein écran, dans un autre module : on
 * ne la trouvait qu'en la cherchant, et la plupart ne savaient pas qu'elle
 * existait. C'est pourtant la même lecture que l'analyse, faite pour être
 * montrée à quelqu'un d'autre. Elle s'ouvre donc là où on lit ses chiffres,
 * un écran à la fois, avec deux chevrons pour avancer — et le plein écran
 * reste à un clic pour le jour de la soutenance.
 */
export function deckBoard(navigate, refresh) {
  const s = store.scenario
  const r = store.result
  if (!r) return null

  const slides = build(s, r)
  at.i = Math.max(0, Math.min(at.i, slides.length - 1))
  const go = (d) => { at.i = Math.max(0, Math.min(at.i + d, slides.length - 1)); refresh() }

  const arrow = (dir, label, disabled) => h('button', {
    class: `deckin-arrow is-${dir}`, disabled: disabled || null,
    'aria-label': label, title: label,
    onClick: () => go(dir === 'prev' ? -1 : 1),
    html: CHEVRON,
  })

  return h('section', { class: 'deckin' },
    h('header', { class: 'deckin-head' },
      h('div', {},
        h('h2', {}, 'La présenter en quinze écrans'),
        h('div', { class: 'tiny muted' }, 'Le même modèle, dit à quelqu’un qui ne le connaît pas'),
      ),
      h('span', { class: 'spacer' }),
      h('span', { class: 'deckin-count num' }, `${at.i + 1} / ${slides.length}`),
      h('button', { class: 'btn btn-sm btn-quiet', onClick: () => navigate('#/presentation') }, 'Plein écran'),
    ),
    h('div', { class: 'deckin-stage' },
      arrow('prev', 'Écran précédent', at.i === 0),
      // L'écran ne glisse que lorsqu'on en change, pas à chaque rendu du
      // tableau de bord — sinon il repartirait de la droite à chaque recalcul.
      h('div', { class: `deckin-slide ${changed('deckin', at.i) ? 'is-fresh' : ''}` }, slides[at.i]),
      arrow('next', 'Écran suivant', at.i === slides.length - 1),
    ),
    h('div', { class: 'deckin-dots' },
      ...slides.map((_, i) => h('button', {
        class: `deck-dot ${i === at.i ? 'active' : ''} ${i < at.i ? 'seen' : ''}`,
        title: `Écran ${i + 1}`, 'aria-label': `Écran ${i + 1}`,
        onClick: () => { at.i = i; refresh() },
      })),
    ),
  )
}

export function renderDeck(navigate, refresh) {
  const s = store.scenario
  const r = store.result
  if (!r) return h('div', { class: 'deck' }, h('p', {}, 'Aucun résultat à présenter.'))

  const slides = build(s, r)
  at.i = Math.max(0, Math.min(at.i, slides.length - 1))
  const go = (d) => { at.i = Math.max(0, Math.min(at.i + d, slides.length - 1)); refresh() }

  const stage = h('div', { class: 'deck-stage' }, slides[at.i])

  const el = h('div', { class: 'deck', tabindex: '0' },
    h('header', { class: 'deck-bar' },
      h('button', { class: 'deck-exit', onClick: () => navigate('#/business-case') }, '← Quitter'),
      h('div', { class: 'deck-dots' },
        ...slides.map((_, i) => h('button', {
          class: `deck-dot ${i === at.i ? 'active' : ''} ${i < at.i ? 'seen' : ''}`,
          title: `Slide ${i + 1}`,
          onClick: () => { at.i = i; refresh() },
        })),
      ),
      h('div', { class: 'deck-count num' }, `${at.i + 1} / ${slides.length}`),
    ),
    stage,
    h('div', { class: 'deck-nav' },
      h('button', { class: 'deck-arrow', disabled: at.i === 0 || null, onClick: () => go(-1) }, '←'),
      h('button', { class: 'deck-arrow', disabled: at.i === slides.length - 1 || null, onClick: () => go(1) }, '→'),
    ),
    h('div', { class: 'deck-progress' }, h('i', { style: { width: `${((at.i + 1) / slides.length) * 100}%` } })),
  )

  // Les flèches, l'espace et Échap : on présente au clavier, pas à la souris.
  el.addEventListener('keydown', (e) => {
    if (['ArrowRight', ' ', 'PageDown'].includes(e.key)) { e.preventDefault(); go(1) }
    else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go(-1) }
    else if (e.key === 'Escape') navigate('#/business-case')
    else if (e.key === 'Home') { at.i = 0; refresh() }
    else if (e.key === 'End') { at.i = slides.length - 1; refresh() }
  })
  requestAnimationFrame(() => { try { el.focus({ preventScroll: true }) } catch { /* rien */ } })

  // Au doigt : un balayage change de slide.
  let x0 = null
  el.addEventListener('touchstart', (e) => { x0 = e.touches[0]?.clientX ?? null }, { passive: true })
  el.addEventListener('touchend', (e) => {
    if (x0 === null) return
    const dx = (e.changedTouches[0]?.clientX ?? x0) - x0
    if (Math.abs(dx) > 48) go(dx < 0 ? 1 : -1)
    x0 = null
  })

  return el
}
