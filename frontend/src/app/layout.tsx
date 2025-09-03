// src/app/layout.tsx
import './globals.css'
import { ReactNode } from 'react'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'ResysPH',
  description: 'Restaurant reservation system for the Philippines',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Shared layout content like nav or sidebar goes here */}
        <main className="min-h-screen bg-gray-50 text-gray-900">
          {children}
        </main>
      </body>
    </html>
  )
}
