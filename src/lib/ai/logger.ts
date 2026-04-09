import pino from 'pino'

const transport =
  process.env.NODE_ENV === 'production'
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
