import { NextRequest, NextResponse } from 'next/server'
import { checkContractDeadlines } from '@/lib/cron/check-deadlines'

// Vercel Cron kræver at denne header valideres
const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: NextRequest) {
  // Valider CRON_SECRET header
  const authHeader = request.headers.get('authorization')
  
  if (!CRON_SECRET) {
    console.error('CRON_SECRET environment variable er ikke sat')
    return NextResponse.json(
      { error: 'Server konfigurationsfejl' },
      { status: 500 }
    )
  }
  
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    console.warn('Uautoriseret cron-kald forsøgt')
    return NextResponse.json(
      { error: 'Ikke autoriseret' },
      { status: 401 }
    )
  }
  
  try {
    console.log('Starter deadline-check cron job...')
    const startTime = Date.now()
    
    const result = await checkContractDeadlines()
    
    const duration = Date.now() - startTime
    
    console.log('Deadline-check færdig:', {
      ...result,
      durationMs: duration,
    })
    
    // Log eventuelle fejl
    if (result.errors.length > 0) {
      console.error('Fejl under deadline-check:', result.errors)
    }
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      durationMs: duration,
      ...result,
    })
  } catch (error) {
    console.error('Kritisk fejl i deadline-check cron:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Ukendt fejl',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// POST for manuel trigger (kun i development)
export async function POST(request: NextRequest) {
  // Kun tilladt i development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Kun tilgængelig i development mode' },
      { status: 403 }
    )
  }
  
  try {
    const result = await checkContractDeadlines()
    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ukendt fejl' },
      { status: 500 }
    )
  }
}