/**
 * Danske kalender-constanter. Brug disse i stedet for inline arrays
 * i kalender-komponenter og dato-formattering.
 */

/** Fulde månedsnavne med stort begyndelsesbogstav (fx til overskrifter: "Januar 2026"). */
export const MONTH_NAMES_DA = [
  'Januar',
  'Februar',
  'Marts',
  'April',
  'Maj',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'December',
] as const

/** Korte månedsnavne i små bogstaver (fx til kompakte dato-labels: "12. jan"). */
export const MONTH_NAMES_DA_SHORT = [
  'jan',
  'feb',
  'mar',
  'apr',
  'maj',
  'jun',
  'jul',
  'aug',
  'sep',
  'okt',
  'nov',
  'dec',
] as const

/** Ugedage (2-bogstavs forkortelser), mandag først — standard-rækkefølge i DK kalendere. */
export const WEEKDAYS_DA_SHORT = ['Ma', 'Ti', 'On', 'To', 'Fr', 'Lø', 'Sø'] as const

/** Fulde ugedagsnavne i små bogstaver, mandag først (fx til agenda-view: "mandag"). */
export const WEEKDAYS_DA_FULL = [
  'mandag',
  'tirsdag',
  'onsdag',
  'torsdag',
  'fredag',
  'lørdag',
  'søndag',
] as const

/**
 * Fulde ugedagsnavne med stort begyndelsesbogstav, søndag først
 * (indeks matcher `Date.getDay()`: 0=søndag, 1=mandag, …).
 */
export const WEEKDAYS_DA_FULL_SUN = [
  'Søndag',
  'Mandag',
  'Tirsdag',
  'Onsdag',
  'Torsdag',
  'Fredag',
  'Lørdag',
] as const

/** Korte månedsnavne i små bogstaver (samme som MONTH_NAMES_DA_SHORT, alias for klarhed). */
export const MONTH_NAMES_DA_LOWER = [
  'januar',
  'februar',
  'marts',
  'april',
  'maj',
  'juni',
  'juli',
  'august',
  'september',
  'oktober',
  'november',
  'december',
] as const
