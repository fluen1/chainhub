import pino from 'pino'

// pino-pretty kan ikke bruges fra Next.js Server Components: transportet
// spawner en worker-traad via thread-stream som doer naar Next.js river
// modul-konteksten ned mellem requests (BLK-004). Vi disabler transport
// helt i Next.js-runtime — det giver NDJSON paa stdout, som kan pipes
// gennem `pino-pretty` fra kommandolinjen hvis oensket. Standalone workers
// udenfor Next.js beholder pino-pretty.
const insideNextjs = !!process.env.NEXT_RUNTIME

const transport =
  process.env.NODE_ENV === 'production' || insideNextjs
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname,module',
        },
      }

export const aiLogger = pino({
  level: process.env.AI_LOG_LEVEL || 'info',
  base: { module: 'ai' },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(transport ? { transport } : {}),
})

export function createLogger(namespace: string) {
  const level = process.env.AI_LOG_LEVEL || 'info'
  return pino({
    level,
    base: { module: 'ai', namespace },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(transport ? { transport } : {}),
  })
}
