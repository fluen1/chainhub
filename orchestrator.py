#!/usr/bin/env python3
"""
ChainHub MABS — Autonom Multi-Agent Orkestrator v2
===================================================
Nye features i v2:
  - BA-12-repair agent: scanner imports, fikser deps, opretter shadcn-komponenter
  - kør_build_gate(): npm install + prisma generate + tsc + next build efter hvert sprint
  - --scan flag: vis manglende imports uden at fixe
  - --build-gate N flag: kør kun build gate for sprint N

Brug:
  python orchestrator.py --sprint 1
  python orchestrator.py --agent BA-12-repair --force
  python orchestrator.py --scan
  python orchestrator.py --build-gate 1
  python orchestrator.py --all
  python orchestrator.py --list
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

load_dotenv(".env.local")
load_dotenv(".env")

REPO_ROOT     = Path(__file__).parent
DOCS_STATUS   = REPO_ROOT / "docs" / "status"
PROGRESS_FILE = DOCS_STATUS / "PROGRESS.md"
MODEL         = "claude-sonnet-4-6"
MAX_TOKENS    = 32000
LOG_FILE      = REPO_ROOT / "orchestrator.log"


def log(besked: str, niveau: str = "INFO"):
    tidsstempel = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    linje = f"[{tidsstempel}] [{niveau}] {besked}"
    print(linje)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(linje + "\n")


def laes_fil(sti: str) -> Optional[str]:
    fuld_sti = REPO_ROOT / sti
    if not fuld_sti.exists():
        log(f"Fil ikke fundet: {sti}", "ADVARSEL")
        return None
    return fuld_sti.read_text(encoding="utf-8")


def skriv_fil(sti: str, indhold: str):
    fuld_sti = REPO_ROOT / sti
    fuld_sti.parent.mkdir(parents=True, exist_ok=True)
    fuld_sti.write_text(indhold, encoding="utf-8")
    log(f"Skrevet: {sti}")


def git_commit(besked: str, filer=None):
    try:
        if filer:
            for fil in filer:
                subprocess.run(["git", "add", fil], cwd=REPO_ROOT, check=True, capture_output=True)
        else:
            subprocess.run(["git", "add", "-A"], cwd=REPO_ROOT, check=True, capture_output=True)
        resultat = subprocess.run(
            ["git", "commit", "--no-verify", "-m", besked],
            cwd=REPO_ROOT, capture_output=True, text=True
        )
        if resultat.returncode == 0:
            log(f"Git commit: {besked}")
        else:
            log(f"Git commit: ingen aendringer", "ADVARSEL")
    except Exception as e:
        log(f"Git fejl: {e}", "FEJL")


def parse_output_filer(tekst: str) -> dict:
    filer = {}
    moenster = r"--- FIL: (.+?) ---\n(.*?)--- SLUT ---"
    matches = re.findall(moenster, tekst, re.DOTALL)
    for sti, indhold in matches:
        filer[sti.strip()] = indhold.strip()
    if filer:
        return filer
    sektioner = re.split(r"--- FIL: (.+?) ---", tekst)
    if len(sektioner) > 1:
        for i in range(1, len(sektioner), 2):
            sti = sektioner[i].strip()
            indhold = sektioner[i+1].strip() if i+1 < len(sektioner) else ""
            indhold = re.sub(r"\s*--- SLUT ---\s*$", "", indhold).strip()
            if sti and indhold:
                filer[sti] = indhold
    if not filer:
        md_moenster = r"```(?:typescript|prisma|yaml|json|bash)?\n(.*?)```"
        md_matches = re.findall(md_moenster, tekst, re.DOTALL)
        for i, indhold in enumerate(md_matches):
            filer[f"output-{i+1}.txt"] = indhold.strip()
    return filer


def opdater_progress(agent_id: str):
    if not PROGRESS_FILE.exists():
        return
    indhold = PROGRESS_FILE.read_text(encoding="utf-8")
    agent = AGENTS.get(agent_id, {})
    nu = datetime.now().strftime("%Y-%m-%d")
    if "## Seneste opdatering" in indhold:
        indhold = re.sub(
            r"(## Seneste opdatering\n)Dato: .*\nAf: .*\nNote: .*",
            f"\\1Dato: {nu}\nAf: {agent_id} ({agent.get('navn', '')})\nNote: {agent.get('opgave','')[:30]} faerdigt",
            indhold
        )
    PROGRESS_FILE.write_text(indhold, encoding="utf-8")


# ============================================================
# Scan + Build Gate
# ============================================================

def scan_manglende_imports() -> tuple:
    """
    Scann alle .ts/.tsx filer i src/ for imports uden matchende node_module.
    Returner (manglende_npm: list, manglende_shadcn: list).
    """
    node_modules = REPO_ROOT / "node_modules"
    manglende_npm = set()
    manglende_shadcn = set()

    pkg_json_sti = REPO_ROOT / "package.json"
    installerede = set()
    if pkg_json_sti.exists():
        pkg = json.loads(pkg_json_sti.read_text(encoding="utf-8"))
        installerede.update(pkg.get("dependencies", {}).keys())
        installerede.update(pkg.get("devDependencies", {}).keys())

    src_dir = REPO_ROOT / "src"
    if not src_dir.exists():
        return [], []

    import_re = re.compile(r'''(?:^import\s+.*?from\s+|^from\s+)['"](.*?)['"]|require\(['"](.*?)['"]\)''', re.MULTILINE)

    for fil in src_dir.rglob("*.ts*"):
        try:
            indhold = fil.read_text(encoding="utf-8")
        except Exception:
            continue

        for m in import_re.finditer(indhold):
            imp = m.group(1) or m.group(2) or ""
            if not imp:
                continue
            if imp.startswith(".") or imp.startswith("/"):
                continue
            if imp.startswith("@/components/ui/"):
                komponent_navn = imp.split("/")[-1]
                komponent_sti = REPO_ROOT / "src" / "components" / "ui" / f"{komponent_navn}.tsx"
                if not komponent_sti.exists():
                    manglende_shadcn.add(komponent_navn)
                continue
            if imp.startswith("@/"):
                continue
            dele = imp.split("/")
            pakke_navn = "/".join(dele[:2]) if imp.startswith("@") and len(dele) >= 2 else dele[0]
            if pakke_navn not in installerede and not (node_modules / pakke_navn).exists():
                manglende_npm.add(pakke_navn)

    return sorted(manglende_npm), sorted(manglende_shadcn)


def koer_build_gate(sprint_nr: int) -> bool:
    """
    Kør build gate: npm install + prisma generate + tsc + next build.
    Returnerer True hvis alt passes.
    """
    log(f"=== BUILD GATE: Sprint {sprint_nr} ===")

    # Pre-scan
    log("Scannner for manglende imports...")
    manglende_npm, manglende_shadcn = scan_manglende_imports()
    if manglende_npm:
        log(f"  Manglende npm: {', '.join(manglende_npm)}", "ADVARSEL")
    if manglende_shadcn:
        log(f"  Manglende shadcn: {', '.join(manglende_shadcn)}", "ADVARSEL")
    if manglende_npm or manglende_shadcn:
        log("  Kør: python orchestrator.py --agent BA-12-repair --force for auto-fix", "ADVARSEL")

    # Windows kræver .cmd suffix — på Unix er npm/npx direkte
    _npm = "npm.cmd" if sys.platform == "win32" else "npm"
    _npx = "npx.cmd" if sys.platform == "win32" else "npx"

    kommandoer = [
        ([_npm, "install", "--legacy-peer-deps"], "npm install"),
        ([_npx, "prisma", "generate"], "prisma generate"),
        ([_npx, "tsc", "--noEmit"], "tsc typecheck"),
        ([_npx, "next", "build"], "next build"),
    ]

    alle_ok = True
    for cmd, navn in kommandoer:
        log(f"  Korer: {navn}...")
        start = time.time()
        try:
            resultat = subprocess.run(cmd, cwd=REPO_ROOT, capture_output=True, text=True, timeout=300)
        except subprocess.TimeoutExpired:
            log(f"  x {navn} TIMEOUT", "FEJL")
            alle_ok = False
            break
        except Exception as e:
            log(f"  x {navn} FEJL: {e}", "FEJL")
            alle_ok = False
            break

        varighed = round(time.time() - start, 1)
        if resultat.returncode == 0:
            log(f"  v {navn} OK ({varighed}s)")
        else:
            log(f"  x {navn} FEJLEDE ({varighed}s)", "FEJL")
            if resultat.stderr:
                log(f"    {resultat.stderr[-600:]}", "FEJL")
            alle_ok = False
            if navn == "prisma generate":
                break

    if alle_ok:
        log(f"=== BUILD GATE SPRINT {sprint_nr}: PASSED ===")
        git_commit(f"chore: sprint {sprint_nr} build gate passed")
    else:
        log(f"=== BUILD GATE SPRINT {sprint_nr}: FEJLEDE ===", "FEJL")
        log("  Fix: python orchestrator.py --autorepair", "FEJL")

    return alle_ok


# ============================================================
# Autonom Repair Loop
# Korer build -> fanger fejl -> sender til Claude -> anvender fix -> gentager
# ============================================================

def udtraek_fejlfiler(fejl_output: str) -> list:
    """
    Ekstraher filstier fra TypeScript/Next.js/Prisma fejloutput.
    Returner liste over relative stier der eksisterer i repo.
    """
    kandidater = set()

    # TypeScript: src/app/page.tsx(10,5): error TS2345:
    for m in re.finditer(r"([\w./\-\[\]()@]+\.tsx?)(?:\(\d+,\d+\))?", fejl_output):
        kandidater.add(m.group(1))

    # Next.js: ./ prefix
    for m in re.finditer(r"\./([\w./\-\[\]()@]+\.tsx?)", fejl_output):
        kandidater.add(m.group(1))

    # Prisma
    for m in re.finditer(r"(prisma/[\w./]+)", fejl_output):
        kandidater.add(m.group(1))

    # Behold kun filer der faktisk eksisterer
    eksisterende = []
    for sti in sorted(kandidater):
        fuld = REPO_ROOT / sti
        if fuld.exists() and fuld.is_file():
            eksisterende.append(sti)

    # Max 20 filer for at holde kontekst under kontrol
    return eksisterende[:20]


def byg_fil_kontekst(fil_stier: list, max_tegn_pr_fil: int = 3000) -> str:
    """Laes filer og byg kontekst-streng til Claude."""
    kontekst = []
    for sti in fil_stier:
        fuld = REPO_ROOT / sti
        try:
            indhold = fuld.read_text(encoding="utf-8")
            if len(indhold) > max_tegn_pr_fil:
                indhold = indhold[:max_tegn_pr_fil] + f"\n... [afskaret ved {max_tegn_pr_fil} tegn]"
            kontekst.append(f"\n=== {sti} ===\n{indhold}")
        except Exception:
            pass
    return "".join(kontekst)


def kald_repair_claude(klient: anthropic.Anthropic, fejlende_trin: str,
                       fejl_output: str, fil_kontekst: str, iteration: int) -> Optional[str]:
    """Kald Claude API med fejl + filer og returnerer fix som tekst."""

    system_prompt = """Du er en ekspert Next.js/TypeScript repair-agent for ChainHub-projektet.

