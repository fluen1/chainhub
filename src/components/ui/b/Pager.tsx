import { cn } from '@/lib/utils'

// ────────────────────────────────────────────────────────────────────────────
// Pager — pagination-strip nederst på list-pages.
//
// Brug:
//   <Pager
//     info="1–10 af 184"
//     page={1}
//     maxPage={19}
//     onPage={(p) => setPage(p)}
//     pageSize={10}
//     onPageSize={(n) => setPageSize(n)}
//   />
// ────────────────────────────────────────────────────────────────────────────

export function Pager({
  info,
  page,
  maxPage,
  onPage,
  pageSize,
  onPageSize,
  sizes = [10, 25, 50],
}: {
  info: React.ReactNode
  page?: number
  maxPage?: number
  onPage?: (n: number) => void
  pageSize?: number
  onPageSize?: (n: number) => void
  sizes?: number[]
}) {
  return (
    <div className="flex items-center justify-between rounded-[4px] border border-b-border bg-b-panel px-3 py-1.5">
      <span className="b-tnum text-[12px] text-b-2">{info}</span>
      {/* Skjul side-navigation når der kun er én side (ingen "1 / 1"-pile-støj). */}
      {page != null && maxPage != null && maxPage > 1 && onPage && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-[3px] border border-b-border-strong bg-white px-2 py-0.5 text-[11px] text-b-1 hover:bg-[#f6f8fa] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            aria-label="Forrige side"
          >
            ←
          </button>
          <span className="b-tnum px-1 text-[12px] text-b-2">
            {page} / {maxPage}
          </span>
          <button
            type="button"
            className="rounded-[3px] border border-b-border-strong bg-white px-2 py-0.5 text-[11px] text-b-1 hover:bg-[#f6f8fa] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={page >= maxPage}
            onClick={() => onPage(page + 1)}
            aria-label="Næste side"
          >
            →
          </button>
        </div>
      )}
      {pageSize != null && onPageSize && (
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-b-2">Vis:</span>
          {sizes.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onPageSize(n)}
              className={cn(
                'rounded-[3px] border px-1.5 py-px text-[11px]',
                pageSize === n
                  ? 'border-[#c1c5cc] bg-[#e8eaee] font-medium text-b-1'
                  : 'border-b-border-strong bg-white text-b-2 hover:bg-[#f6f8fa]'
              )}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
