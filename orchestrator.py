#!/usr/bin/env python3
"""
ChainHub — Autonom Multi-Agent Orkestrator
==========================================
Kører build-agenter sekventielt og autonomt.
Læser opgaver fra PROGRESS.md, kalder Claude API,
skriver output til disk, committer via git.

Krav:
  pip install anthropic gitpython python-dotenv

Brug:
  python orchestrator.py                  # kør næste opgave
  python orchestrator.py --sprint 1       # kør hele Sprint 1
  python orchestrator.py --agent BA-03    # kør specifik agent
  python orchestrator.py --dry-run        # vis plan uden at køre
"""

import os
import re
import sys
import json
import time
import argparse
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Optional

try:
    import anthropic
    from dotenv import load_dotenv
except ImportError:
    print("Mangler pakker. Kør: pip install anthropic python-dotenv")
    sys.exit(1)

# ============================================================
# Konfiguration
# ============================================================

load_dotenv(".env.local")
load_dotenv(".env")

REPO_ROOT        = Path(__file__).parent
DOCS_SPEC        = REPO_ROOT / "docs" / "spec"
DOCS_BUILD       = REPO_ROOT / "docs" / "build"
DOCS_STATUS      = REPO_ROOT / "docs" / "status"
PROGRESS_FILE    = DOCS_STATUS / "PROGRESS.md"
DECISIONS_FILE   = DOCS_STATUS / "DECISIONS.md"
BLOCKERS_FILE    = DOCS_STATUS / "BLOCKERS.md"

MODEL            = "claude-opus-4-5"
MAX_TOKENS       = 32000
LOG_FILE         = REPO_ROOT / "orchestrator.log"

# ============================================================
# Agent-definitioner
# Hver agent har: id, navn, input-filer, succeskriterier,
# og en system-prompt der aktiverer agentens persona
# ============================================================

