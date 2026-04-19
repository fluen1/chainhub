import { getAIUsageDashboard } from '@/actions/ai-usage'
import { AIUsageClient } from './ai-usage-client'
import { redirect } from 'next/navigation'

export const metadata = { title: 'AI-forbrug — ChainHub' }

export default async function AIUsagePage() {
  const result = await getAIUsageDashboard()
  if ('error' in result) {
    if (result.error === 'Ikke autoriseret') redirect('/login')
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">AI-forbrug</h1>
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">{result.error}</div>
      </div>
    )
  }
  return <AIUsageClient data={result.data} />
}
