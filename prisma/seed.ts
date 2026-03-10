import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // 1. Opret test-organisation
  const org = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'TandlægeGruppen A/S',
      cvr: '12345678',
      plan: 'business',
      chain_structure: true,
    },
  })

  // 2. Opret test-bruger (GROUP_OWNER)
  const passwordHash = await bcrypt.hash('password123', 10)
  const user = await prisma.user.upsert({
    where: {
      organization_id_email: {
        organization_id: org.id,
        email: 'philip@chainhub.dk',
      },
    },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      organization_id: org.id,
      email: 'philip@chainhub.dk',
      name: 'Philip Larsen',
      password_hash: passwordHash,
    },
  })

  // 3. Tildel GROUP_OWNER rolle
  await prisma.userRoleAssignment.upsert({
    where: { id: '00000000-0000-0000-0000-000000000100' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000100',
      organization_id: org.id,
      user_id: user.id,
      role: 'GROUP_OWNER',
      scope: 'ALL',
      company_ids: [],
      created_by: user.id,
    },
  })

  // 4. Opret testselskaber
  const company1 = await prisma.company.upsert({
    where: { id: '00000000-0000-0000-0000-000000001001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000001001',
      organization_id: org.id,
      name: 'Tandlæge Østerbro ApS',
      cvr: '87654321',
      company_type: 'ApS',
      address: 'Østerbrogade 123',
      city: 'København Ø',
      postal_code: '2100',
      status: 'aktiv',
      created_by: user.id,
    },
  })

  const company2 = await prisma.company.upsert({
    where: { id: '00000000-0000-0000-0000-000000001002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000001002',
      organization_id: org.id,
      name: 'Tandlæge Aarhus ApS',
      cvr: '11223344',
      company_type: 'ApS',
      address: 'Frederiksgade 45',
      city: 'Aarhus C',
      postal_code: '8000',
      status: 'aktiv',
      created_by: user.id,
    },
  })

  // 5. Opret testpersoner
  const person1 = await prisma.person.upsert({
    where: { id: '00000000-0000-0000-0000-000000002001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000002001',
      organization_id: org.id,
      first_name: 'Anders',
      last_name: 'Jensen',
      email: 'anders@tandlaegegruppen.dk',
      phone: '+4512345678',
      created_by: user.id,
    },
  })

  const person2 = await prisma.person.upsert({
    where: { id: '00000000-0000-0000-0000-000000002002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000002002',
      organization_id: org.id,
      first_name: 'Rikke',
      last_name: 'Nielsen',
      email: 'rikke@tandlaegegruppen.dk',
      phone: '+4587654321',
      created_by: user.id,
    },
  })

  // 6. Tilknyt personer til selskaber
  await prisma.companyPerson.upsert({
    where: { id: '00000000-0000-0000-0000-000000003001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000003001',
      organization_id: org.id,
      company_id: company1.id,
      person_id: person1.id,
      role: 'Direktør',
      start_date: new Date('2020-01-01'),
      created_by: user.id,
    },
  })

  await prisma.companyPerson.upsert({
    where: { id: '00000000-0000-0000-0000-000000003002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000003002',
      organization_id: org.id,
      company_id: company2.id,
      person_id: person2.id,
      role: 'Direktør',
      start_date: new Date('2021-06-01'),
      created_by: user.id,
    },
  })

  // 7. Opret ejerskaber
  await prisma.ownership.upsert({
    where: { id: '00000000-0000-0000-0000-000000004001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000004001',
      organization_id: org.id,
      company_id: company1.id,
      owner_person_id: person1.id,
      ownership_pct: 45,
      effective_date: new Date('2020-01-01'),
      created_by: user.id,
    },
  })

  await prisma.ownership.upsert({
    where: { id: '00000000-0000-0000-0000-000000004002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000004002',
      organization_id: org.id,
      company_id: company2.id,
      owner_person_id: person2.id,
      ownership_pct: 51,
      effective_date: new Date('2021-06-01'),
      created_by: user.id,
    },
  })

  console.log('Seed completed successfully!')
  console.log('Test login: philip@chainhub.dk / password123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