AGENTS = {
    "BA-02": {
        "navn": "Schema-agent",
        "sprint": 1,
        "opgave": "Database — Prisma schema komplet med alle modeller, enums, relationer, indexes",
        "input_filer": [
            "docs/spec/DATABASE-SCHEMA.md",
            "docs/spec/CONTRACT-TYPES.md",
            "docs/status/DECISIONS.md",
        ],
        "output_filer": ["prisma/schema.prisma", "prisma/seed.ts"],
        "succeskriterier": [
            "prisma/schema.prisma eksisterer og er valid Prisma syntax",
            "Alle enums fra DATABASE-SCHEMA.md er med",
            "organization_id på alle modeller",
            "deleted_at på alle kritiske modeller",
            "DEC-008, DEC-016, DEC-019 indarbejdet",
        ],
        "system_prompt": """Du er BA-02 (Schema-agent) for ChainHub-projektet.

Dit ansvar: Prisma schema, database-migrationer, seed-data, multi-tenancy-lag, indexes, enums, soft delete-mønstre.

Kritiske valideringsregler du ALDRIG må bryde:
- Alle tabeller har organization_id, created_at, updated_at, created_by
- Soft delete (deleted_at) på alle kritiske tabeller
- Sensitivity-enum på contracts, cases, documents
- Explicit foreign keys — ingen implicitte relationer
- Indexes på alle organization_id + deleted_at kombinationer

Du skriver KUN kode baseret på spec-dokumenterne. Du gætter aldrig — hvis noget er uklart, skriv en kommentar i koden.

OUTPUT-FORMAT (vigtigt):
For hver fil du opretter eller ændrer, skriv:
--- FIL: [sti/til/fil] ---
[filindhold]
--- SLUT ---

Opret prisma/schema.prisma med KOMPLET schema (alle modeller og enums).
Opret prisma/seed.ts med realistisk testdata (1 organisation, 2 selskaber, 3 brugere, 5 kontrakter).
""",
    },

    "BA-03": {
        "navn": "Auth-agent",
        "sprint": 1,
        "opgave": "Auth — NextAuth.js med email/password + Microsoft OAuth + session + middleware + permissions helpers",
        "input_filer": [
            "docs/spec/kravspec-legalhub.md",
            "docs/build/CONVENTIONS.md",
            "docs/spec/roller-og-tilladelser.md",
            "prisma/schema.prisma",
        ],
        "output_filer": [
            "src/lib/auth/index.ts",
            "src/lib/permissions/index.ts",
            "src/app/api/auth/[...nextauth]/route.ts",
            "src/middleware.ts",
            "src/app/(auth)/login/page.tsx",
        ],
        "succeskriterier": [
            "NextAuth konfigureret med Credentials + Azure AD provider",
            "Session inkluderer organizationId og userId",
            "Middleware beskytter (dashboard) routes",
            "canAccessCompany(), canAccessSensitivity(), canAccessModule(), getAccessibleCompanies() implementeret",
            "Login-side oprettet",
        ],
        "system_prompt": """Du er BA-03 (Auth-agent) for ChainHub-projektet.

Dit ansvar: NextAuth.js, Microsoft OAuth/SSO, session-håndtering, route-middleware, permissions-helpers.

Du leverer disse helpers (ALTID med disse eksakte signaturer):
  canAccessCompany(userId: string, companyId: string): Promise<boolean>
  canAccessSensitivity(userId: string, level: SensitivityLevel): Promise<boolean>
  canAccessModule(userId: string, module: ModuleType): Promise<boolean>
  getAccessibleCompanies(userId: string): Promise<Company[]>

Regler:
- Brug Prisma adapter til NextAuth
- Password hashing med bcrypt (12 rounds)
- Session strategy: database (ikke JWT) for server-side invalidering
- Session levetid: 8 timer (inaktivitet) / 24 timer (absolut)
- Middleware: beskyt alle /app/* routes undtagen /app/api/auth/*
- Permissions hentes fra user_role_assignments tabellen

OUTPUT-FORMAT:
--- FIL: [sti/til/fil] ---
[filindhold]
--- SLUT ---
""",
    },

    "BA-04": {
        "navn": "UI-agent (Dashboard shell)",
        "sprint": 1,
        "opgave": "Dashboard shell — layout med sidebar, header, navigation til alle moduler",
        "input_filer": [
            "docs/build/CONVENTIONS.md",
            "docs/spec/kravspec-legalhub.md",
            "docs/spec/roller-og-tilladelser.md",
            "src/lib/auth/index.ts",
        ],
        "output_filer": [
            "src/app/(dashboard)/layout.tsx",
            "src/components/layout/Sidebar.tsx",
            "src/components/layout/Header.tsx",
            "src/app/(dashboard)/page.tsx",
        ],
        "succeskriterier": [
            "Dashboard layout med sidebar og header",
            "Navigation til: Selskaber, Kontrakter, Sager, Opgaver, Personer, Dokumenter, Økonomi, Indstillinger",
            "Bruger-menu med logout",
            "Tom dashboard-forside med loading skeleton",
            "Kun Tailwind utility classes — ingen inline styles",
            "Dansk sprog i alle labels",
        ],
        "system_prompt": """Du er BA-04 (UI-agent) for ChainHub-projektet.

Dit ansvar: Komponenter, layout, navigation, designsystem. Ingen business logic overhovedet.

Regler du ALDRIG må bryde:
- Kun Tailwind utility classes — aldrig inline styles
- Dansk sprog i ALLE labels, knapper, fejlbeskeder
- Tom state implementeret på alle lister
- Loading state (skeleton) implementeret på alle async operationer
- Desktop-first responsivt design
- Ingen direkte Prisma-kald i komponenter
- Ingen fetch() i klient-komponenter — brug Server Components

Sidebar navigation-rækkefølge:
  1. Overblik (dashboard forside)
  2. Selskaber
  3. Kontrakter
  4. Sager
  5. Opgaver
  6. Personer
  7. Dokumenter
  8. Økonomi
  --- separator ---
  9. Indstillinger

OUTPUT-FORMAT:
--- FIL: [sti/til/fil] ---
[filindhold]
--- SLUT ---
""",
    },

    "BA-08-devops": {
        "navn": "DevOps-agent (CI/CD)",
        "sprint": 1,
        "opgave": "DevOps — GitHub Actions CI, env validation script, Vercel config",
        "input_filer": [
            "docs/build/CONVENTIONS.md",
            "package.json",
            ".env.example",
        ],
        "output_filer": [
            ".github/workflows/ci.yml",
            "scripts/validate-env.ts",
            "vercel.json",
        ],
        "succeskriterier": [
            "GitHub Actions CI kører lint + typecheck + test ved PR",
            "validate-env.ts fejler ved opstart hvis påkrævede vars mangler",
            "vercel.json med korrekte maxDuration og www-webhook URL",
            "Stripe webhook URL dokumenteret med www-prefix advarsel",
        ],
        "system_prompt": """Du er BA-08 (DevOps-agent) for ChainHub-projektet.

Dit ansvar: Alt der ikke er applikationskode men kritisk for produktion.

Kritiske læringer du ALTID anvender:
- Stripe webhook URL SKAL have www-prefix (https://www.chainhub.dk/...) — ikke-forhandlingsbart
- Trailing newlines i secrets giver stille fejl — validate-env.ts skal trimme og validere
- Vercel kræver manuel redeploy ved env var-ændringer — dokumentér i RUNBOOK
- Multi-tenant SaaS kræver miljø-isolation (dev/staging/prod)

validate-env.ts skal:
  - Køre ved npm run dev og npm run build
  - Tjekke ALLE vars fra .env.example
  - Fejle med præcis besked om hvilken var der mangler
  - Advare hvis NEXTAUTH_SECRET er under 32 tegn

OUTPUT-FORMAT:
--- FIL: [sti/til/fil] ---
[filindhold]
--- SLUT ---
""",
    },

    "BA-07-sprint1": {
        "navn": "QA-agent (Sprint 1 review)",
        "sprint": 1,
        "opgave": "QA — Validér at Sprint 1 kode matcher spec. Find gaps og inkonsistenser.",
        "input_filer": [
            "docs/spec/DATABASE-SCHEMA.md",
            "docs/build/CONVENTIONS.md",
            "docs/spec/roller-og-tilladelser.md",
            "docs/spec/API-SPEC.md",
            "docs/status/DECISIONS.md",
            "prisma/schema.prisma",
            "src/lib/auth/index.ts",
            "src/lib/permissions/index.ts",
            "src/middleware.ts",
        ],
        "output_filer": ["docs/status/DECISIONS.md"],
        "succeskriterier": [
            "Alle permissions helpers har korrekte signaturer",
            "organization_id tjek på alle Prisma queries",
            "Ingen inline styles i UI-komponenter",
            "Session indeholder organizationId og userId",
        ],
        "system_prompt": """Du er BA-07 (QA-agent) for ChainHub-projektet.

Dit ansvar: Validér at bygget kode matcher spec. Find gaps og inkonsistenser. Du skriver ALDRIG ny feature-kode.

Tjekliste du gennemgår for HVER fil:
  □ organization_id på alle Prisma queries
  □ deleted_at: null på alle list-queries
  □ canAccessCompany() kaldt inden data returneres
  □ canAccessSensitivity() kaldt på sensitive ressourcer
  □ Zod validation på al brugerinput
  □ Fejlbeskeder på dansk
  □ Ingen inline styles
  □ Ingen console.log i produktionskode

For hvert fund: opret DEC-entry i DECISIONS.md med status CHALLENGED.
For hvert godkendt modul: skriv "QA-GODKENDT: [modul] [dato]" i DECISIONS.md.

OUTPUT-FORMAT:
--- FIL: docs/status/DECISIONS.md ---
[komplet opdateret DECISIONS.md indhold]
--- SLUT ---

Afslut med en QA-rapport:
  GODKENDT: [liste]
  FEJL: [liste med fil og linje]
  MANGLER: [liste]
""",
    },
}

