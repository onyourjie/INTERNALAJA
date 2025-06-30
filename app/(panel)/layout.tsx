// File: app/(panel)/layout.tsx

"use client"

import React, { useCallback, useState } from "react"
import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import Sidebar from "@/components/Sidebar"
import ProfileAvatar from "@/components/ProfileAvatar"
import { useUser } from "@/contexts/UserContext"

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const { userData, loading, error } = useUser()
  const router = useRouter()
  
  const handleToggle = useCallback((open: boolean) => setSidebarOpen(open), [])
  const handleClose = useCallback(() => setSidebarOpen(false), [])

  // Function to handle logout
  const handleLogout = useCallback(async () => {
    try {
      setIsLoggingOut(true)
      
      // Clear all cookies
      document.cookie.split(";").forEach((c) => {
        const eqPos = c.indexOf("=")
        const name = eqPos > -1 ? c.substr(0, eqPos) : c
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/"
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=" + window.location.hostname
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=." + window.location.hostname
      })
      
      // Sign out from NextAuth
      await signOut({ 
        redirect: false,
        callbackUrl: "/"
      })
      
      // Clear localStorage and sessionStorage
      localStorage.clear()
      sessionStorage.clear()
      
      // Redirect to home page
      router.push("/")
      
    } catch (error) {
      console.error("Error during logout:", error)
      // Force redirect even if there's an error
      window.location.href = "/"
    } finally {
      setIsLoggingOut(false)
    }
  }, [router])

  // Jika masih loading, tampilkan loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat data user...</p>
        </div>
      </div>
    )
  }

  // Jika ada error, tampilkan error state
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center p-6 bg-red-50 border border-red-200 rounded-lg max-w-md">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.348 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-red-900 mb-2">Terjadi Kesalahan</h3>
          <p className="text-sm text-red-700 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Muat Ulang
          </button>
        </div>
      </div>
    )
  }

  // Cek apakah user adalah dari divisi PIT
  const isPITUser = userData?.isPIT === true
  
  return (
    <div className="relative flex min-h-screen bg-gray-50">
      {/* ─── Sidebar (hanya tampil jika user PIT) ─── */}
      {isPITUser && (
        <Sidebar isOpen={sidebarOpen} onToggle={handleToggle} onClose={handleClose} />
      )}

      {/* ─── Konten ─── */}
      <div className="flex flex-col flex-1">
        {/* Header mobile (hanya tampil jika user PIT) */}
        {isPITUser && (
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
        )}

        {/* Area konten */}
        <main className={`flex-1 ${isPITUser ? 'lg:ml-64' : ''}`}>
          <div className="max-w-7xl mx-auto px-4 py-6 lg:px-6 lg:py-8">
            {/* Logout Button - Always visible at top right */}
            <div className="flex justify-end mb-4">
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 
                           disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                aria-label="Logout"
              >
                {isLoggingOut ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span className="text-sm font-medium">Logging out...</span>
                  </>
                ) : (
                  <>
                    <svg 
                      className="w-4 h-4" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                      <polyline points="16,17 21,12 16,7"></polyline>
                      <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    <span className="text-sm font-medium">Logout</span>
                  </>
                )}
              </button>
            </div>

            {/* Tampilkan informasi jika bukan user PIT */}
            {!isPITUser && userData && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <ProfileAvatar 
                    imageUrl={userData.profile_image} // Prioritas users.image
                    name={userData.nama_lengkap}
                    size="lg"
                    showBorder={true}
                    borderColor="border-blue-300"
                  />
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      Selamat datang, {userData.nama_lengkap}
                    </p>
                    <p className="text-xs text-blue-700">
                      {userData.jabatan_nama} - {userData.divisi_nama}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}