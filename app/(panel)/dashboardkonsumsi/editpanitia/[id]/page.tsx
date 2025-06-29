'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { ArrowLeft, Save, X, Coffee, Utensils } from 'lucide-react'
import Swal from 'sweetalert2'

interface KonsumsiData {
  panitia_id: number
  kegiatan_id: number
  kegiatan_rangkaian_id: number | null
  nim: string
  nama_lengkap: string
  divisi: string
  unique_id: string
  tanggal_konsumsi: string
  kegiatan_nama: string
  rangkaian_nama: string | null
  konsumsi_1_status: 'sudah_diambil' | 'belum_diambil'
  konsumsi_2_status: 'sudah_diambil' | 'belum_diambil'
  konsumsi_1_waktu: string | null
  konsumsi_2_waktu: string | null
  konsumsi_1_id: number | null
  konsumsi_2_id: number | null
}

export default function EditKonsumsiPanitiaNIMPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  
  const nim = params.id as string
  const kegiatan_id = searchParams.get('kegiatan_id')
  const tanggal = searchParams.get('tanggal')
  const kegiatan_rangkaian_id = searchParams.get('kegiatan_rangkaian_id')
  
  const [konsumsiData, setKonsumsiData] = useState<KonsumsiData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [konsumsi1Status, setKonsumsi1Status] = useState<'sudah_diambil' | 'belum_diambil'>('belum_diambil')
  const [konsumsi2Status, setKonsumsi2Status] = useState<'sudah_diambil' | 'belum_diambil'>('belum_diambil')

  // Format tanggal ke format Indonesia
  const formatTanggalIndonesia = (tanggal: string) => {
    try {
      const date = new Date(tanggal)
      return date.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    } catch (error) {
      return tanggal
    }
  }

  // Format tanggal dengan konteks (hari ini, kemarin, dll)
  const formatTanggalDenganKonteks = (tanggal: string) => {
    try {
      const date = new Date(tanggal)
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      // Normalize dates untuk comparison
      const dateStr = date.toDateString()
      const todayStr = today.toDateString()
      const yesterdayStr = yesterday.toDateString()
      const tomorrowStr = tomorrow.toDateString()

      const indonesianDate = formatTanggalIndonesia(tanggal)

      if (dateStr === todayStr) {
        return `${indonesianDate} (Hari ini)`
      } else if (dateStr === yesterdayStr) {
        return `${indonesianDate} (Kemarin)`
      } else if (dateStr === tomorrowStr) {
        return `${indonesianDate} (Besok)`
      } else {
        return indonesianDate
      }
    } catch (error) {
      return tanggal
    }
  }

  useEffect(() => {
    if (nim && kegiatan_id && tanggal) {
      fetchKonsumsiData()
    } else {
      setError('Parameter NIM, kegiatan_id, dan tanggal diperlukan')
      setIsLoading(false)
    }
  }, [nim, kegiatan_id, tanggal, kegiatan_rangkaian_id])

  const showLoadingAlert = () => {
    Swal.fire({
      title: '🔄 Memuat Data',
      text: 'Sedang mengambil informasi konsumsi panitia...',
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

  const fetchKonsumsiData = async () => {
    try {
      setIsLoading(true)
      showLoadingAlert()
      
      // Build API URL dengan query parameters
      const apiUrl = new URL(`/api/konsumsi/edit/${nim}`, window.location.origin)
      apiUrl.searchParams.set('kegiatan_id', kegiatan_id!)
      apiUrl.searchParams.set('tanggal', tanggal!)
      if (kegiatan_rangkaian_id) {
        apiUrl.searchParams.set('kegiatan_rangkaian_id', kegiatan_rangkaian_id)
      }

      const response = await fetch(apiUrl.toString())
      const result = await response.json()
      
      Swal.close()
      
      if (result.success && result.data) {
        setKonsumsiData(result.data)
        setKonsumsi1Status(result.data.konsumsi_1_status || 'belum_diambil')
        setKonsumsi2Status(result.data.konsumsi_2_status || 'belum_diambil')
        
        // Success notification
        Swal.fire({
          icon: 'success',
          title: '✅ Data Berhasil Dimuat!',
          html: `
            <div class="text-center">
              <p class="text-sm text-green-600 mb-2">
                Menampilkan data konsumsi untuk:
              </p>
              <div class="bg-green-50 p-3 rounded-lg">
                <p class="font-semibold text-green-800">${result.data.nama_lengkap}</p>
                <p class="text-sm text-green-600">NIM: ${nim}</p>
                <p class="text-sm text-green-600">📅 ${formatTanggalDenganKonteks(result.data.tanggal_konsumsi)}</p>
              </div>
            </div>
          `,
          timer: 3000,
          timerProgressBar: true,
          showConfirmButton: false,
          toast: true,
          position: 'top-end',
          background: '#f0fdf4',
          customClass: {
            title: 'text-green-700 font-bold text-sm',
            htmlContainer: 'text-green-600 text-xs'
          }
        })
      } else {
        setError(result.message || 'Data konsumsi panitia tidak ditemukan')
        Swal.fire({
          icon: 'error',
          title: '❌ Data Tidak Ditemukan',
          text: result.message || `Konsumsi panitia dengan NIM ${nim} tidak ada dalam sistem`,
          confirmButtonText: 'Kembali ke Dashboard',
          confirmButtonColor: '#dc2626',
          background: '#fef2f2',
          customClass: {
            title: 'text-red-700 font-bold',
            htmlContainer: 'text-red-600'
          }
        }).then(() => {
          router.push('/dashboardkonsumsi')
        })
      }
    } catch (error) {
      console.error('Error fetching konsumsi data:', error)
      setError('Gagal memuat data konsumsi')
      Swal.close()
      
      Swal.fire({
        icon: 'error',
        title: '🚨 Koneksi Bermasalah',
        text: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda',
        confirmButtonText: 'Coba Lagi',
        showCancelButton: true,
        cancelButtonText: 'Kembali',
        confirmButtonColor: '#059669',
        cancelButtonColor: '#6b7280',
        background: '#fef2f2',
        customClass: {
          title: 'text-red-700 font-bold',
          htmlContainer: 'text-red-600'
        }
      }).then((result) => {
        if (result.isConfirmed) {
          fetchKonsumsiData()
        } else {
          router.push('/dashboardkonsumsi')
        }
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!konsumsiData) return
    
    // Check if there are changes
    const hasChanges = 
      konsumsi1Status !== konsumsiData.konsumsi_1_status ||
      konsumsi2Status !== konsumsiData.konsumsi_2_status
    
    if (!hasChanges) {
      Swal.fire({
        icon: 'info',
        title: '📝 Tidak Ada Perubahan',
        text: 'Status konsumsi tidak berubah dari sebelumnya',
        confirmButtonText: 'OK',
        confirmButtonColor: '#3b82f6'
      })
      return
    }
    
    // Confirmation dialog
    const confirmResult = await Swal.fire({
      title: '🤔 Yakin Mau Ubah Status Konsumsi?',
      html: `
        <div class="text-left bg-slate-50 p-4 rounded-lg mb-4">
          <p class="font-semibold text-slate-700 mb-2">Detail Perubahan:</p>
          <p class="text-sm text-slate-600">📝 <strong>Nama:</strong> ${konsumsiData.nama_lengkap}</p>
          <p class="text-sm text-slate-600">🎫 <strong>NIM:</strong> ${konsumsiData.nim}</p>
          <p class="text-sm text-slate-600">🏢 <strong>Divisi:</strong> ${konsumsiData.divisi}</p>
          <p class="text-sm text-slate-600">🎯 <strong>Kegiatan:</strong> ${konsumsiData.kegiatan_nama}</p>
          ${konsumsiData.rangkaian_nama ? `<p class="text-sm text-slate-600">📅 <strong>Rangkaian:</strong> ${konsumsiData.rangkaian_nama}</p>` : ''}
          <p class="text-sm text-slate-600">📅 <strong>Tanggal:</strong> ${formatTanggalDenganKonteks(konsumsiData.tanggal_konsumsi)}</p>
          <div class="mt-3 space-y-2">
            <div class="p-2 rounded ${konsumsi1Status === 'sudah_diambil' ? 'bg-green-100' : 'bg-red-100'}">
              <p class="text-sm"><strong>☕ Konsumsi 1:</strong> 
                <span class="${konsumsi1Status === 'sudah_diambil' ? 'text-green-700' : 'text-red-700'} font-bold">
                  ${konsumsi1Status === 'sudah_diambil' ? '✅ Sudah Diambil' : '❌ Belum Diambil'}
                </span>
              </p>
            </div>
            <div class="p-2 rounded ${konsumsi2Status === 'sudah_diambil' ? 'bg-green-100' : 'bg-red-100'}">
              <p class="text-sm"><strong>🍽️ Konsumsi 2:</strong> 
                <span class="${konsumsi2Status === 'sudah_diambil' ? 'text-green-700' : 'text-red-700'} font-bold">
                  ${konsumsi2Status === 'sudah_diambil' ? '✅ Sudah Diambil' : '❌ Belum Diambil'}
                </span>
              </p>
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '💾 Ya, Simpan!',
      cancelButtonText: '🚫 Batal',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#6b7280',
      background: '#f8fafc',
      customClass: {
        title: 'text-slate-700 font-bold',
        htmlContainer: 'text-slate-600'
      }
    })

    if (!confirmResult.isConfirmed) return
    
    try {
      setIsSaving(true)
      setError('')
      
      // Show saving progress
      Swal.fire({
        title: '💾 Menyimpan Perubahan',
        text: 'Sedang memperbarui status konsumsi...',
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
      
      // Build API URL dengan query parameters
      const apiUrl = new URL(`/api/konsumsi/edit/${nim}`, window.location.origin)
      apiUrl.searchParams.set('kegiatan_id', konsumsiData.kegiatan_id.toString())
      apiUrl.searchParams.set('tanggal', konsumsiData.tanggal_konsumsi)
      if (konsumsiData.kegiatan_rangkaian_id) {
        apiUrl.searchParams.set('kegiatan_rangkaian_id', konsumsiData.kegiatan_rangkaian_id.toString())
      }

      const response = await fetch(apiUrl.toString(), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          konsumsi_1_status: konsumsi1Status,
          konsumsi_2_status: konsumsi2Status,
          catatan: `Status konsumsi diubah manual pada ${new Date().toLocaleString('id-ID')} via NIM`,
          petugas: 'admin_edit_nim'
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        // Success with celebration
        await Swal.fire({
          icon: 'success',
          title: '🎉 Berhasil Disimpan!',
          html: `
            <div class="text-center">
              <p class="text-lg font-semibold text-green-700 mb-3">Status konsumsi berhasil diperbarui!</p>
              <div class="bg-green-50 p-4 rounded-lg space-y-2">
                <div class="border-b border-green-200 pb-2 mb-3">
                  <p class="font-semibold text-green-800">${konsumsiData.nama_lengkap}</p>
                  <p class="text-sm text-green-600">NIM: ${konsumsiData.nim} • ${konsumsiData.divisi}</p>
                  <p class="text-sm text-green-600">📅 ${formatTanggalDenganKonteks(konsumsiData.tanggal_konsumsi)}</p>
                  <p class="text-sm text-green-600">🎯 ${konsumsiData.kegiatan_nama}</p>
                </div>
                <div class="space-y-1">
                  <p class="text-sm font-bold ${konsumsi1Status === 'sudah_diambil' ? 'text-green-700' : 'text-red-700'}">
                    ☕ Konsumsi 1: ${konsumsi1Status === 'sudah_diambil' ? '✅ SUDAH DIAMBIL' : '❌ BELUM DIAMBIL'}
                  </p>
                  <p class="text-sm font-bold ${konsumsi2Status === 'sudah_diambil' ? 'text-green-700' : 'text-red-700'}">
                    🍽️ Konsumsi 2: ${konsumsi2Status === 'sudah_diambil' ? '✅ SUDAH DIAMBIL' : '❌ BELUM DIAMBIL'}
                  </p>
                </div>
              </div>
            </div>
          `,
          confirmButtonText: '🏠 Kembali ke Dashboard',
          confirmButtonColor: '#059669',
          background: '#f0fdf4',
          timer: 8000,
          timerProgressBar: true,
          customClass: {
            title: 'text-green-700 font-bold',
            htmlContainer: 'text-green-600'
          }
        })
        
        // Redirect back to dashboard with success message
        router.push('/dashboardkonsumsi?edit=success')
      } else {
        setError(result.message || 'Gagal menyimpan perubahan')
        Swal.fire({
          icon: 'error',
          title: '😞 Oops! Gagal Menyimpan',
          text: result.message || 'Terjadi kesalahan saat menyimpan data',
          confirmButtonText: 'Coba Lagi',
          confirmButtonColor: '#dc2626',
          background: '#fef2f2',
          customClass: {
            title: 'text-red-700 font-bold',
            htmlContainer: 'text-red-600'
          }
        })
      }
    } catch (error) {
      console.error('Error saving data:', error)
      setError('Gagal menyimpan perubahan')
      Swal.fire({
        icon: 'error',
        title: '🚨 Koneksi Bermasalah',
        text: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda',
        confirmButtonText: 'Coba Lagi',
        showCancelButton: true,
        cancelButtonText: 'Kembali',
        confirmButtonColor: '#059669',
        cancelButtonColor: '#6b7280',
        background: '#fef2f2',
        customClass: {
          title: 'text-red-700 font-bold',
          htmlContainer: 'text-red-600'
        }
      }).then((result) => {
        if (result.isConfirmed) {
          handleSave()
        }
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = async () => {
    // Check if there are unsaved changes
    const hasChanges = konsumsiData && (
      konsumsi1Status !== konsumsiData.konsumsi_1_status ||
      konsumsi2Status !== konsumsiData.konsumsi_2_status
    )
    
    if (hasChanges) {
      const result = await Swal.fire({
        title: '⚠️ Ada Perubahan Belum Disimpan',
        text: 'Yakin mau keluar tanpa menyimpan perubahan?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '🚪 Ya, Keluar',
        cancelButtonText: '📝 Lanjut Edit',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#059669',
        background: '#fffbeb',
        customClass: {
          title: 'text-amber-700 font-bold',
          htmlContainer: 'text-amber-600'
        }
      })
      
      if (result.isConfirmed) {
        router.push('/dashboardkonsumsi')
      }
    } else {
      router.push('/dashboardkonsumsi')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4891A1] mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat data konsumsi...</p>
        </div>
      </div>
    )
  }

  if (error && !konsumsiData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/dashboardkonsumsi')}
            className="px-6 py-2 bg-[#4891A1] text-white rounded-lg hover:bg-[#3a7a89] transition-colors"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Edit Konsumsi Panitia (NIM)</h1>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header Card */}
          <div className="bg-[#4891A1] text-white p-6 text-center">
            <h2 className="text-xl font-semibold">Form Edit Konsumsi Panitia</h2>
            <p className="text-blue-100 mt-1">NIM: {nim}</p>
            {konsumsiData?.tanggal_konsumsi && (
              <p className="text-blue-200 mt-1 text-sm">
                📅 {formatTanggalDenganKonteks(konsumsiData.tanggal_konsumsi)}
              </p>
            )}
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

            {/* Nama Lengkap */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nama Lengkap
              </label>
              <input
                type="text"
                value={konsumsiData?.nama_lengkap || ''}
                readOnly
                className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-500 cursor-not-allowed"
              />
            </div>

            {/* NIM */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                NIM
              </label>
              <input
                type="text"
                value={konsumsiData?.nim || ''}
                readOnly
                className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-500 cursor-not-allowed"
              />
            </div>

            {/* Divisi */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Divisi
              </label>
              <div className="px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg">
                <span className="inline-block px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm font-medium">
                  {konsumsiData?.divisi || '-'}
                </span>
              </div>
            </div>

            {/* Kegiatan Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">📌 Info Kegiatan</h3>
              <div className="space-y-1 text-sm">
                <p><strong>Kegiatan:</strong> {konsumsiData?.kegiatan_nama}</p>
                {konsumsiData?.rangkaian_nama && (
                  <p><strong>Rangkaian:</strong> {konsumsiData.rangkaian_nama}</p>
                )}
                <p><strong>Tanggal:</strong> {konsumsiData?.tanggal_konsumsi ? formatTanggalDenganKonteks(konsumsiData.tanggal_konsumsi) : '-'}</p>
              </div>
            </div>

            {/* Konsumsi 1 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                <div className="flex items-center gap-2">
                  <Coffee size={18} className="text-blue-500" />
                  Konsumsi 1
                </div>
              </label>
              <div className="flex gap-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="konsumsi1"
                    value="sudah_diambil"
                    checked={konsumsi1Status === 'sudah_diambil'}
                    onChange={(e) => setKonsumsi1Status(e.target.value as 'sudah_diambil' | 'belum_diambil')}
                    className="w-5 h-5 text-green-600 border-2 border-gray-300 focus:ring-green-500"
                  />
                  <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg font-medium">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Sudah
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="konsumsi1"
                    value="belum_diambil"
                    checked={konsumsi1Status === 'belum_diambil'}
                    onChange={(e) => setKonsumsi1Status(e.target.value as 'sudah_diambil' | 'belum_diambil')}
                    className="w-5 h-5 text-red-600 border-2 border-gray-300 focus:ring-red-500"
                  />
                  <span className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-800 rounded-lg font-medium">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    Belum
                  </span>
                </label>
              </div>
              {konsumsiData?.konsumsi_1_waktu && (
                <p className="text-xs text-gray-500 mt-2">
                  ⏰ Terakhir diambil: {konsumsiData.konsumsi_1_waktu}
                </p>
              )}
            </div>

            {/* Konsumsi 2 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                <div className="flex items-center gap-2">
                  <Utensils size={18} className="text-orange-500" />
                  Konsumsi 2
                </div>
              </label>
              <div className="flex gap-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="konsumsi2"
                    value="sudah_diambil"
                    checked={konsumsi2Status === 'sudah_diambil'}
                    onChange={(e) => setKonsumsi2Status(e.target.value as 'sudah_diambil' | 'belum_diambil')}
                    className="w-5 h-5 text-green-600 border-2 border-gray-300 focus:ring-green-500"
                  />
                  <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg font-medium">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Sudah
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="konsumsi2"
                    value="belum_diambil"
                    checked={konsumsi2Status === 'belum_diambil'}
                    onChange={(e) => setKonsumsi2Status(e.target.value as 'sudah_diambil' | 'belum_diambil')}
                    className="w-5 h-5 text-red-600 border-2 border-gray-300 focus:ring-red-500"
                  />
                  <span className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-800 rounded-lg font-medium">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    Belum
                  </span>
                </label>
              </div>
              {konsumsiData?.konsumsi_2_waktu && (
                <p className="text-xs text-gray-500 mt-2">
                  ⏰ Terakhir diambil: {konsumsiData.konsumsi_2_waktu}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6">
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Batalkan
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 px-6 py-3 bg-[#4891A1] text-white rounded-lg hover:bg-[#3a7a89] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    Simpan
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