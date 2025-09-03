// src/components/Layout.tsx
import { ReactNode } from 'react'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-white shadow-md">
        {/* Add sidebar navigation here */}
        <div className="p-4 font-bold">ResysPH</div>
        {/* Add links here if needed */}
      </aside>
      <div className="flex-1 p-6">{children}</div>
    </div>
  )
}
