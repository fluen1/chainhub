/**
 * Geocoding via OpenStreetMap Nominatim (gratis, ingen API-key).
 * Rate limit: max 1 request/sekund — acceptabelt for 5-56 selskaber.
 */

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
}

export interface GeocodingResult {
  latitude: number
  longitude: number
}

export async function geocodeAddress(
  address: string | null,
  city: string | null,
  postalCode: string | null,
  country: string = 'Denmark'
): Promise<GeocodingResult | null> {
  const parts = [address, postalCode, city, country].filter(Boolean)
  if (parts.length < 2) return null

  const query = parts.join(', ')

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', query)
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '1')
    url.searchParams.set('countrycodes', 'dk')

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'ChainHub/1.0 (porteføljestyring)',
      },
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) return null

    const results: NominatimResult[] = await response.json()
    if (results.length === 0) return null

    return {
      latitude: parseFloat(results[0].lat),
      longitude: parseFloat(results[0].lon),
    }
  } catch {
    return null
  }
}