# ============================================================
# Hjælpefunktioner
# ============================================================

def log(besked: str, niveau: str = "INFO"):
    tidsstempel = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    linje = f"[{tidsstempel}] [{niveau}] {besked}"
    print(linje)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(linje + "\n")


def læs_fil(sti: str) -> Optional[str]:
    """Læs en fil relativt til REPO_ROOT. Returner None hvis den ikke findes."""
    fuld_sti = REPO_ROOT / sti
    if not fuld_sti.exists():
        log(f"Fil ikke fundet: {sti}", "ADVARSEL")
        return None
    return fuld_sti.read_text(encoding="utf-8")


def skriv_fil(sti: str, indhold: str):
    """Skriv fil og opret mapper hvis nødvendigt."""
    fuld_sti = REPO_ROOT / sti
    fuld_sti.parent.mkdir(parents=True, exist_ok=True)
    fuld_sti.write_text(indhold, encoding="utf-8")
    log(f"Skrevet: {sti}")


def git_commit(besked: str, filer: list[str] = None):
    """Commit specifikke filer eller alle ændringer."""
    try:
        if filer:
            for fil in filer:
                subprocess.run(["git", "add", fil], cwd=REPO_ROOT, check=True, capture_output=True)
        else:
            subprocess.run(["git", "add", "-A"], cwd=REPO_ROOT, check=True, capture_output=True)

        resultat = subprocess.run(
            ["git", "commit", "-m", besked],
            cwd=REPO_ROOT, capture_output=True, text=True
        )
        if resultat.returncode == 0:
            log(f"Git commit: {besked}")
        else:
            log(f"Git commit fejlede (muligvis ingen ændringer): {resultat.stderr}", "ADVARSEL")
    except subprocess.CalledProcessError as e:
        log(f"Git fejl: {e}", "FEJL")