Dit ENESTE job: Fix de konkrete kompileringsfejl du ser. Intet andet.

Regler:
- Ret KUN de filer der er noedvendige for at fixe fejlene
- Introducér ALDRIG nye features eller refaktorering
- Bevar eksisterende logik — kun minimal aendring for at fixe fejlen
- Manglende exports: tilfoej dem
- Manglende typer: tilfoej dem eller brug 'any' som midlertidig fix
- Manglende imports: tilfoej dem eller installer pakken
- Syntaksfejl: ret dem
- Manglende shadcn/ui-komponenter: opret minimal fungerende version

OUTPUT-FORMAT — brug KUN dette format:
--- FIL: sti/til/fil ---
[komplet filindhold]
--- SLUT ---

Hvis npm-pakker mangler, tilfoej:
NPM_INSTALL: pakke1 pakke2

Afslut med: FAERDIG
"""

    bruger_besked = f"""=== ITERATION {iteration} ===
Fejlende trin: {fejlende_trin}

Fejloutput:
{fejl_output[:4000]}

Relevante filer:
{fil_kontekst}

Fix KUN de fejl der fremgaar af fejloutputtet. Skriv komplette filer.
"""

    try:
        output = ""
        with klient.messages.stream(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=system_prompt,
            messages=[{"role": "user", "content": bruger_besked}]
        ) as stream:
            for tekst in stream.text_stream:
                output += tekst
        return output
    except Exception as e:
        log(f"  Claude API fejl: {e}", "FEJL")
        return None


def byg_fil_til_agent_map() -> dict:
    """
    Byg reverse map: relativ_filsti -> agent_id
    Baseret paa output_filer i hver agents definition.
    Bruges til at route fejl tilbage til den ansvarlige specialist.
    """
    fil_map = {}
    for agent_id, agent in AGENTS.items():
        for sti in agent.get("output_filer", []):
            # Normaliser stien (forward slash, lowercase)
            norm = sti.replace("\\", "/").lower()
            fil_map[norm] = agent_id
    return fil_map


def identificer_ansvarlige_agenter(fejl_filer: list, fil_til_agent: dict) -> dict:
    """
    Gruppér fejlede filer pr. ansvarlig agent.
    Returner {agent_id: [fil1, fil2, ...]}.
    Filer uden ansvarlig agent samles under '__generisk__'.
    """
    grupper = {}
    for sti in fejl_filer:
        norm = sti.replace("\\", "/").lower()
        # Direkte match
        agent_id = fil_til_agent.get(norm)
        # Prøv delvis match (fx '[id]' vs '[companyId]' varianter)
        if not agent_id:
            for mappet_sti, aid in fil_til_agent.items():
                # Sammenlign filnavn uden mappe
                if norm.split("/")[-1] == mappet_sti.split("/")[-1]:
                    agent_id = aid
                    break
        if not agent_id:
            agent_id = "__generisk__"
        grupper.setdefault(agent_id, []).append(sti)
    return grupper


def kald_specialist_agent(klient: anthropic.Anthropic, agent_id: str,
                          fejlende_trin: str, fejl_output: str,
                          fejl_filer: list, iteration: int) -> Optional[str]:
    """
    Kald den originale specialist-agent med dens egen system_prompt + fejl.
    Agenten kender sine egne regler og konventioner bedst.
    """
    agent = AGENTS.get(agent_id)

    if agent_id == "__generisk__" or not agent:
        # Fallback: generisk repair
        system_prompt = """Du er en ekspert Next.js/TypeScript repair-agent for ChainHub-projektet.
