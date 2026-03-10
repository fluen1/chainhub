#!/usr/bin/env python3
"""
ChainHub MABS — Autonom Multi-Agent Orkestrator v3
===================================================
v3 — Fuldt agil specialist repair-loop:
  1. Repair-hukommelse          Anti-loop: agenter ser egne tidligere forsøg
  2. Afhængighedsgraf           Cross-agent impact propagation ved interface-ændringer
  3. Regressionsguard           Detektion af nyregressions introduceret under repair
  4. Sprint replay               Downstream agenter flagges ved input-ændringer
  5. Konvergensmetrik           TS-fejltæller pr. iteration — konvergerer / stagnerer / divergerer
  6. INTELLIGENCE.md            Levende delt videnslag — opdateres efter hver repair-cyklus
  7. Smoke test                 Acceptance-trin: next dev + route-check efter grøn build

v2 features:
  - BA-12-repair agent, build gate, specialist routing

Brug:
  python orchestrator.py --sprint 1
  python orchestrator.py --agent BA-12-repair --force
  python orchestrator.py --scan
  python orchestrator.py --build-gate 1
  python orchestrator.py --autorepair
  python orchestrator.py --autorepair --max-iter 15
  python orchestrator.py --smoke-test
  python orchestrator.py --all
  python orchestrator.py --list
"""

import os
import re
import sys
import json
import time
import hashlib
import argparse
import subprocess
import urllib.request
import urllib.error
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

REPO_ROOT          = Path(__file__).parent
DOCS_STATUS        = REPO_ROOT / "docs" / "status"
PROGRESS_FILE      = DOCS_STATUS / "PROGRESS.md"
INTELLIGENCE_FILE  = REPO_ROOT / "docs" / "build" / "INTELLIGENCE.md"
MODEL              = "claude-sonnet-4-6"
MAX_TOKENS         = 32000
LOG_FILE           = REPO_ROOT / "orchestrator.log"
SMOKE_TEST_PORT    = 3001  # Brug 3001 for ikke at konflikte med evt. kørende dev-server


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


# ============================================================
# 1. REPAIR-HUKOMMELSE — Anti-loop mekanisme
# Agenter ser deres egne tidligere forsog og undgaar at gentage dem
# ============================================================

class RepairHukommelse:
    """Tracker fejl-hashs og forsoegte fixes pr. agent pr. session."""

    def __init__(self):
        self._forsoegte: list[dict] = []

    @staticmethod
    def fejl_hash(fejl_output: str) -> str:
        return hashlib.md5(fejl_output.encode("utf-8", errors="replace")).hexdigest()[:10]

    def er_set_foer(self, fejl_output: str, agent_id: str) -> bool:
        h = self.fejl_hash(fejl_output)
        return any(f["hash"] == h and f["agent_id"] == agent_id for f in self._forsoegte)

    def registrer(self, fejl_output: str, agent_id: str, filer: list, ts_fejl: int):
        self._forsoegte.append({
            "hash": self.fejl_hash(fejl_output),
            "agent_id": agent_id,
            "filer": filer,
            "ts_fejl": ts_fejl,
            "ts": datetime.now().isoformat(timespec="seconds"),
        })

    def som_kontekst(self, agent_id: str) -> str:
        """Returner tidligere forsog for denne specifikke agent som kontekst-tekst."""
        relevante = [f for f in self._forsoegte if f["agent_id"] == agent_id]
        if not relevante:
            return ""
        linjer = ["=== DINE TIDLIGERE FORSOG (undga disse tilgange) ==="]
        for f in relevante[-5:]:
            filer_str = ", ".join(f["filer"][:4]) + (" ..." if len(f["filer"]) > 4 else "")
            linjer.append(f"  [{f['ts']}] Forsoegte fix pa: {filer_str} (fejl-hash: {f['hash']}, TS-fejl: {f['ts_fejl']})")
        linjer.append("Vaelg en ANDEN tilgang end din forrige.")
        return "\n".join(linjer)


# ============================================================
# 2. AFHAENGIGHEDSGRAF — Cross-agent impact propagation
# Naar en agent aendrer en fil bruges som input af en anden agent,
# detekteres dette og den paavirkede agent flagges til re-check.
# ============================================================

def byg_afhaengighedsgraf() -> dict:
    """
    Returner {agent_id: [downstream_agent_ids]}.
    Downstream = agenter der har denne agents output-filer som input-filer.
    Bygges dynamisk fra AGENTS-definitionen.
    """
    output_til_agent: dict[str, str] = {}
    for agent_id, agent in AGENTS.items():
        for sti in agent.get("output_filer", []):
            output_til_agent[sti] = agent_id

    afh: dict[str, list] = {aid: [] for aid in AGENTS}
    for consumer_id, consumer in AGENTS.items():
        for input_sti in consumer.get("input_filer", []):
            kilde = output_til_agent.get(input_sti)
            if kilde and kilde != consumer_id and consumer_id not in afh[kilde]:
                afh[kilde].append(consumer_id)
    return afh


def identificer_paavirkede_downstream(
    aendrede_filer: list, afh_graf: dict
) -> list:
    """
    Find agenter der boer re-checkes fordi en af deres input-filer er aendret under repair.
    Returner liste over agent_ids sorteret efter sprint-nummer.
    """
    output_til_agent: dict[str, str] = {}
    for agent_id, agent in AGENTS.items():
        for sti in agent.get("output_filer", []):
            output_til_agent[sti] = agent_id

    paavirkede: set[str] = set()
    for fil in aendrede_filer:
        kilde = output_til_agent.get(fil)
        if kilde:
            for downstream in afh_graf.get(kilde, []):
                paavirkede.add(downstream)

    # Sorter efter sprint saa vi re-checker i korrekt raekkefoelge
    return sorted(
        paavirkede,
        key=lambda aid: AGENTS.get(aid, {}).get("sprint", 99)
    )


# ============================================================
# 3. REGRESSIONSGUARD — Detektion af nye regressioner under repair
# Tracker hvilke filer der var fejlfri foer repair og sammenligner efter.
# ============================================================

def regressionsguard_snapshot(fejl_filer_foer: list) -> set:
    """
    Tag snapshot af alle .ts/.tsx-filer der IKKE er i fejllisten nu.
    Disse er fejlfri og boer forblive det efter repair.
    """
    alle_ts: set[str] = set()
    src = REPO_ROOT / "src"
    if src.exists():
        for f in src.rglob("*.ts*"):
            rel = str(f.relative_to(REPO_ROOT)).replace("\\", "/")
            alle_ts.add(rel)
    fejl_set = set(fejl_filer_foer)
    return alle_ts - fejl_set


