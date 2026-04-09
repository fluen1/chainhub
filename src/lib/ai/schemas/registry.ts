import type { ContractSchema } from './types'

const schemaMap = new Map<string, ContractSchema>()

export function registerSchema(schema: ContractSchema): void {
  schemaMap.set(schema.contract_type, schema)
}

export function getSchema(contractType: string): ContractSchema | null {
  return schemaMap.get(contractType) ?? null
}

export function getAllSchemaTypes(): string[] {
  return Array.from(schemaMap.keys())
}

export function hasSchema(contractType: string): boolean {
  return schemaMap.has(contractType)
}