Fix KUN de konkrete kompileringsfejl du ser. Minimal aendring — bevar eksisterende logik.
OUTPUT-FORMAT:
--- FIL: sti/til/fil ---
[komplet filindhold]
--- SLUT ---
NPM_INSTALL: pakke1 pakke2  (eller 'NPM_INSTALL: ingen')"""
        agent_navn = "Generisk repair"
    else:
        # Tilfoej repair-instruktion til agentens originale system_prompt
        repair_tillaeg = """

=== REPAIR MODE ===
Du er kaldt fordi din tidligere kode indeholder kompileringsfejl.
Dit job nu: Fix KUN de fejl der er beskrevet nedenfor.
Minimal aendring — bevar al eksisterende logik og arkitektur.
Du kender dine egne regler bedst — anvend dem stadig.

OUTPUT-FORMAT:
--- FIL: sti/til/fil ---
[komplet filindhold]
--- SLUT ---
NPM_INSTALL: pakke1 pakke2  (eller 'NPM_INSTALL: ingen')"""
        system_prompt = agent["system_prompt"] + repair_tillaeg
        agent_navn = agent["navn"]

    # Laes de fejlede filer som kontekst
    fil_kontekst = byg_fil_kontekst(fejl_filer)

    # Laes ogsaa agentens originale input-filer for fuld kontekst
    if agent and agent_id != "__generisk__":
        ekstra_input = []
        for sti in agent.get("input_filer", [])[:4]:  # Max 4 for at holde kontekst
            indhold = laes_fil(sti)
            if indhold:
                afskaret = indhold[:2000] + "\n...[afskaret]" if len(indhold) > 2000 else indhold
                ekstra_input.append(f"\n=== {sti} (spec) ===\n{afskaret}")
        if ekstra_input:
            fil_kontekst = "".join(ekstra_input) + "\n" + fil_kontekst

    bruger_besked = f"""=== REPAIR ITERATION {iteration} ===
Ansvarlig agent: {agent_navn} ({agent_id})
Fejlende build-trin: {fejlende_trin}

Fejloutput:
{fejl_output[:4000]}

Fejlede filer du skal fixe:
{chr(10).join(f'  - {f}' for f in fejl_filer)}

Fil-indhold:
{fil_kontekst}

Fix KUN de fejl der fremgaar. Skriv komplette filer.
"""

    log(f"  Kalder {agent_navn} ({agent_id}) for repair...")
    try:
        output = ""
        with klient.messages.stream(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=system_prompt,
            messages=[{"role": "user", "content": bruger_besked}]
        ) as stream:
            for tekst in stream.text_stream:
                output += tekst
        return output
    except Exception as e:
        log(f"  Claude API fejl: {e}", "FEJL")
        return None


def anvend_fix(fix_output: str, _npm: str) -> int:
    """Parser og anvender filer + npm install fra agent-output. Returnerer antal filer skrevet."""
    filer = parse_output_filer(fix_output)
    antal = 0
    if filer:
        for sti, indhold in filer.items():
            skriv_fil(sti, indhold)
            antal += 1
    else:
        log("  Ingen filer i agent-output", "ADVARSEL")

    npm_match = re.search(r"NPM_INSTALL:\s*(.+)", fix_output)
    if npm_match:
        pakker_str = npm_match.group(1).strip()
        if pakker_str.lower() not in ("ingen", "none", ""):
            pakker = [p for p in pakker_str.split() if p and not p.startswith("#")]
            if pakker:
                log(f"  Installerer npm: {' '.join(pakker)}")
                subprocess.run(
                    [_npm, "install"] + pakker + ["--legacy-peer-deps"],
                    cwd=REPO_ROOT, capture_output=True, text=True, timeout=120
                )
    return antal


def koer_autorepair_loop(klient: anthropic.Anthropic, max_iter: int = 10) -> bool:
    """
    Autonom specialist repair loop:
    1. Koer build-trin
    2. Ved fejl: identificer fejlede filer og route til ansvarlig agent
    3. Agenten fikser med sine egne regler og konventioner
    4. Gentag til groen build eller max_iter naaet
    """
    _npm = "npm.cmd" if sys.platform == "win32" else "npm"
    _npx = "npx.cmd" if sys.platform == "win32" else "npx"

    trin_liste = [
        ([_npm, "install", "--legacy-peer-deps"], "npm install"),
        ([_npx, "prisma", "generate"],             "prisma generate"),
        ([_npx, "tsc", "--noEmit"],                "tsc typecheck"),
        ([_npx, "next", "build"],                  "next build"),
    ]

    # Byg reverse map én gang
    fil_til_agent = byg_fil_til_agent_map()
    log(f"  Fil->agent map: {len(fil_til_agent)} filer kortlagt til {len(set(fil_til_agent.values()))} agenter")

    log(f"=== AUTOREPAIR START (max {max_iter} iterationer) ===")

    for iteration in range(1, max_iter + 1):
        log(f"\n--- Autorepair iteration {iteration}/{max_iter} ---")
        fejl_output = ""
        fejlende_trin = None
        start_fra = 1 if iteration > 1 else 0

        for cmd, navn in trin_liste[start_fra:]:
            log(f"  Korer: {navn}...")
            start = time.time()
            try:
                res = subprocess.run(
                    cmd, cwd=REPO_ROOT, capture_output=True, text=True, timeout=300
                )
            except subprocess.TimeoutExpired:
                log(f"  x {navn} TIMEOUT", "FEJL")
                fejl_output = f"TIMEOUT efter 300s under: {navn}"
                fejlende_trin = navn
                break
            except Exception as e:
                log(f"  x {navn} OS-FEJL: {e}", "FEJL")
                fejl_output = str(e)
                fejlende_trin = navn
                break

            varighed = round(time.time() - start, 1)
            if res.returncode == 0:
                log(f"  v {navn} OK ({varighed}s)")
            else:
                kombineret = (res.stdout + "\n" + res.stderr).strip()
                log(f"  x {navn} FEJLEDE ({varighed}s)")
                fejllinjer = [l for l in kombineret.splitlines()
                              if "error" in l.lower() or "Error" in l][:8]
                for linje in fejllinjer:
                    log(f"    {linje[:120]}", "FEJL")
                fejl_output = kombineret
                fejlende_trin = navn
                break

        # Alle trin OK?
        if fejlende_trin is None:
            log(f"\n=== AUTOREPAIR: BUILD GROENT efter {iteration} iteration(er) ===")
            git_commit(f"chore: autorepair completed — build passing (iter {iteration})")
            return True

        # Specielt: npm install fejl
        if fejlende_trin == "npm install":
            log("  npm install fejlede — proever --force", "ADVARSEL")
            subprocess.run([_npm, "install", "--force"], cwd=REPO_ROOT,
                           capture_output=True, text=True, timeout=120)
            continue

        if iteration == max_iter:
            log(f"=== AUTOREPAIR: MAX ITERATIONER ({max_iter}) NAAET ===", "FEJL")
            (REPO_ROOT / "autorepair-final-error.txt").write_text(
                f"Trin: {fejlende_trin}\n\n{fejl_output}", encoding="utf-8"
            )
            log("  Fejloutput gemt i autorepair-final-error.txt", "FEJL")
            return False

        # Identificer fejlede filer og ansvarlige agenter
        fejl_filer = udtraek_fejlfiler(fejl_output)
        agenter_med_fejl = identificer_ansvarlige_agenter(fejl_filer, fil_til_agent)

        log(f"  Fejlede filer: {len(fejl_filer)}")
        for agent_id, filer in agenter_med_fejl.items():
            agent_navn = AGENTS.get(agent_id, {}).get("navn", agent_id)
            log(f"  -> {agent_id} ({agent_navn}): {', '.join(f.split('/')[-1] for f in filer)}")

        # Kald hver ansvarlig agent med sine egne fejl
        total_filer_skrevet = 0
        for agent_id, agentens_filer in agenter_med_fejl.items():
            fix_output = kald_specialist_agent(
                klient, agent_id, fejlende_trin, fejl_output, agentens_filer, iteration
            )
            if fix_output:
                antal = anvend_fix(fix_output, _npm)
                total_filer_skrevet += antal
                log(f"  {agent_id}: {antal} filer rettet")
            else:
                log(f"  {agent_id}: ingen output — fortsaetter", "ADVARSEL")

        if total_filer_skrevet == 0:
            log("  Ingen filer rettet i denne iteration — risiko for uendelig loop", "ADVARSEL")
            # Skriv fejloutput til fil saa bruger kan inspicere
            (REPO_ROOT / f"autorepair-stuck-iter{iteration}.txt").write_text(
                f"Trin: {fejlende_trin}\n\n{fejl_output}", encoding="utf-8"
            )

        git_commit(f"fix: autorepair iter {iteration} — {fejlende_trin} ({len(agenter_med_fejl)} agenter)")
        log(f"  Iteration {iteration} afsluttet — korer build igen...")

    log(f"=== AUTOREPAIR: AFSLUTTET UDEN GROENT BUILD ===", "FEJL")
    return False


# ============================================================
# Agent-definitioner
# ============================================================

AGENTS = {
    "BA-02": {
        "navn": "Schema-agent",
        "sprint": 1,
        "opgave": "Database — Prisma schema komplet med alle modeller, enums, relationer, indexes",
        "input_filer": ["docs/spec/DATABASE-SCHEMA.md", "docs/spec/CONTRACT-TYPES.md", "docs/status/DECISIONS.md"],
        "output_filer": ["prisma/schema.prisma", "prisma/seed.ts"],
        "succeskriterier": ["prisma/schema.prisma eksisterer og er valid", "organization_id på alle modeller", "deleted_at på kritiske modeller"],
        "system_prompt": """Du er BA-02 (Schema-agent) for ChainHub-projektet.
