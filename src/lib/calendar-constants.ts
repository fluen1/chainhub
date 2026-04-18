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
