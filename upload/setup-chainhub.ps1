# ============================================================
# ChainHub — Repo-setup script (PowerShell)
# Kør fra chainhub-mappen:
#   .\setup-chainhub.ps1
# eller med eksplicit kildemappe:
#   .\setup-chainhub.ps1 -Kilde .\upload
# ============================================================

param(
    [string]$Kilde = ".\upload"
)

Write-Host "🔧 Opretter ChainHub repo-struktur..." -ForegroundColor Cyan

# ------------------------------------------------------------
# 1. Mappestruktur
# ------------------------------------------------------------
$mapper = @(
    "docs\spec",
    "docs\build",
    "docs\status",
    "docs\ops",
    "src\app\(auth)",
    "src\app\(dashboard)",
    "src\components\ui",
    "src\components\layout",
    "src\lib\auth",
    "src\lib\db",
    "src\lib\permissions",
    "src\lib\validations",
    "src\lib\utils",
    "src\actions",
    "src\hooks",
    "src\types",
    "prisma\migrations",
    "e2e"
)

foreach ($mappe in $mapper) {
    New-Item -ItemType Directory -Path $mappe -Force | Out-Null
}

Write-Host "✓ Mappestruktur oprettet" -ForegroundColor Green

# ------------------------------------------------------------
# 2. Kopiér MD-filer
# ------------------------------------------------------------
if (Test-Path $Kilde) {

    $specFiler = @(
        "kravspec-legalhub.md",
        "DATABASE-SCHEMA.md",
        "CONTRACT-TYPES.md",
        "roller-og-tilladelser.md",
        "UI-FLOWS.md",
        "API-SPEC.md"
    )

    $buildFiler = @(
        "AGENT-ARCHITECTURE.md",
        "AGENT-ROSTER.md",
        "SPRINT-PLAN.md",
        "CONVENTIONS.md",
        "DEA-PROMPTS.md",
        "PROJEKT-PROMPTS.md"
    )

    $statusFiler = @(
        "DECISIONS.md",
        "PROGRESS.md"
    )

    foreach ($fil in $specFiler) {
        $sti = Join-Path $Kilde $fil
        if (Test-Path $sti) {
            Copy-Item $sti "docs\spec\" -Force
            Write-Host "  ✓ docs\spec\$fil" -ForegroundColor Gray
        } else {
            Write-Host "  ⚠ Mangler: $fil" -ForegroundColor Yellow
        }
    }

    foreach ($fil in $buildFiler) {
        $sti = Join-Path $Kilde $fil
        if (Test-Path $sti) {
            Copy-Item $sti "docs\build\" -Force
            Write-Host "  ✓ docs\build\$fil" -ForegroundColor Gray
        } else {
            Write-Host "  ⚠ Mangler: $fil" -ForegroundColor Yellow
        }
    }

    foreach ($fil in $statusFiler) {
        $sti = Join-Path $Kilde $fil
        if (Test-Path $sti) {
            Copy-Item $sti "docs\status\" -Force
            Write-Host "  ✓ docs\status\$fil" -ForegroundColor Gray
        } else {
            Write-Host "  ⚠ Mangler: $fil" -ForegroundColor Yellow
        }
    }

    Write-Host "✓ MD-filer kopieret" -ForegroundColor Green

} else {
    Write-Host "⚠️  Kildemappe '$Kilde' ikke fundet" -ForegroundColor Yellow
    Write-Host "   Opret mappen 'upload' og læg dine MD-filer deri" -ForegroundColor Yellow
}

# ------------------------------------------------------------
# 3. BLOCKERS.md
# ------------------------------------------------------------
@"
# BLOCKERS.md
# ChainHub — Aktive blokkere
**Opdateres af:** BA-01 (Orchestrator) løbende
**Format:** Se skabelon nedenfor

---

## Skabelon

``````
## BLK-[NR]: [Beskrivelse]
**Oprettet:** [dato]
**Af:** [agent]
**Blokerer:** [hvad der ikke kan fortsætte]
**Afhænger af:** [hvem/hvad der skal løse det]
**Status:** ÅBEN / LØST
``````

