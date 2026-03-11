/**
 * Server-side pagination utility
 * Brug i Server Components til at parse page-param og returnere slice-args
 */
export function parsePaginationParams(
  searchParamsPage: string | undefined,
  pageSize = 20
): { page: number; skip: number; take: number } {
  const page = Math.max(1, parseInt(searchParamsPage ?? '1', 10) || 1)
  return {
    page,
    skip: (page - 1) * pageSize,
    take: pageSize,
  }
}
