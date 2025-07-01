"use client";
import { useState, FormEvent, useEffect } from "react";
import Swal from "sweetalert2";
import type {
  DivisiOption,
  JabatanOption,
  FormTambahAdminProps,
} from "@/types";

export default function FormTambahAdmin({
  onSuccess,
  onCancel,
}: FormTambahAdminProps) {
  // State management
  const [form, setForm] = useState({
    nama_lengkap: "",
    emailPrefix: "",
    divisi_id: "",
    jabatan_id: "",
  });

  // Custom types untuk komponen
  declare type DivisiOption = {
    id: number;
    nama: string;
    deskripsi?: string;
  };

  declare type JabatanOption = {
    id: number;
    nama: string;
    deskripsi?: string;
  };

  declare type FormTambahAdminProps = {
    onSuccess?: (data: any) => void;
    onCancel?: () => void;
    className?: string;
  };
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [divisiOptions, setDivisiOptions] = useState<DivisiOption[]>([]);
  const [jabatanOptions, setJabatanOptions] = useState<JabatanOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const domain = "@student.ub.ac.id";

  // Fetch data divisi dan jabatan
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch divisi
        const divisiRes = await fetch("/api/divisi");
        const divisiData = await divisiRes.json();
        setDivisiOptions(Array.isArray(divisiData) ? divisiData : []);

        // Fetch jabatan
        const jabatanRes = await fetch("/api/jabatan");
        const jabatanData = await jabatanRes.json();
        setJabatanOptions(Array.isArray(jabatanData) ? jabatanData : []);
      } catch (error) {
        setErrors(["Failed to load options"]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Validasi email
  const validateEmail = (prefix: string) => {
    if (!prefix) return "Email tidak boleh kosong";
    if (prefix.includes("@")) return "Hanya masukkan bagian sebelum @";
    if (!/^[a-z0-9._-]+$/.test(prefix))
      return "Hanya huruf kecil, angka, titik, minus";
    return "";
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validasi form
    const newErrors = [];
    if (!form.nama_lengkap) newErrors.push("Nama lengkap wajib diisi");
    if (!form.divisi_id) newErrors.push("Divisi wajib dipilih");
    if (!form.jabatan_id) newErrors.push("Jabatan wajib dipilih");

    const emailError = validateEmail(form.emailPrefix);
    if (emailError) newErrors.push(emailError);

    if (newErrors.length > 0) {
      Swal.fire({
        title: "Validasi Gagal",
        html: `<ul>${newErrors.map((e) => `<li>${e}</li>`).join("")}</ul>`,
        icon: "error",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      // Format data
      const payload = {
        nama_lengkap: form.nama_lengkap,
        email: `${form.emailPrefix}${domain}`,
        divisi_id: parseInt(form.divisi_id),
        jabatan_id: parseInt(form.jabatan_id),
      };

      // Kirim ke API
      const res = await fetch("/api/panitia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (res.ok) {
        Swal.fire({
          title: "Sukses!",
          text: "Data panitia berhasil disimpan",
          icon: "success",
        });
        if (onSuccess) onSuccess(result.data);
      } else {
        throw new Error(result.error || "Failed to save data");
      }
    } catch (error: any) {
      Swal.fire({
        title: "Error!",
        text: error.message,
        icon: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Tambah Panitia Baru</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Input fields */}
        <div>
          <label className="block mb-1 font-medium">Nama Lengkap</label>
          <input
            type="text"
            value={form.nama_lengkap}
            onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })}
            className="w-full p-2 border rounded-lg"
            required
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">Email UB</label>
          <div className="flex">
            <input
              type="text"
              value={form.emailPrefix}
              onChange={(e) =>
                setForm({ ...form, emailPrefix: e.target.value })
              }
              className="flex-1 p-2 border rounded-l-lg"
              placeholder="username"
              required
            />
            <span className="p-2 bg-gray-100 border rounded-r-lg">
              {domain}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 font-medium">Divisi</label>
            <select
              value={form.divisi_id}
              onChange={(e) => setForm({ ...form, divisi_id: e.target.value })}
              className="w-full p-2 border rounded-lg"
              disabled={isLoading}
              required
            >
              <option value="">Pilih Divisi</option>
              {divisiOptions.map((divisi) => (
                <option key={divisi.id} value={divisi.id}>
                  {divisi.nama}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-1 font-medium">Jabatan</label>
            <select
              value={form.jabatan_id}
              onChange={(e) => setForm({ ...form, jabatan_id: e.target.value })}
              className="w-full p-2 border rounded-lg"
              disabled={isLoading}
              required
            >
              <option value="">Pilih Jabatan</option>
              {jabatanOptions.map((jabatan) => (
                <option key={jabatan.id} value={jabatan.id}>
                  {jabatan.nama}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border rounded-lg hover:bg-gray-100"
            disabled={isSubmitting}
          >
            Batal
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting ? "Menyimpan..." : "Simpan Panitia"}
          </button>
        </div>
      </form>
    </div>
  );
}