---

## Aktive blokkere

*(Ingen endnu)*
"@ | Set-Content "docs\status\BLOCKERS.md" -Encoding UTF8

Write-Host "✓ BLOCKERS.md oprettet" -ForegroundColor Green

# ------------------------------------------------------------
# 4. RUNBOOK.md (tom stub)
# ------------------------------------------------------------
@"
# RUNBOOK.md
# ChainHub — Driftsvejledning
**Oprettes af:** BA-08 (DevOps-agent) i Sprint 6
**Status:** Ikke påbegyndt
"@ | Set-Content "docs\ops\RUNBOOK.md" -Encoding UTF8

Write-Host "✓ RUNBOOK.md oprettet" -ForegroundColor Green

# ------------------------------------------------------------
# 5. .env.example
# ------------------------------------------------------------
@"
# ============================================================
# ChainHub — Environment variables
# Kopiér til .env.local og udfyld værdier
# ALDRIG commit .env.local til git
# ============================================================

# Database
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/chainhub"

# NextAuth
NEXTAUTH_SECRET="minimum-32-tegn-random-string"
NEXTAUTH_URL="http://localhost:3000"

# Microsoft OAuth (Azure AD)
MICROSOFT_CLIENT_ID=""
MICROSOFT_CLIENT_SECRET=""
MICROSOFT_TENANT_ID=""

# Stripe
STRIPE_SECRET_KEY=""
STRIPE_PUBLISHABLE_KEY=""
STRIPE_WEBHOOK_SECRET=""
# OBS: Webhook URL skal bruge www-prefix i Stripe dashboard
# Korrekt: https://www.chainhub.dk/api/webhooks/stripe
# Forkert:  https://chainhub.dk/api/webhooks/stripe

# Storage (Cloudflare R2)
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME=""
R2_PUBLIC_URL=""

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
"@ | Set-Content ".env.example" -Encoding UTF8

Write-Host "✓ .env.example oprettet" -ForegroundColor Green

# ------------------------------------------------------------
# 6. .gitignore
# ------------------------------------------------------------
@"
# Dependencies
node_modules/
.pnp
.pnp.js

# Next.js
.next/
out/
build/

# Environment
.env
.env.local
.env.*.local

# Prisma
prisma/dev.db
prisma/dev.db-journal

# Misc
.DS_Store
*.pem
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Testing
coverage/
playwright-report/
test-results/
"@ | Set-Content ".gitignore" -Encoding UTF8

Write-Host "✓ .gitignore oprettet" -ForegroundColor Green

# ------------------------------------------------------------
# 7. prisma/schema.prisma (stub)
# ------------------------------------------------------------
@"
// ChainHub — Prisma Schema
// Udfyldes af BA-02 (Schema-agent)
// Kilde: /docs/spec/DATABASE-SCHEMA.md v0.3
// MÅ IKKE redigeres manuelt — brug BA-02 via Claude Code

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Enums og modeller tilføjes af BA-02
"@ | Set-Content "prisma\schema.prisma" -Encoding UTF8

Write-Host "✓ prisma/schema.prisma oprettet" -ForegroundColor Green

# ------------------------------------------------------------
# Færdig
# ------------------------------------------------------------
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "✅ ChainHub repo-struktur klar" -ForegroundColor Green
Write-Host ""
Write-Host "Næste skridt:" -ForegroundColor White
Write-Host "  1. git init" -ForegroundColor Gray
Write-Host "     git add ." -ForegroundColor Gray
Write-Host "     git commit -m 'chore: initial repo structure'" -ForegroundColor Gray
Write-Host "  2. Åbn Claude Code i denne mappe" -ForegroundColor Gray
Write-Host "  3. Paste master-prompten fra docs\build\DEA-PROMPTS.md" -ForegroundColor Gray
Write-Host "     (sektionen 'Master-prompt — autonom DEA-challenge-runde')" -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Cyan
