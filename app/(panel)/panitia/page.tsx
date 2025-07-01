// File: app/(panel)/panitia/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ListAdmin from '@/components/Panitia/ListAdmin'
import type { Metadata } from 'next'

export default function PanitiaListPage() {
  const router = useRouter()
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Handle edit action
  const handleEdit = (id: number, data: any) => {
    console.log('Edit panitia:', id, data)
    // Navigate to edit page with dynamic routing
    router.push(`/panitia/edit/${id}`)
  }

  // Handle delete action
  const handleDelete = (id: number, data: any) => {
    console.log('Deleted panitia:', id, data)
    // Trigger refresh after successful delete
    setRefreshTrigger(prev => prev + 1)
  }

  // Handle refresh
  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Breadcrumb */}
            <nav className="flex items-center space-x-2 text-sm text-gray-500">
              <button 
                onClick={() => router.push('/dashboard')}
                className="hover:text-blue-600 transition-colors"
              >
                Dashboard
              </button>
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-900 font-medium">Panitia</span>
            </nav>

            {/* Actions */}
            <div className="flex items-center space-x-4">
              <button
                onClick={handleRefresh}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              <button
                onClick={() => router.push('/panitia/tambah')}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Tambah Panitia
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Page Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Daftar Panitia
          </h1>
          <p className="text-gray-600">
            Kelola data anggota panitia RAJA Brawijaya
          </p>
        </div>

        {/* List Component */}
        <ListAdmin
          onEdit={handleEdit}
          onDelete={handleDelete}
          onRefresh={refreshTrigger}
          showActions={true}
          itemsPerPage={15}
          className="mb-8"
        />
      </div>
    </div>
  )
}