Dit ansvar: Prisma schema, seed-data, multi-tenancy, indexes, enums, soft delete.
Alle tabeller har: organization_id, created_at, updated_at, created_by, deleted_at (kritiske).
OUTPUT-FORMAT:
--- FIL: [sti/til/fil] ---
[filindhold]
--- SLUT ---""",
    },

    "BA-03": {
        "navn": "Auth-agent",
        "sprint": 1,
        "opgave": "Auth — NextAuth.js med email/password + Microsoft OAuth + session + middleware + permissions helpers",
        "input_filer": ["docs/spec/kravspec-legalhub.md", "docs/build/CONVENTIONS.md", "docs/spec/roller-og-tilladelser.md", "prisma/schema.prisma"],
        "output_filer": ["src/lib/auth/index.ts", "src/lib/permissions/index.ts", "src/app/api/auth/[...nextauth]/route.ts", "src/middleware.ts", "src/app/(auth)/login/page.tsx"],
        "succeskriterier": ["NextAuth med Credentials + Azure AD", "canAccessCompany(), canAccessSensitivity(), canAccessModule(), getAccessibleCompanies() implementeret"],
        "system_prompt": """Du er BA-03 (Auth-agent) for ChainHub-projektet.
Levér disse helpers med eksakte signaturer:
  canAccessCompany(userId: string, companyId: string): Promise<boolean>
  canAccessSensitivity(userId: string, level: SensitivityLevel): Promise<boolean>
  canAccessModule(userId: string, module: ModuleType): Promise<boolean>
  getAccessibleCompanies(userId: string): Promise<Company[]>
OUTPUT-FORMAT:
--- FIL: [sti/til/fil] ---
[filindhold]
--- SLUT ---""",
    },

    "BA-04": {
        "navn": "UI-agent (Dashboard shell)",
        "sprint": 1,
        "opgave": "Dashboard shell — layout med sidebar, header, navigation til alle moduler",
        "input_filer": ["docs/build/CONVENTIONS.md", "docs/spec/kravspec-legalhub.md", "src/lib/auth/index.ts"],
        "output_filer": ["src/app/(dashboard)/layout.tsx", "src/components/layout/Sidebar.tsx", "src/components/layout/Header.tsx", "src/app/(dashboard)/page.tsx"],
        "succeskriterier": ["Sidebar med dansk navigation", "Bruger-menu med logout", "Kun Tailwind — ingen inline styles"],
        "system_prompt": """Du er BA-04 (UI-agent) for ChainHub-projektet.
Kun Tailwind utility classes. Dansk sprog i alle labels.
Sidebar: Overblik, Selskaber, Kontrakter, Sager, Opgaver, Personer, Dokumenter, Okonomi, Indstillinger.
OUTPUT-FORMAT:
--- FIL: [sti/til/fil] ---
[filindhold]
--- SLUT ---""",
    },

    "BA-08-devops": {
        "navn": "DevOps-agent (CI/CD)",
        "sprint": 1,
        "opgave": "DevOps — GitHub Actions CI, env validation script, Vercel config",
        "input_filer": ["docs/build/CONVENTIONS.md", "package.json", ".env.example"],
        "output_filer": [".github/workflows/ci.yml", "scripts/validate-env.ts", "vercel.json"],
        "succeskriterier": ["CI korer lint + typecheck + test", "validate-env.ts fejler tidligt", "Stripe webhook www-prefix dokumenteret"],
        "system_prompt": """Du er BA-08 (DevOps-agent) for ChainHub-projektet.
KRITISK: Stripe webhook URL SKAL have www-prefix. Trailing newlines i secrets giver stille fejl.
OUTPUT-FORMAT:
--- FIL: [sti/til/fil] ---
[filindhold]
--- SLUT ---""",
    },

    "BA-05-selskab": {
        "navn": "Feature-agent (Selskabsprofil)",
        "sprint": 2,
        "opgave": "Selskabsprofil — stamdata, ejerskab, governance, ansatte, aktivitetslog",
        "input_filer": ["docs/spec/DATABASE-SCHEMA.md", "docs/build/CONVENTIONS.md", "docs/spec/roller-og-tilladelser.md", "docs/status/DECISIONS.md", "prisma/schema.prisma", "src/lib/auth/index.ts", "src/lib/permissions/index.ts"],
        "output_filer": ["src/app/(dashboard)/companies/[id]/page.tsx", "src/actions/companies.ts", "src/components/companies/CompanyForm.tsx"],
        "succeskriterier": ["canAccessCompany() på alle actions", "organization_id på alle queries", "Zod validation"],
        "system_prompt": """Du er BA-05 (Feature-agent) for ChainHub-projektet. Du bygger Selskabsprofil.
