'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, ChevronDown } from 'lucide-react'
import Swal from 'sweetalert2'

interface Rangkaian { id:number; judul:string; tanggal:string }
interface BuatKegiatanProps { 
  onSuccess?:(d:any)=>void; 
  onCancel?:()=>void; 
  initialData?:any;
  isEdit?: boolean; // Tambahkan prop untuk menentukan mode edit
}
interface ApiResponse { success:boolean; data?:any; error?:string; message?:string }

export default function BuatKegiatan({ onSuccess, onCancel, initialData, isEdit = false }:BuatKegiatanProps){
  const [judul,setJudul]=useState('')
  const [desk,setDesk]=useState('')
  const [selected,setSelected]=useState<string[]>([])
  const [drop,setDrop]=useState(false)
  const [jenis,setJenis]=useState<'single'|'multiple'>('single')
  const [tgl,setTgl]=useState('')
  const [list,setList]=useState<Rangkaian[]>([{id:1,judul:'',tanggal:''},{id:2,judul:'',tanggal:''}])
  const [divisi,setDivisi]=useState<string[]>([])
  const [load,setLoad]=useState(false)
  const [submit,setSubmit]=useState(false)

  useEffect(()=>{initDivisi()},[])
  useEffect(()=>{
    if(initialData){
      setJudul(initialData.nama||'')
      setDesk(initialData.deskripsi||'')
      setSelected(initialData.divisi?.map((d:string)=>d.trim())||[])
      setJenis(initialData.jenisRangkaian||'single')
      if(initialData.tanggal)setTgl(initialData.tanggal)
      if(initialData.rangkaian && initialData.rangkaian.length > 0){
        const rangkaianData = initialData.rangkaian.map((r:any, index:number) => ({
          id: r.id || index + 1,
          judul: r.judul || '',
          tanggal: r.tanggal || ''
        }))
        // Pastikan minimal 2 item untuk multiple
        if(initialData.jenisRangkaian === 'multiple' && rangkaianData.length < 2) {
          setList([...rangkaianData, {id: rangkaianData.length + 1, judul: '', tanggal: ''}])
        } else {
          setList(rangkaianData)
        }
      }
    }
  },[initialData])

  // Reset list ketika jenis berubah
  useEffect(() => {
    if (jenis === 'multiple' && list.length < 2) {
      setList([{id:1,judul:'',tanggal:''},{id:2,judul:'',tanggal:''}])
    } else if (jenis === 'single') {
      setList([{id:1,judul:'',tanggal:''}])
    }
  }, [jenis])

  const initDivisi=async()=>{
    setLoad(true)
    try {
      const r:ApiResponse=await fetch('/api/panitiapeserta/kegiatan/buatkegiatan').then(x=>x.json())
      setDivisi(r.success?['Semua',...new Set((r.data as string[]).map(d=>d.trim()))]:['Semua'])
    } catch (error) {
      setDivisi(['Semua'])
      await Swal.fire({
        icon: 'warning',
        title: 'Peringatan!',
        text: 'Tidak dapat memuat daftar divisi. Sistem akan menggunakan opsi default.',
        confirmButtonText: 'Mengerti',
        confirmButtonColor: '#4891A1'
      })
    }
    setLoad(false)
  }

  const choose=(d:string)=>{
    if(d==='Semua')setSelected(s=>s.includes('Semua')?[]:['Semua'])
    else setSelected(s=>{
      const w=s.filter(x=>x!=='Semua')
      return w.includes(d)?w.filter(x=>x!==d):[...w,d]
    })
  }

  const add=()=>{
    const maxId = list.length > 0 ? Math.max(...list.map(x=>x.id)) : 0
    setList(p=>[...p,{id: maxId + 1, judul:'',tanggal:''}])
  }
  
  // Perbaiki kondisi untuk tidak bisa menghapus jika kurang dari 2 item pada multiple
  const rem=(id:number)=>{
    if (jenis === 'multiple' && list.length <= 2) return
    if (jenis === 'single' && list.length <= 1) return
    setList(p=>p.filter(r=>r.id!==id))
  }
  
  const upd=(id:number,f:'judul'|'tanggal',v:string)=>setList(p=>p.map(r=>r.id===id?{...r,[f]:v}:r))

  const validate=()=>{
    if(!judul.trim())return'Nama kegiatan wajib diisi untuk melanjutkan'
    if(!desk.trim())return'Deskripsi kegiatan diperlukan untuk memberikan informasi yang jelas'
    if(selected.length===0)return'Silakan pilih minimal satu divisi yang akan terlibat dalam kegiatan ini'
    if(jenis==='single'&&!tgl)return'Tanggal pelaksanaan kegiatan harus ditentukan'
    if(jenis==='multiple'){
      const v=list.filter(r=>r.judul.trim()&&r.tanggal)
      if(v.length<2)return'Kegiatan dengan multiple rangkaian memerlukan minimal 2 hari yang terisi lengkap'
      if(new Set(v.map(r=>r.judul.trim().toLowerCase())).size!==v.length)return'Setiap hari kegiatan harus memiliki nama yang berbeda'
      
      // Validasi duplikat tanggal
      const tanggalList = v.map(r=>r.tanggal)
      if(new Set(tanggalList).size !== tanggalList.length)return'Setiap hari kegiatan harus memiliki tanggal yang berbeda'
    }
    return null
  }

  const showValidationError = async (message: string) => {
    await Swal.fire({
      icon: 'error',
      title: 'Oops! Ada yang kurang...',
      text: message,
      confirmButtonText: 'Perbaiki',
      confirmButtonColor: '#4891A1',
      backdrop: `rgba(72,145,161,0.4)`,
      customClass: {
        popup: 'animate__animated animate__shakeX'
      }
    })
  }

  const showSuccessMessage = async (message: string) => {
    await Swal.fire({
      icon: 'success',
      title: 'Berhasil! 🎉',
      text: message,
      confirmButtonText: 'Lanjutkan',
      confirmButtonColor: '#4891A1',
      timer: 3000,
      timerProgressBar: true,
      backdrop: `rgba(72,145,161,0.4)`,
      customClass: {
        popup: 'animate__animated animate__bounceIn'
      }
    })
  }

  const showNetworkError = async () => {
    await Swal.fire({
      icon: 'error',
      title: 'Koneksi Bermasalah',
      text: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda dan coba lagi.',
      confirmButtonText: 'Coba Lagi',
      confirmButtonColor: '#4891A1',
      backdrop: `rgba(255,0,0,0.2)`
    })
  }

  const showServerError = async (message: string) => {
    await Swal.fire({
      icon: 'error',
      title: 'Terjadi Kesalahan',
      text: message || 'Server mengalami gangguan. Tim teknis sedang menangani masalah ini.',
      confirmButtonText: 'Mengerti',
      confirmButtonColor: '#4891A1',
      backdrop: `rgba(255,0,0,0.2)`
    })
  }

  const submitForm=async(e:React.FormEvent)=>{
    e.preventDefault()
    const msg=validate()
    if(msg){
      await showValidationError(msg)
      return
    }
    setSubmit(true)
    
    const body={
      nama:judul.trim(),
      deskripsi:desk.trim(),
      divisi:Array.from(new Set(selected.map(s=>s.trim()))),
      jenisRangkaian:jenis,
      tanggal:jenis==='single'?tgl:undefined,
      rangkaian:jenis==='multiple'?list.filter(r=>r.judul.trim()&&r.tanggal):undefined
    }

    try {
      let url = '/api/panitiapeserta/kegiatan/buatkegiatan'
      let method = 'POST'
      
      // Jika mode edit, gunakan PUT dan sertakan ID
      if(isEdit && initialData?.id) {
        method = 'PUT'
        body.id = initialData.id
      }
      
      const r:ApiResponse = await fetch(url, {
        method,
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body)
      }).then(x=>x.json())
      
      if(r.success){
        const successMessage = isEdit 
          ? `Kegiatan "${judul}" berhasil diperbarui dengan semua perubahan tersimpan!`
          : `Kegiatan "${judul}" berhasil dibuat dan siap untuk dilaksanakan!`
        
        await showSuccessMessage(successMessage)
        onSuccess?.(r.data)
      } else {
        const errorMessage = r.error || (isEdit 
          ? 'Gagal memperbarui kegiatan. Silakan periksa data dan coba lagi.'
          : 'Gagal membuat kegiatan baru. Silakan periksa data dan coba lagi.')
        await showServerError(errorMessage)
      }
    } catch (error) {
      await showNetworkError()
    }
    setSubmit(false)
  }

  const label=()=>load?'Memuat daftar divisi...':selected.length===0?'Pilih Divisi':selected.includes('Semua')?'Semua Divisi':selected.length===1?selected[0]:`${selected.length} divisi dipilih`
  const today=new Date().toISOString().split('T')[0]

  return(
    <div className="w-full">
      <div className="bg-[#4891A1] text-white p-6 -m-6 mb-6 rounded-t-lg text-center text-2xl font-bold">
        {isEdit ? 'Form Edit Kegiatan' : 'Form Buat Kegiatan'}
      </div>
      
      <form onSubmit={submitForm} className="space-y-6">
        <input 
          value={judul} 
          onChange={e=>setJudul(e.target.value)} 
          placeholder="Nama Kegiatan (contoh: PKKMB, SEKOLAH KORLAP)" 
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4891A1] focus:border-[#4891A1] text-lg" 
          disabled={submit} 
          maxLength={255}
        />
        
        <textarea 
          value={desk} 
          onChange={e=>setDesk(e.target.value)} 
          placeholder="Deskripsi Kegiatan (jelaskan tujuan, agenda, dan hal penting lainnya)" 
          rows={4} 
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4891A1] focus:border-[#4891A1] resize-none" 
          disabled={submit} 
          maxLength={1000}
        />
        
        <div className="relative">
          <button 
            type="button" 
            onClick={()=>setDrop(!drop)} 
            className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 flex items-center justify-between" 
            disabled={submit||load}
          >
            <span className="text-gray-700">{label()}</span>
            <ChevronDown size={20} className={`transition-transform ${drop?'rotate-180':''}`}/>
          </button>
          {drop&&!load&&<div className="absolute z-10 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {divisi.map(d=>(
              <label key={d} className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={selected.includes(d)} 
                  onChange={()=>choose(d)} 
                  className="mr-3 h-4 w-4 text-[#4891A1] border-gray-300 rounded focus:ring-[#4891A1]" 
                  disabled={submit}
                />
                <span className="text-gray-700">{d}</span>
              </label>
            ))}
          </div>}
        </div>
        
        <div className="flex gap-4">
          <button 
            type="button" 
            onClick={()=>setJenis('single')} 
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              jenis==='single'?'bg-[#4891A1] text-white shadow-md':'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`} 
            disabled={submit}
            title="Kegiatan dilaksanakan dalam satu hari"
          >
            1 Hari Kegiatan
          </button>
          <button 
            type="button" 
            onClick={()=>setJenis('multiple')} 
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              jenis==='multiple'?'bg-[#4891A1] text-white shadow-md':'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`} 
            disabled={submit}
            title="Kegiatan dilaksanakan dalam beberapa hari"
          >
            Multi Hari Kegiatan
          </button>
        </div>
        
        {jenis==='single'&&(
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tanggal Pelaksanaan Kegiatan
            </label>
            <input 
              type="date" 
              lang="id" 
              value={tgl} 
              onChange={e=>setTgl(e.target.value)} 
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4891A1] focus:border-[#4891A1]" 
              disabled={submit} 
              min={today}
            />
          </div>
        )}
        
        {jenis==='multiple'&&(
          <div className="space-y-4">
            <div className="text-sm font-medium text-gray-700 mb-3">
              Jadwal Kegiatan Multi Hari (minimal 2 hari)
            </div>
            {list.map((r,i)=>(
              <div key={r.id} className="border-l-4 border-[#4891A1] pl-4 bg-gray-50 rounded-lg p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-3">
                    <input 
                      value={r.judul} 
                      onChange={e=>upd(r.id,'judul',e.target.value)} 
                      placeholder={`Day ${i+1}`} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4891A1] focus:border-[#4891A1]" 
                      disabled={submit} 
                      maxLength={255}
                    />
                    <input 
                      type="date" 
                      lang="id" 
                      value={r.tanggal} 
                      onChange={e=>upd(r.id,'tanggal',e.target.value)} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4891A1] focus:border-[#4891A1]" 
                      disabled={submit} 
                      min={today}
                    />
                  </div>
                  {/* Tombol hapus hanya muncul di inputan yang ditambahkan manual (index >= 2) */}
                  {i >= 2 && (
                    <button 
                      type="button" 
                      onClick={()=>rem(r.id)} 
                      className="bg-red-600 text-white p-3 rounded-lg hover:bg-red-700 transition-colors shadow-md" 
                      disabled={submit} 
                      title="Hapus Hari Kegiatan Ini"
                    >
                      <Trash2 size={20}/>
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button 
              type="button" 
              onClick={add} 
              className="w-full flex items-center justify-center gap-2 bg-[#4891A1] text-white py-3 px-4 rounded-lg hover:bg-[#3d7a89] transition-colors shadow-md font-medium" 
              disabled={submit}
            >
              <Plus size={20}/>
              Tambah Hari Kegiatan
            </button>
          </div>
        )}
        
        <div className="flex gap-4 pt-6">
          <button 
            type="button" 
            onClick={onCancel} 
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium" 
            disabled={submit}
          >
            Batalkan
          </button>
          <button 
            type="submit" 
            className="flex-1 px-6 py-3 bg-[#4891A1] text-white rounded-lg hover:bg-[#3d7a89] disabled:opacity-50 transition-colors shadow-md font-medium" 
            disabled={submit||load}
          >
            {submit ? (isEdit ? 'Memperbarui Kegiatan...' : 'Menyimpan Kegiatan...') : (isEdit ? 'Perbarui Kegiatan' : 'Simpan Kegiatan')}
          </button>
        </div>
      </form>
    </div>
  )
}