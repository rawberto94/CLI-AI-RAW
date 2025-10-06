import React from 'react'

export const metadata = {
  title: 'Use Cases - Contract Intelligence Platform',
  description: 'Explore AI-powered contract intelligence use cases',
}

export default function UseCasesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen">
      {children}
    </main>
  )
}