def parse_output_filer(tekst: str) -> dict[str, str]:
    """
    Parser agent-output og udtrækker filer.
    Format: --- FIL: sti/til/fil ---\n[indhold]\n--- SLUT ---
    Håndterer afskårne filer (manglende --- SLUT --- ved token-grænse).
    """
    filer = {}

    # Forsøg 1: komplet format med --- SLUT ---
    mønster = r"--- FIL: (.+?) ---\n(.*?)--- SLUT ---"
    matches = re.findall(mønster, tekst, re.DOTALL)
    for sti, indhold in matches:
        filer[sti.strip()] = indhold.strip()

    if filer:
        return filer

    # Forsøg 2: afskåret output — find alle --- FIL: --- headers
    # og tag indholdet frem til næste header eller slutning
    sektioner = re.split(r"--- FIL: (.+?) ---", tekst)
    # sektioner = [tekst_før, sti1, indhold1, sti2, indhold2, ...]
    if len(sektioner) > 1:
        for i in range(1, len(sektioner), 2):
            sti = sektioner[i].strip()
            indhold = sektioner[i+1].strip() if i+1 < len(sektioner) else ""
            # Fjern eventuel --- SLUT --- i slutningen
            indhold = re.sub(r"\s*--- SLUT ---\s*$", "", indhold).strip()
            if sti and indhold:
                filer[sti] = indhold

    # Forsøg 3: markdown kodeblokke som fallback
    if not filer:
        md_mønster = r"```(?:typescript|prisma|yaml|json|bash)?\n(.*?)```"
        md_matches = re.findall(md_mønster, tekst, re.DOTALL)
        for i, indhold in enumerate(md_matches):
            filer[f"output-{i+1}.txt"] = indhold.strip()

    return filer


def opdater_progress(agent_id: str, status: str = "x"):
    """Opdater PROGRESS.md — marker opgave som færdig."""
    if not PROGRESS_FILE.exists():
        return
    indhold = PROGRESS_FILE.read_text(encoding="utf-8")
    # Simpel opdatering — sæt [x] på linjer der matcher agent-opgaven
    agent = AGENTS.get(agent_id, {})
    opgave_nøgleord = agent.get("opgave", "")[:30]
    # Opdater seneste opdatering sektion
    nu = datetime.now().strftime("%Y-%m-%d")
    if "## Seneste opdatering" in indhold:
        indhold = re.sub(
            r"(## Seneste opdatering\n)Dato: .*\nAf: .*\nNote: .*",
            f"\\1Dato: {nu}\nAf: {agent_id} ({agent.get('navn', '')})\nNote: {opgave_nøgleord} fuldført",
            indhold
        )
    PROGRESS_FILE.write_text(indhold, encoding="utf-8")


# ============================================================
# Kerne: kald Claude API med agent-prompt
# ============================================================

def kør_agent(agent_id: str, klient: anthropic.Anthropic, dry_run: bool = False) -> bool:
    """
    Kør én agent:
    1. Saml input-filer
    2. Kald Claude API
    3. Parse output og skriv filer til disk
    4. Git commit
    5. Opdater PROGRESS.md
    """
    agent = AGENTS.get(agent_id)
    if not agent:
        log(f"Ukendt agent: {agent_id}", "FEJL")
        return False

    log(f"=== Starter {agent_id} ({agent['navn']}) ===")
    log(f"Opgave: {agent['opgave']}")

    # --- 1. Saml input-filer ---
    fil_kontekst = []
    for sti in agent["input_filer"]:
        indhold = læs_fil(sti)
        if indhold:
            fil_kontekst.append(f"\n\n=== {sti} ===\n{indhold}")
        else:
            log(f"Input-fil mangler: {sti} — fortsætter uden", "ADVARSEL")

    bruger_besked = f"""Din opgave: {agent['opgave']}

Succeskriterier:
{chr(10).join(f'- {k}' for k in agent['succeskriterier'])}

Her er de relevante filer:
{''.join(fil_kontekst)}

Udfør opgaven nu. Skriv ALLE filer i formatet:
--- FIL: sti/til/fil ---
[komplet filindhold]
--- SLUT ---

Afslut med en kort status: FÆRDIG / BLOKERET [årsag]
"""

    if dry_run:
        log(f"[DRY RUN] Ville kalde API for {agent_id}")
        log(f"[DRY RUN] System prompt: {agent['system_prompt'][:100]}...")
        log(f"[DRY RUN] Input filer: {agent['input_filer']}")
        return True

    # --- 2. Kald Claude API (streaming) ---
    log(f"Kalder Claude API ({MODEL}) med streaming...")
    start = time.time()

    try:
        output_tekst = ""
        chunks = 0
        with klient.messages.stream(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=agent["system_prompt"],
            messages=[{"role": "user", "content": bruger_besked}]
        ) as stream:
            for tekst in stream.text_stream:
                output_tekst += tekst
                chunks += len(tekst)
                if chunks % 2000 == 0:
                    log(f"  ... {chunks} tegn modtaget")

        varighed = round(time.time() - start, 1)
        log(f"API svar komplet på {varighed}s ({len(output_tekst)} tegn)")

    except Exception as e:
        log(f"API fejl: {e}", "FEJL")
        return False

    # --- 3. Parse og skriv filer ---
    filer = parse_output_filer(output_tekst)

    if not filer:
        log("Ingen filer fundet i output — tjek format", "ADVARSEL")
        # Gem raw output til debug
        debug_sti = REPO_ROOT / f"orchestrator-debug-{agent_id}.txt"
        debug_sti.write_text(output_tekst, encoding="utf-8")
        log(f"Raw output gemt: {debug_sti}")
        return False

    for sti, indhold in filer.items():
        skriv_fil(sti, indhold)

    # --- 4. Git commit ---
    commit_besked = f"feat: {agent_id} {agent['navn']} - {agent['opgave'][:50]}"
    git_commit(commit_besked)

    # --- 5. Opdater PROGRESS.md ---
    opdater_progress(agent_id)

    log(f"=== {agent_id} FÆRDIG ({len(filer)} filer skrevet) ===")
    return True


