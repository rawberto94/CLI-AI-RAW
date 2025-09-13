import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Sidebar } from '../components/Sidebar'
import { Topbar } from '../components/Topbar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Contract Intelligence Platform',
  description: 'Advanced contract lifecycle management and analytics',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen`}>
        <div className="grid grid-cols-[var(--sidebar-w),1fr] grid-rows-[auto,1fr] min-h-screen">
          <aside className="row-span-2 sticky top-0 h-screen border-r bg-white/90 backdrop-blur
                             dark:bg-slate-950/80 dark:border-slate-800">
            <Sidebar/>
          </aside>

          <header className="h-14 border-b bg-white/70 backdrop-blur px-4 flex items-center gap-3
                             dark:bg-slate-950/60 dark:border-slate-800">
            <Topbar/>
          </header>

          <main className="px-6 lg:px-8 py-6">{children}</main>
        </div>
      </body>
    </html>
  )
}
