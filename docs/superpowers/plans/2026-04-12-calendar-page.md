# Calendar Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan.

**Goal:** Byg /calendar side der aggregerer kontrakt-udløb, opgaver, besøg, sager og fornyelser. Fix de to døde links.

**Architecture:** Server action aggregerer 5 datakilder → CalendarEvent[]. Client component med månedsvisning + dag-panel. Deep linking via query params.

**Tech Stack:** Next.js 14 Server Actions, React 18, Tailwind, Prisma

---

### Task 1: Calendar Server Action

**Files:**
- Create: `src/actions/calendar.ts`

### Task 2: Calendar Page + Loading

**Files:**
- Create: `src/app/(dashboard)/calendar/page.tsx`
- Create: `src/app/(dashboard)/calendar/loading.tsx`

### Task 3: Full Calendar Client Component

**Files:**
- Create: `src/components/calendar/full-calendar.tsx`

### Task 4: Wire Dashboard Widget

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

### Task 5: Verification

**Files:**
- All above