Kald ALTID canAccessCompany(). Filtrer ALTID på organization_id. Zod på al input.
OUTPUT-FORMAT:
--- FIL: [sti/til/fil] ---
[filindhold]
--- SLUT ---""",
    },

    "BA-05-person": {
        "navn": "Feature-agent (Persondatabase)",
        "sprint": 2,
        "opgave": "Persondatabase — global kontaktbog, roller på tvaers af selskaber",
        "input_filer": ["docs/spec/DATABASE-SCHEMA.md", "docs/build/CONVENTIONS.md", "prisma/schema.prisma", "src/lib/auth/index.ts", "src/lib/permissions/index.ts", "src/actions/companies.ts"],
        "output_filer": ["src/app/(dashboard)/persons/[id]/page.tsx", "src/actions/persons.ts", "src/components/persons/PersonForm.tsx"],
        "succeskriterier": ["Person kan tilknyttes flere selskaber", "organization_id på alle queries"],
        "system_prompt": """Du er BA-05 (Feature-agent) for ChainHub-projektet. Du bygger Persondatabase.
OUTPUT-FORMAT:
--- FIL: [sti/til/fil] ---
[filindhold]
--- SLUT ---""",
    },

    "BA-09-sprint2": {
        "navn": "Performance-agent (Sprint 2)",
        "sprint": 2,
        "opgave": "Performance — N+1 analyse, indexes, caching-strategi for selskabs- og personmodul",
        "input_filer": ["prisma/schema.prisma", "src/actions/companies.ts", "src/actions/persons.ts"],
        "output_filer": ["docs/status/DECISIONS.md", "docs/ops/CACHING.md"],
        "succeskriterier": ["Ingen N+1", "Pagination på alle lister"],
        "system_prompt": """Du er BA-09 (Performance-agent). Analyser queries — skriv ikke ny kode.
OUTPUT-FORMAT:
--- FIL: [sti/til/fil] ---
[filindhold]
--- SLUT ---""",
    },

    "BA-07-sprint2": {
        "navn": "QA-agent (Sprint 2)",
        "sprint": 2,
        "opgave": "QA — Validér selskabs- og personmodul",
        "input_filer": ["docs/build/CONVENTIONS.md", "docs/status/DECISIONS.md", "src/actions/companies.ts", "src/actions/persons.ts", "src/lib/permissions/index.ts"],
        "output_filer": ["docs/status/DECISIONS.md"],
        "succeskriterier": ["canAccessCompany() kaldt", "organization_id overalt", "Zod validation"],
        "system_prompt": """Du er BA-07 (QA-agent). Du reviewer Sprint 2.
OUTPUT-FORMAT:
--- FIL: docs/status/DECISIONS.md ---
[indhold]
--- SLUT ---""",
    },

    "BA-05-kontrakt": {
        "navn": "Feature-agent (Kontraktstyring)",
        "sprint": 3,
        "opgave": "Kontraktstyring — opret kontrakt, status-flow, parter, fil-upload, versionsstyring",
        "input_filer": ["docs/spec/DATABASE-SCHEMA.md", "docs/spec/CONTRACT-TYPES.md", "docs/build/CONVENTIONS.md", "docs/status/DECISIONS.md", "prisma/schema.prisma", "src/lib/auth/index.ts", "src/lib/permissions/index.ts"],
        "output_filer": ["src/lib/validations/contract.ts", "src/types/contract.ts", "src/actions/contracts.ts", "src/app/(dashboard)/contracts/page.tsx", "src/app/(dashboard)/contracts/[id]/page.tsx"],
        "succeskriterier": ["Alle 34 system_types", "Status-flow korrekt", "Sensitivity-minimum haandhaevet"],
        "system_prompt": """Du er BA-05 (Feature-agent). Du bygger Kontraktstyring.
Status-flow: UDKAST -> TIL_REVIEW -> TIL_UNDERSKRIFT -> AKTIV -> UDLOBET/OPSAGT/FORNYET/ARKIVERET
OUTPUT-FORMAT:
--- FIL: [sti/til/fil] ---
[filindhold]
--- SLUT ---""",
    },

    "BA-06-advisering": {
        "navn": "Integration-agent (Advisering)",
        "sprint": 3,
        "opgave": "Adviseringslogik — 90/30/7 dage, løbende kontrakter, auto-renewal, email",
        "input_filer": ["docs/spec/DATABASE-SCHEMA.md", "docs/build/CONVENTIONS.md", "prisma/schema.prisma", "src/actions/contracts.ts"],
        "output_filer": ["src/lib/advisering/deadlines.ts", "src/lib/advisering/notifications.ts", "src/app/api/cron/check-deadlines/route.ts"],
        "succeskriterier": ["Cron tjekker deadlines dagligt", "90/30/7-dages advis"],
        "system_prompt": """Du er BA-06 (Integration-agent). Du bygger advisering.
OUTPUT-FORMAT:
--- FIL: [sti/til/fil] ---
[filindhold]
--- SLUT ---""",
    },

    "BA-05-dokumenter": {
        "navn": "Feature-agent (Dokumenthaandtering)",
        "sprint": 3,
        "opgave": "Dokumenthaandtering — upload, preview, download, tilknytning",
        "input_filer": ["docs/spec/DATABASE-SCHEMA.md", "docs/build/CONVENTIONS.md", "prisma/schema.prisma", "src/lib/permissions/index.ts"],
        "output_filer": ["src/actions/documents.ts", "src/app/(dashboard)/documents/page.tsx", "src/lib/storage/r2.ts"],
        "succeskriterier": ["Cloudflare R2 upload", "canAccessSensitivity() på downloads"],
        "system_prompt": """Du er BA-05 (Feature-agent). Du bygger Dokumenthaandtering.
OUTPUT-FORMAT:
--- FIL: [sti/til/fil] ---
[filindhold]
--- SLUT ---""",
    },

    "BA-07-sprint3": {
        "navn": "QA-agent (Sprint 3)",
        "sprint": 3,
        "opgave": "QA — Validér kontraktstyring, advisering og dokumentmodul",
        "input_filer": ["docs/build/CONVENTIONS.md", "docs/status/DECISIONS.md", "src/actions/contracts.ts", "src/lib/advisering/deadlines.ts"],
        "output_filer": ["docs/status/DECISIONS.md"],
        "succeskriterier": ["Status-flow korrekt", "Sensitivity-minimum haandhaevet"],
        "system_prompt": """Du er BA-07 (QA-agent). Du reviewer Sprint 3.
OUTPUT-FORMAT:
--- FIL: docs/status/DECISIONS.md ---
[indhold]
--- SLUT ---""",
    },

    "BA-05-sager": {
        "navn": "Feature-agent (Sagsstyring)",
        "sprint": 4,
        "opgave": "Sagsstyring — sagstyper, tilknytning, frister",
        "input_filer": ["docs/spec/DATABASE-SCHEMA.md", "docs/build/CONVENTIONS.md", "prisma/schema.prisma", "src/lib/auth/index.ts", "src/lib/permissions/index.ts"],
        "output_filer": ["src/types/case.ts", "src/actions/cases.ts", "src/app/(dashboard)/cases/page.tsx", "src/app/(dashboard)/cases/[id]/page.tsx"],
        "succeskriterier": ["Alle CaseType-vaerdier", "Status-flow NY->AKTIV->LUKKET"],
        "system_prompt": """Du er BA-05 (Feature-agent). Du bygger Sagsstyring.
OUTPUT-FORMAT:
--- FIL: [sti/til/fil] ---
[filindhold]
--- SLUT ---""",
    },

    "BA-05-opgaver": {
        "navn": "Feature-agent (Opgavestyring)",
        "sprint": 4,
        "opgave": "Opgavestyring — liste/kanban, daglig digest",
        "input_filer": ["docs/spec/DATABASE-SCHEMA.md", "docs/build/CONVENTIONS.md", "prisma/schema.prisma", "src/actions/cases.ts"],
        "output_filer": ["src/types/task.ts", "src/actions/tasks.ts", "src/app/(dashboard)/tasks/page.tsx"],
        "succeskriterier": ["Opgaver tilknyttet sager", "Daglig digest cron"],
        "system_prompt": """Du er BA-05 (Feature-agent). Du bygger Opgavestyring.
