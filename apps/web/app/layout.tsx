import "./globals.css"
import { Sidebar } from "@/components/Sidebar"
import { Topbar } from "@/components/Topbar"
import { HealthBanner } from "./health-banner"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
  <HealthBanner />
  <div className="grid min-h-screen w-full grid-cols-[240px_1fr]">
          <Sidebar />
          <div className="flex flex-col">
            <Topbar />
            <main className="flex-1 p-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  )
}
