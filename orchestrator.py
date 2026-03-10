#!/usr/bin/env python3
"""
ChainHub MABS — Orkestrator
===========================
Start-knap. Intet andet.

Læser MASTER-PROMPT.md + alle MD-dokumenter som kontekst.
Sender til Claude API med streaming og tool use.
Eksekverer tool-kald. Gentager til Claude er færdig.
Al intelligens ligger i Claude og MD-dokumenterne.

Brug:
  python orchestrator.py
  python orchestrator.py --dry-run
"""

import os, re, sys, json, shutil, difflib, subprocess, threading, urllib.request, urllib.error, urllib.parse
from pathlib import Path
from datetime import datetime

try:
    import anthropic
    from dotenv import load_dotenv
except ImportError:
    print("Mangler pakker. Kør: pip install anthropic python-dotenv")
    sys.exit(1)

load_dotenv(".env.local")
load_dotenv(".env")

REPO_ROOT  = Path(__file__).parent
MODEL      = "claude-opus-4-6"
MAX_TOKENS = 32000

# Context window management
MAX_CONTEXT_CHARS    = 550_000   # ~157K tokens — sikkerhedsmargin til 200K window
MAX_TOOL_RESULT_CHARS = 12_000   # Trunkér individuelle tool-results over dette
KEEP_RECENT_TURNS    = 20        # Behold altid de seneste N assistant+user par

KONTEKST_FILER = [
    "docs/build/MASTER-PROMPT.md",
    "docs/status/PROGRESS.md",
    "docs/build/INTELLIGENCE.md",
    "docs/status/DECISIONS.md",
    "docs/status/BLOCKERS.md",
    "docs/build/CONVENTIONS.md",
    "docs/build/AGENT-ROSTER.md",
    "docs/build/AGENT-ARCHITECTURE.md",
    "docs/build/SPRINT-PLAN.md",
    "docs/build/DEA-PROMPTS.md",
    "docs/spec/DATABASE-SCHEMA.md",
    "docs/spec/CONTRACT-TYPES.md",
    "docs/spec/roller-og-tilladelser.md",
    "docs/spec/kravspec-legalhub.md",
    "docs/spec/UI-FLOWS.md",
    "docs/spec/API-SPEC.md",
]

_processer:      dict[int, subprocess.Popen] = {}
_process_logs:   dict[int, list[str]] = {}
_http_sessioner: dict = {}


def log(m: str):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {m}", flush=True)

def _run(cmd: str, timeout: int = 300, cwd: Path = None) -> str:
    try:
        r = subprocess.run(cmd, shell=True, cwd=cwd or REPO_ROOT,
                           capture_output=True, text=True, timeout=timeout,
                           stdin=subprocess.DEVNULL)
        return ((r.stdout or "") + (r.stderr or "")).strip() or f"[returncode: {r.returncode}]"
    except subprocess.TimeoutExpired:
        return f"[TIMEOUT efter {timeout}s]"
    except Exception as e:
        return f"[FEJL: {e}]"

def _tilfoej(sti: Path, tekst: str):
    sti.parent.mkdir(parents=True, exist_ok=True)
    with open(sti, "a", encoding="utf-8") as f:
        f.write(tekst)

def _log_reader(proc: subprocess.Popen, port: int):
    """Læs stdout fra baggrundsproces i en separat tråd (Windows-kompatibel)."""
    try:
        while True:
            line = proc.stdout.readline()
            if not line:
                break
            _process_logs.setdefault(port, []).append(line.rstrip())
    except Exception:
        pass


# ── Context window management ─────────────────────────────────────────────────

def _estimer_besked_chars(beskeder: list) -> int:
    """Estimér samlet tegnantal i beskedlisten."""
    total = 0
    for msg in beskeder:
        content = msg.get("content", "")
        if isinstance(content, str):
            total += len(content)
        elif isinstance(content, list):
            for block in content:
                if isinstance(block, dict):
                    total += len(str(block.get("content", "")))
                    total += len(str(block.get("text", "")))
                else:
                    total += len(str(block))
        else:
            total += len(str(content))
    return total

