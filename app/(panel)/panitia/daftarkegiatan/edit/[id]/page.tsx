'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, AlertCircle, Loader2, CalendarDays } from 'lucide-react'
import BuatKegiatan from '@/components/kegiatan/BuatKegiatan'

interface KegiatanData {
  id: number
  nama: string
  deskripsi?: string
  jenisRangkaian: 'single' | 'multiple'
  tanggal?: string | null
  divisi: string[]
  rangkaian?: Array<{
    id: number
    judul: string
    tanggal: string
    urutan: number
  }>
}

interface ApiResponse {
  success: boolean
  data?: KegiatanData
  error?: string
  message?: string
}

export default function EditKegiatanPage() {
  const router = useRouter()
  const params = useParams()
  const kegiatanId = params.id as string

  const [kegiatanData, setKegiatanData] = useState<KegiatanData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isNotFound, setIsNotFound] = useState(false)

  useEffect(() => {
    if (kegiatanId) {
      fetchKegiatanData()
    }
  }, [kegiatanId])

  const fetchKegiatanData = async () => {
    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch(`/api/panitiapeserta/kegiatan/${kegiatanId}`)
      const result: ApiResponse = await response.json()

      if (result.success && result.data) {
        setKegiatanData(result.data)
        setIsNotFound(false)
      } else {
        if (response.status === 404) {
          setIsNotFound(true)
          setError('Kegiatan tidak ditemukan')
        } else {
          setError(result.error || 'Gagal memuat data kegiatan')
        }
      }
    } catch (error) {
      console.error('Error fetching kegiatan:', error)
      setError('Terjadi kesalahan saat memuat data kegiatan')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateSuccess = (data: any) => {
    // Show success message
    const successDiv = document.createElement('div')
    successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-2'
    successDiv.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
      <span>Kegiatan berhasil diperbarui!</span>
    `
    document.body.appendChild(successDiv)

    // Remove success message and redirect after 2 seconds
    setTimeout(() => {
      document.body.removeChild(successDiv)
      router.push('/panitia/daftarkegiatan')
    }, 2000)
  }

  const handleCancel = () => {
    router.push('/panitia/daftarkegiatan')
  }

  const formatInitialData = (data: KegiatanData) => {
    return {
      id: data.id,
      nama: data.nama,
      deskripsi: data.deskripsi || '',
      jenisRangkaian: data.jenisRangkaian,
      tanggal: data.tanggal,
      divisi: data.divisi,
      rangkaian: data.rangkaian || []
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Loader2 className="w-8 h-8 text-[#4891A1] animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Memuat Data Kegiatan</h2>
          <p className="text-gray-600">Sedang mengambil data kegiatan...</p>
        </div>
      </div>
    )
  }

  // Error state - 404 Not Found
  if (isNotFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="mb-6">
            <CalendarDays className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Kegiatan Tidak Ditemukan</h1>
            <p className="text-gray-600 mb-6">
              Kegiatan dengan ID <span className="font-mono bg-gray-100 px-2 py-1 rounded">{kegiatanId}</span> tidak ditemukan atau telah dihapus.
            </p>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={() => router.push('/panitia/daftarkegiatan')}
              className="w-full flex items-center justify-center gap-2 bg-[#4891A1] text-white px-6 py-3 rounded-lg hover:bg-[#3d7a89] transition-colors font-semibold"
            >
              <ArrowLeft size={20} />
              Kembali ke Daftar Kegiatan
            </button>
            
            <button
              onClick={fetchKegiatanData}
              className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Coba Lagi
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Error state - Other errors
  if (error && !kegiatanData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Gagal Memuat Data</h1>
            <p className="text-gray-600 mb-6">{error}</p>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={fetchKegiatanData}
              className="w-full flex items-center justify-center gap-2 bg-[#4891A1] text-white px-6 py-3 rounded-lg hover:bg-[#3d7a89] transition-colors font-semibold"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Coba Lagi
            </button>
            
            <button
              onClick={() => router.push('/panitia/daftarkegiatan')}
              className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft size={20} />
              Kembali ke Daftar Kegiatan
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Main content - Edit form
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 text-gray-600 hover:text-[#4891A1] transition-colors group"
            >
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              <span className="font-medium">Kembali</span>
            </button>
            
            <div className="h-6 border-l border-gray-300" />
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#4891A1]/10 rounded-lg flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-[#4891A1]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Edit Kegiatan</h1>
                <p className="text-sm text-gray-600">Perbarui informasi kegiatan yang sudah ada</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
          {/* Form */}
          <div className="p-6">
            {kegiatanData && (
              <BuatKegiatan
                onSuccess={handleUpdateSuccess}
                onCancel={handleCancel}
                initialData={formatInitialData(kegiatanData)}
                isEdit={true}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}