OUTPUT-FORMAT:
--- FIL: [sti/til/fil] ---
[filindhold]
--- SLUT ---""",
    },

    "BA-07-sprint4": {
        "navn": "QA-agent (Sprint 4)",
        "sprint": 4,
        "opgave": "QA — Validér sags- og opgavemodul",
        "input_filer": ["docs/build/CONVENTIONS.md", "docs/status/DECISIONS.md", "src/actions/cases.ts", "src/actions/tasks.ts"],
        "output_filer": ["docs/status/DECISIONS.md"],
        "succeskriterier": ["CaseStatus-flow korrekt", "organization_id overalt"],
        "system_prompt": """Du er BA-07 (QA-agent). Du reviewer Sprint 4.
OUTPUT-FORMAT:
--- FIL: docs/status/DECISIONS.md ---
[indhold]
--- SLUT ---""",
    },

    "BA-05-dashboard": {
        "navn": "Feature-agent (Portfolio-dashboard)",
        "sprint": 5,
        "opgave": "Portfolio-dashboard — overblik, filtrering, aggregerede counts",
        "input_filer": ["docs/spec/DATABASE-SCHEMA.md", "docs/build/CONVENTIONS.md", "prisma/schema.prisma", "src/lib/permissions/index.ts", "src/actions/companies.ts"],
        "output_filer": ["src/actions/dashboard.ts", "src/app/(dashboard)/page.tsx", "src/components/dashboard/PortfolioOverview.tsx"],
        "succeskriterier": ["Aggregerede counts — ingen N+1", "Under 2 sekunder"],
        "system_prompt": """Du er BA-05 (Feature-agent). Du bygger Portfolio-dashboard.
PERFORMANCE: Brug aggregerede counts i en query — aldrig N+1.
OUTPUT-FORMAT:
--- FIL: [sti/til/fil] ---
[filindhold]
--- SLUT ---""",
    },

    "BA-05-oekonomi": {
        "navn": "Feature-agent (Oekonomi-overblik)",
        "sprint": 5,
        "opgave": "Oekonomi — noegletal, tidsregistrering, fakturaoversigt, udbytte",
        "input_filer": ["docs/spec/DATABASE-SCHEMA.md", "docs/build/CONVENTIONS.md", "prisma/schema.prisma", "src/lib/permissions/index.ts"],
        "output_filer": ["src/actions/finance.ts", "src/app/(dashboard)/finance/page.tsx"],
        "succeskriterier": ["MetricType/PeriodType enums korrekte", "canAccessSensitivity(FORTROLIG)"],
        "system_prompt": """Du er BA-05 (Feature-agent). Du bygger Oekonomi-overblik.
canAccessSensitivity(userId, "FORTROLIG") SKAL kaldes pa alle finance-queries.
OUTPUT-FORMAT:
--- FIL: [sti/til/fil] ---
[filindhold]
--- SLUT ---""",
    },

    "BA-09-sprint5": {
        "navn": "Performance-agent (Sprint 5)",
        "sprint": 5,
        "opgave": "Performance — validér dashboard under 2s, N+1 analyse",
        "input_filer": ["prisma/schema.prisma", "src/actions/dashboard.ts", "src/actions/finance.ts"],
        "output_filer": ["docs/status/DECISIONS.md"],
        "succeskriterier": ["Dashboard aggregerede queries", "Oekonomidata caches"],
        "system_prompt": """Du er BA-09 (Performance-agent). Du reviewer Sprint 5.
OUTPUT-FORMAT:
--- FIL: [sti/til/fil] ---
[filindhold]
--- SLUT ---""",
    },

    "BA-07-sprint5": {
        "navn": "QA-agent (Sprint 5)",
        "sprint": 5,
        "opgave": "QA — Validér dashboard og oekonomimodul",
        "input_filer": ["docs/build/CONVENTIONS.md", "docs/status/DECISIONS.md", "src/actions/dashboard.ts", "src/actions/finance.ts"],
        "output_filer": ["docs/status/DECISIONS.md"],
        "succeskriterier": ["Enums korrekte", "canAccessSensitivity(FORTROLIG)"],
        "system_prompt": """Du er BA-07 (QA-agent). Du reviewer Sprint 5.
OUTPUT-FORMAT:
--- FIL: docs/status/DECISIONS.md ---
[indhold]
--- SLUT ---""",
    },

    "BA-10-tests": {
        "navn": "Test-agent",
        "sprint": 6,
        "opgave": "Testsuite — unit, integration og E2E tests",
        "input_filer": ["docs/spec/roller-og-tilladelser.md", "docs/build/CONVENTIONS.md", "prisma/schema.prisma", "src/lib/permissions/index.ts", "src/actions/companies.ts"],
        "output_filer": ["src/__tests__/unit/permissions.test.ts", "src/__tests__/integration/tenant-isolation.test.ts", "e2e/login.spec.ts", "vitest.config.ts"],
        "succeskriterier": ["Tenant isolation tests", "Alle ikke-forhandlingsbare tests groenne"],
        "system_prompt": """Du er BA-10 (Test-agent). Brug Vitest + Playwright.
Ikke-forhandlingsbare tests:
  test('tenant A cannot access tenant B companies')
  test('COMPANY_MANAGER cannot see STRENGT_FORTROLIG')
OUTPUT-FORMAT:
--- FIL: [sti/til/fil] ---
[filindhold]
--- SLUT ---""",
    },

    "BA-11-pentest": {
        "navn": "Security Pentest-agent",
        "sprint": 6,
        "opgave": "Pentest — IDOR, tenant isolation, privilege escalation, input validation",
        "input_filer": ["docs/spec/roller-og-tilladelser.md", "docs/status/DECISIONS.md", "src/lib/permissions/index.ts", "src/middleware.ts", "src/actions/companies.ts", "src/actions/contracts.ts"],
        "output_filer": ["docs/ops/PENTEST-REPORT.md", "docs/status/DECISIONS.md"],
        "succeskriterier": ["Ingen KRITISKE sikkerhedshuller", "IDOR-analyse gennemfoert"],
        "system_prompt": """Du er BA-11 (Pentest-agent). Forsog aktivt at bryde systemet.
Test: tenant isolation, IDOR, privilege escalation, input validation, rate limiting.
OUTPUT-FORMAT:
--- FIL: [sti/til/fil] ---
[filindhold]
--- SLUT ---""",
    },

    "BA-06-stripe": {
        "navn": "Integration-agent (Stripe Billing)",
        "sprint": 6,
        "opgave": "Stripe Billing — per-seat subscriptions, trial, webhook",
        "input_filer": ["docs/build/CONVENTIONS.md", "prisma/schema.prisma", "src/lib/auth/index.ts", ".env.example"],
        "output_filer": ["src/lib/stripe/index.ts", "src/lib/stripe/webhook.ts", "src/app/api/webhooks/stripe/route.ts", "src/actions/billing.ts"],
        "succeskriterier": ["Per-seat subscription", "14 dages trial", "www-prefix pa webhook URL"],
        "system_prompt": """Du er BA-06 (Integration-agent). Du bygger Stripe Billing.
