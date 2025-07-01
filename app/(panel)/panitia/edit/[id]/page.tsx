/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import EditAdmin from '@/components/Panitia/EditAdmin'
import Swal from 'sweetalert2'

interface PageParams {
  id: string
}

// Define proper type for success handler data
interface UpdateSuccessData {
  id: number
  nama_lengkap: string
  email: string
  divisi_id: number
  jabatan_id: number
  message?: string
}

export default function EditPanitiaPage() {
  const params = useParams()
  const router = useRouter()
  const [panitiaId, setPanitiaId] = useState<number | null>(null)
  const [isValidId, setIsValidId] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    // Validate and parse ID from URL params
    if (params?.id) {
      // More careful type checking for params.id
      const id = Array.isArray(params.id) ? params.id[0] : params.id
      
      if (typeof id === 'string') {
        const parsedId = parseInt(id)
        
        console.log('Route params:', params)
        console.log('Parsing ID:', id, '->', parsedId)
        
        if (isNaN(parsedId) || parsedId <= 0) {
          console.error('Invalid ID:', id)
          setIsValidId(false)
          
          // Show error and redirect
          Swal.fire({
            title: 'ID Tidak Valid',
            text: 'ID panitia yang diminta tidak valid.',
            icon: 'error',
            confirmButtonText: 'Kembali ke Daftar',
            confirmButtonColor: '#EF4444'
          }).then(() => {
            router.push('/panitia')
          })
        } else {
          console.log('Valid ID found:', parsedId)
          setPanitiaId(parsedId)
          setIsValidId(true)
        }
      } else {
        console.error('Invalid ID type:', typeof id)
        setIsValidId(false)
        router.push('/panitia')
      }
    } else {
      console.error('No ID parameter found')
      setIsValidId(false)
      router.push('/panitia')
    }
    
    setIsInitialized(true)
  }, [params, router])

  // Handle success callback with proper typing
  const handleSuccess = (data: UpdateSuccessData) => {
    console.log('Panitia berhasil diperbarui:', data)
    
    // Show redirect confirmation after a delay
    setTimeout(() => {
      Swal.fire({
        title: 'Kembali ke Daftar?',
        text: 'Data berhasil diperbarui. Apakah Anda ingin kembali ke daftar panitia?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Kembali',
        cancelButtonText: 'Edit Lagi',
        confirmButtonColor: '#3B82F6',
        cancelButtonColor: '#6B7280'
      }).then((result) => {
        if (result.isConfirmed) {
          router.push('/panitia')
        }
        // If user chooses to edit again, stay on current page
      })
    }, 500)
  }

  // Handle cancel action
  const handleCancel = () => {
    // Navigate back to list
    router.push('/panitia')
  }

  // Show loading while initializing
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 mx-auto text-blue-600 mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Menginisialisasi halaman...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (!isValidId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.866-.833-2.636 0L3.18 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">ID Tidak Valid</h3>
          <p className="text-gray-600 mb-4">ID panitia yang diminta tidak valid atau tidak ditemukan.</p>
          <button
            onClick={() => router.push('/panitia')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Kembali ke Daftar
          </button>
        </div>
      </div>
    )
  }

  // Show loading while getting ID
  if (panitiaId === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 mx-auto text-blue-600 mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Memvalidasi ID...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header/Navigation */}
      <div className="shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Breadcrumb */}
            <nav className="flex items-center space-x-2 text-sm text-gray-500">
              <button 
                onClick={() => router.push('/panel')}
                className="hover:text-blue-600 transition-colors"
              >
                Panel
              </button>
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              <button 
                onClick={() => router.push('/panitia')}
                className="hover:text-blue-600 transition-colors"
              >
                Panitia
              </button>
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-gray-900 font-medium">Edit #{panitiaId}</span>
            </nav>

            {/* Back Button */}
            <button
              onClick={handleCancel}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Kembali ke Daftar
            </button>
          </div>
        </div>
      </div>

      {/* Page Title */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Edit Data Panitia
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Perbarui informasi anggota panitia. Email tidak dapat diubah setelah pendaftaran.
          </p>
        </div>

        {/* Instructions Card */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="border border-blue-200 rounded-lg p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-blue-900 mb-2">
                  Petunjuk Edit Data
                </h3>
                <ul className="text-blue-800 space-y-1 text-sm">
                  <li>• Hanya nama lengkap, divisi, dan jabatan yang dapat diubah</li>
                  <li>• Email tidak dapat diubah untuk menjaga integritas data</li>
                  <li>• Perubahan akan langsung disimpan ke sistem</li>
                  <li>• Pastikan data yang diubah sudah benar sebelum menyimpan</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Component */}
        <div className="flex justify-center">
          <div className="w-full max-w-4xl">
            <EditAdmin 
              panitiaId={panitiaId}
              onSuccess={handleSuccess}
              onCancel={handleCancel}
              className="min-h-0"
            />
          </div>
        </div>

        {/* Additional Info */}
        <div className="max-w-4xl mx-auto mt-8">
          <div className="border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">
              Informasi Penting
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Apa yang Dapat Diubah:</h4>
                <ul className="text-gray-600 space-y-1 text-sm">
                  <li>• Nama lengkap panitia</li>
                  <li>• Divisi penempatan</li>
                  <li>• Jabatan dalam divisi</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Apa yang Tidak Dapat Diubah:</h4>
                <ul className="text-gray-600 space-y-1 text-sm">
                  <li>• Alamat email (untuk keamanan)</li>
                  <li>• Tanggal bergabung</li>
                  <li>• ID unik panitia</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}