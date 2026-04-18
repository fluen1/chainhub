import { describe, it, expect } from 'vitest'
import {
  zodCaseType,
  zodCaseSubtype,
  zodCaseStatus,
  zodContractStatus,
  zodContractSystemType,
  zodChangeType,
  zodTaskStatus,
  zodTaskPriority,
  zodVisitType,
  zodVisitStatus,
  zodMetricType,
  zodPeriodType,
  zodMetricSource,
  zodSensitivityLevel,
} from '@/lib/zod-enums'

/**
 * Disse tests verificerer at Zod-schemaerne matcher Prisma-enums eksakt.
 * Hvis Prisma-schemaet ændres, skal en test her fejle (rød før grøn).
 */

describe('zodCaseType', () => {
  it('accepterer valid sagstype', () => {
    expect(zodCaseType.parse('TRANSAKTION')).toBe('TRANSAKTION')
    expect(zodCaseType.parse('GOVERNANCE')).toBe('GOVERNANCE')
  })
  it('afviser ukendt sagstype', () => {
    expect(() => zodCaseType.parse('UGYLDIG')).toThrow()
    expect(() => zodCaseType.parse('transaktion')).toThrow()
  })
})

describe('zodCaseSubtype', () => {
  it('accepterer valid undertype', () => {
    expect(zodCaseSubtype.parse('VIRKSOMHEDSKOEB')).toBe('VIRKSOMHEDSKOEB')
    expect(zodCaseSubtype.parse('MYNDIGHEDSPAABUD')).toBe('MYNDIGHEDSPAABUD')
    expect(zodCaseSubtype.parse('BESTYRELSESMOEDE')).toBe('BESTYRELSESMOEDE')
  })
  it('afviser gammel stavefejl-værdi', () => {
    // Pre-existing typo i CASE_SUBTYPE_BY_TYPE skulle fange denne test
    expect(() => zodCaseSubtype.parse('VIRKSOMHEDSKOB')).toThrow()
    expect(() => zodCaseSubtype.parse('BESTYRELSESMOED')).toThrow()
  })
})

describe('zodCaseStatus', () => {
  it('accepterer valid sagsstatus', () => {
    expect(zodCaseStatus.parse('NY')).toBe('NY')
    expect(zodCaseStatus.parse('AFVENTER_EKSTERN')).toBe('AFVENTER_EKSTERN')
  })
  it('afviser ukendt status', () => {
    expect(() => zodCaseStatus.parse('AKTIV_TASK')).toThrow()
  })
})

describe('zodContractStatus', () => {
  it('accepterer valid kontraktstatus', () => {
    expect(zodContractStatus.parse('UDKAST')).toBe('UDKAST')
    expect(zodContractStatus.parse('UDLOEBET')).toBe('UDLOEBET')
  })
  it('afviser ukendt status', () => {
    expect(() => zodContractStatus.parse('UDLOBET')).toThrow()
    expect(() => zodContractStatus.parse('aktiv')).toThrow()
  })
})

describe('zodContractSystemType', () => {
  it('accepterer valid systemtype', () => {
    expect(zodContractSystemType.parse('EJERAFTALE')).toBe('EJERAFTALE')
    expect(zodContractSystemType.parse('NDA')).toBe('NDA')
    expect(zodContractSystemType.parse('INTERCOMPANY_LAAN')).toBe('INTERCOMPANY_LAAN')
  })
  it('afviser ukendt systemtype', () => {
    expect(() => zodContractSystemType.parse('EJERAFTAL')).toThrow()
  })
})

describe('zodChangeType', () => {
  it('accepterer valid ændringstype', () => {
    expect(zodChangeType.parse('REDAKTIONEL')).toBe('REDAKTIONEL')
    expect(zodChangeType.parse('NY_VERSION')).toBe('NY_VERSION')
  })
  it('afviser ukendt ændringstype', () => {
    expect(() => zodChangeType.parse('ÆNDRING')).toThrow()
  })
})

describe('zodTaskStatus', () => {
  it('accepterer valid opgavestatus', () => {
    expect(zodTaskStatus.parse('NY')).toBe('NY')
    expect(zodTaskStatus.parse('AKTIV_TASK')).toBe('AKTIV_TASK')
  })
  it('afviser AKTIV — som er case-status, ikke task-status', () => {
    expect(() => zodTaskStatus.parse('AKTIV')).toThrow()
  })
})

describe('zodTaskPriority', () => {
  it('accepterer valid prioritet', () => {
    expect(zodTaskPriority.parse('LAV')).toBe('LAV')
    expect(zodTaskPriority.parse('KRITISK')).toBe('KRITISK')
  })
  it('afviser ukendt prioritet', () => {
    expect(() => zodTaskPriority.parse('HØJ')).toThrow()
    expect(() => zodTaskPriority.parse('HIGH')).toThrow()
  })
})

describe('zodVisitType', () => {
  it('accepterer valid besøgstype', () => {
    expect(zodVisitType.parse('KVARTALSBESOEG')).toBe('KVARTALSBESOEG')
    expect(zodVisitType.parse('AD_HOC')).toBe('AD_HOC')
  })
  it('afviser ukendt besøgstype', () => {
    expect(() => zodVisitType.parse('BESOEG')).toThrow()
  })
})

describe('zodVisitStatus', () => {
  it('accepterer valid besøgsstatus', () => {
    expect(zodVisitStatus.parse('PLANLAGT')).toBe('PLANLAGT')
    expect(zodVisitStatus.parse('GENNEMFOERT')).toBe('GENNEMFOERT')
  })
  it('afviser ukendt besøgsstatus', () => {
    expect(() => zodVisitStatus.parse('FULDFØRT')).toThrow()
  })
})

describe('zodMetricType', () => {
  it('accepterer valid metrictype', () => {
    expect(zodMetricType.parse('OMSAETNING')).toBe('OMSAETNING')
    expect(zodMetricType.parse('ANDET_METRIC')).toBe('ANDET_METRIC')
  })
  it('afviser uden _METRIC suffix (Prisma identifier, ikke DB-navn)', () => {
    expect(() => zodMetricType.parse('ANDET')).toThrow()
  })
})

describe('zodPeriodType', () => {
  it('accepterer valid periodetype', () => {
    expect(zodPeriodType.parse('HELAAR')).toBe('HELAAR')
    expect(zodPeriodType.parse('Q1')).toBe('Q1')
  })
  it('afviser ukendt periodetype', () => {
    expect(() => zodPeriodType.parse('Q5')).toThrow()
  })
})

describe('zodMetricSource', () => {
  it('accepterer valid kilde', () => {
    expect(zodMetricSource.parse('REVIDERET')).toBe('REVIDERET')
    expect(zodMetricSource.parse('ESTIMAT')).toBe('ESTIMAT')
  })
  it('afviser ukendt kilde', () => {
    expect(() => zodMetricSource.parse('AUDITED')).toThrow()
  })
})

describe('zodSensitivityLevel', () => {
  it('accepterer valid sensitivitetsniveau', () => {
    expect(zodSensitivityLevel.parse('PUBLIC')).toBe('PUBLIC')
    expect(zodSensitivityLevel.parse('STRENGT_FORTROLIG')).toBe('STRENGT_FORTROLIG')
  })
  it('afviser ukendt niveau', () => {
    expect(() => zodSensitivityLevel.parse('TOP_SECRET')).toThrow()
  })
})
