# BLOCKERS.md — ChainHub MABS

## BLK-001: Supabase database ikke tilgængelig
**Status:** AKTIV
**Opdaget:** Sprint 1
**Beskrivelse:** `prisma db push` fejler med P1001 — kan ikke nå database serveren.
Supabase projekt er sandsynligvis paused eller netværksblokeret.
**Påvirker:** Database migration og seed data. Kode kompilerer og bygger rent.
**Workaround:** Alle routes og build fungerer — data-fetching vil fejle runtime.
Genaktiver Supabase projekt eller brug lokal PostgreSQL.
