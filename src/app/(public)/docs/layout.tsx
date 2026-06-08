import { DocsSidebar } from '@/components/public/DocsSidebar'

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 md:flex-row">
      <aside className="shrink-0 md:w-56">
        <DocsSidebar />
      </aside>
      <article className="min-w-0 flex-1 space-y-6 text-[13px] leading-relaxed text-b-1">
        {children}
      </article>
    </div>
  )
}