def _trim_beskeder(beskeder: list) -> list:
    """
    Trim beskedlisten hvis den overstiger MAX_CONTEXT_CHARS.
    Behold altid: besked[0] (initial kontekst) + de seneste KEEP_RECENT_TURNS par.
    Erstat midterste beskeder med en kort opsummering.
    """
    total = _estimer_besked_chars(beskeder)
    if total <= MAX_CONTEXT_CHARS:
        return beskeder

    keep_end = KEEP_RECENT_TURNS * 2
    if len(beskeder) <= 1 + keep_end:
        return beskeder

    trimmed_count = len(beskeder) - 1 - keep_end
    opsummering = {
        "role": "user",
        "content": f"[KONTEKST TRIMMET: {trimmed_count} ældre beskeder fjernet for at spare context window. "
                   f"Al persistent tilstand er gemt i PROGRESS.md, INTELLIGENCE.md, DECISIONS.md og BLOCKERS.md. "
                   f"Læs disse filer for at genoptage kontekst.]"
    }

    nye_beskeder = [beskeder[0], opsummering] + beskeder[-(keep_end):]
    ny_total = _estimer_besked_chars(nye_beskeder)
    log(f"⚡ CONTEXT TRIM: {total:,} → {ny_total:,} tegn ({trimmed_count} beskeder fjernet)")

    return nye_beskeder

def _truncer_tool_result(resultat: str) -> str:
    """Trunkér store tool-results for at spare context window."""
    if len(resultat) <= MAX_TOOL_RESULT_CHARS:
        return resultat
    halv = MAX_TOOL_RESULT_CHARS // 2
    return (resultat[:halv]
            + f"\n\n[... TRUNKERET — {len(resultat):,} tegn total, viser første og sidste {halv:,} ...]\n\n"
            + resultat[-halv:])


def byg_system_prompt() -> str:
    master = REPO_ROOT / "docs/build/MASTER-PROMPT.md"
    return master.read_text(encoding="utf-8") if master.exists() else \
        "Du er BA-01 (Orchestrator) for ChainHub MABS. Byg applikationen autonomt."

def byg_kontekst() -> str:
    sektioner = []
    for rel in KONTEKST_FILER:
        sti = REPO_ROOT / rel
        indhold = sti.read_text(encoding="utf-8") if sti.exists() else "[MANGLER]"
        sektioner.append(f"\n\n=== {rel} ===\n{indhold}")
    return "".join(sektioner)


# ── Tools ─────────────────────────────────────────────────────────────────────