KRITISK: Webhook URL = https://www.chainhub.dk/api/webhooks/stripe (www-prefix er ikke-forhandlingsbart)
OUTPUT-FORMAT:
--- FIL: [sti/til/fil] ---
[filindhold]
--- SLUT ---""",
    },

    "BA-08-runbook": {
        "navn": "DevOps-agent (Runbook + monitoring)",
        "sprint": 6,
        "opgave": "Runbook, monitoring, alerting, backup, produktionsklar deployment",
        "input_filer": ["docs/build/CONVENTIONS.md", "docs/ops/RUNBOOK.md", ".env.example", "vercel.json"],
        "output_filer": ["docs/ops/RUNBOOK.md", ".github/workflows/ci.yml", "vercel.json"],
        "succeskriterier": ["RUNBOOK daekker kritiske scenarier", "CI pipeline komplet"],
        "system_prompt": """Du er BA-08 (DevOps-agent). Afslut Sprint 6 med produktionsklar infrastruktur.
OUTPUT-FORMAT:
--- FIL: [sti/til/fil] ---
[filindhold]
--- SLUT ---""",
    },

    "BA-07-sprint6": {
        "navn": "QA-agent (Sprint 6 — final review)",
        "sprint": 6,
        "opgave": "Final QA — validér hele systemet er produktionsklart",
        "input_filer": ["docs/build/CONVENTIONS.md", "docs/status/DECISIONS.md", "docs/ops/PENTEST-REPORT.md", "src/lib/permissions/index.ts"],
        "output_filer": ["docs/status/DECISIONS.md", "docs/status/PROGRESS.md"],
        "succeskriterier": ["Ingen uloeste KRITISKE beslutninger", "PROGRESS.md markeret produktionsklart"],
        "system_prompt": """Du er BA-07 (QA-agent). Final review inden produktion.
Opdater PROGRESS.md med PRODUKTIONSKLART: [dato].
OUTPUT-FORMAT:
--- FIL: [sti] ---
[indhold]
--- SLUT ---""",
    },

    "BA-07-sprint1": {
        "navn": "QA-agent (Sprint 1 review)",
        "sprint": 1,
        "opgave": "QA — Validér Sprint 1 kode mod spec",
        "input_filer": ["docs/spec/DATABASE-SCHEMA.md", "docs/build/CONVENTIONS.md", "docs/status/DECISIONS.md", "prisma/schema.prisma", "src/lib/auth/index.ts", "src/lib/permissions/index.ts"],
        "output_filer": ["docs/status/DECISIONS.md"],
        "succeskriterier": ["Permissions helpers korrekte", "organization_id overalt"],
        "system_prompt": """Du er BA-07 (QA-agent). Du reviewer Sprint 1.
OUTPUT-FORMAT:
--- FIL: docs/status/DECISIONS.md ---
[indhold]
--- SLUT ---""",
    },

    # ============================================================
    # BA-12: Repair-agent — scanner og fikser manglende deps
    # Kores med: python orchestrator.py --agent BA-12-repair --force
    # ============================================================
    "BA-12-repair": {
        "navn": "Repair-agent (Dependencies + Build)",
        "sprint": 0,
        "opgave": "Scann alle imports, installer manglende pakker, opret manglende shadcn-komponenter, verificer build",
        "input_filer": ["package.json", "docs/build/CONVENTIONS.md"],
        "output_filer": [],
        "succeskriterier": [
            "Alle imports har matchende pakke i node_modules",
            "Alle manglende shadcn/ui-komponenter er oprettet",
            "npx next build gennemfoeres uden fejl",
        ],
        "system_prompt": """Du er BA-12 (Repair-agent) for ChainHub-projektet.

Dit ENESTE ansvar: Opret manglende shadcn/ui-komponenter som komplette TypeScript/React filer.

Du modtager en liste over manglende komponenter og pakker.

For hver manglende shadcn/ui-komponent (src/components/ui/X.tsx):
Opret den som en komplet, fungerende implementering baseret pa @radix-ui primitives.
Brug cn() fra @/lib/utils og React.forwardRef monsteret.

Standard struktur:
  "use client"
  import * as React from "react"
  import * as XPrimitive from "@radix-ui/react-x"
  import { cn } from "@/lib/utils"
  const Component = React.forwardRef<...>(({ className, ...props }, ref) => (
    <XPrimitive.Root ref={ref} className={cn("base-classes", className)} {...props} />
  ))
  Component.displayName = XPrimitive.Root.displayName
  export { Component }

Tilgaengelige @radix-ui primitives (allerede installeret):
  @radix-ui/react-select, @radix-ui/react-dialog, @radix-ui/react-dropdown-menu,
  @radix-ui/react-tabs, @radix-ui/react-avatar, @radix-ui/react-checkbox,
  @radix-ui/react-popover, @radix-ui/react-toast, @radix-ui/react-label,
  @radix-ui/react-separator, @radix-ui/react-slot

OUTPUT-FORMAT:
--- FIL: src/components/ui/[komponent-navn].tsx ---
[komplet filindhold]
--- SLUT ---

Afslut med:
NPM_INSTALL: [pakke1 pakke2]
(eller "NPM_INSTALL: ingen" hvis ingen npm-pakker mangler)
""",
    },
}


# ============================================================
# Sprint-raekkefoelge
# ============================================================

SPRINT_RAEKKEFOLGEP = {
    1: ["BA-02", "BA-03", "BA-04", "BA-08-devops", "BA-07-sprint1"],
    2: ["BA-05-selskab", "BA-05-person", "BA-09-sprint2", "BA-07-sprint2"],
    3: ["BA-05-kontrakt", "BA-06-advisering", "BA-05-dokumenter", "BA-07-sprint3"],
    4: ["BA-05-sager", "BA-05-opgaver", "BA-07-sprint4"],
    5: ["BA-05-dashboard", "BA-05-oekonomi", "BA-09-sprint5", "BA-07-sprint5"],
    6: ["BA-10-tests", "BA-11-pentest", "BA-06-stripe", "BA-08-runbook", "BA-07-sprint6"],
}


def koer_agent(agent_id: str, klient: anthropic.Anthropic, dry_run: bool = False, force: bool = False) -> bool:
    agent = AGENTS.get(agent_id)
    if not agent:
        log(f"Ukendt agent: {agent_id}", "FEJL")
        return False

    output_filer = agent.get("output_filer", [])
    if agent_id != "BA-12-repair" and not force and output_filer and all((REPO_ROOT / f).exists() for f in output_filer):
        log(f"=== {agent_id} SPRINGER OVER — output-filer eksisterer allerede ===")
        return True

    log(f"=== Starter {agent_id} ({agent['navn']}) ===")
    log(f"Opgave: {agent['opgave']}")

    fil_kontekst = []
    for sti in agent["input_filer"]:
        indhold = laes_fil(sti)
        if indhold:
            fil_kontekst.append(f"\n\n=== {sti} ===\n{indhold}")
        else:
            log(f"Input-fil mangler: {sti} — fortsaetter uden", "ADVARSEL")

    ekstra_kontekst = ""
    if agent_id == "BA-12-repair":
        log("Scanner for manglende imports...")
        manglende_npm, manglende_shadcn = scan_manglende_imports()
        if not manglende_npm and not manglende_shadcn:
            log("Ingen manglende imports — korer build gate direkte")
            return koer_build_gate(0)
        ekstra_kontekst = f"""
