import { PrototypeSidebar } from '@/components/layout/prototype-sidebar'
import { PrototypeHeader } from '@/components/layout/prototype-header'
import { PrototypeProvider } from '@/components/prototype/PrototypeProvider'
import { RoleSwitcher } from '@/components/prototype/RoleSwitcher'

export default function PrototypeLayout({ children }: { children: React.ReactNode }) {
  return (
    <PrototypeProvider>
      <div className="flex h-screen overflow-hidden">
        <div className="hidden lg:flex">
          <PrototypeSidebar />
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          <RoleSwitcher />
          <PrototypeHeader />
          <main className="flex-1 overflow-y-auto bg-[#f0f2f5] p-6">
            {children}
          </main>
        </div>
      </div>
    </PrototypeProvider>
  )
}
