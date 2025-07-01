/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import Swal from 'sweetalert2'

interface PanitiaData {
  id: number;
  nama_lengkap: string;
  email: string;
  nama_divisi: string;
  nama_jabatan: string;
  created_at_formatted: string;
}

interface ListAdminProps {
  onEdit?: (id: number, data: PanitiaData) => void;
  onDelete?: (id: number, data: PanitiaData) => void;
  onRefresh?: () => void;
  className?: string;
  showActions?: boolean;
  itemsPerPage?: number;
}

export default function ListAdmin({ 
  onEdit, 
  onDelete, 
  onRefresh, 
  className, 
  showActions = true,
  itemsPerPage = 10 
}: ListAdminProps) {
  const router = useRouter()
  const [panitiaList, setPanitiaList] = useState<PanitiaData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDivisi, setFilterDivisi] = useState('')
  const [filterJabatan, setFilterJabatan] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [sortBy, setSortBy] = useState<'nama' | 'divisi' | 'jabatan' | 'tanggal'>('tanggal')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [isDeleting, setIsDeleting] = useState<number | null>(null)

  // Unique options for filters
  const [divisiOptions, setDivisiOptions] = useState<string[]>([])
  const [jabatanOptions, setJabatanOptions] = useState<string[]>([])

  // Custom SweetAlert Toast
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer)
      toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
  })

  // Fetch data panitia
  const fetchPanitiaData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/panitia', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      if (Array.isArray(data)) {
        setPanitiaList(data)
        
        // Extract unique options for filters
        const uniqueDivisi = [...new Set(data.map(item => item.nama_divisi).filter(Boolean))]
        const uniqueJabatan = [...new Set(data.map(item => item.nama_jabatan).filter(Boolean))]
        
        setDivisiOptions(uniqueDivisi)
        setJabatanOptions(uniqueJabatan)

        Toast.fire({
          icon: 'success',
          title: `${data.length} data panitia berhasil dimuat`,
          background: '#F0FDF4',
          color: '#166534'
        })
      } else {
        setPanitiaList([])
        Toast.fire({
          icon: 'info',
          title: 'Tidak ada data panitia',
          background: '#FEF3C7',
          color: '#92400E'
        })
      }
    } catch (error: any) {
      console.error('Error fetching panitia data:', error)
      setError(error.message || 'Gagal memuat data')
      
      Toast.fire({
        icon: 'error',
        title: 'Gagal memuat data panitia',
        background: '#FEF2F2',
        color: '#DC2626'
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Load data on component mount
  useEffect(() => {
    fetchPanitiaData()
  }, [])

  // Refresh data when onRefresh prop changes
  useEffect(() => {
    if (onRefresh) {
      fetchPanitiaData()
    }
  }, [onRefresh])

  // Filter and sort data
  const filteredAndSortedData = panitiaList
    .filter(item => {
      const matchesSearch = item.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.email.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesDivisi = !filterDivisi || item.nama_divisi === filterDivisi
      const matchesJabatan = !filterJabatan || item.nama_jabatan === filterJabatan
      
      return matchesSearch && matchesDivisi && matchesJabatan
    })
    .sort((a, b) => {
      let compareValue = 0
      
      switch (sortBy) {
        case 'nama':
          compareValue = a.nama_lengkap.localeCompare(b.nama_lengkap)
          break
        case 'divisi':
          compareValue = a.nama_divisi.localeCompare(b.nama_divisi)
          break
        case 'jabatan':
          compareValue = a.nama_jabatan.localeCompare(b.nama_jabatan)
          break
        case 'tanggal':
          compareValue = new Date(a.created_at_formatted).getTime() - new Date(b.created_at_formatted).getTime()
          break
        default:
          compareValue = 0
      }
      
      return sortOrder === 'asc' ? compareValue : -compareValue
    })

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedData = filteredAndSortedData.slice(startIndex, startIndex + itemsPerPage)

  // Handle sort
  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  // Handle edit
  const handleEdit = (item: PanitiaData) => {
    if (onEdit) {
      onEdit(item.id, item)
    } else {
      // Default: navigate to edit page
      router.push(`/panitia/edit/${item.id}`)
    }
  }

  // Handle delete
  const handleDelete = async (item: PanitiaData) => {
    // Show confirmation dialog
    const result = await Swal.fire({
      title: 'Hapus Panitia?',
      html: `
        <div class="text-center">
          <div class="mb-4">
            <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <svg class="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </div>
          </div>
          <p class="text-gray-600 mb-3">Apakah Anda yakin ingin menghapus panitia:</p>
          <div class="bg-gray-50 p-4 rounded-lg text-sm border">
            <div class="grid grid-cols-1 gap-2 text-left">
              <div class="flex justify-between">
                <span class="font-medium text-gray-700">Nama:</span>
                <span class="text-gray-900">${item.nama_lengkap}</span>
              </div>
              <div class="flex justify-between">
                <span class="font-medium text-gray-700">Email:</span>
                <span class="text-gray-900">${item.email}</span>
              </div>
              <div class="flex justify-between">
                <span class="font-medium text-gray-700">Divisi:</span>
                <span class="text-gray-900">${item.nama_divisi}</span>
              </div>
            </div>
          </div>
          <p class="text-red-600 text-sm mt-3 font-medium">Data yang dihapus tidak dapat dikembalikan!</p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#6B7280',
      customClass: {
        popup: 'swal2-popup-delete',
        title: 'text-red-600 font-bold'
      }
    })

    if (result.isConfirmed) {
      try {
        setIsDeleting(item.id)
        
        // Show loading
        Swal.fire({
          title: 'Menghapus...',
          html: `Sedang menghapus data ${item.nama_lengkap}`,
          allowOutsideClick: false,
          allowEscapeKey: false,
          showConfirmButton: false,
          didOpen: () => {
            Swal.showLoading()
          }
        })

        // Try edit API route first, fallback to main API
        let response
        try {
          response = await fetch(`/api/panitia/edit/${item.id}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
          })
        } catch (err) {
          console.log('Edit API route failed, trying main API...')
          // Fallback to main API route
          response = await fetch(`/api/panitia?id=${item.id}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
          })
        }

        console.log(`Delete API Response status: ${response.status}`)
        const responseData = await response.json()
        console.log('Delete API Response data:', responseData)

        if (response.ok) {
          // Remove from local state
          setPanitiaList(prev => prev.filter(p => p.id !== item.id))
          
          // Close loading and show success
          Swal.close()
          
          await Swal.fire({
            title: 'Berhasil!',
            html: `
              <div class="text-center">
                <div class="mb-3">
                  <svg class="mx-auto h-16 w-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
                <p class="text-gray-600">Data panitia berhasil dihapus</p>
              </div>
            `,
            icon: 'success',
            timer: 2000,
            showConfirmButton: false,
            customClass: {
              popup: 'swal2-popup-success'
            }
          })

          // Call onDelete callback
          if (onDelete) {
            onDelete(item.id, item)
          }

        } else {
          throw new Error(responseData.error || 'Gagal menghapus data')
        }

      } catch (error: any) {
        console.error('Error deleting panitia:', error)
        
        Swal.close()
        Swal.fire({
          title: 'Gagal!',
          text: error.message || 'Terjadi kesalahan saat menghapus data',
          icon: 'error',
          confirmButtonColor: '#EF4444'
        })
      } finally {
        setIsDeleting(null)
      }
    }
  }

  // Handle refresh
  const handleRefresh = () => {
    fetchPanitiaData()
  }

  // Reset filters
  const resetFilters = () => {
    setSearchTerm('')
    setFilterDivisi('')
    setFilterJabatan('')
    setCurrentPage(1)
    setSortBy('tanggal')
    setSortOrder('desc')
    
    Toast.fire({
      icon: 'info',
      title: 'Filter direset'
    })
  }

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className || ''}`}>
        <div className="animate-pulse">
          <div className="flex justify-between items-center mb-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-10 bg-gray-200 rounded w-32"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
          
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className || ''}`}>
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.866-.833-2.636 0L3.18 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Terjadi Kesalahan</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow-lg overflow-hidden ${className || ''}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Daftar Panitia</h2>
            <p className="text-blue-100 text-sm">
              Total: {filteredAndSortedData.length} dari {panitiaList.length} panitia
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              className="bg-white/20 text-white px-3 py-2 rounded-lg hover:bg-white/30 transition-colors flex items-center"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <button
              onClick={() => router.push('/panitia/tambah')}
              className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Tambah
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-6 border-b bg-gray-50">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {/* Search */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Cari nama atau email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filter Divisi */}
          <select
            value={filterDivisi}
            onChange={(e) => setFilterDivisi(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Semua Divisi</option>
            {divisiOptions.map(divisi => (
              <option key={divisi} value={divisi}>{divisi}</option>
            ))}
          </select>

          {/* Filter Jabatan */}
          <select
            value={filterJabatan}
            onChange={(e) => setFilterJabatan(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Semua Jabatan</option>
            {jabatanOptions.map(jabatan => (
              <option key={jabatan} value={jabatan}>{jabatan}</option>
            ))}
          </select>

          {/* Reset Button */}
          <button
            onClick={resetFilters}
            className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center"
          >
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('nama')}
                  className="flex items-center hover:text-gray-700 transition-colors"
                >
                  Nama
                  {sortBy === 'nama' && (
                    <svg className={`ml-1 h-4 w-4 transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('divisi')}
                  className="flex items-center hover:text-gray-700 transition-colors"
                >
                  Divisi
                  {sortBy === 'divisi' && (
                    <svg className={`ml-1 h-4 w-4 transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('jabatan')}
                  className="flex items-center hover:text-gray-700 transition-colors"
                >
                  Jabatan
                  {sortBy === 'jabatan' && (
                    <svg className={`ml-1 h-4 w-4 transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('tanggal')}
                  className="flex items-center hover:text-gray-700 transition-colors"
                >
                  Tanggal Gabung
                  {sortBy === 'tanggal' && (
                    <svg className={`ml-1 h-4 w-4 transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </th>
              {showActions && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <AnimatePresence>
              {paginatedData.map((item, index) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className={`hover:bg-gray-50 transition-colors ${isDeleting === item.id ? 'opacity-50' : ''}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {item.nama_lengkap.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{item.nama_lengkap}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{item.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {item.nama_divisi}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      item.nama_jabatan === 'Koordinator' ? 'bg-green-100 text-green-800' :
                      item.nama_jabatan === 'Wakil Koordinator' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {item.nama_jabatan}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.created_at_formatted}
                  </td>
                  {showActions && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(item)}
                          disabled={isDeleting === item.id}
                          className="text-indigo-600 hover:text-indigo-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Edit"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          disabled={isDeleting === item.id}
                          className="text-red-600 hover:text-red-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Hapus"
                        >
                          {isDeleting === item.id ? (
                            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  )}
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {filteredAndSortedData.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak ada data panitia</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || filterDivisi || filterJabatan 
              ? 'Tidak ada data yang sesuai dengan filter yang dipilih.' 
              : 'Belum ada data panitia yang tersimpan.'
            }
          </p>
          {searchTerm || filterDivisi || filterJabatan ? (
            <button
              onClick={resetFilters}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Reset Filter
            </button>
          ) : (
            <button
              onClick={() => router.push('/panitia/tambah')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Tambah Panitia Pertama
            </button>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white px-6 py-3 border-t border-gray-200 flex items-center justify-between">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Menampilkan{' '}
                <span className="font-medium">{startIndex + 1}</span>{' '}
                sampai{' '}
                <span className="font-medium">
                  {Math.min(startIndex + itemsPerPage, filteredAndSortedData.length)}
                </span>{' '}
                dari{' '}
                <span className="font-medium">{filteredAndSortedData.length}</span>{' '}
                hasil
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                
                {/* Page Numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNumber = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
                  if (pageNumber > totalPages) return null
                  
                  return (
                    <button
                      key={pageNumber}
                      onClick={() => setCurrentPage(pageNumber)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        pageNumber === currentPage
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  )
                })}
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}