import { z } from 'zod'
import type {
  SagsType,
  SagsSubtype,
  CaseStatus,
  ContractStatus,
  ContractSystemType,
  TaskStatus,
  Prioritet,
  VisitType,
  VisitStatus,
  MetricType,
  PeriodType,
  MetricSource,
  ChangeType,
  SensitivityLevel,
} from '@prisma/client'

/**
 * Zod-schemaer der matcher Prisma-enums eksakt.
 *
 * Kilde til sandhed: `prisma/schema.prisma`.
 *
 * Hver eksport bruger `satisfies z.ZodType<PrismaEnum>` så TypeScript
 * fejler ved compile hvis en værdi mangler eller er forkert stavet.
 * Dette er broen mellem Zod-validering (som producerer `string`) og
 * Prisma-klientens enum-typer (som er typesikre literal-unions) og
 * gør det muligt at fjerne `as never`-casts i action-filer.
 */

// --- Sager (cases) -------------------------------------------------

export const zodCaseType = z.enum([
  'TRANSAKTION',
  'TVIST',
  'COMPLIANCE',
  'KONTRAKT',
  'GOVERNANCE',
  'ANDET',
]) satisfies z.ZodType<SagsType>

export const zodCaseSubtype = z.enum([
  'VIRKSOMHEDSKOEB',
  'VIRKSOMHEDSSALG',
  'FUSION',
  'OMSTRUKTURERING',
  'STIFTELSE',
  'RETSSAG',
  'VOLDGIFT',
  'FORHANDLING_MED_MODPART',
  'INKASSO',
  'GDPR',
  'ARBEJDSMILJOE',
  'MYNDIGHEDSPAABUD',
  'SKATTEMASSIG',
  'FORHANDLING',
  'OPSIGELSE',
  'FORNYELSE',
  'MISLIGHOLDELSE',
  'GENERALFORSAMLING',
  'BESTYRELSESMOEDE',
  'VEDTAEGTSAENDRING',
  'DIREKTOERSKIFTE',
]) satisfies z.ZodType<SagsSubtype>

export const zodCaseStatus = z.enum([
  'NY',
  'AKTIV',
  'AFVENTER_EKSTERN',
  'AFVENTER_KLIENT',
  'LUKKET',
  'ARKIVERET',
]) satisfies z.ZodType<CaseStatus>

// --- Kontrakter ----------------------------------------------------

export const zodContractStatus = z.enum([
  'UDKAST',
  'TIL_REVIEW',
  'TIL_UNDERSKRIFT',
  'AKTIV',
  'UDLOEBET',
  'OPSAGT',
  'FORNYET',
  'ARKIVERET',
]) satisfies z.ZodType<ContractStatus>

export const zodContractSystemType = z.enum([
  'EJERAFTALE',
  'DIREKTOERKONTRAKT',
  'OVERDRAGELSESAFTALE',
  'AKTIONAERLAAN',
  'PANTSAETNING',
  'VEDTAEGTER',
  'ANSAETTELSE_FUNKTIONAER',
  'ANSAETTELSE_IKKE_FUNKTIONAER',
  'VIKARAFTALE',
  'UDDANNELSESAFTALE',
  'FRATRAEDELSESAFTALE',
  'KONKURRENCEKLAUSUL',
  'PERSONALHAANDBOG',
  'LEJEKONTRAKT_ERHVERV',
  'LEASINGAFTALE',
  'LEVERANDOERKONTRAKT',
  'SAMARBEJDSAFTALE',
  'NDA',
  'IT_SYSTEMAFTALE',
  'DBA',
  'FORSIKRING',
  'GF_REFERAT',
  'BESTYRELSESREFERAT',
  'FORRETNINGSORDEN',
  'DIREKTIONSINSTRUKS',
  'VOA',
  'INTERN_SERVICEAFTALE',
  'ROYALTY_LICENS',
  'OPTIONSAFTALE',
  'TILTRAEDELSESDOKUMENT',
  'KASSEKREDIT',
  'CASH_POOL',
  'INTERCOMPANY_LAAN',
  'SELSKABSGARANTI',
]) satisfies z.ZodType<ContractSystemType>

export const zodChangeType = z.enum([
  'REDAKTIONEL',
  'MATERIEL',
  'ALLONGE',
  'NY_VERSION',
]) satisfies z.ZodType<ChangeType>

// --- Opgaver (tasks) -----------------------------------------------

export const zodTaskStatus = z.enum([
  'NY',
  'AKTIV_TASK',
  'AFVENTER',
  'LUKKET',
]) satisfies z.ZodType<TaskStatus>

export const zodTaskPriority = z.enum([
  'LAV',
  'MELLEM',
  'HOEJ',
  'KRITISK',
]) satisfies z.ZodType<Prioritet>

// --- Besøg ---------------------------------------------------------

export const zodVisitType = z.enum([
  'KVARTALSBESOEG',
  'OPFOELGNING',
  'AD_HOC',
  'AUDIT',
  'ONBOARDING',
  'OVERDRAGELSE',
]) satisfies z.ZodType<VisitType>

export const zodVisitStatus = z.enum([
  'PLANLAGT',
  'GENNEMFOERT',
  'AFLYST',
]) satisfies z.ZodType<VisitStatus>

// --- Økonomi -------------------------------------------------------

export const zodMetricType = z.enum([
  'OMSAETNING',
  'EBITDA',
  'RESULTAT',
  'LIKVIDITET',
  'EGENKAPITAL',
  'ANDET_METRIC',
]) satisfies z.ZodType<MetricType>

export const zodPeriodType = z.enum([
  'HELAAR',
  'H1',
  'H2',
  'Q1',
  'Q2',
  'Q3',
  'Q4',
  'MAANED',
]) satisfies z.ZodType<PeriodType>

export const zodMetricSource = z.enum([
  'REVIDERET',
  'UREVIDERET',
  'ESTIMAT',
]) satisfies z.ZodType<MetricSource>

// --- Sensitivity ---------------------------------------------------

export const zodSensitivityLevel = z.enum([
  'PUBLIC',
  'STANDARD',
  'INTERN',
  'FORTROLIG',
  'STRENGT_FORTROLIG',
]) satisfies z.ZodType<SensitivityLevel>