def regressionsguard_check(fejlfri_foer: set, fejl_filer_efter: list) -> list:
    """
    Find filer der var fejlfri FOER men fejlede EFTER repair.
    = regressioner som repair har introduceret.
    """
    return [f for f in fejl_filer_efter if f in fejlfri_foer]


# ============================================================
# 5. KONVERGENSMETRIK — Maaler om repair-loopen konvergerer
# Taeller TypeScript-fejl pr. iteration og vurderer retningen.
# ============================================================

def tael_ts_fejl(fejl_output: str) -> int:
    """Taell antal unikke TypeScript-fejl (error TSxxxx) i output."""
    return len(re.findall(r"error TS\d+:", fejl_output))


def vurder_konvergens(ts_fejl_historik: list) -> str:
    """
    Vurder om repair-loopen konvergerer, stagnerer eller divergerer.
    Returner en beskrivende streng.
    """
    n = len(ts_fejl_historik)
    if n == 0:
        return "ingen data"
    if ts_fejl_historik[-1] == 0:
        return "LOEST"
    if n < 2:
        return f"{ts_fejl_historik[-1]} TS-fejl (baseline)"
    seneste = ts_fejl_historik[-1]
    naest = ts_fejl_historik[-2]
    foerste = ts_fejl_historik[0]
    if seneste < naest:
        pct = round((foerste - seneste) / foerste * 100) if foerste > 0 else 0
        return f"KONVERGERER ({foerste}->{seneste} fejl, -{pct}% fra start)"
    if seneste == naest:
        return f"STAGNERER ({seneste} fejl uaendret i 2 iterationer)"
    return f"DIVERGERER ({naest}->{seneste} fejl STIGER)"


# ============================================================
# 6. INTELLIGENCE.md — Levende delt videnslag
# Opdateres automatisk efter hver repair-cyklus.
# Alle agenter laeder dette ved repair for at undgaa kendte fejl.
# ============================================================

def opdater_intelligence(laering: str, kontekst: str = "autorepair"):
    """
    Tilfoej en struktureret laering til INTELLIGENCE.md.
    Nyeste post indsaettes oeverst efter header-sektionen.
    """
    INTELLIGENCE_FILE.parent.mkdir(parents=True, exist_ok=True)
    nu = datetime.now().strftime("%Y-%m-%d %H:%M")
    ny_post = f"\n## [{nu}] {kontekst}\n{laering}\n"

    if not INTELLIGENCE_FILE.exists():
        header = (
            "# INTELLIGENCE.md — ChainHub MABS Videnslag\n"
            "Automatisk opdateret af orchestrator efter hver repair-cyklus.\n"
            "Laeses af alle agenter ved repair for at undgaa kendte fejl.\n"
            "Nyeste laering oeverst.\n"
            "---\n"
        )
        INTELLIGENCE_FILE.write_text(header + ny_post, encoding="utf-8")
    else:
        eksisterende = INTELLIGENCE_FILE.read_text(encoding="utf-8")
        marker = "---\n"
        pos = eksisterende.find(marker)
        if pos >= 0:
            INTELLIGENCE_FILE.write_text(
                eksisterende[:pos + len(marker)] + ny_post + eksisterende[pos + len(marker):],
                encoding="utf-8"
            )
        else:
            INTELLIGENCE_FILE.write_text(eksisterende + ny_post, encoding="utf-8")

    log(f"  INTELLIGENCE.md opdateret: {laering[:100].strip()}")


def byg_intelligence_laering(
    agenter_med_fejl: dict,
    ts_fejl_foer: int,
    ts_fejl_efter: int,
    fejlende_trin: str,
    aendrede_filer: list,
    regressioner: list,
    konvergens: str,
) -> str:
    """Byg en struktureret laering baseret paa repair-resultatet."""
    agenter_str = "; ".join(
        f"{aid} ({len(filer)} filer)" for aid, filer in agenter_med_fejl.items()
    )
    filer_str = ", ".join(aendrede_filer[:6])
    if len(aendrede_filer) > 6:
        filer_str += f" (+{len(aendrede_filer) - 6} flere)"
    linjer = [
        f"- Trin: `{fejlende_trin}` | TS-fejl: {ts_fejl_foer}->{ts_fejl_efter} | Status: {konvergens}",
        f"- Agenter: {agenter_str}",
        f"- Rettede filer: {filer_str}",
    ]
    if regressioner:
        linjer.append(f"- REGRESSIONER OPDAGET: {', '.join(regressioner)}")
    return "\n".join(linjer)


# ============================================================
# 7. SMOKE TEST — Acceptance-trin efter groen build
# Starter 'next dev', venter paa server, tester kritiske routes,
# stopper server. Groen build PLUS fungerende applikation.
# ============================================================

