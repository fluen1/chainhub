-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SensitivityLevel" AS ENUM ('PUBLIC', 'STANDARD', 'INTERN', 'FORTROLIG', 'STRENGT_FORTROLIG');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('UDKAST', 'TIL_REVIEW', 'TIL_UNDERSKRIFT', 'AKTIV', 'UDLOBET', 'OPSAGT', 'FORNYET', 'ARKIVERET');

-- CreateEnum
CREATE TYPE "ContractSystemType" AS ENUM ('EJERAFTALE', 'DIREKTOERKONTRAKT', 'OVERDRAGELSESAFTALE', 'AKTIONAERLAAN', 'PANTSAETNING', 'VEDTAEGTER', 'ANSAETTELSE_FUNKTIONAER', 'ANSAETTELSE_IKKE_FUNKTIONAER', 'VIKARAFTALE', 'UDDANNELSESAFTALE', 'FRATRAEDELSESAFTALE', 'KONKURRENCEKLAUSUL', 'PERSONALHAANDBOG', 'LEJEKONTRAKT_ERHVERV', 'LEASINGAFTALE', 'LEVERANDOERKONTRAKT', 'SAMARBEJDSAFTALE', 'NDA', 'IT_SYSTEMAFTALE', 'DBA', 'FORSIKRING', 'GF_REFERAT', 'BESTYRELSESREFERAT', 'FORRETNINGSORDEN', 'DIREKTIONSINSTRUKS', 'VOA', 'INTERN_SERVICEAFTALE', 'ROYALTY_LICENS', 'OPTIONSAFTALE', 'TILTRAEDELSESDOKUMENT', 'KASSEKREDIT', 'CASH_POOL', 'INTERCOMPANY_LAAN', 'SELSKABSGARANTI');

-- CreateEnum
CREATE TYPE "DeadlineType" AS ENUM ('ABSOLUT', 'OPERATIONEL', 'INGEN');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('GROUP_OWNER', 'GROUP_ADMIN', 'GROUP_LEGAL', 'GROUP_FINANCE', 'GROUP_READONLY', 'COMPANY_MANAGER', 'COMPANY_LEGAL', 'COMPANY_READONLY');

-- CreateEnum
CREATE TYPE "UserScope" AS ENUM ('ALL', 'ASSIGNED', 'OWN');

-- CreateEnum
CREATE TYPE "SagsType" AS ENUM ('TRANSAKTION', 'TVIST', 'COMPLIANCE', 'KONTRAKT', 'GOVERNANCE', 'ANDET');

-- CreateEnum
CREATE TYPE "SagsSubtype" AS ENUM ('VIRKSOMHEDSKOEB', 'VIRKSOMHEDSSALG', 'FUSION', 'OMSTRUKTURERING', 'STIFTELSE', 'RETSSAG', 'VOLDGIFT', 'FORHANDLING_MED_MODPART', 'INKASSO', 'GDPR', 'ARBEJDSMILJOE', 'MYNDIGHEDSPAABUD', 'SKATTEMASSIG', 'FORHANDLING', 'OPSIGELSE', 'FORNYELSE', 'MISLIGHOLDELSE', 'GENERALFORSAMLING', 'BESTYRELSESMOEDE', 'VEDTAEGTSAENDRING', 'DIREKTOERSKIFTE');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('NY', 'AKTIV', 'AFVENTER_EKSTERN', 'AFVENTER_KLIENT', 'LUKKET', 'ARKIVERET');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('NY', 'AKTIV', 'AFVENTER', 'LUKKET');

-- CreateEnum
CREATE TYPE "TaskHistoryField" AS ENUM ('STATUS', 'PRIORITY', 'ASSIGNEE', 'DUE_DATE', 'TITLE', 'DESCRIPTION');

-- CreateEnum
CREATE TYPE "VersionSource" AS ENUM ('BRANCHESTANDARD', 'INTERNT', 'EKSTERNT_STANDARD', 'CUSTOM');

-- CreateEnum
CREATE TYPE "LeaseType" AS ENUM ('FINANSIEL', 'OPERATIONEL');

-- CreateEnum
CREATE TYPE "NdaType" AS ENUM ('GENSIDIG', 'ENSIDIG');

