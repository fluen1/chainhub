import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Hjælpefunktion til UUID-generering med prefix
function uid(n: number) {
  return `00000000-0000-0000-0000-${n.toString().padStart(12, '0')}`
}

// Datoer relativt til nu
const now = new Date()
const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000)
const daysFromNow = (d: number) => new Date(Date.now() + d * 24 * 60 * 60 * 1000)

async function main() {
  console.log('🌱 Seeding ChainHub demo-data...')

  // ══════════════════════════════════════════════════════════════
  // 1. ORGANISATION
  // ══════════════════════════════════════════════════════════════
  const org = await prisma.organization.upsert({
    where: { id: uid(1) },
    update: {},
    create: {
      id: uid(1),
      name: 'TandlægeGruppen A/S',
      cvr: '12345678',
      plan: 'business',
      chain_structure: true,
    },
  })

  // ══════════════════════════════════════════════════════════════
  // 2. BRUGERE
  // ══════════════════════════════════════════════════════════════
  const passwordHash = await bcrypt.hash('password123', 10)

  const philip = await prisma.user.upsert({
    where: { organization_id_email: { organization_id: org.id, email: 'philip@chainhub.dk' } },
    update: {},
    create: { id: uid(10), organization_id: org.id, email: 'philip@chainhub.dk', name: 'Philip Larsen', password_hash: passwordHash },
  })

  const maria = await prisma.user.upsert({
    where: { organization_id_email: { organization_id: org.id, email: 'maria@tandlaegegruppen.dk' } },
    update: {},
    create: { id: uid(11), organization_id: org.id, email: 'maria@tandlaegegruppen.dk', name: 'Maria Sørensen', password_hash: passwordHash },
  })

  const thomas = await prisma.user.upsert({
    where: { organization_id_email: { organization_id: org.id, email: 'thomas@tandlaegegruppen.dk' } },
    update: {},
    create: { id: uid(12), organization_id: org.id, email: 'thomas@tandlaegegruppen.dk', name: 'Thomas Mikkelsen', password_hash: passwordHash },
  })

  // Roller
  await prisma.userRoleAssignment.upsert({
    where: { id: uid(100) }, update: {},
    create: { id: uid(100), organization_id: org.id, user_id: philip.id, role: 'GROUP_OWNER', scope: 'ALL', company_ids: [], created_by: philip.id },
  })
  await prisma.userRoleAssignment.upsert({
    where: { id: uid(101) }, update: {},
    create: { id: uid(101), organization_id: org.id, user_id: maria.id, role: 'GROUP_LEGAL', scope: 'ALL', company_ids: [], created_by: philip.id },
  })
  await prisma.userRoleAssignment.upsert({
    where: { id: uid(102) }, update: {},
    create: { id: uid(102), organization_id: org.id, user_id: thomas.id, role: 'GROUP_FINANCE', scope: 'ALL', company_ids: [], created_by: philip.id },
  })

  // ══════════════════════════════════════════════════════════════
  // 3. PERSONER (kontakter i systemet)
  // ══════════════════════════════════════════════════════════════
  const persons = await Promise.all([
    { id: uid(2001), first_name: 'Anders', last_name: 'Jensen', email: 'anders@tandosterbro.dk', phone: '+4512345678' },
    { id: uid(2002), first_name: 'Rikke', last_name: 'Nielsen', email: 'rikke@tandaarhus.dk', phone: '+4587654321' },
    { id: uid(2003), first_name: 'Søren', last_name: 'Pedersen', email: 'soren@tandvesterbro.dk', phone: '+4533221100' },
    { id: uid(2004), first_name: 'Line', last_name: 'Christensen', email: 'line@tandnordhavn.dk', phone: '+4511223344' },
    { id: uid(2005), first_name: 'Kasper', last_name: 'Andersen', email: 'kasper@tandodense.dk', phone: '+4555667788' },
    { id: uid(2006), first_name: 'Mette', last_name: 'Rasmussen', email: 'mette@tandaalborg.dk', phone: '+4599887766' },
    { id: uid(2007), first_name: 'Henrik', last_name: 'Thomsen', email: 'henrik@revisor.dk', phone: '+4540506070' },
    { id: uid(2008), first_name: 'Camilla', last_name: 'Madsen', email: 'camilla@advokatfirma.dk', phone: '+4560708090' },
    { id: uid(2009), first_name: 'Jens', last_name: 'Larsen', email: 'jens@bankdk.dk', phone: '+4570809010' },
    { id: uid(2010), first_name: 'Anne', last_name: 'Møller', email: 'anne@forsikring.dk', phone: '+4520304050' },
  ].map((p) =>
    prisma.person.upsert({
      where: { id: p.id }, update: {},
      create: { ...p, organization_id: org.id, created_by: philip.id },
    })
  ))

  // ══════════════════════════════════════════════════════════════
  // 4. SELSKABER (6 klinikker + 1 holding)
  // ══════════════════════════════════════════════════════════════
  const companyData = [
    { id: uid(1000), name: 'TandlægeGruppen Holding ApS', cvr: '10000001', company_type: 'ApS', address: 'Bredgade 25', city: 'København K', postal_code: '1260', status: 'aktiv', notes: 'Moderselskab for hele kæden', latitude: 55.6839, longitude: 12.5876 },
    { id: uid(1001), name: 'Tandlæge Østerbro ApS', cvr: '87654321', company_type: 'ApS', address: 'Østerbrogade 123', city: 'København Ø', postal_code: '2100', status: 'aktiv', latitude: 55.7065, longitude: 12.5773 },
    { id: uid(1002), name: 'Tandlæge Aarhus ApS', cvr: '11223344', company_type: 'ApS', address: 'Frederiksgade 45', city: 'Aarhus C', postal_code: '8000', status: 'aktiv', latitude: 56.1572, longitude: 10.2107 },
    { id: uid(1003), name: 'Tandlæge Vesterbro ApS', cvr: '22334455', company_type: 'ApS', address: 'Vesterbrogade 78', city: 'København V', postal_code: '1620', status: 'aktiv', latitude: 55.6713, longitude: 12.5520 },
    { id: uid(1004), name: 'Tandlæge Nordhavn ApS', cvr: '33445566', company_type: 'ApS', address: 'Århusgade 88', city: 'København Ø', postal_code: '2150', status: 'under_stiftelse', latitude: 55.7157, longitude: 12.5993 },
    { id: uid(1005), name: 'Tandlæge Odense ApS', cvr: '44556677', company_type: 'ApS', address: 'Kongensgade 55', city: 'Odense C', postal_code: '5000', status: 'aktiv', latitude: 55.3959, longitude: 10.3883 },
    { id: uid(1006), name: 'Tandlæge Aalborg ApS', cvr: '55667788', company_type: 'ApS', address: 'Boulevarden 33', city: 'Aalborg', postal_code: '9000', status: 'aktiv', latitude: 57.0488, longitude: 9.9217 },
  ]

  const companies = await Promise.all(
    companyData.map((c) =>
      prisma.company.upsert({
        where: { id: c.id }, update: {},
        create: { ...c, organization_id: org.id, created_by: philip.id },
      })
    )
  )

  // ══════════════════════════════════════════════════════════════
  // 5. EJERSKABER
  // ══════════════════════════════════════════════════════════════
  const ownershipData = [
    // Holding ejer 55% af alle klinikker (via company — men vi bruger person her for demo)
    { id: uid(4001), company_id: uid(1001), owner_person_id: uid(2001), ownership_pct: 45, effective_date: new Date('2020-01-01') },
    { id: uid(4002), company_id: uid(1002), owner_person_id: uid(2002), ownership_pct: 40, effective_date: new Date('2021-06-01') },
    { id: uid(4003), company_id: uid(1003), owner_person_id: uid(2003), ownership_pct: 35, effective_date: new Date('2022-03-15') },
    { id: uid(4004), company_id: uid(1004), owner_person_id: uid(2004), ownership_pct: 50, effective_date: new Date('2024-09-01') },
    { id: uid(4005), company_id: uid(1005), owner_person_id: uid(2005), ownership_pct: 40, effective_date: new Date('2023-01-01') },
    { id: uid(4006), company_id: uid(1006), owner_person_id: uid(2006), ownership_pct: 45, effective_date: new Date('2023-08-01') },
  ]

  await Promise.all(
    ownershipData.map((o) =>
      prisma.ownership.upsert({
        where: { id: o.id }, update: {},
        create: { ...o, organization_id: org.id, created_by: philip.id },
      })
    )
  )

  // ══════════════════════════════════════════════════════════════
  // 6. COMPANY-PERSON tilknytninger
  // ══════════════════════════════════════════════════════════════
  const cpData = [
    { id: uid(3001), company_id: uid(1001), person_id: uid(2001), role: 'Direktør', start_date: new Date('2020-01-01') },
    { id: uid(3002), company_id: uid(1002), person_id: uid(2002), role: 'Direktør', start_date: new Date('2021-06-01') },
    { id: uid(3003), company_id: uid(1003), person_id: uid(2003), role: 'Direktør', start_date: new Date('2022-03-15') },
    { id: uid(3004), company_id: uid(1004), person_id: uid(2004), role: 'Direktør', start_date: new Date('2024-09-01') },
    { id: uid(3005), company_id: uid(1005), person_id: uid(2005), role: 'Direktør', start_date: new Date('2023-01-01') },
    { id: uid(3006), company_id: uid(1006), person_id: uid(2006), role: 'Direktør', start_date: new Date('2023-08-01') },
    { id: uid(3007), company_id: uid(1000), person_id: uid(2007), role: 'Revisor', start_date: new Date('2020-01-01') },
    { id: uid(3008), company_id: uid(1000), person_id: uid(2008), role: 'Ekstern advokat', start_date: new Date('2020-01-01') },
  ]

  await Promise.all(
    cpData.map((cp) =>
      prisma.companyPerson.upsert({
        where: { id: cp.id }, update: {},
        create: { ...cp, organization_id: org.id, created_by: philip.id },
      })
    )
  )

  // ══════════════════════════════════════════════════════════════
  // 7. KONTRAKTER (varierede typer og statusser)
  // ══════════════════════════════════════════════════════════════
  const contractData = [
    // Ejeraftaler — STRENGT_FORTROLIG
    { id: uid(5001), company_id: uid(1001), system_type: 'EJERAFTALE' as const, display_name: 'Ejeraftale — Tandlæge Østerbro', status: 'AKTIV' as const, sensitivity: 'STRENGT_FORTROLIG' as const, effective_date: new Date('2020-01-01'), notes: 'Original ejeraftale. Forkøbsret i §8, tag-along i §9.' },
    { id: uid(5002), company_id: uid(1002), system_type: 'EJERAFTALE' as const, display_name: 'Ejeraftale — Tandlæge Aarhus', status: 'AKTIV' as const, sensitivity: 'STRENGT_FORTROLIG' as const, effective_date: new Date('2021-06-01') },
    { id: uid(5003), company_id: uid(1003), system_type: 'EJERAFTALE' as const, display_name: 'Ejeraftale — Tandlæge Vesterbro', status: 'AKTIV' as const, sensitivity: 'STRENGT_FORTROLIG' as const, effective_date: new Date('2022-03-15') },
    // Direktørkontrakter
    { id: uid(5010), company_id: uid(1001), system_type: 'DIREKTOERKONTRAKT' as const, display_name: 'Direktørkontrakt — Anders Jensen', status: 'AKTIV' as const, sensitivity: 'FORTROLIG' as const, effective_date: new Date('2020-01-01'), notice_period_days: 180 },
    { id: uid(5011), company_id: uid(1002), system_type: 'DIREKTOERKONTRAKT' as const, display_name: 'Direktørkontrakt — Rikke Nielsen', status: 'AKTIV' as const, sensitivity: 'FORTROLIG' as const, effective_date: new Date('2021-06-01'), notice_period_days: 180 },
    // Lejekontrakter — udløber snart!
    { id: uid(5020), company_id: uid(1001), system_type: 'LEJEKONTRAKT_ERHVERV' as const, display_name: 'Lejekontrakt — Østerbrogade 123', status: 'AKTIV' as const, sensitivity: 'INTERN' as const, effective_date: new Date('2020-01-01'), expiry_date: daysFromNow(25), notice_period_days: 90, notes: '⚠️ Udløber snart — forhandling påkrævet' },
    { id: uid(5021), company_id: uid(1002), system_type: 'LEJEKONTRAKT_ERHVERV' as const, display_name: 'Lejekontrakt — Frederiksgade 45', status: 'AKTIV' as const, sensitivity: 'INTERN' as const, effective_date: new Date('2021-06-01'), expiry_date: daysFromNow(85) },
    { id: uid(5022), company_id: uid(1003), system_type: 'LEJEKONTRAKT_ERHVERV' as const, display_name: 'Lejekontrakt — Vesterbrogade 78', status: 'AKTIV' as const, sensitivity: 'INTERN' as const, effective_date: new Date('2022-03-15'), expiry_date: new Date('2027-03-14') },
    // Forsikringer
    { id: uid(5030), company_id: uid(1001), system_type: 'FORSIKRING' as const, display_name: 'Erhvervsansvarsforsikring — Østerbro', status: 'AKTIV' as const, sensitivity: 'STANDARD' as const, effective_date: new Date('2024-01-01'), expiry_date: new Date('2026-12-31') },
    { id: uid(5031), company_id: uid(1002), system_type: 'FORSIKRING' as const, display_name: 'Erhvervsansvarsforsikring — Aarhus', status: 'AKTIV' as const, sensitivity: 'STANDARD' as const, effective_date: new Date('2024-01-01'), expiry_date: new Date('2026-12-31') },
    // NDA'er
    { id: uid(5040), company_id: uid(1004), system_type: 'NDA' as const, display_name: 'NDA — Nordhavn opkøbsforhandling', status: 'AKTIV' as const, sensitivity: 'FORTROLIG' as const, effective_date: new Date('2024-08-01'), expiry_date: new Date('2026-08-01') },
    // IT-aftale
    { id: uid(5050), company_id: uid(1000), system_type: 'IT_SYSTEMAFTALE' as const, display_name: 'Journalsystem — Dental Suite Pro', status: 'AKTIV' as const, sensitivity: 'STANDARD' as const, effective_date: new Date('2023-01-01'), expiry_date: new Date('2026-12-31'), notice_period_days: 90 },
    // DBA
    { id: uid(5060), company_id: uid(1000), system_type: 'DBA' as const, display_name: 'Databehandleraftale — Dental Suite', status: 'AKTIV' as const, sensitivity: 'INTERN' as const, effective_date: new Date('2023-01-01') },
    // Ansættelseskontrakter
    { id: uid(5070), company_id: uid(1001), system_type: 'ANSAETTELSE_FUNKTIONAER' as const, display_name: 'Ansættelseskontrakt — Tandplejer Sara Holm', status: 'AKTIV' as const, sensitivity: 'FORTROLIG' as const, effective_date: new Date('2022-04-01') },
    { id: uid(5071), company_id: uid(1001), system_type: 'ANSAETTELSE_FUNKTIONAER' as const, display_name: 'Ansættelseskontrakt — Klinikassistent Maja Bech', status: 'AKTIV' as const, sensitivity: 'FORTROLIG' as const, effective_date: new Date('2023-09-01') },
    // Udkast
    { id: uid(5080), company_id: uid(1004), system_type: 'EJERAFTALE' as const, display_name: 'Ejeraftale — Tandlæge Nordhavn (UDKAST)', status: 'UDKAST' as const, sensitivity: 'STRENGT_FORTROLIG' as const, notes: 'Under forhandling med Line Christensen' },
    // Opsagt kontrakt
    { id: uid(5090), company_id: uid(1005), system_type: 'LEVERANDOERKONTRAKT' as const, display_name: 'Leverandørkontrakt — Dental Supplies (opsagt)', status: 'OPSAGT' as const, sensitivity: 'STANDARD' as const, effective_date: new Date('2023-06-01'), termination_date: daysFromNow(45) },
    // Vedtægter
    { id: uid(5100), company_id: uid(1000), system_type: 'VEDTAEGTER' as const, display_name: 'Vedtægter — TandlægeGruppen Holding', status: 'AKTIV' as const, sensitivity: 'INTERN' as const, effective_date: new Date('2019-06-01') },
  ]

  await Promise.all(
    contractData.map((c) =>
      prisma.contract.upsert({
        where: { id: c.id }, update: {},
        create: { ...c, organization_id: org.id, created_by: philip.id },
      })
    )
  )

  // ══════════════════════════════════════════════════════════════
  // 8. SAGER
  // ══════════════════════════════════════════════════════════════
  const caseData = [
    { id: uid(6001), case_number: 'SAG-2024-001', title: 'Opkøb af Nordhavn-klinik', case_type: 'TRANSAKTION' as const, case_subtype: 'VIRKSOMHEDSKOEB' as const, status: 'AKTIV' as const, sensitivity: 'STRENGT_FORTROLIG' as const, description: 'Due diligence og forhandling om opkøb af eksisterende tandlægepraksis i Nordhavn.', responsible_id: philip.id, due_date: daysFromNow(30) },
    { id: uid(6002), case_number: 'SAG-2024-002', title: 'Lejeforhandling Østerbro', case_type: 'KONTRAKT' as const, case_subtype: 'FORNYELSE' as const, status: 'AKTIV' as const, sensitivity: 'INTERN' as const, description: 'Lejekontrakten udløber om 25 dage. Udlejer kræver 12% huslejestigning.', responsible_id: maria.id, due_date: daysFromNow(14) },
    { id: uid(6003), case_number: 'SAG-2024-003', title: 'GDPR-audit Q1 2025', case_type: 'COMPLIANCE' as const, case_subtype: 'GDPR' as const, status: 'AKTIV' as const, sensitivity: 'INTERN' as const, description: 'Årlig GDPR-gennemgang af alle klinikker. Fokus på patientsamtykke og journaldata.', responsible_id: maria.id },
    { id: uid(6004), case_number: 'SAG-2024-004', title: 'Opsigelse af Dental Supplies', case_type: 'KONTRAKT' as const, case_subtype: 'OPSIGELSE' as const, status: 'AKTIV' as const, sensitivity: 'STANDARD' as const, description: 'Leverandørskifte pga. prisforhøjelse. Ny leverandør identificeret.' },
    { id: uid(6005), case_number: 'SAG-2023-008', title: 'Arbejdsmiljøtilsyn — Aarhus', case_type: 'COMPLIANCE' as const, case_subtype: 'ARBEJDSMILJOE' as const, status: 'LUKKET' as const, sensitivity: 'INTERN' as const, description: 'Arbejdstilsynet gennemførte besøg d. 15/9. Ingen påbud.', closed_at: daysAgo(60) },
    { id: uid(6006), case_number: 'SAG-2023-012', title: 'Generalforsamling 2024', case_type: 'GOVERNANCE' as const, case_subtype: 'GENERALFORSAMLING' as const, status: 'LUKKET' as const, sensitivity: 'INTERN' as const, description: 'Ordinær generalforsamling afholdt d. 28/3 2024.', closed_at: daysAgo(350) },
  ]

  await Promise.all(
    caseData.map((c) =>
      prisma.case.upsert({
        where: { id: c.id }, update: {},
        create: { ...c, organization_id: org.id, created_by: philip.id },
      })
    )
  )

  // Tilknyt sager til selskaber
  const ccData = [
    { case_id: uid(6001), company_id: uid(1004) },
    { case_id: uid(6002), company_id: uid(1001) },
    { case_id: uid(6003), company_id: uid(1001) }, { case_id: uid(6003), company_id: uid(1002) }, { case_id: uid(6003), company_id: uid(1003) },
    { case_id: uid(6004), company_id: uid(1005) },
    { case_id: uid(6005), company_id: uid(1002) },
    { case_id: uid(6006), company_id: uid(1000) },
  ]

  for (const cc of ccData) {
    await prisma.caseCompany.upsert({
      where: { case_id_company_id: { case_id: cc.case_id, company_id: cc.company_id } },
      update: {},
      create: { ...cc, organization_id: org.id, created_by: philip.id },
    })
  }

  // ══════════════════════════════════════════════════════════════
  // 9. OPGAVER
  // ══════════════════════════════════════════════════════════════
  const taskData = [
    // Forfaldne!
    { id: uid(7001), title: 'Gennemgå due diligence-rapport fra revisor', case_id: uid(6001), assigned_to: philip.id, priority: 'HOEJ' as const, due_date: daysAgo(3), status: 'AKTIV_TASK' as const },
    { id: uid(7002), title: 'Send revideret NDA til modpart', case_id: uid(6001), assigned_to: maria.id, priority: 'KRITISK' as const, due_date: daysAgo(1), status: 'AKTIV_TASK' as const },
    // Denne uge
    { id: uid(7003), title: 'Udarbejd modbud til udlejer (Østerbro)', case_id: uid(6002), assigned_to: maria.id, priority: 'KRITISK' as const, due_date: daysFromNow(3), status: 'NY' as const },
    { id: uid(7004), title: 'Indhent tilbud fra ny leverandør', case_id: uid(6004), assigned_to: thomas.id, priority: 'MELLEM' as const, due_date: daysFromNow(5), status: 'AKTIV_TASK' as const },
    // Næste uge
    { id: uid(7005), title: 'GDPR-tjekliste for Østerbro-klinik', case_id: uid(6003), assigned_to: maria.id, priority: 'MELLEM' as const, due_date: daysFromNow(10), status: 'NY' as const },
    { id: uid(7006), title: 'GDPR-tjekliste for Aarhus-klinik', case_id: uid(6003), assigned_to: maria.id, priority: 'MELLEM' as const, due_date: daysFromNow(12), status: 'NY' as const },
    { id: uid(7007), title: 'GDPR-tjekliste for Vesterbro-klinik', case_id: uid(6003), assigned_to: maria.id, priority: 'MELLEM' as const, due_date: daysFromNow(14), status: 'NY' as const },
    // Fremtidige
    { id: uid(7008), title: 'Opdater vedtægter efter kapitalforhøjelse', assigned_to: philip.id, priority: 'LAV' as const, due_date: daysFromNow(45), status: 'NY' as const },
    { id: uid(7009), title: 'Årlig forsikringsgennemgang', assigned_to: thomas.id, priority: 'MELLEM' as const, due_date: daysFromNow(60), status: 'NY' as const },
    // Lukket
    { id: uid(7010), title: 'Underskrift af ejeraftale — Nordhavn (initial)', case_id: uid(6001), assigned_to: philip.id, priority: 'HOEJ' as const, due_date: daysAgo(30), status: 'LUKKET' as const, completed_at: daysAgo(28) },
  ]

  await Promise.all(
    taskData.map((t) =>
      prisma.task.upsert({
        where: { id: t.id }, update: {},
        create: { ...t, organization_id: org.id, created_by: philip.id },
      })
    )
  )

  // ══════════════════════════════════════════════════════════════
  // 10. ØKONOMI — nøgletal pr. selskab
  // ══════════════════════════════════════════════════════════════
  const finData = [
    // Østerbro
    { company_id: uid(1001), metric_type: 'OMSAETNING' as const, period_year: 2024, value: 8200000, source: 'REVIDERET' as const },
    { company_id: uid(1001), metric_type: 'EBITDA' as const, period_year: 2024, value: 1850000, source: 'REVIDERET' as const },
    { company_id: uid(1001), metric_type: 'RESULTAT' as const, period_year: 2024, value: 1200000, source: 'REVIDERET' as const },
    { company_id: uid(1001), metric_type: 'OMSAETNING' as const, period_year: 2023, value: 7500000, source: 'REVIDERET' as const },
    { company_id: uid(1001), metric_type: 'EBITDA' as const, period_year: 2023, value: 1600000, source: 'REVIDERET' as const },
    // Aarhus
    { company_id: uid(1002), metric_type: 'OMSAETNING' as const, period_year: 2024, value: 6800000, source: 'REVIDERET' as const },
    { company_id: uid(1002), metric_type: 'EBITDA' as const, period_year: 2024, value: 1400000, source: 'REVIDERET' as const },
    { company_id: uid(1002), metric_type: 'RESULTAT' as const, period_year: 2024, value: 900000, source: 'REVIDERET' as const },
    // Vesterbro
    { company_id: uid(1003), metric_type: 'OMSAETNING' as const, period_year: 2024, value: 5500000, source: 'UREVIDERET' as const },
    { company_id: uid(1003), metric_type: 'EBITDA' as const, period_year: 2024, value: 1100000, source: 'UREVIDERET' as const },
    // Odense
    { company_id: uid(1005), metric_type: 'OMSAETNING' as const, period_year: 2024, value: 4200000, source: 'UREVIDERET' as const },
    { company_id: uid(1005), metric_type: 'EBITDA' as const, period_year: 2024, value: 750000, source: 'UREVIDERET' as const },
    // Aalborg
    { company_id: uid(1006), metric_type: 'OMSAETNING' as const, period_year: 2024, value: 3900000, source: 'ESTIMAT' as const },
    { company_id: uid(1006), metric_type: 'EBITDA' as const, period_year: 2024, value: 680000, source: 'ESTIMAT' as const },
  ]

  for (const f of finData) {
    await prisma.financialMetric.upsert({
      where: {
        organization_id_company_id_metric_type_period_type_period_year: {
          organization_id: org.id, company_id: f.company_id, metric_type: f.metric_type, period_type: 'HELAAR', period_year: f.period_year,
        },
      },
      update: {},
      create: { ...f, period_type: 'HELAAR' as const, organization_id: org.id, created_by: philip.id },
    })
  }

  // ══════════════════════════════════════════════════════════════
  // 11. DOKUMENTER (metadata — ingen faktiske filer)
  // ══════════════════════════════════════════════════════════════
  const docData = [
    { id: uid(8001), company_id: uid(1001), title: 'Ejeraftale — Østerbro (underskrevet)', file_url: '/docs/ejeraftale-osterbro.pdf', file_name: 'ejeraftale-osterbro.pdf', file_size_bytes: 245000, file_type: 'application/pdf', sensitivity: 'STRENGT_FORTROLIG' as const },
    { id: uid(8002), company_id: uid(1001), title: 'Lejekontrakt — Østerbrogade 123', file_url: '/docs/lejekontrakt-osterbro.pdf', file_name: 'lejekontrakt-osterbro.pdf', file_size_bytes: 180000, file_type: 'application/pdf', sensitivity: 'INTERN' as const },
    { id: uid(8003), company_id: uid(1002), title: 'Ejeraftale — Aarhus (underskrevet)', file_url: '/docs/ejeraftale-aarhus.pdf', file_name: 'ejeraftale-aarhus.pdf', file_size_bytes: 230000, file_type: 'application/pdf', sensitivity: 'STRENGT_FORTROLIG' as const },
    { id: uid(8004), company_id: uid(1000), title: 'Vedtægter — TandlægeGruppen Holding', file_url: '/docs/vedtaegter-holding.pdf', file_name: 'vedtaegter-holding.pdf', file_size_bytes: 120000, file_type: 'application/pdf', sensitivity: 'INTERN' as const },
    { id: uid(8005), company_id: uid(1004), title: 'NDA — Nordhavn forhandling', file_url: '/docs/nda-nordhavn.pdf', file_name: 'nda-nordhavn.pdf', file_size_bytes: 95000, file_type: 'application/pdf', sensitivity: 'FORTROLIG' as const },
    { id: uid(8006), company_id: uid(1001), title: 'Erhvervsansvarsforsikring — police 2024', file_url: '/docs/forsikring-osterbro-2024.pdf', file_name: 'forsikring-osterbro-2024.pdf', file_size_bytes: 310000, file_type: 'application/pdf', sensitivity: 'STANDARD' as const },
    { id: uid(8007), company_id: uid(1000), title: 'Databehandleraftale — Dental Suite', file_url: '/docs/dba-dental-suite.pdf', file_name: 'dba-dental-suite.pdf', file_size_bytes: 150000, file_type: 'application/pdf', sensitivity: 'INTERN' as const },
    { id: uid(8008), case_id: uid(6001), title: 'Due diligence rapport — Nordhavn', file_url: '/docs/dd-nordhavn.pdf', file_name: 'dd-nordhavn.pdf', file_size_bytes: 520000, file_type: 'application/pdf', sensitivity: 'STRENGT_FORTROLIG' as const },
  ]

  await Promise.all(
    docData.map((d) =>
      prisma.document.upsert({
        where: { id: d.id }, update: {},
        create: { ...d, organization_id: org.id, uploaded_by: philip.id },
      })
    )
  )

  // ══════════════════════════════════════════════════════════════
  // 12. AUDIT LOG (seneste aktivitet)
  // ══════════════════════════════════════════════════════════════
  const auditData = [
    { id: uid(9001), user_id: philip.id, action: 'OPRETTET', resource_type: 'KONTRAKT', resource_id: uid(5080), created_at: daysAgo(5) },
    { id: uid(9002), user_id: maria.id, action: 'STATUS_AENDRET', resource_type: 'SAG', resource_id: uid(6002), created_at: daysAgo(3) },
    { id: uid(9003), user_id: philip.id, action: 'TILGAAET', resource_type: 'KONTRAKT', resource_id: uid(5001), sensitivity: 'STRENGT_FORTROLIG' as const, created_at: daysAgo(1) },
    { id: uid(9004), user_id: thomas.id, action: 'OPDATERET', resource_type: 'SELSKAB', resource_id: uid(1005), created_at: daysAgo(2) },
  ]

  await Promise.all(
    auditData.map((a) =>
      prisma.auditLog.upsert({
        where: { id: a.id }, update: {},
        create: { ...a, organization_id: org.id },
      })
    )
  )

  console.log('')
  console.log('✅ Demo-data indlæst!')
  console.log('')
  console.log('📊 Oversigt:')
  console.log('   7 selskaber (1 holding + 6 klinikker)')
  console.log('   10 personer (direktører, revisor, advokat, bank, forsikring)')
  console.log('   18 kontrakter (ejeraftaler, leje, forsikring, NDA, IT, ansættelse...)')
  console.log('   6 sager (opkøb, lejeforhandling, GDPR, compliance...)')
  console.log('   10 opgaver (2 forfaldne, 5 denne uge, 3 fremtidige)')
  console.log('   14 økonominøgletal (omsætning + EBITDA for 5 klinikker)')
  console.log('   8 dokumenter')
  console.log('')
  console.log('🔑 Login:')
  console.log('   philip@chainhub.dk / password123  (GROUP_OWNER)')
  console.log('   maria@tandlaegegruppen.dk / password123  (GROUP_LEGAL)')
  console.log('   thomas@tandlaegegruppen.dk / password123  (GROUP_FINANCE)')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