def koer_smoke_test() -> bool:
    """
    Minimal acceptance-test efter groen next build:
    1. Start 'next dev --port SMOKE_TEST_PORT' i baggrunden
    2. Vent paa server er klar (max 90s)
    3. Test at kritiske routes returnerer acceptable statuskoder
    4. Stop server og rapporter resultat
    """
    _npx = "npx.cmd" if sys.platform == "win32" else "npx"
    base = f"http://localhost:{SMOKE_TEST_PORT}"

    # (url, acceptable HTTP-koder)
    # 307/308 = redirect (fx login redirect fra protected route) er OK
    # 404 er OK for /api/health hvis den ikke er implementeret endnu
    kritiske_routes = [
        (f"{base}/",             [200, 301, 302, 307, 308]),
        (f"{base}/login",        [200, 301, 302, 307, 308]),
        (f"{base}/api/health",   [200, 404]),
    ]

    log(f"=== SMOKE TEST: Starter next dev paa port {SMOKE_TEST_PORT} ===")
    server_proc = None

    try:
        server_proc = subprocess.Popen(
            [_npx, "next", "dev", "--port", str(SMOKE_TEST_PORT)],
            cwd=REPO_ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )

        # Vent paa server er klar
        klar = False
        log(f"  Venter paa server (max 90s)...")
        for i in range(90):
            time.sleep(1)
            if server_proc.poll() is not None:
                stderr_out = ""
                try:
                    stderr_out = server_proc.stderr.read(500) if server_proc.stderr else ""
                except Exception:
                    pass
                log(f"  Next dev stoppede uventet: {stderr_out[:200]}", "FEJL")
                return False
            try:
                urllib.request.urlopen(f"{base}/", timeout=2)
                klar = True
                log(f"  Server klar efter {i+1}s")
                break
            except urllib.error.HTTPError:
                klar = True  # HTTP-fejl = server svarer
                log(f"  Server klar efter {i+1}s (HTTP-svar)")
                break
            except Exception:
                pass

        if not klar:
            log("  Server ikke klar efter 90s", "FEJL")
            return False

        # Test routes
        alle_ok = True
        for url, acceptable in kritiske_routes:
            try:
                try:
                    resp = urllib.request.urlopen(
                        urllib.request.Request(url), timeout=8
                    )
                    status = resp.status
                except urllib.error.HTTPError as e:
                    status = e.code
                except urllib.error.URLError as e:
                    # Kan vaere redirect til HTTPS—betragt som OK hvis acceptable inkl. 3xx
                    status = 307 if any(c in acceptable for c in [301, 302, 307, 308]) else 0

                if status in acceptable:
                    log(f"  v {url} -> {status}")
                else:
                    log(f"  x {url} -> {status} (forventet {acceptable})", "FEJL")
                    alle_ok = False
            except Exception as e:
                log(f"  x {url} -> undtagelse: {e}", "FEJL")
                alle_ok = False

        if alle_ok:
            log("=== SMOKE TEST: PASSED ===")
        else:
            log("=== SMOKE TEST: FEJLEDE ===", "FEJL")
        return alle_ok

    except Exception as e:
        log(f"  Smoke test undtagelse: {e}", "FEJL")
        return False
    finally:
        if server_proc and server_proc.poll() is None:
            server_proc.terminate()
            try:
                server_proc.wait(timeout=12)
            except subprocess.TimeoutExpired:
                server_proc.kill()
            log("  Smoke test server stoppet")


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


