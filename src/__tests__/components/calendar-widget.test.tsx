import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CalendarWidget } from '@/components/ui/calendar-widget'
import type { CalendarEvent } from '@/types/ui'

const events: CalendarEvent[] = [
  {
    id: 'e1',
    date: '2026-04-11',
    title: 'Udløb lejekontrakt',
    subtitle: 'Tandlæge Østerbro',
    type: 'expiry',
  },
  {
    id: 'e2',
    date: '2026-04-15',
    title: 'Bestyrelsesmøde',
    subtitle: 'TandlægeGruppen',
    type: 'meeting',
  },
  {
    id: 'e3',
    date: '2026-04-20',
    title: 'Sagsfrist',
    subtitle: 'Lejeforhandling',
    type: 'deadline',
    aiExtracted: true,
  },
]

const upcoming: CalendarEvent[] = [events[0], events[1]]

describe('CalendarWidget', () => {
  it('viser månedsnavn og år', () => {
    render(<CalendarWidget events={events} upcoming={upcoming} today="2026-04-11" />)
    expect(screen.getByText('April 2026')).toBeInTheDocument()
  })

  it('viser kommende events-liste', () => {
    render(<CalendarWidget events={events} upcoming={upcoming} today="2026-04-11" />)
    expect(screen.getByText('Udløb lejekontrakt')).toBeInTheDocument()
    expect(screen.getByText('Bestyrelsesmøde')).toBeInTheDocument()
  })

  it('viser "I dag" for event på today-datoen', () => {
    render(<CalendarWidget events={events} upcoming={upcoming} today="2026-04-11" />)
    expect(screen.getByText('I dag')).toBeInTheDocument()
  })

  it('viser AI-badge for aiExtracted events', () => {
    render(<CalendarWidget events={events} upcoming={[events[2]]} today="2026-04-11" />)
    expect(screen.getByText('AI')).toBeInTheDocument()
  })

  it('navigerer til næste måned ved klik på højre-pil', () => {
    render(<CalendarWidget events={events} upcoming={upcoming} today="2026-04-11" />)
    fireEvent.click(screen.getByLabelText('Næste måned'))
    expect(screen.getByText('Maj 2026')).toBeInTheDocument()
  })

  it('navigerer til forrige måned ved klik på venstre-pil', () => {
    render(<CalendarWidget events={events} upcoming={upcoming} today="2026-04-11" />)
    fireEvent.click(screen.getByLabelText('Forrige måned'))
    expect(screen.getByText('Marts 2026')).toBeInTheDocument()
  })

  it('viser tom-state hvis upcoming er tomt', () => {
    render(<CalendarWidget events={[]} upcoming={[]} today="2026-04-11" />)
    expect(screen.getByText(/Ingen planlagte besøg/)).toBeInTheDocument()
  })

  it('link peger på fullCalendarHref', () => {
    render(
      <CalendarWidget
        events={events}
        upcoming={upcoming}
        today="2026-04-11"
        fullCalendarHref="/calendar"
      />
    )
    const link = screen.getByRole('link', { name: /Åbn fuld kalender/ })
    expect(link).toHaveAttribute('href', '/calendar')
  })
})
