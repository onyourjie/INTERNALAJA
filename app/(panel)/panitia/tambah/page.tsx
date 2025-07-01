"use client"

import { useState, FormEvent } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import Swal from "sweetalert2"
import "sweetalert2/dist/sweetalert2.min.css"

interface OptionItem {
  id: number
  nama: string
}

export default function TambahPanitia() {
  const router = useRouter()
  const [form, setForm] = useState({
    nama_lengkap: "",
    emailPrefix: "",
    divisi_id: 0,
    jabatan_id: 0
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const domain = "@student.ub.ac.id"

  const divisiOptions: OptionItem[] = [
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
    { id: 13, nama: "Sekretaris Pelaksana" },
  ]

  const jabatanOptions: OptionItem[] = [
    { id: 1, nama: "Koordinator" },
    { id: 2, nama: "Wakil Koordinator" },
    { id: 3, nama: "Staf" },
  ]

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    const prefix = form.emailPrefix.trim()
    if (!prefix) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Email tidak boleh kosong' })
      setIsSubmitting(false)
      return
    }
    if (prefix.includes(" ")) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Email tidak boleh mengandung spasi' })
      setIsSubmitting(false)
      return
    }
    if (!/^[a-z0-9]/.test(prefix)) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Email harus diawali huruf atau angka' })
      setIsSubmitting(false)
      return
    }
    if (prefix.endsWith(".")) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Email tidak boleh diakhiri titik (.)' })
      setIsSubmitting(false)
      return
    }
    if (prefix.includes("..")) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Email tidak boleh mengandung dua titik berturut-turut' })
      setIsSubmitting(false)
      return
    }
    if (!form.divisi_id || !form.jabatan_id) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Divisi dan jabatan harus dipilih' })
      setIsSubmitting(false)
      return
    }

    const email = prefix + domain
    const payload = {
      nama_lengkap: form.nama_lengkap.trim(),
      email,
      divisi_id: form.divisi_id,
      jabatan_id: form.jabatan_id
    }

    try {
      const res = await fetch("/api/panitia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Berhasil',
          text: 'Panitia berhasil ditambahkan'
        }).then(() => {
          router.push('/panitia')
        })
      } else {
        const err = await res.json()
        Swal.fire({ icon: 'error', title: 'Gagal', text: err.error || 'Gagal menambahkan panitia' })
      }
    } catch {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Terjadi kesalahan pada server' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden border border-white/20"
      >
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-center">
          <h2 className="text-3xl font-bold text-white">Form Tambah Panitia</h2>
          <p className="text-blue-100 mt-2">Tambahkan anggota baru ke dalam kepanitiaan</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Nama Lengkap */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Nama Lengkap</label>
            <input
              type="text"
              placeholder="Contoh: Budi Santoso"
              value={form.nama_lengkap}
              onChange={e => setForm({ ...form, nama_lengkap: e.target.value })}
              className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Email UB */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Email UB</label>
            <div className="flex">
              <input
                type="text"
                placeholder="username"
                value={form.emailPrefix}
                onChange={e => {
                  let v = e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "")
                  if (!v.includes("..") && !v.endsWith(".")) {
                    setForm({ ...form, emailPrefix: v })
                  }
                }}
                className="flex-grow border border-gray-300 p-3 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <span className="px-4 py-3 bg-gray-100 border border-gray-300 rounded-r-lg">
                {domain}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Hanya a–z, 0–9, titik (.), underscore (_) atau minus (-)</p>
          </div>

          {/* Divisi & Jabatan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Divisi</label>
              <select
                value={form.divisi_id}
                onChange={e => setForm({ ...form, divisi_id: +e.target.value })}
                className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value={0}>Pilih Divisi</option>
                {divisiOptions.map(d => (
                  <option key={d.id} value={d.id}>{d.nama}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Jabatan</label>
              <select
                value={form.jabatan_id}
                onChange={e => setForm({ ...form, jabatan_id: +e.target.value })}
                className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value={0}>Pilih Jabatan</option>
                {jabatanOptions.map(j => (
                  <option key={j.id} value={j.id}>{j.nama}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Submit Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-4 rounded-xl text-white font-semibold transition ${
              isSubmitting ? "bg-gray-400 cursor-not-allowed" : "bg-gradient-to-r from-blue-600 to-indigo-700"
            }`}
          >
            {isSubmitting ? "Memproses..." : "Tambah Panitia"}
          </motion.button>
        </form>
      </motion.div>
    </div>
  )
}