# ============================================================
# Sprint-kørsel: kør alle agenter i et sprint sekventielt
# ============================================================

SPRINT_RÆKKEFØLGE = {
    1: ["BA-02", "BA-03", "BA-04", "BA-08-devops", "BA-07-sprint1"],
}


def kør_sprint(sprint_nr: int, klient: anthropic.Anthropic, dry_run: bool = False):
    """Kør alle agenter i et sprint sekventielt."""
    agenter = SPRINT_RÆKKEFØLGE.get(sprint_nr)
    if not agenter:
        log(f"Ukendt sprint: {sprint_nr}", "FEJL")
        return

    log(f"=== STARTER SPRINT {sprint_nr} ({len(agenter)} agenter) ===")
    start = time.time()

    for i, agent_id in enumerate(agenter, 1):
        log(f"--- Agent {i}/{len(agenter)}: {agent_id} ---")
        succes = kør_agent(agent_id, klient, dry_run)
        if not succes:
            log(f"Agent {agent_id} fejlede — stopper sprint", "FEJL")
            log("Tjek orchestrator-debug-*.txt for detaljer")
            break
        # Kort pause mellem agenter
        if i < len(agenter):
            time.sleep(2)

    varighed = round(time.time() - start, 1)
    log(f"=== SPRINT {sprint_nr} AFSLUTTET på {varighed}s ===")


# ============================================================
# Hovedprogram
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="ChainHub autonom orkestrator")
    parser.add_argument("--sprint", type=int, help="Kør hele et sprint (fx --sprint 1)")
    parser.add_argument("--agent", type=str, help="Kør specifik agent (fx --agent BA-03)")
    parser.add_argument("--dry-run", action="store_true", help="Vis plan uden at køre")
    parser.add_argument("--list", action="store_true", help="List alle agenter")
    args = parser.parse_args()

    if args.list:
        print("\nTilgængelige agenter:")
        for agent_id, agent in AGENTS.items():
            print(f"  {agent_id:20} Sprint {agent['sprint']} — {agent['navn']}")
        print("\nSprints:")
        for sprint_nr, agenter in SPRINT_RÆKKEFØLGE.items():
            print(f"  Sprint {sprint_nr}: {' → '.join(agenter)}")
        return

    # Tjek API-nøgle
    api_nøgle = os.getenv("ANTHROPIC_API_KEY")
    if not api_nøgle:
        log("ANTHROPIC_API_KEY ikke fundet i .env.local eller miljøvariabler", "FEJL")
        log("Tilføj: ANTHROPIC_API_KEY=sk-ant-... til .env.local")
        sys.exit(1)

    klient = anthropic.Anthropic(api_key=api_nøgle)

    if args.dry_run:
        log("=== DRY RUN — ingen filer skrives, ingen API-kald ===")

    if args.agent:
        kør_agent(args.agent, klient, args.dry_run)
    elif args.sprint:
        kør_sprint(args.sprint, klient, args.dry_run)
    else:
        # Default: vis status og næste opgave
        log("Ingen handling angivet. Brug --sprint 1, --agent BA-03 eller --list")
        log("Eksempel: python orchestrator.py --sprint 1")


if __name__ == "__main__":
    main()
