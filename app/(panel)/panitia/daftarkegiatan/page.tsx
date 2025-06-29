'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, ChevronDown, Edit, Trash2, Search, Plus, X, Users, Calendar, CalendarDays, AlertCircle } from 'lucide-react'
import BuatKegiatan from '@/components/kegiatan/BuatKegiatan'
import Swal from 'sweetalert2'

interface Kegiatan {
  id: number
  nama: string
  tanggal: string
  panitia: string
  deskripsi?: string
  divisi?: string[]
  jenisRangkaian?: 'single' | 'multiple'
  rangkaian?: Array<{
    id: number
    judul: string
    tanggal: string
    urutan: number
  }>
  subKegiatan?: Kegiatan[]
  status?: string
}

interface ApiResponse {
  success: boolean
  data: Kegiatan[]
  pagination: {
    current_page: number
    total_pages: number
    total_entries: number
    per_page: number
  }
  error?: string
}

export default function DaftarKegiatanPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedItems, setExpandedItems] = useState<number[]>([])
  const [expandedDivisi, setExpandedDivisi] = useState<number[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editKegiatanData, setEditKegiatanData] = useState<any>(null)
  const [isLoadingEdit, setIsLoadingEdit] = useState(false)
  const [kegiatanList, setKegiatanList] = useState<Kegiatan[]>([])
  const [pagination, setPagination] = useState({
    current_page: 1,
    total_pages: 0,
    total_entries: 0,
    per_page: 20
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    fetchKegiatan()
  }, [currentPage])

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchQuery) {
        handleSearch()
      } else {
        setCurrentPage(1)
        fetchKegiatan()
      }
    }, 500)
    return () => clearTimeout(t)
  }, [searchQuery])

  const fetchKegiatan = async (search = '') => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20'
      })
      if (search) params.append('search', search)
      const res = await fetch(`/api/panitiapeserta/kegiatan?${params}`)
      const result: ApiResponse = await res.json()
      if (result.success) {
        setKegiatanList(result.data)
        setPagination(result.pagination)
      } else {
        setKegiatanList([])
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = async () => {
    setIsSearching(true)
    setCurrentPage(1)
    await fetchKegiatan(searchQuery)
    setIsSearching(false)
  }

  const toggleExpanded = (id: number) =>
    setExpandedItems(p => (p.includes(id) ? p.filter(i => i !== id) : [...p, id]))

  const toggleDivisiExpanded = (id: number) =>
    setExpandedDivisi(p => (p.includes(id) ? p.filter(i => i !== id) : [...p, id]))

  const fetchKegiatanForEdit = async (id: number) => {
    setIsLoadingEdit(true)
    try {
      const response = await fetch(`/api/panitiapeserta/kegiatan/${id}`)
      const result = await response.json()

      if (result.success && result.data) {
        // Format data untuk BuatKegiatan component
        const formattedData = {
          id: result.data.id,
          nama: result.data.nama,
          deskripsi: result.data.deskripsi || '',
          jenisRangkaian: result.data.jenisRangkaian,
          tanggal: result.data.tanggal,
          divisi: result.data.divisi,
          rangkaian: result.data.rangkaian || []
        }
        setEditKegiatanData(formattedData)
        setIsEditModalOpen(true)
      } else {
        alert(result.error || 'Gagal memuat data kegiatan untuk edit')
      }
    } catch (error) {
      console.error('Error fetching kegiatan for edit:', error)
      alert('Terjadi kesalahan saat memuat data kegiatan')
    } finally {
      setIsLoadingEdit(false)
    }
  }

  const handleEdit = (id: number) => {
    fetchKegiatanForEdit(id)
  }

  const handleEditSuccess = (data: any) => {
    setIsEditModalOpen(false)
    setEditKegiatanData(null)
    
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

    // Remove after 3 seconds and refresh data
    setTimeout(() => {
      if (document.body.contains(successDiv)) {
        document.body.removeChild(successDiv)
      }
    }, 3000)
    
    // Refresh data
    fetchKegiatan(searchQuery)
  }

  const handleEditCancel = () => {
    setIsEditModalOpen(false)
    setEditKegiatanData(null)
  }

  const handleDelete = async (id: number) => {
    const kegiatan = kegiatanList.find(k => k.id === id)
    const kegiatanNama = kegiatan?.nama || 'kegiatan ini'
    
    // First confirmation with input
    const { value: userInput, isDismissed } = await Swal.fire({
      title: '⚠️ PENGHAPUSAN PERMANEN',
      html: `
        <div class="text-left space-y-4">
          <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div class="flex items-start gap-3">
              <div class="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center mt-0.5">
                <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-1.662-.833-2.432 0L4.382 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <p class="text-sm font-semibold text-red-800">Data akan dihapus PERMANEN dari database!</p>
                <p class="text-xs text-red-600 mt-1">Tindakan ini tidak dapat dibatalkan!</p>
              </div>
            </div>
          </div>
          
          <div class="bg-gray-50 rounded-lg p-4">
            <p class="font-semibold text-gray-900 mb-2">Kegiatan yang akan dihapus:</p>
            <p class="text-lg font-bold text-red-600">"${kegiatanNama}"</p>
          </div>
          
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p class="text-sm font-semibold text-yellow-800 mb-2">📊 Yang akan dihapus:</p>
            <ul class="text-sm text-yellow-700 space-y-1">
              <li>• Data kegiatan utama</li>
              <li>• Semua rangkaian kegiatan</li>
              <li>• Data divisi yang terlibat</li>
              <li>• <strong>SEMUA data absensi panitia</strong></li>
              <li>• <strong>SEMUA data konsumsi</strong></li>
            </ul>
          </div>
          
          <div class="border-2 border-red-300 rounded-lg p-4 bg-red-50">
            <p class="text-sm font-bold text-red-800 mb-3">⚠️ KONFIRMASI PENGHAPUSAN:</p>
            <p class="text-sm text-red-700 mb-2">Ketik <span class="font-mono bg-red-100 px-2 py-1 rounded font-bold">HAPUS</span> untuk melanjutkan:</p>
          </div>
        </div>
      `,
      input: 'text',
      inputPlaceholder: 'Ketik HAPUS disini...',
      inputAttributes: {
        autocapitalize: 'off',
        autocorrect: 'off',
        autocomplete: 'off',
        class: 'font-mono text-center text-lg font-bold'
      },
      showCancelButton: true,
      confirmButtonText: 'Lanjutkan Hapus',
      cancelButtonText: 'Batalkan',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      customClass: {
        popup: 'swal-custom-popup',
        title: 'swal-custom-title',
        htmlContainer: 'swal-custom-html',
        input: 'swal-custom-input',
        confirmButton: 'swal-custom-confirm',
        cancelButton: 'swal-custom-cancel'
      },
      width: '600px',
      padding: '2rem',
      allowOutsideClick: false,
      allowEscapeKey: false,
      inputValidator: (value) => {
        if (!value) {
          return 'Anda harus mengetik "HAPUS" untuk melanjutkan!'
        }
        if (value.toUpperCase() !== 'HAPUS') {
          return 'Ketik "HAPUS" dengan benar (tanpa tanda kutip)'
        }
        return null
      }
    })

    if (isDismissed || !userInput) {
      return
    }

    // Second confirmation
    const secondConfirm = await Swal.fire({
      title: '🚨 KONFIRMASI TERAKHIR',
      html: `
        <div class="text-center space-y-4">
          <div class="bg-red-100 border-2 border-red-300 rounded-lg p-4">
            <div class="text-red-800">
              <p class="text-lg font-bold mb-2">Anda akan menghapus:</p>
              <p class="text-xl font-bold text-red-600">"${kegiatanNama}"</p>
              <p class="text-sm mt-2 font-semibold">SECARA PERMANEN</p>
            </div>
          </div>
          
          <div class="bg-gray-100 rounded-lg p-3">
            <p class="text-sm text-gray-700">
              ⏰ Setelah mengklik "Ya, Hapus Permanen", data akan langsung hilang dari database dan tidak dapat dikembalikan.
            </p>
          </div>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus Permanen',
      cancelButtonText: 'Batalkan',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#059669',
      customClass: {
        popup: 'swal-custom-popup',
        confirmButton: 'swal-custom-confirm-final',
        cancelButton: 'swal-custom-cancel-final'
      },
      width: '500px',
      allowOutsideClick: false,
      reverseButtons: true
    })

    if (!secondConfirm.isConfirmed) {
      return
    }

    // Show loading
    Swal.fire({
      title: '🗑️ Menghapus Kegiatan',
      html: `
        <div class="text-center space-y-3">
          <div class="flex justify-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
          </div>
          <p class="text-gray-600">Sedang menghapus "${kegiatanNama}" dan semua data terkait...</p>
          <p class="text-sm text-gray-500">Mohon tunggu, proses ini mungkin memakan waktu beberapa detik.</p>
        </div>
      `,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading()
      }
    })
    
    try {
      const res = await fetch(`/api/panitiapeserta/kegiatan/${id}`, { 
        method: 'DELETE' 
      })
      const r = await res.json()
      
      if (r.success) {
        // Success with deletion stats
        const deletedCounts = r.data?.deleted_counts || {}
        
        await Swal.fire({
          title: '✅ Berhasil Dihapus!',
          html: `
            <div class="text-center space-y-4">
              <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                <p class="text-green-800 font-semibold mb-2">${r.message}</p>
              </div>
              
              <div class="bg-gray-50 rounded-lg p-4">
                <p class="text-sm font-semibold text-gray-800 mb-3">📊 Detail Data yang Dihapus:</p>
                <div class="grid grid-cols-2 gap-2 text-sm">
                  <div class="bg-blue-100 rounded p-2">
                    <p class="font-semibold text-blue-800">${deletedCounts.absensi || 0}</p>
                    <p class="text-blue-600">Data Absensi</p>
                  </div>
                  <div class="bg-orange-100 rounded p-2">
                    <p class="font-semibold text-orange-800">${deletedCounts.konsumsi || 0}</p>
                    <p class="text-orange-600">Data Konsumsi</p>
                  </div>
                  <div class="bg-purple-100 rounded p-2">
                    <p class="font-semibold text-purple-800">${deletedCounts.rangkaian || 0}</p>
                    <p class="text-purple-600">Rangkaian</p>
                  </div>
                  <div class="bg-teal-100 rounded p-2">
                    <p class="font-semibold text-teal-800">${deletedCounts.divisi || 0}</p>
                    <p class="text-teal-600">Mapping Divisi</p>
                  </div>
                </div>
              </div>
              
              <div class="text-sm text-gray-600">
                <p>✨ Data telah berhasil dihapus dari database</p>
                <p>🔄 Halaman akan diperbarui otomatis</p>
              </div>
            </div>
          `,
          icon: 'success',
          confirmButtonText: 'OK',
          confirmButtonColor: '#059669',
          customClass: {
            popup: 'swal-custom-popup',
            confirmButton: 'swal-custom-success'
          },
          width: '600px',
          timer: 5000,
          timerProgressBar: true
        })
        
        // Refresh data
        await fetchKegiatan(searchQuery)
      } else {
        await Swal.fire({
          title: '❌ Gagal Menghapus',
          html: `
            <div class="text-center space-y-3">
              <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                <p class="text-red-800 font-semibold">${r.error}</p>
              </div>
              <p class="text-sm text-gray-600">Silakan coba lagi atau hubungi administrator jika masalah berlanjut.</p>
            </div>
          `,
          icon: 'error',
          confirmButtonText: 'OK',
          confirmButtonColor: '#dc2626',
          customClass: {
            popup: 'swal-custom-popup'
          }
        })
      }
    } catch (error) {
      console.error('Error deleting kegiatan:', error)
      await Swal.fire({
        title: '❌ Kesalahan Sistem',
        html: `
          <div class="text-center space-y-3">
            <div class="bg-red-50 border border-red-200 rounded-lg p-4">
              <p class="text-red-800 font-semibold">Terjadi kesalahan jaringan</p>
              <p class="text-red-600 text-sm mt-1">Tidak dapat terhubung ke server</p>
            </div>
            <p class="text-sm text-gray-600">Periksa koneksi internet Anda dan coba lagi.</p>
          </div>
        `,
        icon: 'error',
        confirmButtonText: 'OK',
        confirmButtonColor: '#dc2626',
        customClass: {
          popup: 'swal-custom-popup'
        }
      })
    }
  }

  const renderDivisiInfo = (k: Kegiatan) => {
    const isDivisiExpanded = expandedDivisi.includes(k.id)
    const divisiCount = k.divisi?.length || 0
    const isSemua = k.panitia === 'Semua Divisi'
    const isDivisiTerpilih = k.panitia === 'Divisi Terpilih'
    
    if (isSemua)
      return (
        <div className="space-y-2">
          <button
            onClick={() => toggleDivisiExpanded(k.id)}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-[#4891A1]/10 text-[#4891A1] font-bold border-2 border-[#4891A1]/30 hover:bg-[#4891A1]/20 transition-colors"
          >
            <Users size={14} />
            <span>Semua Divisi</span>
            {isDivisiExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {isDivisiExpanded && (
            <div className="mt-2 space-y-1">
              {k.divisi?.map((d, i) => (
                <div key={i} className="inline-block mr-2 mb-1">
                  <span className="px-2 py-1 text-xs bg-[#4891A1]/5 text-[#4891A1] rounded border border-[#4891A1]/20">
                    {d}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    if (divisiCount <= 1)
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
          {k.panitia}
        </span>
      )
    if (isDivisiTerpilih)
      return (
        <div className="space-y-2">
          <button
            onClick={() => toggleDivisiExpanded(k.id)}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
          >
            <Users size={14} />
            <span>Divisi Terpilih</span>
            {isDivisiExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {isDivisiExpanded && (
            <div className="mt-2 space-y-1">
              {k.divisi?.map((d, i) => (
                <div key={i} className="inline-block mr-2 mb-1">
                  <span className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded border border-blue-200">
                    {d}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    // Fallback untuk case lainnya
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">
        {k.panitia}
      </span>
    )
  }

  const renderJenisRangkaianIcon = (k: Kegiatan) => {
    if (k.jenisRangkaian === 'single') {
      return (
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-green-100 rounded-full">
            <Calendar size={14} className="text-green-600" />
          </div>
          <span className="text-xs text-green-600 font-medium">Single</span>
        </div>
      )
    } else if (k.jenisRangkaian === 'multiple') {
      return (
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-purple-100 rounded-full">
            <CalendarDays size={14} className="text-purple-600" />
          </div>
          <span className="text-xs text-purple-600 font-medium">Multiple</span>
        </div>
      )
    }
    return null
  }

  const renderKegiatanCard = (k: Kegiatan, sub = false) => {
    const isExpanded = expandedItems.includes(k.id)
    const hasSub = k.subKegiatan && k.subKegiatan.length > 0
    const isMultiple = k.jenisRangkaian === 'multiple'
    const canExpand = hasSub && isMultiple && !sub
    
    return (
      <div key={k.id} className={`${sub ? 'ml-4 border-l-2 border-[#4891A1]/30' : ''}`}>
        <div className={`p-4 border-b border-gray-100 ${sub ? 'bg-gray-50' : 'bg-white'} ${!sub ? 'hover:bg-gray-50' : ''} transition-colors`}>
          {/* Header with expand button and jenis rangkaian */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {canExpand && (
                <button 
                  onClick={() => toggleExpanded(k.id)} 
                  className="text-[#4891A1] hover:bg-[#4891A1]/10 p-1.5 rounded transition-colors mt-0.5 flex-shrink-0"
                >
                  {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className={`font-semibold text-sm sm:text-base ${sub ? 'text-gray-700' : 'text-gray-900'} line-clamp-2`}>
                    {k.nama}
                  </h3>
                  {!sub && renderJenisRangkaianIcon(k)}
                </div>
              </div>
            </div>
          </div>

          {/* Tanggal */}
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={14} className="text-[#4891A1] flex-shrink-0" />
            <span className="text-sm text-gray-600 font-medium">{k.tanggal}</span>
          </div>

          {/* Divisi */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Users size={14} className="text-[#4891A1] flex-shrink-0" />
              <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Divisi Terlibat</span>
            </div>
            <div className="pl-5">
              {sub ? (
                <span className="inline-flex px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">
                  {k.panitia}
                </span>
              ) : (
                renderDivisiInfo(k)
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <button 
              onClick={() => handleEdit(k.id)} 
              className="flex items-center gap-1.5 px-3 py-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors text-sm font-medium"
              title="Edit Kegiatan"
            >
              <Edit size={14} />
              <span className="hidden xs:inline">Edit</span>
            </button>
            <button 
              onClick={() => handleDelete(k.id)} 
              className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
              title="Hapus Kegiatan"
            >
              <Trash2 size={14} />
              <span className="hidden xs:inline">Hapus</span>
            </button>
          </div>
        </div>
        
        {/* Sub kegiatan untuk mobile */}
        {isExpanded && canExpand && (
          <div className="bg-gray-50">
            {k.subKegiatan?.map(s => renderKegiatanCard(s, true))}
          </div>
        )}
      </div>
    )
  }

  const renderKegiatanRow = (k: Kegiatan, sub = false) => {
    const isExpanded = expandedItems.includes(k.id)
    const hasSub = k.subKegiatan && k.subKegiatan.length > 0
    const isMultiple = k.jenisRangkaian === 'multiple'
    const canExpand = hasSub && isMultiple && !sub // Hanya multiple rangkaian yang bisa di-expand
    
    return (
      <div key={k.id}>
        <div
          className={`grid grid-cols-4 gap-4 py-4 px-6 border-b border-gray-100 hover:bg-[#4891A1]/5 transition-colors ${
            sub ? 'pl-16 bg-gray-50' : ''
          }`}
        >
          <div className="flex items-center gap-3">
            {canExpand && (
              <button 
                onClick={() => toggleExpanded(k.id)} 
                className="text-[#4891A1] hover:bg-[#4891A1]/10 p-1 rounded transition-colors"
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            )}
            {!canExpand && !sub && (
              <div className="w-6 h-6 flex items-center justify-center">
                {/* Spacer untuk alignment */}
              </div>
            )}
            <div className="flex flex-col gap-1">
              <span className={`font-medium ${sub ? 'text-gray-700' : 'text-gray-900'}`}>
                {k.nama}
              </span>
              {!sub && renderJenisRangkaianIcon(k)}
            </div>
          </div>
          
          <div className="flex items-center text-gray-600">
            <Calendar size={16} className="mr-2 text-[#4891A1]" />
            {k.tanggal}
          </div>
          
          <div className="flex items-center">
            {sub ? (
              <span className="inline-flex px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">
                {k.panitia}
              </span>
            ) : (
              renderDivisiInfo(k)
            )}
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => handleEdit(k.id)} 
              className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
              title="Edit Kegiatan"
            >
              <Edit size={16} />
            </button>
            <button 
              onClick={() => handleDelete(k.id)} 
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Hapus Kegiatan"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        {isExpanded && canExpand && k.subKegiatan?.map(s => renderKegiatanRow(s, true))}
      </div>
    )
  }

  const renderPaginationButtons = () => {
    const { current_page, total_pages } = pagination
    const btns: (number | string)[] = []
    if (total_pages <= 7) {
      for (let i = 1; i <= total_pages; i++) btns.push(i)
    } else {
      if (current_page <= 4) btns.push(1, 2, 3, 4, '...', total_pages - 1, total_pages)
      else if (current_page >= total_pages - 3)
        btns.push(1, 2, '...', total_pages - 3, total_pages - 2, total_pages - 1, total_pages)
      else btns.push(1, 2, '...', current_page - 1, current_page, current_page + 1, '...', total_pages - 1, total_pages)
    }
    return btns.filter((v, i, a) => a.indexOf(v) === i).slice(0, 8)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header - Responsive */}
        <div className="flex flex-col sm:flex-row justify-between items-start mb-4 sm:mb-6 lg:mb-8 gap-3 sm:gap-4">
          <div className="w-full sm:w-auto">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">Daftar Kegiatan</h1>
            <p className="text-sm sm:text-base text-gray-600">Dashboard daftar kegiatan pada Raja Brawijaya 2025</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#4891A1] hover:bg-[#3d7a89] text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold transition-colors shadow-lg text-sm sm:text-base"
          >
            <Plus size={18} className="sm:hidden" />
            <Plus size={20} className="hidden sm:block" />
            <span className="sm:hidden">Tambah</span>
            <span className="hidden sm:inline">Tambah Kegiatan</span>
          </button>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
          {/* Header - Responsive */}
          <div className="bg-[#4891A1] text-white p-3 sm:p-4 lg:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                  <CalendarDays className="w-3 h-3 sm:w-5 sm:h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold">Daftar Kegiatan</h2>
                  <p className="text-[#4891A1]/80 text-xs sm:text-sm hidden sm:block">Kelola semua kegiatan Raja Brawijaya</p>
                </div>
              </div>
              
              {/* Search - Responsive */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full lg:w-auto">
                <div className="relative w-full sm:w-64 lg:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Cari kegiatan..."
                    className="pl-9 pr-4 py-2 sm:py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-white/20 focus:border-white/50 text-gray-900 w-full text-sm sm:text-base"
                  />
                </div>
                <button 
                  onClick={handleSearch} 
                  disabled={isSearching} 
                  className="bg-white/20 hover:bg-white/30 px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg disabled:opacity-50 font-medium transition-colors text-sm sm:text-base"
                >
                  {isSearching ? 'Mencari...' : 'Cari'}
                </button>
              </div>
            </div>
          </div>
          
          {/* Desktop Table Header */}
          <div className="hidden lg:grid grid-cols-4 gap-4 py-4 px-6 bg-gray-50 border-b font-semibold text-gray-700 text-sm">
            <div className="flex items-center gap-2">
              <CalendarDays size={16} className="text-[#4891A1]" />
              Nama Kegiatan
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-[#4891A1]" />
              Tanggal
            </div>
            <div className="flex items-center gap-2">
              <Users size={16} className="text-[#4891A1]" />
              Divisi Terlibat
            </div>
            <div>Tindakan</div>
          </div>
          
          {/* Content - Responsive */}
          <div>
            {isLoading ? (
              <div className="flex items-center justify-center py-12 sm:py-16">
                <div className="animate-spin h-6 w-6 sm:h-8 sm:w-8 rounded-full border-b-2 border-[#4891A1]" />
                <span className="ml-3 text-gray-600 font-medium text-sm sm:text-base">Memuat data kegiatan...</span>
              </div>
            ) : kegiatanList.length === 0 ? (
              <div className="text-center py-12 sm:py-16 px-4">
                <CalendarDays size={40} className="sm:w-12 sm:h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 text-base sm:text-lg mb-4">
                  {searchQuery ? 'Tidak ada kegiatan yang sesuai dengan pencarian' : 'Belum ada kegiatan yang dibuat'}
                </p>
                {!searchQuery && (
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-[#4891A1] text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-[#3d7a89] transition-colors text-sm sm:text-base"
                  >
                    Buat Kegiatan Pertama
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop View */}
                <div className="hidden lg:block">
                  {kegiatanList.map(k => renderKegiatanRow(k))}
                </div>
                
                {/* Mobile/Tablet Card View */}
                <div className="lg:hidden">
                  {kegiatanList.map(k => renderKegiatanCard(k))}
                </div>
              </>
            )}
          </div>
          
          {/* Pagination - Responsive */}
          {pagination.total_pages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between p-3 sm:p-4 lg:p-6 border-t bg-gray-50 gap-3 sm:gap-0">
              <div className="text-gray-600 font-medium text-xs sm:text-sm order-2 sm:order-1">
                <span className="hidden sm:inline">Menampilkan </span>
                <span className="font-bold text-[#4891A1]">
                  {pagination.total_entries
                    ? (pagination.current_page - 1) * pagination.per_page + 1
                    : 0}
                </span>
                <span className="hidden sm:inline"> hingga </span>
                <span className="sm:hidden">-</span>
                <span className="font-bold text-[#4891A1]">
                  {Math.min(pagination.current_page * pagination.per_page, pagination.total_entries)}
                </span>
                <span className="hidden sm:inline"> dari </span>
                <span className="sm:hidden">/</span>
                <span className="font-bold text-[#4891A1]">{pagination.total_entries}</span>
                <span className="hidden sm:inline"> kegiatan</span>
              </div>
              
              <div className="flex items-center gap-1 sm:gap-2 order-1 sm:order-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={pagination.current_page === 1}
                  className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-400 hover:text-[#4891A1] disabled:opacity-50 transition-colors"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                {renderPaginationButtons().map((p, i) => (
                  <button
                    key={i}
                    onClick={() => typeof p === 'number' && setCurrentPage(p)}
                    disabled={p === '...'}
                    className={`px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm ${
                      p === pagination.current_page
                        ? 'bg-[#4891A1] text-white shadow-md'
                        : p === '...'
                        ? 'text-gray-400 cursor-default'
                        : 'text-gray-600 hover:bg-[#4891A1]/10 hover:text-[#4891A1]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(p + 1, pagination.total_pages))}
                  disabled={pagination.current_page === pagination.total_pages}
                  className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-600 hover:text-[#4891A1] disabled:opacity-50 transition-colors"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Modal Tambah Kegiatan - Responsive */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <div className="absolute inset-0 bg-gray-900/20 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 p-1.5 sm:p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="sm:w-6 sm:h-6" />
              </button>
              <div className="p-4 sm:p-6">
                <BuatKegiatan 
                  onSuccess={() => (setIsModalOpen(false), fetchKegiatan(searchQuery))} 
                  onCancel={() => setIsModalOpen(false)} 
                />
              </div>
            </div>
          </div>
        )}

        {/* Modal Edit Kegiatan - Responsive */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <div className="absolute inset-0 bg-gray-900/20 backdrop-blur-sm" onClick={handleEditCancel} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              <button 
                onClick={handleEditCancel} 
                className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 p-1.5 sm:p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="sm:w-6 sm:h-6" />
              </button>
              <div className="p-4 sm:p-6">
                {isLoadingEdit ? (
                  <div className="flex items-center justify-center py-8 sm:py-12">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin h-5 w-5 sm:h-6 sm:w-6 rounded-full border-b-2 border-[#4891A1]" />
                      <span className="text-gray-600 font-medium text-sm sm:text-base">Memuat data kegiatan...</span>
                    </div>
                  </div>
                ) : editKegiatanData ? (
                  <BuatKegiatan 
                    onSuccess={handleEditSuccess}
                    onCancel={handleEditCancel}
                    initialData={editKegiatanData}
                    isEdit={true}
                  />
                ) : (
                  <div className="text-center py-8 sm:py-12 px-4">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-red-600" />
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Gagal Memuat Data</h3>
                    <p className="text-sm sm:text-base text-gray-600 mb-4">Terjadi kesalahan saat memuat data kegiatan untuk edit.</p>
                    <button
                      onClick={handleEditCancel}
                      className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors text-sm sm:text-base"
                    >
                      Tutup
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}