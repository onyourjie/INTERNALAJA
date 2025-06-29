"use client"

import React, { useCallback, useState } from "react"
import Sidebar from "@/components/Sidebar"

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const handleToggle = useCallback((open: boolean) => setSidebarOpen(open), [])
  const handleClose  = useCallback(() => setSidebarOpen(false), [])

  return (
    <div className="relative flex min-h-screen bg-gray-50">
      {/* ─── Sidebar (desktop & mobile) ─── */}
      <Sidebar isOpen={sidebarOpen} onToggle={handleToggle} onClose={handleClose} />

      {/* ─── Konten ─── */}
      <div className="flex flex-col flex-1">
        {/* Header mobile (sticky) */}
        <div className="sticky top-0 z-40 lg:hidden h-14 w-full flex items-center gap-2
                         bg-gray-50/95 backdrop-blur border-b border-gray-200">
          {/* Burger */}
          <button
            aria-label="Buka sidebar"
            className="absolute left-4 p-2"
            onClick={() => setSidebarOpen(true)}
          >
            <svg
              className="w-6 h-6 text-gray-700"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Logo di tengah */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">RB</span>
            </div>
            <span className="text-base font-semibold text-gray-800">
              RAJA Brawijaya
            </span>
          </div>
        </div>

        {/* Area konten */}
        <main className="flex-1 lg:ml-64">
          <div className="max-w-7xl mx-auto px-4 py-6 lg:px-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