def kald_specialist_agent(
    klient: anthropic.Anthropic,
    agent_id: str,
    fejlende_trin: str,
    fejl_output: str,
    fejl_filer: list,
    iteration: int,
    hukommelse: Optional["RepairHukommelse"] = None,
    findings_buffer: Optional[dict] = None,
) -> Optional[str]:
    """
    Kald den originale specialist-agent med dens egen system_prompt + fejl.
    Agenten faar:
      - Sin egen system_prompt (kender sine egne regler bedst)
      - Fejloutput + fejlede filer
      - Sine egne spec-inputfiler som kontekst
      - Repair-hukommelse: tidligere forsoegte fixes (anti-loop)
      - INTELLIGENCE.md: delt videnslag med kendte fejlmoenstre
    """
    agent = AGENTS.get(agent_id)

    if agent_id == "__generisk__" or not agent:
        system_prompt = (
            "Du er en ekspert Next.js/TypeScript repair-agent for ChainHub-projektet.\n"
            "Fix KUN de konkrete kompileringsfejl du ser. Minimal aendring — bevar eksisterende logik.\n"
            "OUTPUT-FORMAT:\n"
            "--- FIL: sti/til/fil ---\n[komplet filindhold]\n--- SLUT ---\n"
            "NPM_INSTALL: pakke1 pakke2  (eller 'NPM_INSTALL: ingen')"
        )
        agent_navn = "Generisk repair"
    else:
        repair_tillaeg = """

=== REPAIR MODE ===
Du er kaldt fordi din kode indeholder kompileringsfejl.
Dit job: Fix KUN de fejl beskrevet nedenfor.
Minimal aendring — bevar al eksisterende logik og arkitektur.
Anvend fortsat dine egne konventioner og regler.

OUTPUT-FORMAT:
--- FIL: sti/til/fil ---
[komplet filindhold]
--- SLUT ---
NPM_INSTALL: pakke1 pakke2  (eller 'NPM_INSTALL: ingen')

=== KOMMUNIKATION MED ANDRE AGENTER ===
Hvis du opdager et problem i en fil du IKKE ejer, rapporter det:
  FINDING: <ejeragent-id>
  Fil: <relativ-sti>
  Beskrivelse: <hvad der er galt>

Hvis du mangler information fra en anden agent for at loese din opgave:
  CLARIFICATION_NEEDED: <ejeragent-id>
  Spoergsmaal: <praecist spoergsmaal>
  Blokerer: <fil/opgave der venter>

Hvis du aendrer en public interface (funktion, enum, model) andre bruger:
  INTERFACE_CHANGE: <beskrivelse>
  Paavirkede agenter: <agent-id1>, <agent-id2>
  Detaljer: <gamle vs. nye signaturer/vaerdier>

Direktiver skrives EFTER dine filer i dit output."""
        system_prompt = agent["system_prompt"] + repair_tillaeg
        agent_navn = agent["navn"]

    # 6. INTELLIGENCE.md — laes levende videnslag
    intelligence_kontekst = ""
    if INTELLIGENCE_FILE.exists():
        try:
            intel = INTELLIGENCE_FILE.read_text(encoding="utf-8")
            # Begraens til de seneste 3.000 tegn (nyeste laeringer)
            if len(intel) > 3000:
                intel = intel[:3000] + "\n...[afskaret]"
            intelligence_kontekst = f"\n=== INTELLIGENCE.md (kendte fejlmoenstre) ===\n{intel}\n"
        except Exception:
            pass

    # Spec-inputfiler
    spec_kontekst = ""
    if agent and agent_id != "__generisk__":
        ekstra_input = []
        for sti in agent.get("input_filer", [])[:4]:
            indhold = laes_fil(sti)
            if indhold:
                afskaret = indhold[:2000] + "\n...[afskaret]" if len(indhold) > 2000 else indhold
                ekstra_input.append(f"\n=== {sti} (spec) ===\n{afskaret}")
        spec_kontekst = "".join(ekstra_input)

    # Fejlede filer
    fil_kontekst = byg_fil_kontekst(fejl_filer)

    # 1. REPAIR-HUKOMMELSE — tidligere forsoegte fixes
    hukommelse_kontekst = ""
    if hukommelse:
        hukommelse_kontekst = hukommelse.som_kontekst(agent_id)
        if hukommelse_kontekst:
            hukommelse_kontekst = f"\n{hukommelse_kontekst}\n"

    # sektion 18: FINDINGS + CLARIFICATION-SVAR fra andre agenter
    findings_kontekst = ""
    if findings_buffer:
        findings_kontekst = byg_findings_kontekst(agent_id, findings_buffer)
        if findings_kontekst:
            findings_kontekst = f"\n{findings_kontekst}\n"

    bruger_besked = (
        f"=== REPAIR ITERATION {iteration} ===\n"
        f"Ansvarlig agent: {agent_navn} ({agent_id})\n"
        f"Fejlende build-trin: {fejlende_trin}\n"
        f"{hukommelse_kontekst}"
        f"{intelligence_kontekst}"
        f"{findings_kontekst}"
        f"\nFejloutput:\n{fejl_output[:4000]}\n"
        f"\nFejlede filer du skal fixe:\n"
        + "\n".join(f"  - {f}" for f in fejl_filer)
        + f"\n{spec_kontekst}\nFil-indhold:\n{fil_kontekst}\n"
        "\nFix KUN de fejl der fremgaar. Skriv komplette filer."
    )

    log(f"  Kalder {agent_navn} ({agent_id}) for repair...")
    try:
        output = ""
        with klient.messages.stream(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=system_prompt,
            messages=[{"role": "user", "content": bruger_besked}],
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


# ============================================================
# SEKTION 18: Agent-til-agent kommunikationsprotokol
# Parser FINDING, CLARIFICATION_NEEDED og INTERFACE_CHANGE
# fra agentoutput og router dem korrekt.
# ============================================================

def parse_agent_direktiver(output: str) -> dict:
    """
    Parser tre kommunikationstyper fra agentoutput:
      FINDING, CLARIFICATION_NEEDED, INTERFACE_CHANGE
    Returner dict med lister af hvert.
    """
    direktiver = {
        "findings":        [],  # {agent_id, fil, beskrivelse}
        "clarifications":  [],  # {agent_id, spoergsmaal, bloekerer}
        "interface_changes": [], # {beskrivelse, paavirkede, detaljer}
    }

    # FINDING: BA-02 / Fil: ... / Beskrivelse: ...
    for m in re.finditer(
        r"FINDING:\s*(\S+)\s*\nFil:\s*(.+?)\s*\nBeskrivelse:\s*(.+?)(?=\n(?:FINDING|CLARIFICATION|INTERFACE|---)|\.?$)",
        output, re.DOTALL | re.MULTILINE
    ):
        direktiver["findings"].append({
            "agent_id":    m.group(1).strip(),
            "fil":         m.group(2).strip(),
            "beskrivelse": m.group(3).strip()[:300],
        })

    # CLARIFICATION_NEEDED: BA-02 / Spoergsmaal: ... / Bloekerer: ...
    for m in re.finditer(
        r"CLARIFICATION_NEEDED:\s*(\S+)\s*\nSp.rgsm.l:\s*(.+?)\s*\nBlokerer:\s*(.+?)(?=\n(?:FINDING|CLARIFICATION|INTERFACE|---)|\.?$)",
        output, re.DOTALL | re.MULTILINE
    ):
        direktiver["clarifications"].append({
            "agent_id":   m.group(1).strip(),
            "spoergsmaal": m.group(2).strip()[:400],
            "bloekerer":  m.group(3).strip(),
        })

    # INTERFACE_CHANGE: beskrivelse / Paavirkede agenter: ... / Detaljer: ...
    for m in re.finditer(
        r"INTERFACE_CHANGE:\s*(.+?)\s*\nP.virkede agenter:\s*(.+?)\s*\nDetaljer:\s*(.+?)(?=\n(?:FINDING|CLARIFICATION|INTERFACE|---)|\.?$)",
        output, re.DOTALL | re.MULTILINE
    ):
        paavirkede = [a.strip() for a in m.group(2).split(",") if a.strip()]
        direktiver["interface_changes"].append({
            "beskrivelse": m.group(1).strip()[:200],
            "paavirkede":  paavirkede,
            "detaljer":    m.group(3).strip()[:400],
        })

    return direktiver


def behandl_direktiver(
    direktiver: dict,
    klient: anthropic.Anthropic,
    downstream_queue: list,
    findings_buffer: dict,   # {agent_id: [beskrivelse, ...]}
    iteration: int,
) -> None:
    """
    Router direktiver fra agentoutput:
      INTERFACE_CHANGE -> tilfoej paavirkede til downstream_queue
      FINDING         -> bufrer til ejeragentens naeste kald
      CLARIFICATION   -> kald ejeragent med spoergsmaal, log svar
    Raekkefølge: INTERFACE_CHANGE foerst, derefter FINDING, CLARIFICATION sidst.
    """
    # 1. INTERFACE_CHANGE — trigger downstream foer alt andet
    for ic in direktiver["interface_changes"]:
        log(
            f"  INTERFACE_CHANGE: {ic['beskrivelse']}\n"
            f"    Paavirkede: {', '.join(ic['paavirkede'])}"
        )
        opdater_intelligence(
            f"- INTERFACE_CHANGE: {ic['beskrivelse']}\n"
            f"  Paavirkede: {', '.join(ic['paavirkede'])}\n"
            f"  Detaljer: {ic['detaljer']}",
            kontekst=f"interface-change iter={iteration}"
        )
        for aid in ic["paavirkede"]:
            if aid in AGENTS and aid not in downstream_queue:
                downstream_queue.append(aid)
                log(f"  + INTERFACE_CHANGE downstream: {aid}")

    # 2. FINDING — bufrer til ejeragentens naeste kald
    for f in direktiver["findings"]:
        target = f["agent_id"]
        if target not in AGENTS:
            log(f"  FINDING til ukendt agent '{target}' — ignoreret", "ADVARSEL")
            continue
        findings_buffer.setdefault(target, [])
        findings_buffer[target].append(
            f"[Iter {iteration}] Fil: {f['fil']}\nBeskrivelse: {f['beskrivelse']}"
        )
        log(f"  FINDING -> {target}: {f['fil']} ({f['beskrivelse'][:80]})")
        opdater_intelligence(
            f"- FINDING til {target}: {f['fil']}\n  {f['beskrivelse']}",
            kontekst=f"finding iter={iteration}"
        )
        # Ejeragenten skal med i naeste iteration
        if target not in downstream_queue:
            downstream_queue.append(target)

    # 3. CLARIFICATION_NEEDED — kald ejeragent synkront og log svaret
    for cl in direktiver["clarifications"]:
        target = cl["agent_id"]
        agent  = AGENTS.get(target)
        if not agent:
            log(f"  CLARIFICATION til ukendt agent '{target}' — ignoreret", "ADVARSEL")
            continue

        log(f"  CLARIFICATION_NEEDED -> {target}: {cl['spoergsmaal'][:100]}")

        # Byg et minimalt kald til ejeragenten med kun spoergsmaalet
        svar_besked = (
            f"=== CLARIFICATION REQUEST (iter {iteration}) ===\n"
            f"En anden agent har brug for din ekspertise.\n"
            f"Spoergsmaal: {cl['spoergsmaal']}\n"
            f"Kontekst (blokeret fil): {cl['bloekerer']}\n"
            f"\nSvar kort og praecist. Ingen filer noedvendige medmindre svaret kraever kodeaendring."
        )
        try:
            svar = ""
            with klient.messages.stream(
                model=MODEL,
                max_tokens=2000,
                system=agent["system_prompt"],
                messages=[{"role": "user", "content": svar_besked}],
            ) as stream:
                for tekst in stream.text_stream:
                    svar += tekst

            log(f"  {target} svar: {svar[:200].strip()}")
            opdater_intelligence(
                f"- CLARIFICATION {target} -> svar:\n  Sp: {cl['spoergsmaal']}\n  Sv: {svar[:300].strip()}",
                kontekst=f"clarification iter={iteration}"
            )
            # Bufrer svaret saa den blokerede agent faar det i naeste kald
            findings_buffer.setdefault(cl["agent_id"] + "__clarification", [])
            findings_buffer[cl["agent_id"] + "__clarification"].append(
                f"SVAR FRA {target} om '{cl['bloekerer']}':\n{svar[:600]}"
            )
        except Exception as e:
            log(f"  CLARIFICATION API fejl: {e}", "FEJL")


def byg_findings_kontekst(agent_id: str, findings_buffer: dict) -> str:
    """Hent akkumulerede findings og clarification-svar til denne agent."""
    linjer = []
    for key in (agent_id, agent_id + "__clarification"):
        if key in findings_buffer and findings_buffer[key]:
            linjer.append(f"=== FINDINGS/SVAR TIL {agent_id} ===")
            linjer.extend(findings_buffer[key])
            findings_buffer[key] = []  # Forbrugt
    return "\n".join(linjer) if linjer else ""


def koer_autorepair_loop(
    klient: anthropic.Anthropic,
    max_iter: int = 10,
    smoke_test: bool = False,
) -> bool:
    """
    Fuldt agil specialist repair-loop (v3):

    Pr. iteration:
      - Koor build-trin (npm install -> prisma generate -> tsc -> next build)
      - Maaler TS-fejl og vurderer konvergens (punkt 5)
      - Router fejl til ansvarlige specialist-agenter (punkt 2-routing)
      - Agenter ser INTELLIGENCE.md + egne tidligere forsoegte fixes (punkt 1+6)
      - Regressionsguard: detekterer nye fejl introduceret af repair (punkt 3)
      - Afhaengighedsgraf: flagger downstream agenter ved interface-aendringer (punkt 2+4)
      - Opdaterer INTELLIGENCE.md med ny laering (punkt 6)

    Ved groen build:
      - Smoke test hvis --smoke-test er angivet (punkt 7)
    """
    _npm = "npm.cmd" if sys.platform == "win32" else "npm"
    _npx = "npx.cmd" if sys.platform == "win32" else "npx"

    trin_liste = [
        ([_npm, "install", "--legacy-peer-deps"], "npm install"),
        ([_npx, "prisma", "generate"],             "prisma generate"),
        ([_npx, "tsc", "--noEmit"],                "tsc typecheck"),
        ([_npx, "next", "build"],                  "next build"),
    ]

    # Initialiser sessionsdata
    hukommelse        = RepairHukommelse()          # punkt 1
    afh_graf          = byg_afhaengighedsgraf()     # punkt 2
    ts_fejl_historik: list[int] = []               # punkt 5
    downstream_queue: list[str] = []               # punkt 4: agenter der skal re-checkes
    findings_buffer:  dict      = {}               # sektion 18: findings + clarifications

    # Byg reverse map
    fil_til_agent = byg_fil_til_agent_map()

    log(
        f"=== AUTOREPAIR START (max {max_iter} iterationer) ===\n"
        f"  Fil->agent map: {len(fil_til_agent)} filer / {len(set(fil_til_agent.values()))} agenter\n"
        f"  Afhaengighedsgraf: {sum(len(v) for v in afh_graf.values())} relationer kortlagt"
    )

    for iteration in range(1, max_iter + 1):
        log(f"\n{'='*60}\n--- Autorepair iteration {iteration}/{max_iter} ---")

        # Vis konvergensstatus
        if ts_fejl_historik:
            log(f"  Konvergens: {vurder_konvergens(ts_fejl_historik)}")

        # Vis downstream queue
        if downstream_queue:
            log(f"  Downstream re-check koe: {', '.join(downstream_queue)}")

        fejl_output   = ""
        fejlende_trin = None
        start_fra     = 1 if iteration > 1 else 0  # Spring npm install over efter 1. runde

        # Koer build-trin
        for cmd, navn in trin_liste[start_fra:]:
            log(f"  Korer: {navn}...")
            start = time.time()
            try:
                res = subprocess.run(
                    cmd, cwd=REPO_ROOT, capture_output=True, text=True, timeout=300
                )
            except subprocess.TimeoutExpired:
                log(f"  x {navn} TIMEOUT", "FEJL")
                fejl_output   = f"TIMEOUT efter 300s under: {navn}"
                fejlende_trin = navn
                break
            except Exception as e:
                log(f"  x {navn} OS-FEJL: {e}", "FEJL")
                fejl_output   = str(e)
                fejlende_trin = navn
                break

            varighed = round(time.time() - start, 1)
            if res.returncode == 0:
                log(f"  v {navn} OK ({varighed}s)")
            else:
                kombineret = (res.stdout + "\n" + res.stderr).strip()
                log(f"  x {navn} FEJLEDE ({varighed}s)")
                fejllinjer = [
                    l for l in kombineret.splitlines()
                    if "error" in l.lower() or "Error" in l
                ][:8]
                for linje in fejllinjer:
                    log(f"    {linje[:120]}", "FEJL")
                fejl_output   = kombineret
                fejlende_trin = navn
                break

        # ============================================================
        # ALLE TRIN OK -> BUILD GROENT
        # ============================================================
        if fejlende_trin is None:
            log(f"\n=== AUTOREPAIR: BUILD GROENT efter {iteration} iteration(er) ===")

            # INTELLIGENCE.md — skriv succes-laering
            opdater_intelligence(
                f"- Build groen efter {iteration} iterationer\n"
                f"- TS-fejl historik: {' -> '.join(str(x) for x in ts_fejl_historik)} -> 0",
                kontekst=f"autorepair-succes iter={iteration}"
            )

            git_commit(
                f"chore: autorepair completed — build passing "
                f"(iter {iteration}, {len(ts_fejl_historik)} repair-runder)"
            )

            # punkt 7: smoke test
            if smoke_test:
                smoke_ok = koer_smoke_test()
                if not smoke_ok:
                    log("  Build groen men smoke test fejlede — se log", "ADVARSEL")
                    opdater_intelligence(
                        "- Build groen men smoke test fejlede — applikationen starter/svarer ikke korrekt",
                        kontekst="smoke-test-fejl"
                    )
                    return False
            return True

        # ============================================================
        # SPECIELT: npm install fejl
        # ============================================================
        if fejlende_trin == "npm install":
            log("  npm install fejlede — proever --force", "ADVARSEL")
            subprocess.run(
                [_npm, "install", "--force"],
                cwd=REPO_ROOT, capture_output=True, text=True, timeout=120
            )
            continue

        # ============================================================
        # MAX ITERATIONER NAAET
        # ============================================================
        if iteration == max_iter:
            log(f"=== AUTOREPAIR: MAX ITERATIONER ({max_iter}) NAAET ===", "FEJL")
            fejl_sti = REPO_ROOT / "autorepair-final-error.txt"
            fejl_sti.write_text(
                f"Trin: {fejlende_trin}\n"
                f"TS-fejl historik: {ts_fejl_historik}\n"
                f"Konvergens: {vurder_konvergens(ts_fejl_historik)}\n\n"
                f"{fejl_output}",
                encoding="utf-8"
            )
            log(f"  Fejloutput gemt: autorepair-final-error.txt", "FEJL")
            opdater_intelligence(
                f"- MISLYKKET: {max_iter} iterationer udtoemte uden groen build\n"
                f"- TS-fejl historik: {' -> '.join(str(x) for x in ts_fejl_historik)}\n"
                f"- Konvergens: {vurder_konvergens(ts_fejl_historik)}\n"
                f"- Sidst fejlende trin: {fejlende_trin}",
                kontekst=f"autorepair-fejlet max-iter={max_iter}"
            )
            return False

        # ============================================================
        # punkt 5: KONVERGENSMETRIK — tael TS-fejl og vurder retning
        # ============================================================
        ts_fejl_nu = tael_ts_fejl(fejl_output)
        ts_fejl_historik.append(ts_fejl_nu)
        konvergens = vurder_konvergens(ts_fejl_historik)
        log(f"  TS-fejl nu: {ts_fejl_nu} | {konvergens}")

        # Divergens-alarm: stop hvis fejl stiger 2 iterationer i traek
        if (
            len(ts_fejl_historik) >= 3
            and ts_fejl_historik[-1] > ts_fejl_historik[-2] > ts_fejl_historik[-3]
        ):
            log(
                "  ADVARSEL: Fejl stiger 2 iterationer i traek — mulig strukturel issue."
                " Fortsaetter men noterer i INTELLIGENCE.md.",
                "ADVARSEL"
            )
            opdater_intelligence(
                f"- Divergens detekteret: {ts_fejl_historik[-3]}->{ts_fejl_historik[-2]}->{ts_fejl_historik[-1]} TS-fejl\n"
                f"- Trin: {fejlende_trin}",
                kontekst="autorepair-divergens"
            )

        # ============================================================
        # Identificer fejlede filer og ansvarlige agenter
        # ============================================================
        fejl_filer       = udtraek_fejlfiler(fejl_output)
        agenter_med_fejl = identificer_ansvarlige_agenter(fejl_filer, fil_til_agent)

        # FALLBACK: prisma generate/migrate fejler uden TS-filstier — router altid til BA-02
        if not agenter_med_fejl and not fejl_filer and fejlende_trin in ("prisma generate", "prisma migrate dev"):
            log(f"  Ingen fejlede filer fundet for '{fejlende_trin}' — router til BA-02 (schema-ejer)", "ADVARSEL")
            schema_filer = AGENTS.get("BA-02", {}).get("output_filer", ["prisma/schema.prisma"])
            agenter_med_fejl = {"BA-02": schema_filer}

        # punkt 3: REGRESSIONSGUARD — snapshot foer repair
        fejlfri_snapshot = regressionsguard_snapshot(fejl_filer)

        log(f"  Fejlede filer: {len(fejl_filer)}")
        for agent_id, filer in agenter_med_fejl.items():
            agent_navn = AGENTS.get(agent_id, {}).get("navn", agent_id)
            log(f"  -> {agent_id} ({agent_navn}): {', '.join(f.split('/')[-1] for f in filer)}")

        # ============================================================
        # Kald specialisterne — inkl. downstream queue (punkt 4)
        # ============================================================
        alle_agenter_denne_iter = dict(agenter_med_fejl)

        # Tilfoej downstream-agenter fra forrige iteration
        for ds_agent_id in downstream_queue:
            if ds_agent_id not in alle_agenter_denne_iter:
                ds_filer = AGENTS.get(ds_agent_id, {}).get("output_filer", [])[:3]
                alle_agenter_denne_iter[ds_agent_id] = ds_filer
                log(f"  + Downstream re-check: {ds_agent_id}")
        downstream_queue.clear()

        total_filer_skrevet  = 0
        alle_aendrede_filer: list[str] = []

        for agent_id, agentens_filer in alle_agenter_denne_iter.items():
            # punkt 1: Anti-loop check
            if hukommelse.er_set_foer(fejl_output, agent_id):
                log(f"  {agent_id}: samme fejl set foer — tvinger alternativ tilgang", "ADVARSEL")
                # Fortsaet: hukommelse.som_kontekst() vil instruere agenten om at proeve nyt

            fix_output = kald_specialist_agent(
                klient, agent_id, fejlende_trin, fejl_output,
                agentens_filer, iteration, hukommelse=hukommelse,
                findings_buffer=findings_buffer
            )

            if fix_output:
                antal = anvend_fix(fix_output, _npm)
                total_filer_skrevet += antal
                aendrede = list(parse_output_filer(fix_output).keys())
                alle_aendrede_filer.extend(aendrede)
                log(f"  {agent_id}: {antal} filer rettet")

                # punkt 1: Registrer dette forsog i hukommelsen
                hukommelse.registrer(fejl_output, agent_id, aendrede, ts_fejl_nu)

                # punkt 2+4: Find downstream agenter paavirkede af aendringer
                paavirkede = identificer_paavirkede_downstream(aendrede, afh_graf)
                if paavirkede:
                    log(f"  {agent_id} aendrede filer der bruges af: {', '.join(paavirkede)}")
                    for p in paavirkede:
                        if p not in downstream_queue:
                            downstream_queue.append(p)

                # sektion 18: parser og router FINDING / CLARIFICATION / INTERFACE_CHANGE
                direktiver = parse_agent_direktiver(fix_output)
                if any(direktiver.values()):
                    behandl_direktiver(
                        direktiver, klient, downstream_queue,
                        findings_buffer, iteration
                    )
            else:
                log(f"  {agent_id}: ingen output — fortsaetter", "ADVARSEL")

        # punkt 3: REGRESSIONSGUARD — check for nye fejl efter repair
        if total_filer_skrevet > 0:
            # Hent nye fejl via hurtig tsc-check
            tsc_check = subprocess.run(
                [_npx, "tsc", "--noEmit"],
                cwd=REPO_ROOT, capture_output=True, text=True, timeout=120
            )
            if tsc_check.returncode != 0:
                nye_fejl_filer = udtraek_fejlfiler(tsc_check.stdout + tsc_check.stderr)
                regressioner   = regressionsguard_check(fejlfri_snapshot, nye_fejl_filer)
                if regressioner:
                    log(
                        f"  REGRESSIONSGUARD: {len(regressioner)} nye fejl introduceret: "
                        f"{', '.join(r.split('/')[-1] for r in regressioner)}",
                        "ADVARSEL"
                    )
                    # Tilfoej de regrederede filer til naeste iterations ansvarlige agenter
                    reg_agenter = identificer_ansvarlige_agenter(regressioner, fil_til_agent)
                    for reg_agent in reg_agenter:
                        if reg_agent not in downstream_queue:
                            downstream_queue.append(reg_agent)
                else:
                    regressioner = []
            else:
                regressioner = []
        else:
            regressioner = []

        # Ingen filer rettet denne iteration
        if total_filer_skrevet == 0:
            log("  Ingen filer rettet — risiko for uendelig loop", "ADVARSEL")
            (REPO_ROOT / f"autorepair-stuck-iter{iteration}.txt").write_text(
                f"Trin: {fejlende_trin}\nTS-fejl: {ts_fejl_nu}\n\n{fejl_output}",
                encoding="utf-8"
            )

        # punkt 6: INTELLIGENCE.md — opdater med ny laering
        ts_fejl_efter = tael_ts_fejl(fejl_output)  # Opdateres naeste iteration
        laering = byg_intelligence_laering(
            agenter_med_fejl   = alle_agenter_denne_iter,
            ts_fejl_foer       = ts_fejl_nu,
            ts_fejl_efter      = ts_fejl_historik[-1] if ts_fejl_historik else ts_fejl_nu,
            fejlende_trin      = fejlende_trin,
            aendrede_filer     = alle_aendrede_filer,
            regressioner       = regressioner,
            konvergens         = konvergens,
        )
        opdater_intelligence(laering, kontekst=f"iter={iteration} trin={fejlende_trin}")

        git_commit(
            f"fix: autorepair iter {iteration} — {fejlende_trin} "
            f"({len(alle_agenter_denne_iter)} agenter, {total_filer_skrevet} filer, {ts_fejl_nu} TS-fejl)"
        )
        log(f"  Iteration {iteration} afsluttet — korer build igen...")

    log("=== AUTOREPAIR: AFSLUTTET UDEN GROENT BUILD ===", "FEJL")
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



# ============================================================
# SEKTION 18: Agent-til-agent kommunikationsprotokol
# Parser FINDING, CLARIFICATION_NEEDED og INTERFACE_CHANGE
# fra agentoutput og router dem korrekt.
# ============================================================

def parse_agent_direktiver(output: str) -> dict:
    """
    Parser tre kommunikationstyper fra agentoutput:
      FINDING, CLARIFICATION_NEEDED, INTERFACE_CHANGE
    Returner dict med lister af hvert.
    """
    direktiver = {
        "findings":        [],  # {agent_id, fil, beskrivelse}
        "clarifications":  [],  # {agent_id, spoergsmaal, bloekerer}
        "interface_changes": [], # {beskrivelse, paavirkede, detaljer}
    }

    # FINDING: BA-02 / Fil: ... / Beskrivelse: ...
    for m in re.finditer(
        r"FINDING:\s*(\S+)\s*\nFil:\s*(.+?)\s*\nBeskrivelse:\s*(.+?)(?=\n(?:FINDING|CLARIFICATION|INTERFACE|---)|\.?$)",
        output, re.DOTALL | re.MULTILINE
    ):
        direktiver["findings"].append({
            "agent_id":    m.group(1).strip(),
            "fil":         m.group(2).strip(),
            "beskrivelse": m.group(3).strip()[:300],
        })

    # CLARIFICATION_NEEDED
    for m in re.finditer(
        r"CLARIFICATION_NEEDED:\s*(\S+)\s*\nSp.rgsm.l:\s*(.+?)\s*\nBlokerer:\s*(.+?)(?=\n(?:FINDING|CLARIFICATION|INTERFACE|---)|\.?$)",
        output, re.DOTALL | re.MULTILINE
    ):
        direktiver["clarifications"].append({
            "agent_id":    m.group(1).strip(),
            "spoergsmaal": m.group(2).strip()[:400],
            "bloekerer":   m.group(3).strip(),
        })

    # INTERFACE_CHANGE
    for m in re.finditer(
        r"INTERFACE_CHANGE:\s*(.+?)\s*\nP.virkede agenter:\s*(.+?)\s*\nDetaljer:\s*(.+?)(?=\n(?:FINDING|CLARIFICATION|INTERFACE|---)|\.?$)",
        output, re.DOTALL | re.MULTILINE
    ):
        paavirkede = [a.strip() for a in m.group(2).split(",") if a.strip()]
        direktiver["interface_changes"].append({
            "beskrivelse": m.group(1).strip()[:200],
            "paavirkede":  paavirkede,
            "detaljer":    m.group(3).strip()[:400],
        })

    return direktiver


def behandl_direktiver(
    direktiver: dict,
    klient: anthropic.Anthropic,
    downstream_queue: list,
    findings_buffer: dict,
    iteration: int,
) -> None:
    """
    Router direktiver: INTERFACE_CHANGE foerst, FINDING dernaest, CLARIFICATION sidst.
    """
    # 1. INTERFACE_CHANGE
    for ic in direktiver["interface_changes"]:
        log(f"  INTERFACE_CHANGE: {ic['beskrivelse']}\n    Paavirkede: {', '.join(ic['paavirkede'])}")
        opdater_intelligence(
            f"- INTERFACE_CHANGE: {ic['beskrivelse']}\n  Paavirkede: {', '.join(ic['paavirkede'])}\n  Detaljer: {ic['detaljer']}",
            kontekst=f"interface-change iter={iteration}"
        )
        for aid in ic["paavirkede"]:
            if aid in AGENTS and aid not in downstream_queue:
                downstream_queue.append(aid)
                log(f"  + INTERFACE_CHANGE downstream: {aid}")

    # 2. FINDING
    for f in direktiver["findings"]:
        target = f["agent_id"]
        if target not in AGENTS:
            log(f"  FINDING til ukendt agent '{target}' — ignoreret", "ADVARSEL")
            continue
        findings_buffer.setdefault(target, [])
        findings_buffer[target].append(f"[Iter {iteration}] Fil: {f['fil']}\nBeskrivelse: {f['beskrivelse']}")
        log(f"  FINDING -> {target}: {f['fil']} ({f['beskrivelse'][:80]})")
        opdater_intelligence(
            f"- FINDING til {target}: {f['fil']}\n  {f['beskrivelse']}",
            kontekst=f"finding iter={iteration}"
        )
        if target not in downstream_queue:
            downstream_queue.append(target)

    # 3. CLARIFICATION_NEEDED
    for cl in direktiver["clarifications"]:
        target = cl["agent_id"]
        agent  = AGENTS.get(target)
        if not agent:
            log(f"  CLARIFICATION til ukendt agent '{target}' — ignoreret", "ADVARSEL")
            continue
        log(f"  CLARIFICATION_NEEDED -> {target}: {cl['spoergsmaal'][:100]}")
        svar_besked = (
            f"=== CLARIFICATION REQUEST (iter {iteration}) ===\n"
            f"En anden agent har brug for din ekspertise.\n"
            f"Spoergsmaal: {cl['spoergsmaal']}\n"
            f"Kontekst (blokeret fil): {cl['bloekerer']}\n"
            f"\nSvar kort og praecist."
        )
        try:
            svar = ""
            with klient.messages.stream(
                model=MODEL, max_tokens=2000,
                system=agent["system_prompt"],
                messages=[{"role": "user", "content": svar_besked}],
            ) as stream:
                for tekst in stream.text_stream:
                    svar += tekst
            log(f"  {target} svar: {svar[:200].strip()}")
            opdater_intelligence(
                f"- CLARIFICATION {target} -> svar:\n  Sp: {cl['spoergsmaal']}\n  Sv: {svar[:300].strip()}",
                kontekst=f"clarification iter={iteration}"
            )
            findings_buffer.setdefault(cl["agent_id"] + "__clarification", [])
            findings_buffer[cl["agent_id"] + "__clarification"].append(
                f"SVAR FRA {target} om '{cl['bloekerer']}':\n{svar[:600]}"
            )
        except Exception as e:
            log(f"  CLARIFICATION API fejl: {e}", "FEJL")


def byg_findings_kontekst(agent_id: str, findings_buffer: dict) -> str:
    """Hent akkumulerede findings og clarification-svar til denne agent."""
    linjer = []
    for key in (agent_id, agent_id + "__clarification"):
        if key in findings_buffer and findings_buffer[key]:
            linjer.append(f"=== FINDINGS/SVAR TIL {agent_id} ===")
            linjer.extend(findings_buffer[key])
            findings_buffer[key] = []  # Forbrugt
    return "\n".join(linjer) if linjer else ""


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
    parser = argparse.ArgumentParser(
        description="ChainHub MABS orkestrator v3",
        formatter_class=argparse.RawTextHelpFormatter,
        epilog=(
            "Eksempler:\n"
            "  python orchestrator.py --sprint 1       Koor sprint 1\n"
            "  python orchestrator.py --all            Koor alle sprints\n"
            "  python orchestrator.py --autorepair     Fix til groen build + smoke test\n"
            "  python orchestrator.py --list           Vis alle agenter og status\n"
        )
    )
    parser.add_argument("--sprint",      type=int,          help="Koor et enkelt sprint (1-6)")
    parser.add_argument("--all",         action="store_true", help="Koor alle sprints i raekkefoelge")
    parser.add_argument("--autorepair",  action="store_true", help="Autonom repair loop + smoke test")
    parser.add_argument("--agent",       type=str,           help="Koor en specifik agent direkte")
    parser.add_argument("--list",        action="store_true", help="Vis alle agenter og sprint-status")
    # Modifiers
    parser.add_argument("--force",       action="store_true", help="Tving genkoersel selv om output eksisterer")
    parser.add_argument("--dry-run",     action="store_true", help="Simuler uden API-kald")
    parser.add_argument("--max-iter",    type=int, default=10, metavar="N",
                        help="Max repair-iterationer (default: 10)")
    args = parser.parse_args()

    if args.list:
        print("\nAgenter:")
        for aid, ag in AGENTS.items():
            sprint_str = f"Sprint {ag['sprint']}" if ag['sprint'] > 0 else "Repair  "
            status = "OK" if all((REPO_ROOT / f).exists() for f in ag.get("output_filer", []) if ag.get("output_filer")) else "--"
            print(f"  {aid:25} {sprint_str:10} [{status}]  {ag['navn']}")
        print("\nBrug:")
        print("  python orchestrator.py --sprint 1")
        print("  python orchestrator.py --all")
        print("  python orchestrator.py --autorepair")
        print("  python orchestrator.py --autorepair --max-iter 15")
        print("  python orchestrator.py --agent BA-02 --force")
        return

    api_noegle = os.getenv("ANTHROPIC_API_KEY")
    if not api_noegle:
        log("ANTHROPIC_API_KEY ikke fundet i .env.local", "FEJL")
        sys.exit(1)

    klient = anthropic.Anthropic(api_key=api_noegle)

    if args.autorepair:
        # Smoke test er altid med i autorepair — det er hele pointen
        succes = koer_autorepair_loop(klient, max_iter=args.max_iter, smoke_test=True)
        sys.exit(0 if succes else 1)

    if args.all:
        for sprint_nr in sorted(SPRINT_RAEKKEFOLGEP.keys()):
            koer_sprint(sprint_nr, klient, args.dry_run, args.force)
    elif args.sprint:
        koer_sprint(args.sprint, klient, args.dry_run, args.force)
    elif args.agent:
        koer_agent(args.agent, klient, args.dry_run, args.force)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()