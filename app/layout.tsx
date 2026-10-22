import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import AppShell from './components/app-shell'
import './globals.css'


export const metadata: Metadata = {
  title: 'TideSecret',
  description: 'TideSecret with TideCloak authentication',
}

interface RootLayoutProps {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
