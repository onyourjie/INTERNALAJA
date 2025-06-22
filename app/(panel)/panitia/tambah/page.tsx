/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { useState, FormEvent } from "react"
import { toast } from "react-toastify"
import { motion } from "framer-motion"

export default function TambahPanitia() {
  const [form, setForm] = useState({
    nama_lengkap: "",
    emailPrefix: "",
    divisi: "",
    jabatan: ""
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const domain = "@student.ub.ac.id"

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    const prefix = form.emailPrefix.trim()

    if (!prefix) {
      toast.error("❌ Email tidak boleh kosong")
      setIsSubmitting(false)
      return
    }

    if (prefix.includes(" ")) {
      toast.error("❌ Email tidak boleh mengandung spasi")
      setIsSubmitting(false)
      return
    }

    if (!/^[a-z0-9]/.test(prefix)) {
      toast.error("❌ Email harus diawali huruf atau angka")
      setIsSubmitting(false)
      return
    }

    if (prefix.endsWith(".")) {
      toast.error("❌ Email tidak boleh diakhiri titik (.)")
      setIsSubmitting(false)
      return
    }

    if (prefix.includes("..")) {
      toast.error("❌ Email tidak boleh mengandung dua titik berturut-turut")
      setIsSubmitting(false)
      return
    }

    const email = prefix + domain

    try {
      const res = await fetch("/api/panitia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama_lengkap: form.nama_lengkap,
          email,
          divisi: form.divisi,
          jabatan: form.jabatan,
        })
      })

      if (res.ok) {
        toast.success("✅ Panitia berhasil ditambahkan")
        setForm({ nama_lengkap: "", emailPrefix: "", divisi: "", jabatan: "" })
      } else {
        toast.error("❌ Gagal menambahkan panitia")
      }
    } catch (error) {
      toast.error("❌ Terjadi kesalahan pada server")
    } finally {
      setIsSubmitting(false)
    }
  }

  const divisiOptions = [
    "Acara RAJA Brawijaya",
    "Bendahara Pelaksana",
    "DDM",
    "HUMAS",
    "Kesehatan",
    "KESTARI",
    "Konsumsi",
    "KORLAP",
    "OH",
    "PERKAP",
    "PIT",
    "SPV",
    "Sekretaris Pelaksana"
  ]

  const jabatanOptions = [
    "Koordinator",
    "Wakil Koordinator",
    "Staf"
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-10">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden border border-white/20"
      >
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-center">
          <h2 className="text-3xl font-bold text-white">
            Form Tambah Panitia
          </h2>
          <p className="text-blue-100 mt-2">
            Tambahkan anggota baru ke dalam kepanitiaan
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="group relative">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Nama Lengkap
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
                className="w-full border border-gray-300 p-3 pl-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:border-gray-400"
                required
              />
            </div>
          </div>

          <div className="group">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Email UB
            </label>
            <div className="flex items-center">
              <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="username"
                  value={form.emailPrefix}
                  onChange={(e) => {
                    let input = e.target.value
                    input = input.replace(/[^a-z0-9._-]/gi, "")
                    if (input.includes("..")) return
                    if (input.length === 1 && !/^[a-z0-9]/.test(input)) return
                    if (input.endsWith(".")) return
                    setForm({ ...form, emailPrefix: input.toLowerCase() })
                  }}
                  className="w-full border border-gray-300 p-3 pl-10 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:border-gray-400"
                  required
                />
              </div>
              <span className="px-4 py-3 bg-gray-100 border-t border-b border-r border-gray-300 rounded-r-lg text-gray-600 font-medium">
                {domain}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2 ml-1">
              Hanya karakter: a–z, 0–9, titik (.), underscore (_) atau minus (-)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="group">
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Divisi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                  </svg>
                </div>
                <select
                  value={form.divisi}
                  onChange={(e) => setForm({ ...form, divisi: e.target.value })}
                  className="w-full border border-gray-300 p-3 pl-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:border-gray-400 appearance-none bg-white"
                  required
                >
                  <option value="">Pilih Divisi</option>
                  {divisiOptions.map((divisi, index) => (
                    <option key={index}>{divisi}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="group">
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Jabatan
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                  </svg>
                </div>
                <select
                  value={form.jabatan}
                  onChange={(e) => setForm({ ...form, jabatan: e.target.value })}
                  className="w-full border border-gray-300 p-3 pl-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 hover:border-gray-400 appearance-none bg-white"
                  required
                >
                  <option value="">Pilih Jabatan</option>
                  {jabatanOptions.map((jabatan, index) => (
                    <option key={index}>{jabatan}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-4 px-6 rounded-xl font-semibold text-white shadow-lg transition-all duration-300 flex items-center justify-center ${
              isSubmitting 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800'
            }`}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Memproses...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                </svg>
                Tambah Panitia
              </>
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  )
}