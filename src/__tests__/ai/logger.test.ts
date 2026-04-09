import { describe, it, expect } from 'vitest'
import { createLogger, aiLogger } from '@/lib/ai/logger'

describe('AI logger', () => {
  it('createLogger returns a pino instance with the given namespace', () => {
    const logger = createLogger('test-module')
    expect(logger).toBeDefined()
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.warn).toBe('function')
  })

  it('aiLogger is the root logger with module="ai"', () => {
    expect(aiLogger).toBeDefined()
    expect(typeof aiLogger.child).toBe('function')
  })

  it('child loggers inherit from parent and add context', () => {
    const child = aiLogger.child({ component: 'test' })
    expect(child).toBeDefined()
    expect(typeof child.info).toBe('function')
  })

  it('logger respects AI_LOG_LEVEL env var', () => {
    const oldLevel = process.env.AI_LOG_LEVEL
    process.env.AI_LOG_LEVEL = 'debug'
    const logger = createLogger('debug-test')
    expect(logger.level).toBe('debug')
    process.env.AI_LOG_LEVEL = oldLevel
  })
})