-- CreateEnum
CREATE TYPE "InsuranceType" AS ENUM ('ERHVERVSANSVAR', 'ARBEJDSSKADE', 'TINGSFORSIKRING', 'LEDELSESANSVAR', 'ANDET');

-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('ORDINAER', 'EKSTRAORDINAER');

-- CreateEnum
CREATE TYPE "OptionType" AS ENUM ('CALL', 'PUT', 'BOTH');

-- CreateEnum
CREATE TYPE "GuaranteeType" AS ENUM ('SELVSKYLDNER', 'SIMPEL');

-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('OMSAETNING', 'EBITDA', 'RESULTAT', 'LIKVIDITET', 'EGENKAPITAL', 'ANDET');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('HELAAR', 'H1', 'H2', 'Q1', 'Q2', 'Q3', 'Q4', 'MAANED');

-- CreateEnum
CREATE TYPE "MetricSource" AS ENUM ('REVIDERET', 'UREVIDERET', 'ESTIMAT');

-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('REDAKTIONEL', 'MATERIEL', 'ALLONGE', 'NY_VERSION');

-- CreateEnum
CREATE TYPE "TpMethod" AS ENUM ('CUP', 'COST_PLUS', 'TNMM', 'PROFIT_SPLIT', 'ANDET');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('REGULERER', 'KRAEVER', 'UDLOESER', 'SUPPLERER', 'SIKRER');

-- CreateEnum
CREATE TYPE "AktivitetsEntitet" AS ENUM ('SELSKAB', 'KONTRAKT', 'SAG', 'OPGAVE', 'PERSON', 'DOKUMENT');

-- CreateEnum
CREATE TYPE "AktivitetsHandling" AS ENUM ('OPRETTET', 'OPDATERET', 'STATUS_AENDRET', 'SLETTET', 'TILGAAET', 'DOWNLOADET');

-- CreateEnum
CREATE TYPE "Prioritet" AS ENUM ('LAV', 'MELLEM', 'HOEJ', 'KRITISK');

-- CreateEnum
CREATE TYPE "AIMode" AS ENUM ('OFF', 'SHADOW', 'BETA', 'LIVE');

-- CreateEnum
CREATE TYPE "alert_severity" AS ENUM ('CRITICAL', 'WARNING', 'INFO');

-- CreateEnum
CREATE TYPE "alert_category" AS ENUM ('DEADLINE', 'MISSING', 'RISK', 'COMPLIANCE');

-- CreateEnum
CREATE TYPE "document_status" AS ENUM ('KLADDE', 'TIL_REVIEW', 'GODKENDT', 'AFVIST');

-- CreateEnum
CREATE TYPE "VisitType" AS ENUM ('KVARTALSBESOEG', 'OPFOELGNING', 'AD_HOC', 'AUDIT', 'ONBOARDING', 'OVERDRAGELSE');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('PLANLAGT', 'GENNEMFOERT', 'AFLYST');

