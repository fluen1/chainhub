export default function PersonListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="h-9 flex-1 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-5 w-20 animate-pulse rounded bg-gray-100" />
      </div>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['Navn', 'E-mail', 'Telefon', 'Roller', 'Selskaber', ''].map((h) => (
                <th
                  key={h}
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                <td className="px-6 py-4">
                  <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 w-40 animate-pulse rounded bg-gray-100" />
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-1">
                    <div className="h-5 w-16 animate-pulse rounded-full bg-gray-100" />
                    <div className="h-5 w-16 animate-pulse rounded-full bg-gray-100" />
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 w-16 animate-pulse rounded bg-gray-100" />
                </td>
                <td className="px-6 py-4">
                  <div className="h-4 w-16 animate-pulse rounded bg-gray-100" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}