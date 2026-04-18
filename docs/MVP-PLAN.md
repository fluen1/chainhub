# ChainHub MVP Plan

## Mål

En funktionel MVP som en kædeleder kan bruge dagligt til at:

1. Overvåge sine klinikker/selskaber
2. Holde styr på kontrakter og deadlines
3. Spore sager og opgaver
4. Se hvad der kræver opmærksomhed NU

---

## Status: Hvad virker allerede (Sprint 1-7)

**Fungerende moduler:**

- Auth (login, session, JWT, middleware)
- Dashboard (urgency panel, onboarding, company cards)
- Selskaber (CRUD, 10 tabs, overview, stamdata, ejerskab)
- Kontrakter (34 typer, status-flow, sensitivity, parter)
- Sager (4 typer, 8 subtyper, linking til selskab/kontrakt/person)
- Opgaver (status, prioritet, tildeling)
- Persondatabase (søg, CRUD, selskabsroller)
- Global søgning (header-søgning)
- Permissions (3-lags RBAC, sensitivity)
- Pagination + filtre (selskaber, kontrakter, personer)

**Hvad mangler for en brugbar MVP:**

- Database skal genaktiveres (Supabase paused)
- Pagination på cases og tasks lister
- Seed-data for demo/test
- Basis brugerstyring (invite/opret bruger)

---

## MVP Sprint Plan

### MVP-A: Database + Data (forudsætning)

- [ ] Genaktiver Supabase projekt ELLER opsæt lokal PostgreSQL
- [ ] Kør `prisma db push` / `prisma migrate dev`
- [ ] Kør `prisma db seed` med realistisk demo-data
- [ ] Verificér at alle sider loader med data

### MVP-B: Manglende pagination + polish

- [ ] Cases-liste: tilføj Pagination + SearchAndFilter
- [ ] Tasks-liste: tilføj Pagination + SearchAndFilter
- [ ] Verificér alle CRUD-flows end-to-end (opret → vis → rediger → slet)

### MVP-C: Brugerstyring (minimal)

- [ ] `/settings/users` side — list brugere i organisationen
- [ ] Opret bruger (email, navn, rolle, company_ids)
- [ ] Server actions: `createUser`, `updateUser`, `deleteUser`
- [ ] Zod-validering + permissions (kun GROUP_OWNER/GROUP_ADMIN)

### MVP-D: Seed + Demo

- [ ] Realistisk seed-script med:
  - 1 organisation ("Tandlægegruppen Danmark")
  - 5-8 selskaber (klinikker)
  - 15-20 kontrakter (blanding af typer)
  - 5-10 sager
  - 10-15 opgaver
  - 8-12 personer
  - 1 admin-bruger + 1 readonly-bruger
- [ ] Login credentials i `.env.example` kommentar

### MVP-E: Smoke Test

- [ ] Login → Dashboard loader med data
- [ ] Urgency panel viser forfaldne items
- [ ] Selskabsliste → klik → tabs virker
- [ ] Opret kontrakt → den vises i listen
- [ ] Opret sag → den vises i listen
- [ ] Global søgning finder selskab og kontrakt
- [ ] Readonly-bruger kan se men ikke redigere

---

## Post-MVP (Sprint 8 features — prioriteret)

1. **Besøgsstyring** — planlæg og log besøg pr. klinik
2. **Dokumentupload** — vedhæft filer til kontrakter/sager
3. **Opgave-kommentarer** — kommentér og spor historik
4. **Kontraktversioner** — upload nye versioner med ChangeType
5. **Email-digest** — daglig advisering om forfaldne items

---

## Kendte Risici

| Risiko                  | Mitigation                              |
| ----------------------- | --------------------------------------- |
| Supabase paused         | Genaktiver eller brug lokal PG          |
| Ingen seed-data         | Opret realistisk seed-script            |
| Manglende brugerstyring | MVP-C dækker minimum                    |
| Ingen fil-upload        | Post-MVP — kontrakter virker uden bilag |
