/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Swal from 'sweetalert2'

interface DivisiOption {
  id: number;
  nama: string;
  deskripsi?: string;
}

interface JabatanOption {
  id: number;
  nama: string;
  deskripsi?: string;
}

interface PanitiaData {
  id: number;
  nama_lengkap: string;
  email: string;
  nama_divisi: string;
  nama_jabatan: string;
  divisi_id: number;
  jabatan_id: number;
  created_at_formatted: string;
}

interface EditAdminProps {
  panitiaId: number;
  onSuccess?: (data: any) => void;
  onCancel?: () => void;
  className?: string;
}

export default function EditAdmin({ panitiaId, onSuccess, onCancel, className }: EditAdminProps) {
  const router = useRouter()
  const [form, setForm] = useState({
    nama_lengkap: "",
    divisi_id: "",
    jabatan_id: ""
  })

  const [originalData, setOriginalData] = useState<PanitiaData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [divisiOptions, setDivisiOptions] = useState<DivisiOption[]>([])
  const [jabatanOptions, setJabatanOptions] = useState<JabatanOption[]>([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fallback data
  const fallbackDivisiOptions = [
    { id: 1, nama: "Acara RAJA Brawijaya" },
    { id: 2, nama: "Bendahara Pelaksana" },
    { id: 3, nama: "DDM" },
    { id: 4, nama: "HUMAS" },
    { id: 5, nama: "Kesehatan" },
    { id: 6, nama: "KESTARI" },
    { id: 7, nama: "Konsumsi" },
    { id: 8, nama: "KORLAP" },
    { id: 9, nama: "OH" },
    { id: 10, nama: "PERKAP" },
    { id: 11, nama: "PIT" },
    { id: 12, nama: "SPV" },
    { id: 13, nama: "Sekretaris Pelaksana" }
  ]

  const fallbackJabatanOptions = [
    { id: 1, nama: "Koordinator" },
    { id: 2, nama: "Wakil Koordinator" },
    { id: 3, nama: "Staf" }
  ]

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

  // Success Alert
  const showSuccessAlert = (data: any) => {
    const timer = setTimeout(() => {
      Swal.close()
      if (onSuccess) onSuccess(data)
    }, 3000)

    Swal.fire({
      title: 'Berhasil!',
      html: `
        <div class="text-center">
          <div class="mb-4">
            <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <svg class="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
          </div>
          <p class="text-gray-600 mb-3 text-lg">Data panitia berhasil diperbarui!</p>
          ${data ? `
            <div class="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg text-sm border border-blue-200">
              <div class="grid grid-cols-1 gap-2 text-left">
                <div class="flex justify-between">
                  <span class="font-medium text-gray-700">Nama:</span>
                  <span class="text-gray-900">${data.nama_lengkap}</span>
                </div>
                <div class="flex justify-between">
                  <span class="font-medium text-gray-700">Email:</span>
                  <span class="text-gray-900">${data.email}</span>
                </div>
                <div class="flex justify-between">
                  <span class="font-medium text-gray-700">Divisi:</span>
                  <span class="text-gray-900">${data.nama_divisi || '-'}</span>
                </div>
                <div class="flex justify-between">
                  <span class="font-medium text-gray-700">Jabatan:</span>
                  <span class="text-gray-900">${data.nama_jabatan || '-'}</span>
                </div>
              </div>
            </div>
          ` : ''}
          <div class="mt-4 text-xs text-gray-500">
            Otomatis tutup dalam <span id="countdown">3</span> detik atau tekan OK
          </div>
        </div>
      `,
      icon: 'success',
      timer: 3000,
      timerProgressBar: true,
      showConfirmButton: true,
      confirmButtonText: 'OK',
      confirmButtonColor: '#10B981',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        let countdown = 3
        const countdownElement = document.getElementById('countdown')
        const interval = setInterval(() => {
          countdown--
          if (countdownElement) {
            countdownElement.textContent = countdown.toString()
          }
          if (countdown <= 0) {
            clearInterval(interval)
          }
        }, 1000)
      }
    }).then((result) => {
      clearTimeout(timer)
      if (onSuccess) onSuccess(data)
    })
  }

  // Error Alert
  const showErrorAlert = (message: string, details?: string) => {
    Swal.fire({
      title: 'Gagal!',
      html: `
        <div class="text-center">
          <div class="mb-4">
            <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <svg class="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
          </div>
          <p class="text-gray-600 mb-3 text-lg">${message}</p>
          ${details ? `
            <div class="bg-red-50 p-3 rounded-lg text-sm border border-red-200">
              <p class="text-red-700">${details}</p>
            </div>
          ` : ''}
        </div>
      `,
      icon: 'error',
      confirmButtonText: 'Coba Lagi',
      confirmButtonColor: '#EF4444'
    })
  }

  // Fetch options (divisi & jabatan)
  const fetchOptions = async () => {
    try {
      setIsLoadingOptions(true)
      
      const [divisiRes, jabatanRes] = await Promise.all([
        fetch('/api/divisi'),
        fetch('/api/jabatan')
      ])

      let divisiData = fallbackDivisiOptions
      let jabatanData = fallbackJabatanOptions

      if (divisiRes.ok) {
        const divisiResult = await divisiRes.json()
        if (Array.isArray(divisiResult) && divisiResult.length > 0) {
          divisiData = divisiResult
        }
      }

      if (jabatanRes.ok) {
        const jabatanResult = await jabatanRes.json()
        if (Array.isArray(jabatanResult) && jabatanResult.length > 0) {
          jabatanData = jabatanResult
        }
      }

      setDivisiOptions(divisiData)
      setJabatanOptions(jabatanData)

    } catch (error) {
      console.error('Error fetching options:', error)
      setDivisiOptions(fallbackDivisiOptions)
      setJabatanOptions(fallbackJabatanOptions)
    } finally {
      setIsLoadingOptions(false)
    }
  }

  // Fetch panitia data
  const fetchPanitiaData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      console.log(`Fetching panitia data for ID: ${panitiaId}`)

      // Try the new edit API route first, then fallback to main API
      let response
      let apiUsed = ''
      
      try {
        console.log('Trying edit API route...')
        response = await fetch(`/api/panitia/edit/${panitiaId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        apiUsed = 'edit'
      } catch (err) {
        console.log('Edit API route failed, trying main API...')
        try {
          response = await fetch(`/api/panitia?id=${panitiaId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          })
          apiUsed = 'main'
        } catch (mainErr) {
          console.error('Both API routes failed:', mainErr)
          throw new Error(`Tidak dapat mengakses API: ${mainErr}`)
        }
      }
      
      console.log(`API Response (${apiUsed}): ${response.status}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`API Error Response (${apiUsed}):`, errorText)
        
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText }
        }
        
        if (response.status === 404) {
          throw new Error('Data panitia tidak ditemukan atau sudah dihapus')
        } else if (response.status === 503) {
          throw new Error('Tidak dapat terhubung ke database. Periksa koneksi database.')
        } else if (response.status === 500) {
          const details = errorData.details || errorData.message || 'Server error'
          throw new Error(`Server error: ${details}`)
        } else {
          throw new Error(`HTTP ${response.status}: ${errorData.error || errorData.message || 'Unknown error'}`)
        }
      }

      const data = await response.json()
      console.log(`Received panitia data (${apiUsed}):`, data)
      
      if (data && (data.id || data.length > 0)) {
        // Handle both single object and array response
        const panitiaData = Array.isArray(data) ? data[0] : data
        
        if (!panitiaData || !panitiaData.id) {
          throw new Error('Data panitia tidak valid - missing ID')
        }

        // Ensure all required fields exist with defaults
        const validatedData = {
          id: panitiaData.id,
          nama_lengkap: panitiaData.nama_lengkap || '',
          email: panitiaData.email || '',
          divisi_id: panitiaData.divisi_id || null,
          jabatan_id: panitiaData.jabatan_id || null,
          nama_divisi: panitiaData.nama_divisi || panitiaData.divisi || '',
          nama_jabatan: panitiaData.nama_jabatan || panitiaData.role || '',
          created_at_formatted: panitiaData.created_at_formatted || panitiaData.bergabung || ''
        }

        setOriginalData(validatedData)
        setForm({
          nama_lengkap: validatedData.nama_lengkap,
          divisi_id: validatedData.divisi_id?.toString() || '',
          jabatan_id: validatedData.jabatan_id?.toString() || ''
        })
        
        console.log('Form initialized with:', {
          nama_lengkap: validatedData.nama_lengkap,
          divisi_id: validatedData.divisi_id,
          jabatan_id: validatedData.jabatan_id
        })
        
        Toast.fire({
          icon: 'success',
          title: `Data panitia berhasil dimuat (${apiUsed} API)`
        })
        
      } else {
        throw new Error('Data panitia tidak valid - empty response')
      }

    } catch (error: any) {
      console.error('Error fetching panitia data:', error)
      const errorMessage = error.message || 'Gagal memuat data panitia'
      setError(errorMessage)
      
      Toast.fire({
        icon: 'error',
        title: `Gagal memuat data: ${errorMessage}`
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Load data on mount
  useEffect(() => {
    fetchOptions()
    if (panitiaId) {
      fetchPanitiaData()
    }
  }, [panitiaId])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Validation
      if (!form.nama_lengkap.trim()) {
        showErrorAlert('Nama lengkap tidak boleh kosong')
        return
      }

      if (form.nama_lengkap.trim().length < 2) {
        showErrorAlert('Nama lengkap minimal 2 karakter')
        return
      }

      if (!form.divisi_id) {
        showErrorAlert('Pilih divisi terlebih dahulu')
        return
      }

      if (!form.jabatan_id) {
        showErrorAlert('Pilih jabatan terlebih dahulu')
        return
      }

      // Check if any changes made
      const hasChanges = form.nama_lengkap !== originalData?.nama_lengkap ||
                        form.divisi_id !== originalData?.divisi_id?.toString() ||
                        form.jabatan_id !== originalData?.jabatan_id?.toString()

      if (!hasChanges) {
        Toast.fire({
          icon: 'info',
          title: 'Tidak ada perubahan yang disimpan'
        })
        return
      }

      // Prepare data
      const updateData = {
        nama_lengkap: form.nama_lengkap.trim(),
        divisi_id: parseInt(form.divisi_id),
        jabatan_id: parseInt(form.jabatan_id)
      }

      console.log('Updating panitia data:', updateData)

      // Show loading
      Swal.fire({
        title: 'Memperbarui...',
        html: `Sedang memperbarui data ${form.nama_lengkap}`,
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
        response = await fetch(`/api/panitia/edit/${panitiaId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData)
        })
      } catch (err) {
        console.log('Edit API route failed, trying main API...')
        // Fallback to main API route
        response = await fetch(`/api/panitia?id=${panitiaId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData)
        })
      }

      console.log(`Update API Response status: ${response.status}`)
      const responseData = await response.json()
      console.log('Update API Response data:', responseData)

      if (response.ok) {
        Swal.close()
        showSuccessAlert(responseData.data)
        
        // Update original data
        setOriginalData(prev => prev ? { ...prev, ...responseData.data } : null)
        
      } else {
        Swal.close()
        showErrorAlert(
          responseData.error || 'Gagal memperbarui data',
          responseData.details
        )
      }

    } catch (error: any) {
      console.error('Error updating panitia:', error)
      Swal.close()
      showErrorAlert('Terjadi kesalahan saat memperbarui data', error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle cancel
  const handleCancel = () => {
    const hasChanges = form.nama_lengkap !== originalData?.nama_lengkap ||
                      form.divisi_id !== originalData?.divisi_id?.toString() ||
                      form.jabatan_id !== originalData?.jabatan_id?.toString()

    if (hasChanges) {
      Swal.fire({
        title: 'Batalkan Perubahan?',
        text: 'Perubahan yang belum disimpan akan hilang.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Batalkan',
        cancelButtonText: 'Lanjut Edit',
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#6B7280'
      }).then((result) => {
        if (result.isConfirmed) {
          if (onCancel) {
            onCancel()
          } else {
            router.back()
          }
        }
      })
    } else {
      if (onCancel) {
        onCancel()
      } else {
        router.back()
      }
    }
  }

  // Reset form to original data
  const handleReset = () => {
    if (originalData) {
      setForm({
        nama_lengkap: originalData.nama_lengkap || '',
        divisi_id: originalData.divisi_id?.toString() || '',
        jabatan_id: originalData.jabatan_id?.toString() || ''
      })
      
      Toast.fire({
        icon: 'info',
        title: 'Form direset ke data asli'
      })
    }
  }

  if (isLoading) {
    return (
      <div className={`min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-10 ${className || ''}`}>
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden border border-white/20 p-8">
          <div className="animate-pulse">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 rounded-t-3xl mb-8">
              <div className="h-8 bg-white/20 rounded w-3/4 mx-auto"></div>
              <div className="h-4 bg-white/20 rounded w-1/2 mx-auto mt-2"></div>
            </div>
            <div className="space-y-6">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-12 bg-gray-200 rounded"></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="h-12 bg-gray-200 rounded"></div>
                <div className="h-12 bg-gray-200 rounded"></div>
              </div>
              <div className="h-12 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-10 ${className || ''}`}>
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden border border-white/20 p-8">
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.866-.833-2.636 0L3.18 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Terjadi Kesalahan</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={fetchPanitiaData}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Coba Lagi
              </button>
              <button
                onClick={() => router.back()}
                className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Kembali
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Get selected options for display
  const selectedDivisi = divisiOptions.find(d => d.id.toString() === form.divisi_id)
  const selectedJabatan = jabatanOptions.find(j => j.id.toString() === form.jabatan_id)

  // Check if there are changes
  const hasChanges = form.nama_lengkap !== originalData?.nama_lengkap ||
                    form.divisi_id !== originalData?.divisi_id?.toString() ||
                    form.jabatan_id !== originalData?.jabatan_id?.toString()

  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-10 ${className || ''}`}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden border border-white/20"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-center relative">
          <h2 className="text-3xl font-bold text-white">
            Edit Data Panitia
          </h2>
          <p className="text-blue-100 mt-2">
            Perbarui informasi anggota panitia RAJA Brawijaya
          </p>
          
          {/* Cancel button */}
          <button
            onClick={handleCancel}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
            disabled={isSubmitting}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Original Data Display */}
        {originalData && (
          <div className="bg-blue-50 border-b border-blue-200 p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Data Saat Ini:</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-blue-700 font-medium">Email:</span>
                <span className="text-blue-900 ml-1">{originalData.email}</span>
              </div>
              <div>
                <span className="text-blue-700 font-medium">Divisi:</span>
                <span className="text-blue-900 ml-1">{originalData.nama_divisi}</span>
              </div>
              <div>
                <span className="text-blue-700 font-medium">Jabatan:</span>
                <span className="text-blue-900 ml-1">{originalData.nama_jabatan}</span>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Email Display (Read-only) */}
          <div className="group">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Email UB (Tidak dapat diubah)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
              </div>
              <input
                type="text"
                value={originalData?.email || ''}
                disabled
                className="w-full border border-gray-200 p-3 pl-10 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Email tidak dapat diubah setelah pendaftaran
            </p>
          </div>

          {/* Nama Lengkap */}
          <div className="group relative">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Nama Lengkap <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Contoh: Budi Santoso"
                value={form.nama_lengkap}
                onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })}
                className={`w-full border p-3 pl-10 rounded-lg focus:outline-none focus:ring-2 transition-all duration-300 ${
                  form.nama_lengkap.trim().length > 0 && form.nama_lengkap.trim().length < 2 
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                    : form.nama_lengkap !== originalData?.nama_lengkap && form.nama_lengkap.trim().length >= 2
                    ? 'border-yellow-300 focus:ring-yellow-500 focus:border-yellow-500 bg-yellow-50'
                    : 'border-gray-300 focus:ring-blue-500 focus:border-transparent hover:border-gray-400'
                }`}
                required
                maxLength={255}
                disabled={isSubmitting}
              />
              {form.nama_lengkap.trim().length > 0 && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  {form.nama_lengkap.trim().length >= 2 ? (
                    <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              )}
            </div>
            {form.nama_lengkap.trim().length > 0 && form.nama_lengkap.trim().length < 2 && (
              <p className="text-red-500 text-xs mt-1">Nama lengkap minimal 2 karakter</p>
            )}
            {form.nama_lengkap !== originalData?.nama_lengkap && form.nama_lengkap.trim().length >= 2 && (
              <p className="text-yellow-600 text-xs mt-1">Nama akan diubah dari "{originalData?.nama_lengkap}"</p>
            )}
          </div>

          {/* Divisi dan Jabatan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Divisi */}
            <div className="group">
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Divisi <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                  </svg>
                </div>
                <select
                  value={form.divisi_id}
                  onChange={(e) => setForm({ ...form, divisi_id: e.target.value })}
                  className={`w-full border p-3 pl-10 rounded-lg focus:outline-none focus:ring-2 transition-all duration-300 appearance-none bg-white ${
                    form.divisi_id !== originalData?.divisi_id?.toString() && form.divisi_id
                      ? 'border-yellow-300 focus:ring-yellow-500 focus:border-yellow-500 bg-yellow-50'
                      : form.divisi_id 
                      ? 'border-green-300 focus:ring-green-500 focus:border-green-500' 
                      : 'border-gray-300 focus:ring-blue-500 focus:border-transparent hover:border-gray-400'
                  }`}
                  required
                  disabled={isLoadingOptions || isSubmitting}
                >
                  <option value="">
                    {isLoadingOptions ? "Loading..." : "Pilih Divisi"}
                  </option>
                  {divisiOptions.map((divisi) => (
                    <option key={divisi.id} value={divisi.id}>
                      {divisi.nama}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                  {isLoadingOptions ? (
                    <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>
              {selectedDivisi && (
                <p className={`text-xs mt-1 font-medium ${
                  form.divisi_id !== originalData?.divisi_id?.toString() 
                    ? 'text-yellow-600' 
                    : 'text-green-600'
                }`}>
                  {form.divisi_id !== originalData?.divisi_id?.toString() 
                    ? `Akan diubah ke: ${selectedDivisi.nama}` 
                    : `Terpilih: ${selectedDivisi.nama}`
                  }
                </p>
              )}
            </div>

            {/* Jabatan */}
            <div className="group">
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Jabatan <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                  </svg>
                </div>
                <select
                  value={form.jabatan_id}
                  onChange={(e) => setForm({ ...form, jabatan_id: e.target.value })}
                  className={`w-full border p-3 pl-10 rounded-lg focus:outline-none focus:ring-2 transition-all duration-300 appearance-none bg-white ${
                    form.jabatan_id !== originalData?.jabatan_id?.toString() && form.jabatan_id
                      ? 'border-yellow-300 focus:ring-yellow-500 focus:border-yellow-500 bg-yellow-50'
                      : form.jabatan_id 
                      ? 'border-green-300 focus:ring-green-500 focus:border-green-500' 
                      : 'border-gray-300 focus:ring-blue-500 focus:border-transparent hover:border-gray-400'
                  }`}
                  required
                  disabled={isLoadingOptions || isSubmitting}
                >
                  <option value="">
                    {isLoadingOptions ? "Loading..." : "Pilih Jabatan"}
                  </option>
                  {jabatanOptions.map((jabatan) => (
                    <option key={jabatan.id} value={jabatan.id}>
                      {jabatan.nama}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                  {isLoadingOptions ? (
                    <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>
              {selectedJabatan && (
                <p className={`text-xs mt-1 font-medium ${
                  form.jabatan_id !== originalData?.jabatan_id?.toString() 
                    ? 'text-yellow-600' 
                    : 'text-green-600'
                }`}>
                  {form.jabatan_id !== originalData?.jabatan_id?.toString() 
                    ? `Akan diubah ke: ${selectedJabatan.nama}` 
                    : `Terpilih: ${selectedJabatan.nama}`
                  }
                </p>
              )}
            </div>
          </div>

          {/* Changes Summary */}
          {hasChanges && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-900 mb-2">Perubahan yang akan disimpan:</h4>
              <div className="space-y-1 text-sm">
                {form.nama_lengkap !== originalData?.nama_lengkap && (
                  <div className="flex justify-between">
                    <span className="text-yellow-700">Nama:</span>
                    <span className="text-yellow-900">{originalData?.nama_lengkap} → {form.nama_lengkap}</span>
                  </div>
                )}
                {form.divisi_id !== originalData?.divisi_id?.toString() && (
                  <div className="flex justify-between">
                    <span className="text-yellow-700">Divisi:</span>
                    <span className="text-yellow-900">{originalData?.nama_divisi} → {selectedDivisi?.nama}</span>
                  </div>
                )}
                {form.jabatan_id !== originalData?.jabatan_id?.toString() && (
                  <div className="flex justify-between">
                    <span className="text-yellow-700">Jabatan:</span>
                    <span className="text-yellow-900">{originalData?.nama_jabatan} → {selectedJabatan?.nama}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col md:flex-row gap-4">
            {/* Reset Button */}
            <motion.button
              whileHover={{ scale: hasChanges && !isSubmitting ? 1.02 : 1 }}
              whileTap={{ scale: hasChanges && !isSubmitting ? 0.98 : 1 }}
              type="button"
              onClick={handleReset}
              disabled={!hasChanges || isSubmitting}
              className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center ${
                !hasChanges || isSubmitting
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                  : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border border-yellow-300'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
              Reset
            </motion.button>

            {/* Cancel Button */}
            <motion.button
              whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
              whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center ${
                isSubmitting
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Batal
            </motion.button>

            {/* Save Button */}
            <motion.button
              whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
              whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
              type="submit"
              disabled={isSubmitting || isLoadingOptions || !hasChanges || form.nama_lengkap.trim().length < 2}
              className={`flex-1 md:flex-[2] py-4 px-6 rounded-xl font-semibold text-white shadow-lg transition-all duration-300 flex items-center justify-center ${
                isSubmitting || isLoadingOptions || !hasChanges || form.nama_lengkap.trim().length < 2
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 hover:shadow-xl'
              }`}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Menyimpan...
                </>
              ) : isLoadingOptions ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </>
              ) : !hasChanges ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Tidak Ada Perubahan
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
                  </svg>
                  Simpan Perubahan
                </>
              )}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}