-- CreateEnum
CREATE TYPE "message_role" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "pending_action_status" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cvr" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'trial',
    "plan_expires_at" TIMESTAMP(3),
    "chain_structure" BOOLEAN NOT NULL DEFAULT false,
    "industry" TEXT,
    "estimated_locations" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT,
    "avatar_url" TEXT,
    "microsoft_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRoleAssignment" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "scope" "UserScope" NOT NULL,
    "company_ids" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cvr" TEXT,
    "company_type" TEXT,
    "address" TEXT,
    "city" TEXT,
    "postal_code" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "founded_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'aktiv',
    "parent_company_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_notes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "company_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ownership" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "owner_person_id" TEXT,
    "owner_company_id" TEXT,
    "ownership_pct" DECIMAL(5,2) NOT NULL,
    "share_class" TEXT,
    "effective_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "contract_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Ownership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "microsoft_contact_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyPerson" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "employment_type" TEXT,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "anciennity_start" TIMESTAMP(3),
    "contract_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "CompanyPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "system_type" "ContractSystemType" NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'UDKAST',
    "sensitivity" "SensitivityLevel" NOT NULL DEFAULT 'STANDARD',
    "deadline_type" "DeadlineType" NOT NULL DEFAULT 'INGEN',
    "version_source" "VersionSource" NOT NULL DEFAULT 'CUSTOM',
    "collective_agreement" TEXT,
    "parent_contract_id" TEXT,
    "triggered_by_id" TEXT,
    "effective_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "signed_date" TIMESTAMP(3),
    "notice_period_days" INTEGER,
    "termination_date" TIMESTAMP(3),
    "anciennity_start" TIMESTAMP(3),
    "reminder_90_days" BOOLEAN NOT NULL DEFAULT true,
    "reminder_30_days" BOOLEAN NOT NULL DEFAULT true,
    "reminder_7_days" BOOLEAN NOT NULL DEFAULT true,
    "reminder_recipients" TEXT[],
    "must_retain_until" TIMESTAMP(3),
    "type_data" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "last_viewed_at" TIMESTAMP(3),
    "last_viewed_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractParty" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "person_id" TEXT,
    "is_signer" BOOLEAN NOT NULL DEFAULT false,
    "counterparty_name" TEXT,
    "role_in_contract" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractVersion" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "change_type" "ChangeType" NOT NULL DEFAULT 'NY_VERSION',
    "change_note" TEXT,
    "amends_clause" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ContractVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractAttachment" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "description" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ContractAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractRelation" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "from_contract_id" TEXT NOT NULL,
    "to_contract_id" TEXT NOT NULL,
    "relation_type" "RelationType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "ContractRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "case_number" TEXT,
    "title" TEXT NOT NULL,
    "case_type" "SagsType" NOT NULL,
    "case_subtype" "SagsSubtype",
    "status" "CaseStatus" NOT NULL DEFAULT 'NY',
    "sensitivity" "SensitivityLevel" NOT NULL DEFAULT 'INTERN',
    "description" TEXT,
    "responsible_id" TEXT,
    "due_date" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseCompany" (
    "organization_id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "CaseCompany_pkey" PRIMARY KEY ("case_id","company_id")
);

-- CreateTable
CREATE TABLE "CaseContract" (
    "organization_id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "CaseContract_pkey" PRIMARY KEY ("case_id","contract_id")
);

