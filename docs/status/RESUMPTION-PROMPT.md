# Resumption Prompt — til næste Claude Code-session

**Generated:** 2026-04-18 (efter samtale-clear)

Kopiér teksten mellem `---BEGIN PROMPT---` og `---END PROMPT---` ind som første besked i ny Claude Code-session.

---BEGIN PROMPT---

Vi genoptager ChainHub-udvikling efter samtale-clear. Læs følgende filer FØRST for komplet kontekst, og start så hvor vi sluttede:

## Hurtig-læse-liste (i prioriteret rækkefølge)

1. `CLAUDE.md` — projekt-overblik + kritiske regler
2. `docs/status/PROGRESS.md` — fuld sprint-historik (læs specifikt de nederste sektioner fra 2026-04-18)
3. `docs/status/RESUMPTION-PROMPT.md` — **denne fil** — giver kontekst om hvad vi er midt i
4. `docs/build/PRICING-DECISION-2026-04.md` — afventer mine 4 beslutninger
5. `docs/superpowers/plans/2026-04-18-product-roadmap.md` — overordnet roadmap (Phase A-C)

## Aktuel state (2026-04-18)

**Gate 1 kode-side er komplet:** mobile, empty-states, GDPR, eksport, backup, onboarding, dashboard, print, R2-interface, axe-core CI, performance-fixes, comment-bug-fix — alt leveret og testet (730+ tests grønne).

**Phase B first delivery er leveret:** upload → auto-extraction → AI-fields synlige på /persons/[id] i shadow-mode.

**MCP-servere tilgængelige (kræver OAuth-auth før brug):** vercel, supabase, sentry, github, stripe. Authenticate på anmodning.

## Pending — 7 åbne faser

Status pr. 2026-04-18:

- **◼ A.2 Pricing** — beslutningsdokument klar (`docs/build/PRICING-DECISION-2026-04.md`). Afventer brugerens svar på 4 spørgsmål. **REVIDERET v2**: estimater var for lave — nye priser er Basis 3.500 kr., Plus 9.500 kr. + 75/ekstra over 50, Enterprise floor 32.000 kr.
- **◻ A.4 UX/UI-audit + fixes** — audit lavet (PAGE-AUDIT-2026-04.md), hovedsageligt adresseret. Udestående: evt. findings fra første axe-core CI-run når det kører i Actions.
- **◻ A.5 Bruger-godkendelse Gate 1** — bruger har verificeret lokalt (2026-04-18) og bekræftet comment-bug fix + dashboard-density. Kræver formel "det er færdigt lokalt"-bekræftelse inden A.7 starter.
- **◻ A.7 Deploy-infrastruktur** — kræver MCP-auth + eksterne opgaver: domæne-køb, Vercel Pro ($20/m), Supabase Pro ($25/m), Resend SPF/DKIM, Sentry alerts, BetterStack uptime. ~5-6 timers opsætning + ~500 kr./måned drift.
- **◻ A.8 Pilot + Gate 2** — kræver kunde-outreach (ekstern) + servicevilkår (skabelon nok til pilot). Ingen advokat krævet til første pilot.
- **◻ Phase B Plus AI-assist** — B.1a (extraction auto-kø) + B.1c (AI-fields på persons) leveret. Udestående: B.1b review-UI-udbygning (eksisterer allerede som 817-linjers skeleton — skal valideres/udvides), gold-standard-dataset (20-30 annoterede kontrakter), regression-suite, feedback-loop-analytics.
- **◻ Phase C Enterprise + Bedrock** — ikke startet. Cross-company portfolio-insights + contract-renewal-risk-scoring + RAG med pgvector + Bedrock-migration. Kræver AWS-konto + Bedrock-model-access (2-4 ugers ventetid).

## Prioriterede næste skridt

1. **Få brugerens pricing-svar** (afventer i PRICING-DECISION v2-dokumentet)
2. **Phase B.1b — review-UI validering + udbygning** (kode, ingen eksterne)
3. **Phase C.1 — cross-company portfolio-insights** (kode, ingen eksterne)
4. **Deploy-prep-dokument** hvis brugeren vil starte A.7 (MCP-auth + konfiguration)

## Vigtige ikke-code-ting brugeren skal gøre (ekstern)

- [ ] Svar på pricing-spørgsmål (4 stk. i dokumentet)
- [ ] Auth MCPs hvis A.7 skal automatiseres (Vercel/Supabase/Sentry/GitHub)
- [ ] Start AWS Bedrock-model-access-ansøgning som forsikring (2-4 ugers ventetid)
- [ ] Domæne-køb når klar
- [ ] Pilot-kunde-outreach

## Arbejdsmønster

- Subagent-driven-development for alle kode-tasks (fresh agent pr. task, two-stage review)
- writing-plans skill for nye tracks
- Danish commit messages, format `[type]: beskrivelse på dansk`
- CLAUDE.md kritiske regler SKAL følges (organization_id på alle queries, sensitivity-checks, soft-delete, Zod-validering)
- Test før commit, gate: format ✅ lint ✅ tsc ✅ tests ✅ build ✅

## Dev-server state

Dev-server er **stoppet** ved session-slut. Start igen med `npm run dev`.

## Auto-mode

Forrige session var i auto-mode. Hvis brugeren vil forsætte autonomt, bekræft og start den naturligste næste task.

## Spørg brugeren først

Start med at læse denne fil + PROGRESS.md, og spørg så **kort**: "Hvor vil du fortsætte — pricing-svar først, Phase B.1b review-UI, Phase C.1 portfolio-insights, eller deploy-prep?"

---END PROMPT---

## Ting brugeren selv skal notere før clear

Kopiér også disse noter et sikkert sted så de ikke tabes:

### Dine pricing-beslutninger (afventer)

Se `docs/build/PRICING-DECISION-2026-04.md` for kontekst. Fire spørgsmål:

1. **Basis-pris:** 3.500 kr./måned? (a/b/c/d)
2. **Plus-model:** Flat 10.000 kr. / 9.500 kr. + 75 kr. pr. ekstra over 50 / Forbrugs-baseret / andet?
3. **Enterprise-floor:** 25k / 32k / 40k / andet?
4. **Margin-mål:** Basis 85-90%, Plus 70-80%, Enterprise 85-90% — OK?

### Dine eksterne opgaver

- Domæne (hvor? namecheap, simply.com, one.com) — skal først bruges til Gate 2 deploy
- AWS-konto + Bedrock-model-access (hvis du vil have EU-residency eller Phase C)
- Vercel + Supabase Pro billing-kort
- Pilot-kunde: hvem er kandidat?
- Advokat: kun nødvendig ved 2+ kommercielle kunder

### Væsentlige tal

- Tests pr. sidste session: **735 passed, 4 skipped**
- Kode-linje-tal: ingen ændring, ingen rapport nødvendig
- Commits i seneste session (siden Gate 1-milestone): ~25+
- Projekt-status: Gate 1 komplet, Phase B first delivery komplet, venter på bruger-svar til at fortsætte