=== SCAN RESULTAT ===
Manglende npm-pakker ({len(manglende_npm)}):
{chr(10).join(f'  - {p}' for p in manglende_npm) if manglende_npm else '  ingen'}

Manglende shadcn/ui-komponenter ({len(manglende_shadcn)}):
{chr(10).join(f'  - src/components/ui/{k}.tsx' for k in manglende_shadcn) if manglende_shadcn else '  ingen'}
"""
        log(f"Fund: {len(manglende_npm)} npm, {len(manglende_shadcn)} shadcn")

    bruger_besked = f"""Din opgave: {agent['opgave']}

Succeskriterier:
{chr(10).join(f'- {k}' for k in agent['succeskriterier'])}
{ekstra_kontekst}
Relevante filer:
{''.join(fil_kontekst)}

Udfør opgaven nu.
--- FIL: sti/til/fil ---
[komplet filindhold]
--- SLUT ---

Afslut: FAERDIG / BLOKERET [aarsag]
"""

    if dry_run:
        log(f"[DRY RUN] {agent_id} — ville kalde API")
        return True

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
        log(f"API svar komplet paa {varighed}s ({len(output_tekst)} tegn)")

    except Exception as e:
        log(f"API fejl: {e}", "FEJL")
        return False

    filer = parse_output_filer(output_tekst)

    if not filer and agent_id != "BA-12-repair":
        log("Ingen filer fundet i output", "ADVARSEL")
        debug_sti = REPO_ROOT / f"orchestrator-debug-{agent_id}.txt"
        debug_sti.write_text(output_tekst, encoding="utf-8")
        log(f"Raw output gemt: {debug_sti}")
        return False

    for sti, indhold in filer.items():
        skriv_fil(sti, indhold)

    # BA-12: installer pakker fra NPM_INSTALL-linjen
    if agent_id == "BA-12-repair":
        npm_match = re.search(r"NPM_INSTALL:\s*(.+)", output_tekst)
        if npm_match:
            pakker_str = npm_match.group(1).strip()
            if pakker_str.lower() != "ingen":
                pakker = [p for p in pakker_str.split() if p and not p.startswith("#")]
                if pakker:
                    log(f"Installerer: {' '.join(pakker)}")
                    _npm = "npm.cmd" if sys.platform == "win32" else "npm"
                    res = subprocess.run(
                        [_npm, "install"] + pakker + ["--legacy-peer-deps"],
                        cwd=REPO_ROOT, capture_output=True, text=True, timeout=120
                    )
                    if res.returncode == 0:
                        log(f"npm install OK")
                    else:
                        log(f"npm install fejlede: {res.stderr[-200:]}", "ADVARSEL")

    commit_besked = f"feat: {agent_id} {agent['navn']} - {agent['opgave'][:50]}"
    git_commit(commit_besked)
    opdater_progress(agent_id)

    if agent_id == "BA-12-repair":
        log("BA-12 faerdig — korer build gate...")
        koer_build_gate(0)

    log(f"=== {agent_id} FAERDIG ({len(filer)} filer skrevet) ===")
    return True


def koer_sprint(sprint_nr: int, klient: anthropic.Anthropic, dry_run: bool = False, force: bool = False):
    agenter = SPRINT_RAEKKEFOLGEP.get(sprint_nr)
    if not agenter:
        log(f"Ukendt sprint: {sprint_nr}", "FEJL")
        return

    log(f"=== STARTER SPRINT {sprint_nr} ({len(agenter)} agenter) ===")
    start = time.time()

    for i, agent_id in enumerate(agenter, 1):
        log(f"--- Agent {i}/{len(agenter)}: {agent_id} ---")
        succes = koer_agent(agent_id, klient, dry_run, force)
        if not succes:
            log(f"Agent {agent_id} fejlede — stopper", "FEJL")
            break
        if i < len(agenter):
            time.sleep(2)

    # Automatisk build gate efter hvert sprint
    if not dry_run:
        build_ok = koer_build_gate(sprint_nr)
        if not build_ok:
            log(f"Build gate fejlede — fix: python orchestrator.py --agent BA-12-repair --force", "FEJL")

    varighed = round(time.time() - start, 1)
    log(f"=== SPRINT {sprint_nr} AFSLUTTET paa {varighed}s ===")


# ============================================================
# Hovedprogram
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="ChainHub MABS orkestrator v2")
    parser.add_argument("--sprint", type=int)
    parser.add_argument("--agent", type=str)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--list", action="store_true")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--build-gate", type=int, metavar="SPRINT")
    parser.add_argument("--scan", action="store_true", help="Scann for manglende imports")
    parser.add_argument("--autorepair", action="store_true", help="Autonom repair loop: korer build og fikser fejl til det er groent")
    parser.add_argument("--max-iter", type=int, default=10, help="Max iterationer for autorepair (default: 10)")
    args = parser.parse_args()

    if args.list:
        print("\nTilgaengelige agenter:")
        for aid, ag in AGENTS.items():
            sprint_str = f"Sprint {ag['sprint']}" if ag['sprint'] > 0 else "Repair  "
            print(f"  {aid:25} {sprint_str:10} {ag['navn']}")
        print("\nSpecielle kommandoer:")
        print("  --scan                              Scann for manglende imports")
        print("  --build-gate N                      Kor build gate for sprint N")
        print("  --agent BA-12-repair --force        Fix alle deps + build")
        print("  --autorepair                        Autonom loop: korer til groen build")
        print("  --autorepair --max-iter 15          Som ovenfor med 15 maks iterationer")
        return

    if args.scan:
        manglende_npm, manglende_shadcn = scan_manglende_imports()
        print(f"\nManglende npm-pakker ({len(manglende_npm)}):")
        for p in manglende_npm:
            print(f"  - {p}")
        print(f"\nManglende shadcn-komponenter ({len(manglende_shadcn)}):")
        for k in manglende_shadcn:
            print(f"  - src/components/ui/{k}.tsx")
        if not manglende_npm and not manglende_shadcn:
            print("  Ingen manglende imports!")
        return

    if args.build_gate is not None:
        koer_build_gate(args.build_gate)
        return

    api_noegle = os.getenv("ANTHROPIC_API_KEY")
    if hasattr(args, 'autorepair') and args.autorepair and not api_noegle:
        log("ANTHROPIC_API_KEY ikke fundet i .env.local", "FEJL")
        sys.exit(1)
    if not api_noegle:
        log("ANTHROPIC_API_KEY ikke fundet i .env.local", "FEJL")
        sys.exit(1)

    klient = anthropic.Anthropic(api_key=api_noegle)

    if hasattr(args, 'autorepair') and args.autorepair:
        klient = anthropic.Anthropic(api_key=api_noegle)
        succes = koer_autorepair_loop(klient, max_iter=args.max_iter)
        sys.exit(0 if succes else 1)

    if args.dry_run:
        log("=== DRY RUN ===")

    if args.all:
        for sprint_nr in sorted(SPRINT_RAEKKEFOLGEP.keys()):
            koer_sprint(sprint_nr, klient, args.dry_run, args.force)
    elif args.agent:
        koer_agent(args.agent, klient, args.dry_run, args.force)
    elif args.sprint:
        koer_sprint(args.sprint, klient, args.dry_run, args.force)
    else:
        log("Ingen handling. Eksempler:")
        log("  python orchestrator.py --sprint 1")
        log("  python orchestrator.py --agent BA-12-repair --force")
        log("  python orchestrator.py --scan")


if __name__ == "__main__":
    main()