-- CreateTable
CREATE TABLE "CasePerson" (
    "organization_id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "role" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "CasePerson_pkey" PRIMARY KEY ("case_id","person_id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'NY',
    "priority" "Prioritet" NOT NULL DEFAULT 'MELLEM',
    "due_date" TIMESTAMP(3),
    "assigned_to" TEXT,
    "case_id" TEXT,
    "company_id" TEXT,
    "contract_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskHistory" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "field_name" "TaskHistoryField" NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "TaskHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "task_id" TEXT,
    "case_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deadline" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "priority" "Prioritet" NOT NULL,
    "assigned_to" TEXT,
    "case_id" TEXT,
    "contract_id" TEXT,
    "note" TEXT,
    "advise_days_before" INTEGER NOT NULL DEFAULT 3,
    "advise_sent_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Deadline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "company_id" TEXT,
    "case_id" TEXT,
    "contract_id" TEXT,
    "title" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "file_type" TEXT NOT NULL,
    "sensitivity" "SensitivityLevel" NOT NULL DEFAULT 'STANDARD',
    "folder_path" TEXT,
    "description" TEXT,
    "status" "document_status" NOT NULL DEFAULT 'KLADDE',
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "review_comment" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by" TEXT NOT NULL,
    "last_viewed_at" TIMESTAMP(3),
    "last_viewed_by" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialMetric" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "metric_type" "MetricType" NOT NULL,
    "period_type" "PeriodType" NOT NULL,
    "period_year" INTEGER NOT NULL,
    "value" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'DKK',
    "source" "MetricSource" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "FinancialMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "description" TEXT,
    "minutes" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "hourly_rate" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "resource_company_id" TEXT,
    "sensitivity" "SensitivityLevel",
    "changes" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "reminder_type" TEXT NOT NULL,
    "trigger_date" TIMESTAMP(3) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "recipient_ids" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT NOT NULL,
    "stripe_subscription_id" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "seat_count" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "trial_ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "visited_by" TEXT NOT NULL,
    "visit_date" TIMESTAMP(3) NOT NULL,
    "visit_type" "VisitType" NOT NULL,
    "status" "VisitStatus" NOT NULL DEFAULT 'PLANLAGT',
    "notes" TEXT,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationAISettings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "ai_mode" "AIMode" NOT NULL DEFAULT 'OFF',
    "shadow_comparison_enabled" BOOLEAN NOT NULL DEFAULT false,
    "beta_features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rate_limit_per_day" INTEGER NOT NULL DEFAULT 1000,
    "monthly_cost_cap_usd" DECIMAL(10,2) NOT NULL DEFAULT 50.00,
    "reserved_cost_usd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "reservation_period" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kill_switch" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationAISettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsageLog" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cost_usd" DECIMAL(10,6) NOT NULL,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "cached" BOOLEAN NOT NULL DEFAULT false,
    "cache_read_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_write_tokens" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentExtraction" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "content_hash" VARCHAR(64),
    "detected_type" TEXT,
    "type_confidence" DOUBLE PRECISION,
    "type_alternatives" JSONB,
    "schema_version" TEXT,
    "prompt_version" TEXT,
    "model_name" TEXT NOT NULL,
    "model_temperature" DOUBLE PRECISION,
    "extracted_fields" JSONB NOT NULL,
    "extracted_fields_run2" JSONB,
    "pipeline_checkpoint" JSONB,
    "agreement_score" DOUBLE PRECISION,
    "source_verification" JSONB,
    "sanity_check_results" JSONB,
    "discrepancies" JSONB,
    "raw_response" JSONB NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "total_cost_usd" DECIMAL(10,4) NOT NULL,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "field_decisions" JSONB,
    "extraction_status" TEXT NOT NULL DEFAULT 'completed',
    "entity_matches" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIFieldCorrection" (
    "id" TEXT NOT NULL,
    "extraction_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "ai_value" JSONB NOT NULL,
    "user_value" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "schema_version" TEXT,
    "prompt_version" TEXT,
    "corrected_by" TEXT NOT NULL,
    "corrected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIFieldCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyInsightsCache" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "alerts" JSONB NOT NULL,
    "insight" JSONB,
    "model_name" TEXT NOT NULL,
    "total_cost_usd" DECIMAL(10,4) NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyInsightsCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InviteToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "severity" "alert_severity" NOT NULL,
    "category" "alert_category" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "entity_name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "dismissed_at" TIMESTAMP(3),
    "dismissed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" "message_role" NOT NULL,
    "content" TEXT NOT NULL,
    "tool_calls" JSONB,
    "tool_results" JSONB,
    "tokens_used" INTEGER,
    "cost_usd" DECIMAL(10,6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingAction" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "action_label" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "pending_action_status" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "PendingAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Organization_id_idx" ON "Organization"("id");

-- CreateIndex
CREATE INDEX "User_organization_id_deleted_at_idx" ON "User"("organization_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "User_organization_id_email_key" ON "User"("organization_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_user_id_idx" ON "PasswordResetToken"("user_id");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE INDEX "UserRoleAssignment_organization_id_user_id_idx" ON "UserRoleAssignment"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "Company_organization_id_deleted_at_idx" ON "Company"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "Company_organization_id_status_idx" ON "Company"("organization_id", "status");

-- CreateIndex
CREATE INDEX "Company_organization_id_parent_company_id_idx" ON "Company"("organization_id", "parent_company_id");

-- CreateIndex
CREATE UNIQUE INDEX "Company_organization_id_cvr_key" ON "Company"("organization_id", "cvr");

-- CreateIndex
CREATE INDEX "company_notes_company_id_deleted_at_idx" ON "company_notes"("company_id", "deleted_at");

-- CreateIndex
CREATE INDEX "company_notes_organization_id_idx" ON "company_notes"("organization_id");

-- CreateIndex
CREATE INDEX "Ownership_organization_id_company_id_idx" ON "Ownership"("organization_id", "company_id");

-- CreateIndex
CREATE INDEX "Person_organization_id_deleted_at_idx" ON "Person"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "CompanyPerson_organization_id_company_id_idx" ON "CompanyPerson"("organization_id", "company_id");

-- CreateIndex
CREATE INDEX "CompanyPerson_organization_id_person_id_idx" ON "CompanyPerson"("organization_id", "person_id");

-- CreateIndex
CREATE INDEX "Contract_organization_id_deleted_at_idx" ON "Contract"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "Contract_organization_id_company_id_deleted_at_idx" ON "Contract"("organization_id", "company_id", "deleted_at");

-- CreateIndex
CREATE INDEX "Contract_organization_id_system_type_deleted_at_idx" ON "Contract"("organization_id", "system_type", "deleted_at");

-- CreateIndex
CREATE INDEX "Contract_organization_id_status_deleted_at_idx" ON "Contract"("organization_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "Contract_organization_id_company_id_deleted_at_status_idx" ON "Contract"("organization_id", "company_id", "deleted_at", "status");

-- CreateIndex
CREATE INDEX "Contract_expiry_date_idx" ON "Contract"("expiry_date");

-- CreateIndex
CREATE INDEX "ContractParty_organization_id_contract_id_idx" ON "ContractParty"("organization_id", "contract_id");

-- CreateIndex
CREATE INDEX "ContractVersion_organization_id_contract_id_idx" ON "ContractVersion"("organization_id", "contract_id");

-- CreateIndex
CREATE INDEX "ContractAttachment_organization_id_contract_id_idx" ON "ContractAttachment"("organization_id", "contract_id");

-- CreateIndex
CREATE INDEX "ContractRelation_organization_id_from_contract_id_idx" ON "ContractRelation"("organization_id", "from_contract_id");

-- CreateIndex
CREATE INDEX "ContractRelation_organization_id_to_contract_id_idx" ON "ContractRelation"("organization_id", "to_contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "ContractRelation_from_contract_id_to_contract_id_relation_t_key" ON "ContractRelation"("from_contract_id", "to_contract_id", "relation_type");

-- CreateIndex
CREATE INDEX "Case_organization_id_deleted_at_idx" ON "Case"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "Case_organization_id_status_deleted_at_idx" ON "Case"("organization_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "Case_organization_id_deleted_at_status_idx" ON "Case"("organization_id", "deleted_at", "status");

-- CreateIndex
CREATE INDEX "CaseCompany_organization_id_case_id_idx" ON "CaseCompany"("organization_id", "case_id");

-- CreateIndex
CREATE INDEX "CaseContract_organization_id_case_id_idx" ON "CaseContract"("organization_id", "case_id");

-- CreateIndex
CREATE INDEX "CasePerson_organization_id_case_id_idx" ON "CasePerson"("organization_id", "case_id");

-- CreateIndex
CREATE INDEX "Task_organization_id_deleted_at_idx" ON "Task"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "Task_organization_id_assigned_to_deleted_at_idx" ON "Task"("organization_id", "assigned_to", "deleted_at");

-- CreateIndex
CREATE INDEX "Task_organization_id_due_date_idx" ON "Task"("organization_id", "due_date");

-- CreateIndex
CREATE INDEX "Task_organization_id_deleted_at_status_idx" ON "Task"("organization_id", "deleted_at", "status");

-- CreateIndex
CREATE INDEX "Task_organization_id_company_id_idx" ON "Task"("organization_id", "company_id");

-- CreateIndex
CREATE INDEX "TaskHistory_organization_id_task_id_changed_at_idx" ON "TaskHistory"("organization_id", "task_id", "changed_at");

-- CreateIndex
CREATE INDEX "TaskHistory_organization_id_deleted_at_idx" ON "TaskHistory"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "Comment_organization_id_task_id_idx" ON "Comment"("organization_id", "task_id");

-- CreateIndex
CREATE INDEX "Comment_organization_id_case_id_idx" ON "Comment"("organization_id", "case_id");

-- CreateIndex
CREATE INDEX "Comment_organization_id_deleted_at_idx" ON "Comment"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "Deadline_organization_id_deleted_at_idx" ON "Deadline"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "Deadline_organization_id_due_date_idx" ON "Deadline"("organization_id", "due_date");

-- CreateIndex
CREATE INDEX "Deadline_due_date_advise_sent_at_idx" ON "Deadline"("due_date", "advise_sent_at");

-- CreateIndex
CREATE INDEX "Document_organization_id_deleted_at_idx" ON "Document"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "Document_organization_id_company_id_deleted_at_idx" ON "Document"("organization_id", "company_id", "deleted_at");

-- CreateIndex
CREATE INDEX "Document_organization_id_contract_id_idx" ON "Document"("organization_id", "contract_id");

-- CreateIndex
CREATE INDEX "FinancialMetric_organization_id_company_id_idx" ON "FinancialMetric"("organization_id", "company_id");

-- CreateIndex
CREATE INDEX "FinancialMetric_organization_id_company_id_metric_type_peri_idx" ON "FinancialMetric"("organization_id", "company_id", "metric_type", "period_year");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialMetric_organization_id_company_id_metric_type_peri_key" ON "FinancialMetric"("organization_id", "company_id", "metric_type", "period_type", "period_year");

-- CreateIndex
CREATE INDEX "TimeEntry_organization_id_case_id_idx" ON "TimeEntry"("organization_id", "case_id");

-- CreateIndex
CREATE INDEX "AuditLog_organization_id_resource_type_resource_id_idx" ON "AuditLog"("organization_id", "resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "AuditLog_organization_id_user_id_idx" ON "AuditLog"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "AuditLog_organization_id_resource_company_id_idx" ON "AuditLog"("organization_id", "resource_company_id");

-- CreateIndex
CREATE INDEX "AuditLog_created_at_idx" ON "AuditLog"("created_at");

-- CreateIndex
CREATE INDEX "AuditLog_organization_id_resource_company_id_created_at_idx" ON "AuditLog"("organization_id", "resource_company_id", "created_at");

-- CreateIndex
CREATE INDEX "Reminder_trigger_date_sent_at_idx" ON "Reminder"("trigger_date", "sent_at");

-- CreateIndex
CREATE INDEX "Reminder_organization_id_contract_id_idx" ON "Reminder"("organization_id", "contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_organization_id_key" ON "Subscription"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripe_customer_id_key" ON "Subscription"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripe_subscription_id_key" ON "Subscription"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "Subscription_stripe_customer_id_idx" ON "Subscription"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Visit_organization_id_deleted_at_idx" ON "Visit"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "Visit_organization_id_company_id_deleted_at_idx" ON "Visit"("organization_id", "company_id", "deleted_at");

-- CreateIndex
CREATE INDEX "Visit_organization_id_visit_date_idx" ON "Visit"("organization_id", "visit_date");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationAISettings_organization_id_key" ON "OrganizationAISettings"("organization_id");

-- CreateIndex
CREATE INDEX "OrganizationAISettings_ai_mode_idx" ON "OrganizationAISettings"("ai_mode");

-- CreateIndex
CREATE INDEX "AIUsageLog_organization_id_created_at_idx" ON "AIUsageLog"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "AIUsageLog_organization_id_feature_created_at_idx" ON "AIUsageLog"("organization_id", "feature", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentExtraction_document_id_key" ON "DocumentExtraction"("document_id");

-- CreateIndex
CREATE INDEX "DocumentExtraction_document_id_idx" ON "DocumentExtraction"("document_id");

-- CreateIndex
CREATE INDEX "DocumentExtraction_organization_id_idx" ON "DocumentExtraction"("organization_id");

-- CreateIndex
CREATE INDEX "DocumentExtraction_detected_type_idx" ON "DocumentExtraction"("detected_type");

-- CreateIndex
CREATE INDEX "DocumentExtraction_reviewed_at_idx" ON "DocumentExtraction"("reviewed_at");

-- CreateIndex
CREATE INDEX "DocumentExtraction_extraction_status_idx" ON "DocumentExtraction"("extraction_status");

-- CreateIndex
CREATE INDEX "DocumentExtraction_organization_id_content_hash_idx" ON "DocumentExtraction"("organization_id", "content_hash");

-- CreateIndex
CREATE INDEX "AIFieldCorrection_field_name_idx" ON "AIFieldCorrection"("field_name");

-- CreateIndex
CREATE INDEX "AIFieldCorrection_schema_version_idx" ON "AIFieldCorrection"("schema_version");

-- CreateIndex
CREATE INDEX "AIFieldCorrection_organization_id_idx" ON "AIFieldCorrection"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyInsightsCache_company_id_key" ON "CompanyInsightsCache"("company_id");

-- CreateIndex
CREATE INDEX "CompanyInsightsCache_company_id_generated_at_idx" ON "CompanyInsightsCache"("company_id", "generated_at");

-- CreateIndex
CREATE UNIQUE INDEX "InviteToken_token_key" ON "InviteToken"("token");

-- CreateIndex
CREATE INDEX "InviteToken_token_idx" ON "InviteToken"("token");

-- CreateIndex
CREATE INDEX "InviteToken_organization_id_idx" ON "InviteToken"("organization_id");

-- CreateIndex
CREATE INDEX "Alert_organization_id_dismissed_at_idx" ON "Alert"("organization_id", "dismissed_at");

-- CreateIndex
CREATE INDEX "Alert_organization_id_severity_idx" ON "Alert"("organization_id", "severity");

-- CreateIndex
CREATE INDEX "Alert_entity_type_entity_id_idx" ON "Alert"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "Conversation_organization_id_user_id_idx" ON "Conversation"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "Conversation_user_id_updated_at_idx" ON "Conversation"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "Message_conversation_id_created_at_idx" ON "Message"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "PendingAction_conversation_id_status_idx" ON "PendingAction"("conversation_id", "status");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRoleAssignment" ADD CONSTRAINT "UserRoleAssignment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_parent_company_id_fkey" FOREIGN KEY ("parent_company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_notes" ADD CONSTRAINT "company_notes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_notes" ADD CONSTRAINT "company_notes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_notes" ADD CONSTRAINT "company_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ownership" ADD CONSTRAINT "Ownership_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ownership" ADD CONSTRAINT "Ownership_owner_person_id_fkey" FOREIGN KEY ("owner_person_id") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ownership" ADD CONSTRAINT "Ownership_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPerson" ADD CONSTRAINT "CompanyPerson_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPerson" ADD CONSTRAINT "CompanyPerson_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPerson" ADD CONSTRAINT "CompanyPerson_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_parent_contract_id_fkey" FOREIGN KEY ("parent_contract_id") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractParty" ADD CONSTRAINT "ContractParty_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractParty" ADD CONSTRAINT "ContractParty_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractVersion" ADD CONSTRAINT "ContractVersion_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAttachment" ADD CONSTRAINT "ContractAttachment_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractRelation" ADD CONSTRAINT "ContractRelation_from_contract_id_fkey" FOREIGN KEY ("from_contract_id") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractRelation" ADD CONSTRAINT "ContractRelation_to_contract_id_fkey" FOREIGN KEY ("to_contract_id") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseCompany" ADD CONSTRAINT "CaseCompany_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseCompany" ADD CONSTRAINT "CaseCompany_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseContract" ADD CONSTRAINT "CaseContract_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseContract" ADD CONSTRAINT "CaseContract_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasePerson" ADD CONSTRAINT "CasePerson_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasePerson" ADD CONSTRAINT "CasePerson_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskHistory" ADD CONSTRAINT "TaskHistory_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskHistory" ADD CONSTRAINT "TaskHistory_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskHistory" ADD CONSTRAINT "TaskHistory_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialMetric" ADD CONSTRAINT "FinancialMetric_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_visited_by_fkey" FOREIGN KEY ("visited_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationAISettings" ADD CONSTRAINT "OrganizationAISettings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsageLog" ADD CONSTRAINT "AIUsageLog_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentExtraction" ADD CONSTRAINT "DocumentExtraction_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIFieldCorrection" ADD CONSTRAINT "AIFieldCorrection_extraction_id_fkey" FOREIGN KEY ("extraction_id") REFERENCES "DocumentExtraction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyInsightsCache" ADD CONSTRAINT "CompanyInsightsCache_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyInsightsCache" ADD CONSTRAINT "CompanyInsightsCache_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InviteToken" ADD CONSTRAINT "InviteToken_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingAction" ADD CONSTRAINT "PendingAction_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

