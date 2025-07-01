'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { ArrowLeft, Save, X, User, Hash, Building, Clock, Tag } from 'lucide-react'
import Swal from 'sweetalert2'

interface PanitiaData {
  id: number
  panitia_id: number
  nim: string
  nama_lengkap: string
  divisi: string
  kehadiran: 'Hadir' | 'Tidak Hadir'
  status: 'Hadir' | 'Tidak Hadir'
  waktu_hadir: string
  waktu_absensi: string | null
  tanggal_absensi: string
  metode_absensi: 'QR Code' | 'Manual'
  catatan?: string
  kegiatan_nama?: string
}

export default function EditPanitiaPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  
  // IMPORTANT: params.id contains NIM, not database ID
  const nimFromUrl = params.id as string
  
  const [contextParams, setContextParams] = useState({
    kegiatan_id: '',
    kegiatan_rangkaian_id: '',
    tanggal: ''
  })
  
  const [panitiaData, setPanitiaData] = useState<PanitiaData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<'Hadir' | 'Tidak Hadir'>('Tidak Hadir')

  useEffect(() => {
    const getContextParams = () => {
      const params = {
        kegiatan_id: searchParams.get('kegiatan_id') || '',
        kegiatan_rangkaian_id: searchParams.get('kegiatan_rangkaian_id') || '',
        tanggal: searchParams.get('tanggal') || ''
      }

      if (!params.kegiatan_id) {
        try {
          const stored = localStorage.getItem('dashboard_context')
          if (stored) {
            const parsed = JSON.parse(stored)
            params.kegiatan_id = parsed.selectedKegiatanId || ''
            params.kegiatan_rangkaian_id = parsed.selectedRangkaianId || ''
            params.tanggal = parsed.selectedDate || ''
          }
        } catch (e) {
          console.warn('Failed to parse stored context:', e)
        }
      }

      return params
    }

    const params = getContextParams()
    setContextParams(params)
    
    console.log('🔧 Edit page loaded with NIM:', nimFromUrl)
    console.log('📋 Context params:', params)
  }, [searchParams, nimFromUrl])

  useEffect(() => {
    if (contextParams.kegiatan_id && contextParams.tanggal && nimFromUrl) {
      fetchPanitiaData()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nimFromUrl, contextParams])

  const showLoadingAlert = () => {
    Swal.fire({
      title: '🔄 Memuat Data',
      text: `Sedang mengambil data absensi untuk NIM: ${nimFromUrl}`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      background: '#f8fafc',
      customClass: {
        title: 'text-slate-700 font-bold',
        htmlContainer: 'text-slate-600'
      },
      didOpen: () => {
        Swal.showLoading()
      }
    })
  }

  const fetchPanitiaData = async () => {
    try {
      setIsLoading(true)
      setError('')
      showLoadingAlert()
      
      if (!nimFromUrl) {
        throw new Error('NIM tidak ditemukan dalam URL')
      }

      console.log('🔍 Fetching data for NIM:', nimFromUrl)
      
      const queryParams = new URLSearchParams()
      if (contextParams.kegiatan_id) {
        queryParams.append('kegiatan_id', contextParams.kegiatan_id)
      }
      if (contextParams.kegiatan_rangkaian_id && contextParams.kegiatan_rangkaian_id !== 'null') {
        queryParams.append('kegiatan_rangkaian_id', contextParams.kegiatan_rangkaian_id)
      }
      if (contextParams.tanggal) {
        queryParams.append('tanggal', contextParams.tanggal)
      }

      // API call using NIM as [id] parameter
      const url = `/api/absensi/${nimFromUrl}?${queryParams.toString()}`
      console.log('🌐 API URL:', url)
      
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }
      
      const result = await response.json()
      Swal.close()
      
      if (result.success && result.data) {
        console.log('✅ Data fetched successfully:', result.data.nama_lengkap)
        setPanitiaData(result.data)
        setSelectedStatus(result.data.kehadiran || result.data.status || 'Tidak Hadir')
      } else {
        throw new Error(result.message || 'Data tidak ditemukan')
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      setError(error.message || 'Gagal memuat data absensi')
      Swal.close()
      console.error('❌ Fetch error:', error)
      
      Swal.fire({
        icon: 'error',
        title: '❌ Gagal Memuat Data',
        text: error.message || 'Tidak dapat memuat data absensi',
        confirmButtonText: 'Kembali ke Dashboard',
        confirmButtonColor: '#dc2626',
        background: '#fef2f2'
      }).then(() => {
        router.push('/dashboardkestari')
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!panitiaData) return
    
    const confirmResult = await Swal.fire({
      title: '🤔 Konfirmasi Perubahan',
      html: `
        <div class="text-left bg-slate-50 p-4 rounded-lg mb-4">
          <p class="font-semibold text-slate-700 mb-2">Detail Perubahan:</p>
          <p class="text-sm text-slate-600">📝 <strong>Nama:</strong> ${panitiaData.nama_lengkap}</p>
          <p class="text-sm text-slate-600">🎫 <strong>NIM:</strong> ${panitiaData.nim}</p>
          <p class="text-sm text-slate-600">🏢 <strong>Divisi:</strong> ${panitiaData.divisi}</p>
          <div class="mt-3 p-2 rounded ${selectedStatus === 'Hadir' ? 'bg-green-100' : 'bg-red-100'}">
            <p class="text-sm"><strong>Status Baru:</strong> 
              <span class="${selectedStatus === 'Hadir' ? 'text-green-700' : 'text-red-700'} font-bold">
                ${selectedStatus === 'Hadir' ? '✅ Hadir' : '❌ Tidak Hadir'}
              </span>
            </p>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '💾 Ya, Simpan!',
      cancelButtonText: '🚫 Batal',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#6b7280'
    })

    if (!confirmResult.isConfirmed) return
    
    try {
      setIsSaving(true)
      setError('')
      
      Swal.fire({
        title: '💾 Menyimpan...',
        text: 'Sedang memperbarui status presensi',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading()
        }
      })
      
      const putQueryParams = new URLSearchParams()
      if (contextParams.kegiatan_id) {
        putQueryParams.append('kegiatan_id', contextParams.kegiatan_id)
      }
      if (contextParams.kegiatan_rangkaian_id && contextParams.kegiatan_rangkaian_id !== 'null') {
        putQueryParams.append('kegiatan_rangkaian_id', contextParams.kegiatan_rangkaian_id)
      }
      if (contextParams.tanggal) {
        putQueryParams.append('tanggal', contextParams.tanggal)
      }

      const putUrl = `/api/absensi/${nimFromUrl}?${putQueryParams.toString()}`
      console.log('📡 PUT URL:', putUrl)
      
      const response = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: selectedStatus,
          metode_absensi: 'Manual',
          catatan: `Status diubah manual menjadi ${selectedStatus} pada ${new Date().toLocaleString('id-ID')} oleh admin`
        })
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }
      
      const result = await response.json()
      console.log('✅ Save successful:', result)
      
      if (result.success) {
        await Swal.fire({
          icon: 'success',
          title: '🎉 Berhasil Disimpan!',
          html: `
            <div class="text-center">
              <p class="text-lg font-semibold text-green-700 mb-2">Status presensi berhasil diperbarui!</p>
              <div class="bg-green-50 p-3 rounded-lg">
                <p class="text-sm text-green-600">
                  <strong>${panitiaData.nama_lengkap}</strong> (NIM: ${nimFromUrl})
                </p>
                <p class="text-lg font-bold ${selectedStatus === 'Hadir' ? 'text-green-700' : 'text-red-700'}">
                  ${selectedStatus === 'Hadir' ? '✅ HADIR' : '❌ TIDAK HADIR'}
                </p>
              </div>
            </div>
          `,
          confirmButtonText: '🏠 Kembali ke Dashboard',
          confirmButtonColor: '#059669',
          timer: 5000,
          timerProgressBar: true
        })
        
        // Store context for dashboard refresh
        try {
          localStorage.setItem('dashboard_context', JSON.stringify({
            selectedKegiatanId: contextParams.kegiatan_id,
            selectedRangkaianId: contextParams.kegiatan_rangkaian_id,
            selectedDate: contextParams.tanggal,
            lastEdit: Date.now(),
            editedNIM: nimFromUrl
          }))
        } catch (e) {
          console.warn('Failed to store context:', e)
        }
        
        // Redirect with success flag
        const timestamp = Date.now()
        router.push(`/dashboardkestari?edit=success&t=${timestamp}`)
      } else {
        throw new Error(result.message || 'Gagal menyimpan perubahan')
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error('❌ Save error:', error)
      setError(error.message || 'Gagal menyimpan perubahan')
      
      Swal.fire({
        icon: 'error',
        title: '😞 Gagal Menyimpan',
        text: error.message || 'Terjadi kesalahan saat menyimpan',
        confirmButtonColor: '#dc2626'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = async () => {
    const hasChanges = panitiaData && selectedStatus !== (panitiaData.kehadiran || panitiaData.status)
    
    if (hasChanges) {
      const result = await Swal.fire({
        title: '⚠️ Perubahan Belum Disimpan',
        text: 'Yakin ingin keluar tanpa menyimpan?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '🚪 Ya, Keluar',
        cancelButtonText: '📝 Lanjut Edit',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#059669'
      })
      
      if (result.isConfirmed) {
        router.push('/dashboardkestari')
      }
    } else {
      router.push('/dashboardkestari')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#eaf6fa] to-[#d2e7ef] flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md w-full mx-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4891A1] mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Memuat data absensi...</p>
          <p className="text-gray-400 text-sm mt-2">NIM: {nimFromUrl}</p>
          {contextParams.kegiatan_id && (
            <div className="text-xs text-gray-400 mt-2 space-y-1">
              <p>Kegiatan: {contextParams.kegiatan_id}</p>
              {contextParams.tanggal && <p>Tanggal: {contextParams.tanggal}</p>}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (error && !panitiaData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#eaf6fa] to-[#d2e7ef] flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md w-full mx-4">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="text-xs text-gray-400 mb-4 space-y-1">
            <p>NIM: {nimFromUrl}</p>
            <p>Kegiatan: {contextParams.kegiatan_id || 'N/A'}</p>
            <p>Tanggal: {contextParams.tanggal || 'N/A'}</p>
          </div>
          <button
            onClick={() => router.push('/dashboardkestari')}
            className="px-6 py-2 bg-[#4891A1] text-white rounded-lg hover:bg-[#35707e] transition-colors"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#eaf6fa] to-[#d2e7ef] p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-[#eaf6fa] rounded-lg transition-colors"
          >
            <ArrowLeft size={24} className="text-[#4891A1]" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Presensi Panitia</h1>
            {panitiaData?.kegiatan_nama && (
              <p className="text-sm text-gray-600 mt-1">
                📅 {panitiaData.kegiatan_nama}
              </p>
            )}
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header Card */}
          <div className="bg-[#4891A1] text-white p-6 text-center">
            <h2 className="text-xl font-semibold">Form Edit Presensi</h2>
            <p className="text-[#eaf6fa] text-sm mt-1">
              Ubah status kehadiran panitia (NIM: {nimFromUrl})
            </p>
          </div>

          {/* Form Content */}
          <div className="p-8 space-y-6">
            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-800">
                  <X size={20} />
                  <span className="font-medium">{error}</span>
                </div>
              </div>
            )}

            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nama Lengkap */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User size={16} className="inline mr-1" />
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={panitiaData?.nama_lengkap || ''}
                  readOnly
                  className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 cursor-not-allowed font-medium"
                />
              </div>

              {/* NIM */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Hash size={16} className="inline mr-1" />
                  NIM
                </label>
                <input
                  type="text"
                  value={panitiaData?.nim || nimFromUrl}
                  readOnly
                  className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-700 cursor-not-allowed font-mono"
                />
              </div>
            </div>

            {/* Divisi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building size={16} className="inline mr-1" />
                Divisi
              </label>
              <div className="px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg">
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {panitiaData?.divisi || '-'}
                </span>
              </div>
            </div>

            {/* Status Saat Ini */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock size={16} className="inline mr-1" />
                Status Saat Ini
              </label>
              <div className="px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg">
                <div className="flex items-center justify-between">
                  <span 
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      (panitiaData?.status || panitiaData?.kehadiran) === 'Hadir' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    <div 
                      className={`w-2 h-2 rounded-full mr-2 ${
                        (panitiaData?.status || panitiaData?.kehadiran) === 'Hadir' 
                          ? 'bg-green-500' 
                          : 'bg-red-500'
                      }`}
                    ></div>
                    {panitiaData?.status || panitiaData?.kehadiran || 'Tidak Hadir'}
                  </span>
                  {panitiaData?.waktu_hadir && panitiaData.waktu_hadir !== '-' && (
                    <span className="text-sm text-gray-600">
                      📅 {panitiaData.waktu_hadir}
                    </span>
                  )}
                </div>
                {panitiaData?.metode_absensi && (
                  <div className="mt-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                      panitiaData.metode_absensi === 'QR Code' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      <Tag size={12} className="mr-1" />
                      {panitiaData.metode_absensi}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Presensi Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Ubah Status Presensi
              </label>
              <div className="flex gap-4">
                {/* Hadir Option */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="presensi"
                    value="Hadir"
                    checked={selectedStatus === 'Hadir'}
                    onChange={(e) => setSelectedStatus(e.target.value as 'Hadir' | 'Tidak Hadir')}
                    className="w-5 h-5 text-green-600 border-2 border-gray-300 focus:ring-green-500"
                  />
                  <span className="inline-flex items-center gap-2 px-4 py-3 bg-green-100 text-green-800 rounded-lg font-medium group-hover:bg-green-200 transition-colors">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Hadir
                  </span>
                </label>

                {/* Tidak Hadir Option */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="presensi"
                    value="Tidak Hadir"
                    checked={selectedStatus === 'Tidak Hadir'}
                    onChange={(e) => setSelectedStatus(e.target.value as 'Hadir' | 'Tidak Hadir')}
                    className="w-5 h-5 text-red-600 border-2 border-gray-300 focus:ring-red-500"
                  />
                  <span className="inline-flex items-center gap-2 px-4 py-3 bg-red-100 text-red-800 rounded-lg font-medium group-hover:bg-red-200 transition-colors">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    Tidak Hadir
                  </span>
                </label>
              </div>
              
              {/* Change Indicator */}
              {panitiaData && selectedStatus !== (panitiaData.kehadiran || panitiaData.status) && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ <strong>Perubahan akan diterapkan:</strong> 
                    <span className="ml-2">
                      <span className="line-through">{panitiaData.kehadiran || panitiaData.status}</span>
                      {' → '}
                      <span className="font-bold">{selectedStatus}</span>
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6">
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="flex-1 px-6 py-3 border border-[#4891A1] text-[#4891A1] rounded-lg hover:bg-[#eaf6fa] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Batalkan
              </button>
              <button
                onClick={handleSave}
                disabled={
                  isSaving || !!(panitiaData && selectedStatus === (panitiaData.kehadiran || panitiaData.status))
                }
                className="flex-1 px-6 py-3 bg-[#4891A1] text-white rounded-lg hover:bg-[#35707e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    {panitiaData && selectedStatus === (panitiaData.kehadiran || panitiaData.status) ? 'Tidak Ada Perubahan' : 'Simpan Perubahan'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}