TOOLS = [
    {"name":"read_file","description":"Læs en fil","input_schema":{"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}},
    {"name":"write_file","description":"Skriv komplet indhold til en fil — opretter mapper automatisk","input_schema":{"type":"object","properties":{"path":{"type":"string"},"content":{"type":"string"}},"required":["path","content"]}},
    {"name":"delete_file","description":"Slet en fil","input_schema":{"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}},
    {"name":"move_file","description":"Flyt eller omdøb en fil","input_schema":{"type":"object","properties":{"from_path":{"type":"string"},"to_path":{"type":"string"}},"required":["from_path","to_path"]}},
    {"name":"list_files","description":"List filer i en mappe","input_schema":{"type":"object","properties":{"directory":{"type":"string"},"recursive":{"type":"boolean","default":False}},"required":["directory"]}},
    {"name":"search_in_files","description":"Grep på tværs af filer","input_schema":{"type":"object","properties":{"pattern":{"type":"string"},"directory":{"type":"string"},"file_glob":{"type":"string","default":"*"}},"required":["pattern","directory"]}},
    {"name":"diff_files","description":"Vis forskel mellem to filer","input_schema":{"type":"object","properties":{"path_a":{"type":"string"},"path_b":{"type":"string"}},"required":["path_a","path_b"]}},
    {"name":"file_encoding_check","description":"Tjek for ugyldige tegn (Æ/Ø/Å) i Prisma enum-navne","input_schema":{"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}},
    {"name":"file_encoding_fix","description":"Erstat Æ/Ø/Å i Prisma enum-navne med ASCII + @map()","input_schema":{"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}},
    {"name":"bash","description":"Kør en shell-kommando — returnér stdout + stderr. VIGTIGT: stdin er lukket — interaktive kommandoer der kræver brugerinput vil fejle. Brug --yes eller lignende flags.","input_schema":{"type":"object","properties":{"command":{"type":"string"},"timeout":{"type":"integer","default":300},"working_dir":{"type":"string"}},"required":["command"]}},
    {"name":"start_process","description":"Start en baggrundsproces (fx next dev)","input_schema":{"type":"object","properties":{"command":{"type":"string"},"port":{"type":"integer"}},"required":["command","port"]}},
    {"name":"stop_process","description":"Stop baggrundsproces på en port","input_schema":{"type":"object","properties":{"port":{"type":"integer"}},"required":["port"]}},
    {"name":"wait_for_port","description":"Vent til en port er åben","input_schema":{"type":"object","properties":{"port":{"type":"integer"},"timeout":{"type":"integer","default":90}},"required":["port"]}},
    {"name":"read_process_logs","description":"Læs stdout fra kørende baggrundsproces","input_schema":{"type":"object","properties":{"port":{"type":"integer"}},"required":["port"]}},
    {"name":"process_list","description":"List aktive baggrundsprocesser","input_schema":{"type":"object","properties":{}}},
    {"name":"http_request","description":"Send HTTP-request — returnér status, headers og body","input_schema":{"type":"object","properties":{"method":{"type":"string","enum":["GET","POST","PUT","PATCH","DELETE"]},"url":{"type":"string"},"headers":{"type":"object"},"body":{"type":"string"},"follow_redirects":{"type":"boolean","default":True}},"required":["method","url"]}},
    {"name":"http_session","description":"Opret stateful HTTP-session med cookie jar","input_schema":{"type":"object","properties":{"name":{"type":"string"}},"required":["name"]}},
    {"name":"db_query","description":"Kør rå SQL mod PostgreSQL","input_schema":{"type":"object","properties":{"sql":{"type":"string"}},"required":["sql"]}},
    {"name":"db_prisma","description":"Kør Prisma CLI-kommando (generate, migrate dev, db seed osv.)","input_schema":{"type":"object","properties":{"command":{"type":"string"}},"required":["command"]}},
    {"name":"typescript_check","description":"Kør tsc --noEmit","input_schema":{"type":"object","properties":{"path":{"type":"string"}}}},
    {"name":"lint","description":"Kør ESLint","input_schema":{"type":"object","properties":{"path":{"type":"string","default":"."}}}},
    {"name":"test_run","description":"Kør Vitest eller Playwright tests","input_schema":{"type":"object","properties":{"pattern":{"type":"string"},"reporter":{"type":"string","default":"verbose"}}}},
    {"name":"test_coverage","description":"Kør tests med coverage-rapport","input_schema":{"type":"object","properties":{}}},
    {"name":"npm_audit","description":"Kør npm audit — sikkerhedshuller i dependencies","input_schema":{"type":"object","properties":{}}},
    {"name":"bundle_analyze","description":"Analysér Next.js bundle-størrelser","input_schema":{"type":"object","properties":{}}},
    {"name":"lighthouse","description":"Kør Lighthouse analyse på en URL","input_schema":{"type":"object","properties":{"url":{"type":"string"}},"required":["url"]}},
    {"name":"git","description":"Kør en git-kommando","input_schema":{"type":"object","properties":{"command":{"type":"string"}},"required":["command"]}},
    {"name":"env_get","description":"Hent environment-variabel","input_schema":{"type":"object","properties":{"key":{"type":"string"}},"required":["key"]}},
    {"name":"env_set","description":"Sæt environment-variabel i .env.local","input_schema":{"type":"object","properties":{"key":{"type":"string"},"value":{"type":"string"}},"required":["key","value"]}},
    {"name":"env_validate","description":"Valider at alle påkrævede env vars er sat","input_schema":{"type":"object","properties":{}}},
    {"name":"env_diff","description":"Sammenlign to env-filer","input_schema":{"type":"object","properties":{"env1":{"type":"string","default":".env.example"},"env2":{"type":"string","default":".env.local"}}}},
    {"name":"inspect_headers","description":"Hent HTTP response-headers (CORS, CSP)","input_schema":{"type":"object","properties":{"url":{"type":"string"}},"required":["url"]}},
    {"name":"check_auth_bypass","description":"Forsøg auth-bypass med manipuleret payload (pentest)","input_schema":{"type":"object","properties":{"url":{"type":"string"},"payload":{"type":"string"}},"required":["url","payload"]}},
    {"name":"stripe_cli","description":"Kør Stripe CLI-kommando","input_schema":{"type":"object","properties":{"command":{"type":"string"}},"required":["command"]}},
    {"name":"generate_test_data","description":"Generer test-data baseret på Prisma-schema","input_schema":{"type":"object","properties":{"schema":{"type":"string"},"count":{"type":"integer","default":10}},"required":["schema"]}},
    {"name":"browser_screenshot","description":"Tag screenshot af en URL (kræver Playwright)","input_schema":{"type":"object","properties":{"url":{"type":"string"},"output":{"type":"string"}},"required":["url"]}},
    {"name":"browser_get_dom","description":"Hent HTML-indhold fra en URL via Playwright — returnér sidens DOM","input_schema":{"type":"object","properties":{"url":{"type":"string"},"selector":{"type":"string","default":"body"}},"required":["url"]}},
    {"name":"browser_get_console_errors","description":"Hent JS console-fejl fra en URL (kræver Playwright)","input_schema":{"type":"object","properties":{"url":{"type":"string"}},"required":["url"]}},
    {"name":"browser_get_network_requests","description":"Hent netværkskald fra en URL (kræver Playwright)","input_schema":{"type":"object","properties":{"url":{"type":"string"}},"required":["url"]}},
    {"name":"browser_screenshot_diff","description":"Sammenlign screenshot mod baseline","input_schema":{"type":"object","properties":{"url":{"type":"string"},"baseline_path":{"type":"string"}},"required":["url","baseline_path"]}},
    {"name":"accessibility_check","description":"Kør axe-core accessibility check (kræver Playwright)","input_schema":{"type":"object","properties":{"url":{"type":"string"}},"required":["url"]}},
    {"name":"vercel_deploy","description":"Deploy til Vercel","input_schema":{"type":"object","properties":{"environment":{"type":"string","enum":["staging","production"],"default":"staging"}}}},
    {"name":"vercel_logs","description":"Hent Vercel deployment-logs","input_schema":{"type":"object","properties":{"deployment_id":{"type":"string"}}}},
    {"name":"web_search","description":"Søg på nettet — til DEA-agenter der researcher juridiske krav og konkurrenter","input_schema":{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}},
    {"name":"write_finding","description":"Skriv fund til INTELLIGENCE.md rettet mod en specifik agent","input_schema":{"type":"object","properties":{"target_agent":{"type":"string"},"file":{"type":"string"},"description":{"type":"string"}},"required":["target_agent","file","description"]}},
    {"name":"write_decision","description":"Skriv arkitekturbeslutning til DECISIONS.md","input_schema":{"type":"object","properties":{"dec_id":{"type":"string"},"status":{"type":"string","enum":["PROPOSED","ACCEPTED","WONT-FIX"]},"content":{"type":"string"}},"required":["dec_id","status","content"]}},
    {"name":"update_progress","description":"Opdater PROGRESS.md med agent-fremgang","input_schema":{"type":"object","properties":{"agent_id":{"type":"string"},"task":{"type":"string"},"status":{"type":"string","enum":["STARTET","FÆRDIG","BLOKERET"]}},"required":["agent_id","task","status"]}},
    {"name":"update_intelligence","description":"Tilføj læring til INTELLIGENCE.md","input_schema":{"type":"object","properties":{"learning":{"type":"string"}},"required":["learning"]}},
    {"name":"notify","description":"Send notifikation til terminalen — brug ved sprint færdigt, kritisk blokering eller systemet færdigt","input_schema":{"type":"object","properties":{"message":{"type":"string"},"level":{"type":"string","enum":["info","success","warning","error"],"default":"info"}},"required":["message"]}},
]


def _eksekver_tool(navn: str, inp: dict) -> str:
    npx = "npx.cmd" if sys.platform == "win32" else "npx"
    npm = "npm.cmd" if sys.platform == "win32" else "npm"

    if navn == "read_file":
        p = REPO_ROOT / inp["path"]
        return p.read_text(encoding="utf-8") if p.exists() else f"[FIL IKKE FUNDET: {inp['path']}]"

    if navn == "write_file":
        p = REPO_ROOT / inp["path"]
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(inp["content"], encoding="utf-8")
        return f"✓ Skrevet: {inp['path']} ({len(inp['content'])} tegn)"

    if navn == "delete_file":
        p = REPO_ROOT / inp["path"]
        p.unlink(missing_ok=True)
        return f"✓ Slettet: {inp['path']}"

    if navn == "move_file":
        src, dst = REPO_ROOT / inp["from_path"], REPO_ROOT / inp["to_path"]
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dst))
        return f"✓ Flyttet: {inp['from_path']} → {inp['to_path']}"

    if navn == "list_files":
        p = REPO_ROOT / inp["directory"]
        if not p.exists(): return f"[MAPPE IKKE FUNDET: {inp['directory']}]"
        filer = [str(f.relative_to(REPO_ROOT)) for f in (p.rglob("*") if inp.get("recursive") else p.iterdir()) if f.is_file()]
        return "\n".join(sorted(filer)) or "[Tom]"

    if navn == "search_in_files":
        p, pat, glob = REPO_ROOT / inp["directory"], inp["pattern"], inp.get("file_glob","*")
        hits = []
        for fil in p.rglob(glob):
            if not fil.is_file(): continue
            try:
                for nr, linje in enumerate(fil.read_text(encoding="utf-8",errors="replace").splitlines(), 1):
                    if re.search(pat, linje): hits.append(f"{fil.relative_to(REPO_ROOT)}:{nr}: {linje.strip()}")
            except Exception: pass
        return "\n".join(hits[:100]) or "[Ingen match]"

    if navn == "diff_files":
        a = (REPO_ROOT/inp["path_a"]).read_text(encoding="utf-8",errors="replace").splitlines()
        b = (REPO_ROOT/inp["path_b"]).read_text(encoding="utf-8",errors="replace").splitlines()
        return "\n".join(difflib.unified_diff(a,b,fromfile=inp["path_a"],tofile=inp["path_b"],lineterm="")) or "[Ingen forskel]"

    if navn == "file_encoding_check":
        p = REPO_ROOT / inp["path"]
        problemer = [l for l in p.read_text(encoding="utf-8",errors="replace").splitlines()
                     if re.search(r'[ÆØÅæøå]', l.split("//")[0].split("@map")[0])]
        return ("PROBLEMER:\n" + "\n".join(problemer[:20])) if problemer else "✓ Ingen problemer"

    if navn == "file_encoding_fix":
        tabel = {"Æ":"AE","æ":"ae","Ø":"OE","ø":"oe","Å":"AA","å":"aa"}
        p = REPO_ROOT / inp["path"]
        linjer = []
        for l in p.read_text(encoding="utf-8").splitlines():
            s = l.strip()
            if s and not s.startswith("//") and "@map" not in l:
                token = s.split()[0]
                if re.search(r"[ÆØÅæøå]", token):
                    ascii_token = token
                    for da, en in tabel.items(): ascii_token = ascii_token.replace(da, en)
                    l = l.replace(token, f'{ascii_token}  @map("{token}")')
            linjer.append(l)
        p.write_text("\n".join(linjer), encoding="utf-8")
        return f"✓ Encoding-fix: {inp['path']}"

    if navn == "bash":
        cwd = REPO_ROOT / inp["working_dir"] if "working_dir" in inp else REPO_ROOT
        return _run(inp["command"], inp.get("timeout",300), cwd)

    if navn == "start_process":
        port = inp["port"]
        proc = subprocess.Popen(inp["command"], shell=True, cwd=REPO_ROOT,
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                text=True, stdin=subprocess.DEVNULL)
        _processer[port] = proc
        _process_logs[port] = []
        t = threading.Thread(target=_log_reader, args=(proc, port), daemon=True)
        t.start()
        return f"✓ Startet port {port} (PID {proc.pid})"

    if navn == "stop_process":
        proc = _processer.pop(inp["port"], None)
        _process_logs.pop(inp["port"], None)
        if proc:
            proc.terminate()
            try: proc.wait(timeout=10)
            except subprocess.TimeoutExpired: proc.kill()
            return f"✓ Stoppet port {inp['port']}"
        return f"[Ingen proces på port {inp['port']}]"

    if navn == "wait_for_port":
        import time
        for i in range(inp.get("timeout",90)):
            try:
                urllib.request.urlopen(f"http://localhost:{inp['port']}/", timeout=2)
                return f"✓ Port {inp['port']} klar efter {i+1}s"
            except urllib.error.HTTPError:
                return f"✓ Port {inp['port']} klar efter {i+1}s"
            except Exception: time.sleep(1)
        return f"[TIMEOUT: port {inp['port']}]"

    if navn == "read_process_logs":
        port = inp["port"]
        if port not in _processer:
            return f"[Ingen proces på port {port}]"
        logs = _process_logs.get(port, [])
        return "\n".join(logs[-100:]) or "[Ingen nye linjer]"

    if navn == "process_list":
        return "\n".join(f"Port {p}: PID {pr.pid} ({'kørende' if pr.poll() is None else 'stoppet'})"
                         for p, pr in _processer.items()) or "[Ingen aktive processer]"

    if navn == "http_session":
        import http.cookiejar
        _http_sessioner[inp["name"]] = http.cookiejar.CookieJar()
        return f"✓ Session '{inp['name']}' oprettet"

    if navn == "http_request":
        body = inp["body"].encode("utf-8") if inp.get("body") else None
        req  = urllib.request.Request(inp["url"], data=body, method=inp.get("method","GET"))
        for k,v in (inp.get("headers") or {}).items(): req.add_header(k,v)
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return f"Status: {r.status}\n{r.read(4096).decode('utf-8',errors='replace')}"
        except urllib.error.HTTPError as e:
            return f"Status: {e.code}\n{e.read(2048).decode('utf-8',errors='replace')}"
        except Exception as e: return f"[FEJL: {e}]"

    if navn == "db_query":
        db = os.getenv("DATABASE_URL","")
        return _run(f'psql "{db}" -c "{inp["sql"].replace(chr(34), chr(39))}"') if db else "[DATABASE_URL ikke sat]"

    if navn == "db_prisma":
        return _run(f"{npx} prisma {inp['command']}", timeout=120)

    if navn == "typescript_check":
        return _run(f"{npx} tsc --noEmit {inp.get('path','')}", timeout=120)

    if navn == "lint":
        return _run(f"{npx} eslint {inp.get('path','.')}", timeout=120)

    if navn == "test_run":
        pat = inp.get("pattern","")
        rep = inp.get("reporter","verbose")
        return _run(f"{npx} vitest run {pat} --reporter={rep}", timeout=300)

    if navn == "test_coverage":
        return _run(f"{npx} vitest run --coverage", timeout=300)

    if navn == "npm_audit":
        return _run(f"{npm} audit", timeout=60)

    if navn == "bundle_analyze":
        return _run("ANALYZE=true npx next build", timeout=300)

    if navn == "lighthouse":
        return _run(f"{npx} lighthouse {inp['url']} --output=json --quiet", timeout=120)

    if navn == "git":
        return _run(f"git {inp['command']}", timeout=60)

    if navn == "env_get":
        return os.getenv(inp["key"], f"[{inp['key']} ikke sat]")

    if navn == "env_set":
        p = REPO_ROOT / ".env.local"
        linjer = p.read_text(encoding="utf-8").splitlines() if p.exists() else []
        opdateret = False
        for i, l in enumerate(linjer):
            if l.startswith(f"{inp['key']}="):
                linjer[i] = f"{inp['key']}={inp['value']}"; opdateret = True; break
        if not opdateret: linjer.append(f"{inp['key']}={inp['value']}")
        p.write_text("\n".join(linjer)+"\n", encoding="utf-8")
        return f"✓ {inp['key']} sat i .env.local"

    if navn == "env_validate":
        ex = REPO_ROOT / ".env.example"
        if not ex.exists(): return "[.env.example ikke fundet]"
        krav = [l.split("=")[0].strip() for l in ex.read_text(encoding="utf-8").splitlines()
                if l.strip() and not l.startswith("#") and "=" in l]
        mangler = [k for k in krav if not os.getenv(k)]
        return ("MANGLER:\n" + "\n".join(f"  - {k}" for k in mangler)) if mangler else f"✓ Alle {len(krav)} vars sat"

    if navn == "env_diff":
        f1 = (REPO_ROOT/inp.get("env1",".env.example")).read_text(encoding="utf-8",errors="replace").splitlines()
        f2 = (REPO_ROOT/inp.get("env2",".env.local")).read_text(encoding="utf-8",errors="replace").splitlines()
        return "\n".join(difflib.unified_diff(f1,f2,lineterm="")) or "[Ingen forskel]"

    if navn == "inspect_headers":
        try:
            with urllib.request.urlopen(urllib.request.Request(inp["url"]), timeout=10) as r:
                return "\n".join(f"{k}: {v}" for k,v in r.headers.items())
        except urllib.error.HTTPError as e:
            return "\n".join(f"{k}: {v}" for k,v in e.headers.items())
        except Exception as e: return f"[FEJL: {e}]"

    if navn == "check_auth_bypass":
        req = urllib.request.Request(inp["url"], data=inp["payload"].encode(),
                                     method="POST", headers={"Content-Type":"application/json"})
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return f"Status: {r.status}\n{r.read(2048).decode('utf-8',errors='replace')}"
        except urllib.error.HTTPError as e:
            return f"Status: {e.code}\n{e.read(1024).decode('utf-8',errors='replace')}"
        except Exception as e: return f"[FEJL: {e}]"

    if navn == "stripe_cli":
        return _run(f"stripe {inp['command']}", timeout=60)

    if navn == "generate_test_data":
        return _run(f"{npx} ts-node scripts/generate-test-data.ts {inp['schema']} {inp.get('count',10)}", timeout=60)

    if navn == "browser_screenshot":
        out = inp.get("output","screenshot.png")
        return _run(f"{npx} playwright screenshot {inp['url']} {out}", timeout=60)

    if navn == "browser_get_dom":
        selector = inp.get("selector", "body")
        script = f"""
const {{ chromium }} = require('playwright');
(async () => {{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('{inp["url"]}', {{ waitUntil: 'networkidle', timeout: 30000 }});
  const el = await page.$('{selector}');
  if (el) {{
    const html = await el.innerHTML();
    console.log(html.substring(0, 8000));
  }} else {{
    console.log('[SELECTOR IKKE FUNDET: {selector}]');
  }}
  await browser.close();
}})();
""".strip()
        return _run(f'node -e "{script}"', timeout=60)

    if navn == "browser_get_console_errors":
        script = f"""
const {{ chromium }} = require('playwright');
(async () => {{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => {{ if (msg.type() === 'error') errors.push(msg.text()); }});
  page.on('pageerror', err => errors.push(err.message));
  await page.goto('{inp["url"]}', {{ waitUntil: 'networkidle', timeout: 30000 }});
  console.log(errors.length ? errors.join('\\n') : '[Ingen console-fejl]');
  await browser.close();
}})();
""".strip()
        return _run(f'node -e "{script}"', timeout=60)

    if navn == "browser_get_network_requests":
        script = f"""
const {{ chromium }} = require('playwright');
(async () => {{
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const reqs = [];
  page.on('request', r => reqs.push(r.method() + ' ' + r.url()));
  await page.goto('{inp["url"]}', {{ waitUntil: 'networkidle', timeout: 30000 }});
  console.log(reqs.join('\\n'));
  await browser.close();
}})();
""".strip()
        return _run(f'node -e "{script}"', timeout=60)

    if navn == "browser_screenshot_diff":
        return _run(f"npx pixelmatch {inp['baseline_path']} {inp['url']}", timeout=30)

    if navn == "accessibility_check":
        return _run(f"{npx} axe {inp['url']}", timeout=60)

    if navn == "vercel_deploy":
        flag = "--prod" if inp.get("environment") == "production" else ""
        return _run(f"vercel deploy {flag}", timeout=300)

    if navn == "vercel_logs":
        return _run(f"vercel logs {inp.get('deployment_id','')}", timeout=60)

    if navn == "web_search":
        q = urllib.parse.quote(inp["query"])
        try:
            with urllib.request.urlopen(f"https://api.duckduckgo.com/?q={q}&format=json&no_html=1", timeout=10) as r:
                d = json.loads(r.read().decode("utf-8"))
                hits = [f"- {t.get('Text','')}: {t.get('FirstURL','')}" for t in d.get("RelatedTopics",[])[:5] if t.get("Text")]
                return "\n".join(hits) or d.get("AbstractText","[Ingen resultater]")
        except Exception as e: return f"[Søgefejl: {e}]"

    if navn == "write_finding":
        nu = datetime.now().strftime("%Y-%m-%d %H:%M")
        _tilfoej(REPO_ROOT/"docs/build/INTELLIGENCE.md",
                 f"\n## [{nu}] FINDING → {inp['target_agent']}\nFil: {inp['file']}\n{inp['description']}\n")
        return f"✓ Finding → {inp['target_agent']}"

    if navn == "write_decision":
        nu = datetime.now().strftime("%Y-%m-%d")
        _tilfoej(REPO_ROOT/"docs/status/DECISIONS.md",
                 f"\n## {inp['dec_id']}\n**Status:** {inp['status']}\n**Dato:** {nu}\n{inp['content']}\n")
        return f"✓ {inp['dec_id']} ({inp['status']})"

    if navn == "update_progress":
        nu = datetime.now().strftime("%Y-%m-%d %H:%M")
        _tilfoej(REPO_ROOT/"docs/status/PROGRESS.md",
                 f"\n[{nu}] {inp['agent_id']} — {inp['task']}: {inp['status']}\n")
        return f"✓ PROGRESS.md opdateret"

    if navn == "update_intelligence":
        nu = datetime.now().strftime("%Y-%m-%d %H:%M")
        _tilfoej(REPO_ROOT/"docs/build/INTELLIGENCE.md", f"\n## [{nu}]\n{inp['learning']}\n")
        return "✓ INTELLIGENCE.md opdateret"

    if navn == "notify":
        ikoner = {"info":"ℹ️","success":"✅","warning":"⚠️","error":"❌"}
        ikon   = ikoner.get(inp.get("level","info"), "ℹ️")
        print(f"\n{'='*60}\n{ikon} {inp['message']}\n{'='*60}\n", flush=True)
        return "✓ Notifikation sendt"

    return f"[UKENDT TOOL: {navn}]"


# ── Hoved-loop ─────────────────────────────────────────────────────────────────

def main():
    import argparse
    p = argparse.ArgumentParser(description="ChainHub MABS — start-knap")
    p.add_argument("--dry-run", action="store_true", help="Vis kontekst og afslut uden API-kald")
    args = p.parse_args()

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        log("ANTHROPIC_API_KEY ikke fundet"); sys.exit(1)

    system_prompt = byg_system_prompt()
    kontekst      = byg_kontekst()

    if args.dry_run:
        print(f"System prompt: {len(system_prompt)} tegn")
        print(f"Kontekst: {len(kontekst)} tegn fra {len(KONTEKST_FILER)} filer")
        est_tokens = (len(system_prompt) + len(kontekst)) // 3.5
        print(f"Estimeret tokens: ~{int(est_tokens):,} (af 200K window)")
        print(f"Ledig til tool-kald: ~{int(200_000 - est_tokens - MAX_TOKENS):,} tokens")
        print("[--dry-run: afslutter]")
        return

    klient   = anthropic.Anthropic(api_key=api_key)
    beskeder = [{"role": "user", "content": kontekst}]

    log(f"=== CHAINHUB MABS START | Model: {MODEL} | Tools: {len(TOOLS)} ===")
    log(f"    Kontekst: {len(kontekst):,} tegn | Max context: {MAX_CONTEXT_CHARS:,} tegn")

    while True:
        beskeder = _trim_beskeder(beskeder)

        output       = ""
        tool_kald    = []
        aktuel_tool  = None

        try:
            with klient.messages.stream(
                model=MODEL, max_tokens=MAX_TOKENS,
                system=system_prompt, tools=TOOLS, messages=beskeder
            ) as stream:
                for event in stream:
                    if not hasattr(event, "type"): continue
                    if event.type == "content_block_start":
                        if getattr(getattr(event, "content_block", None), "type", None) == "tool_use":
                            cb = event.content_block
                            aktuel_tool = {"id": cb.id, "name": cb.name, "input": ""}
                    elif event.type == "content_block_delta":
                        if hasattr(event.delta, "text"):
                            print(event.delta.text, end="", flush=True)
                            output += event.delta.text
                        elif hasattr(event.delta, "partial_json") and aktuel_tool:
                            aktuel_tool["input"] += event.delta.partial_json
                    elif event.type == "content_block_stop" and aktuel_tool:
                        try: aktuel_tool["input"] = json.loads(aktuel_tool["input"] or "{}")
                        except json.JSONDecodeError: aktuel_tool["input"] = {}
                        tool_kald.append(aktuel_tool)
                        aktuel_tool = None

        except anthropic.APIError as e:
            log(f"❌ API-FEJL: {e}")
            if "context_length" in str(e).lower() or "too many tokens" in str(e).lower():
                log("⚡ Context window overskredet — trimmer aggressivt og genprøver")
                beskeder = [beskeder[0]] + beskeder[-6:]
                continue
            raise

        print(flush=True)
        beskeder.append({"role": "assistant", "content": stream.get_final_message().content})

        if not tool_kald:
            log("=== MABS AFSLUTTET ===")
            break

        resultater = []
        for kald in tool_kald:
            log(f"→ {kald['name']}({json.dumps(kald['input'])[:120]})")
            res = _eksekver_tool(kald["name"], kald["input"])
            res = _truncer_tool_result(str(res))
            log(f"← {str(res)[:200]}")
            resultater.append({"type":"tool_result","tool_use_id":kald["id"],"content":res})

        beskeder.append({"role": "user", "content": resultater})

        total_chars = _estimer_besked_chars(beskeder)
        if total_chars > MAX_CONTEXT_CHARS * 0.7:
            log(f"⚠️  Context: {total_chars:,}/{MAX_CONTEXT_CHARS:,} tegn ({total_chars*100//MAX_CONTEXT_CHARS}%)")


if __name__ == "__main__":
    main()
