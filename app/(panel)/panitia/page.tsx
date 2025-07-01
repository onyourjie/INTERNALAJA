/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePITAccess } from '@/hooks/usePITAccess'
import ErrorBoundary from '@/components/ErrorBoundary'
import dynamic from 'next/dynamic'

// Dynamic import untuk ListAdmin
const ListAdmin = dynamic(() => import('@/components/Panitia/ListAdmin'), {
  ssr: false,
  loading: () => (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 rounded mb-4"></div>
      <div className="h-64 bg-gray-200 rounded"></div>
    </div>
  )
});

function PanitiaPageContent() {
  // Always call hooks in the same order
  const router = useRouter()
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [mounted, setMounted] = useState(false)
  
  // Always call usePITAccess hook
  const { hasAccess, loading, panitiaData, error, retry } = usePITAccess({
    redirectOnDenied: true,
    unauthorizedRedirectUrl: '/unauthorized',
    maxRetries: 3,
    retryDelay: 2000
  });

  // Always call useEffect for mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Always define handlers - no conditional definitions
  const handleEdit = (id: number, data: any) => {
    console.log('Edit panitia:', id, data)
    router.push(`/panitia/edit/${id}`)
  }

  const handleDelete = (id: number, data: any) => {
    console.log('Deleted panitia:', id, data)
    setRefreshTrigger(prev => prev + 1)
  }

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  // Don't render until mounted to prevent hydration issues
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded mb-2 w-48"></div>
          <div className="h-4 bg-gray-200 rounded w-32"></div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Memverifikasi akses PIT...</p>
          {error && (
            <p className="text-sm text-orange-600 mt-2">{error}</p>
          )}
        </div>
      </div>
    );
  }

  // Error state
  if (error && !hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg max-w-md">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Gagal Memverifikasi Akses</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={retry}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Coba Lagi
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Kembali ke Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Access denied (should already be redirected, but as fallback)
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Akses Ditolak</h2>
          <p className="text-gray-600">Anda tidak memiliki akses ke halaman ini.</p>
        </div>
      </div>
    );
  }

  // Main content - only render when we have access
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Management Panitia
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Panel khusus divisi PIT untuk mengelola data panitia
              </p>
            </div>
            
            {panitiaData && (
              <div className="bg-blue-50 rounded-lg px-4 py-2">
                <p className="text-sm font-medium text-blue-900">
                  {panitiaData.nama_lengkap}
                </p>
                <p className="text-xs text-blue-600">
                  {panitiaData.jabatan_nama} - Divisi {panitiaData.divisi_nama}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3">
            <div className="flex space-x-4">
              <button
                onClick={() => router.push('/panitia/tambah')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Tambah Admin Panel
              </button>
              
              <button
                onClick={() => router.push('/panitia/buatqr')}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                Tambah Panitia
              </button>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleRefresh}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>

              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium">
                ✓ PIT Access
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Daftar Panitia
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Kelola data panitia untuk semua divisi
            </p>
          </div>
          
          <div className="p-6">
            <ListAdmin
              key={refreshTrigger}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onRefresh={handleRefresh}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PanitiaListPage() {
  return (
    <ErrorBoundary>
      <PanitiaPageContent />
    </ErrorBoundary>
  );
}