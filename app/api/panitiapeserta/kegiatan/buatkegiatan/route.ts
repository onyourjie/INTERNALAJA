/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket } from '@/lib/db'

interface DivisiRow extends RowDataPacket { divisi:string }
interface KegiatanRow extends RowDataPacket { 
  id: number; 
  nama: string; 
  deskripsi: string; 
  jenis_rangkaian: string; 
  tanggal_single: string;
  status: string;
}

export async function GET(){
  try {
    const [rows]=await db.execute<DivisiRow[]>(
      `SELECT DISTINCT divisi FROM panitia_peserta 
       WHERE divisi IS NOT NULL AND divisi!='' AND is_active=1 
       ORDER BY divisi`
    )
    return NextResponse.json({ 
      success:true, 
      data:rows.map(r=>r.divisi.trim()), 
      total:rows.length 
    })
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: 'Gagal mengambil data divisi' 
    }, { status: 500 })
  }
}

export async function POST(request:NextRequest){
  const conn=await db.getConnection()
  try{
    await conn.beginTransaction()
    const { nama,deskripsi,divisi,jenisRangkaian,tanggal,rangkaian }=await request.json()
    
    // Debugging log
    console.log('POST Data received:', { nama, divisi, jenisRangkaian, rangkaianCount: rangkaian?.length })
    
    // Validasi input
    if(!nama||!deskripsi||!divisi?.length) {
      return NextResponse.json({ success:false,error:'Data tidak lengkap'},{status:400})
    }
    if(jenisRangkaian==='single'&&!tanggal) {
      return NextResponse.json({ success:false,error:'Tanggal harus diisi untuk kegiatan 1 rangkaian'},{status:400})
    }
    if(jenisRangkaian==='multiple'&&(!rangkaian||rangkaian.length===0)) {
      return NextResponse.json({ success:false,error:'Minimal satu rangkaian harus diisi'},{status:400})
    }

    // Cek apakah nama kegiatan sudah ada
    const [existing] = await conn.execute<KegiatanRow[]>(
      `SELECT id FROM kegiatan WHERE nama = ? AND status != 'deleted'`, 
      [nama.trim()]
    )
    if(existing.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nama kegiatan sudah digunakan' 
      }, { status: 400 })
    }

    // Proses divisi
    let finalDivisi=(divisi as string[]).map(d=>d.trim()).filter(Boolean)
    if(finalDivisi.includes('Semua')){
      const [all]=await conn.execute<DivisiRow[]>(
        `SELECT DISTINCT divisi FROM panitia_peserta 
         WHERE divisi IS NOT NULL AND divisi!='' AND is_active=1`
      )
      finalDivisi=all.map(r=>r.divisi.trim())
    }
    // Pastikan tidak ada duplikasi divisi
    finalDivisi=[...new Set(finalDivisi.filter(Boolean))]
    
    console.log('Final divisi:', finalDivisi)
    
    if(finalDivisi.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Minimal satu divisi harus dipilih' 
      }, { status: 400 })
    }

    // Insert kegiatan
    const [res]=await conn.execute(
      `INSERT INTO kegiatan(nama,deskripsi,jenis_rangkaian,tanggal_single,status,created_at,created_by) 
       VALUES(?,?,?,?, 'draft',NOW(),'system')`,
      [nama.trim(),deskripsi.trim(),jenisRangkaian,jenisRangkaian==='single'?tanggal:null]
    )
    const kid=(res as any).insertId
    console.log('Kegiatan created with ID:', kid)

    // Insert divisi satu per satu dengan error handling
    for(const d of finalDivisi) {
      try {
        await conn.execute(
          `INSERT INTO kegiatan_divisi(kegiatan_id,divisi,created_at) VALUES(?,?,NOW())`,
          [kid, d]
        )
        console.log(`Divisi ${d} inserted for kegiatan ${kid}`)
      } catch (divisiError: any) {
        if (divisiError.code === 'ER_DUP_ENTRY') {
          // Skip jika sudah ada, tapi lanjutkan proses
          console.warn(`Divisi ${d} sudah ada untuk kegiatan ${kid}`)
          continue
        } else {
          throw divisiError // Re-throw jika bukan duplicate error
        }
      }
    }

    // Insert rangkaian untuk multiple
    if(jenisRangkaian==='multiple'){
      const validRangkaian = rangkaian.filter((r:any)=>r.judul&&r.tanggal)
      console.log('Valid rangkaian:', validRangkaian.length)
      
      // Validasi urutan tidak duplikat
      const urutanSet = new Set()
      for(let i = 0; i < validRangkaian.length; i++) {
        const urutan = i + 1
        if(urutanSet.has(urutan)) {
          throw new Error(`Urutan rangkaian ${urutan} duplikat`)
        }
        urutanSet.add(urutan)
        
        try {
          await conn.execute(
            `INSERT INTO kegiatan_rangkaian(kegiatan_id,judul,tanggal,urutan,status,created_at) 
             VALUES(?,?,?,?, 'draft',NOW())`,
            [kid, validRangkaian[i].judul.trim(), validRangkaian[i].tanggal, urutan]
          )
          console.log(`Rangkaian ${urutan} inserted for kegiatan ${kid}`)
        } catch (rangkaianError: any) {
          if (rangkaianError.code === 'ER_DUP_ENTRY') {
            console.warn(`Rangkaian urutan ${urutan} sudah ada untuk kegiatan ${kid}`)
            continue
          } else {
            throw rangkaianError
          }
        }
      }
    }

    await conn.commit()
    console.log('Transaction committed successfully')
    return NextResponse.json({ 
      success:true, 
      data:{ id:kid }, 
      message:'Kegiatan berhasil disimpan' 
    })
  }catch(e:any){
    await conn.rollback()
    console.error('Error creating kegiatan:', e)
    return NextResponse.json({ 
      success:false, 
      error: 'Gagal menyimpan kegiatan' 
    },{status:500})
  }finally{ 
    conn.release() 
  }
}

export async function PUT(request:NextRequest){
  const conn=await db.getConnection()
  try{
    await conn.beginTransaction()
    const { id, nama,deskripsi,divisi,jenisRangkaian,tanggal,rangkaian }=await request.json()
    
    // Debugging log
    console.log('PUT Data received:', { id, nama, divisi, jenisRangkaian, rangkaianCount: rangkaian?.length })
    
    // Validasi input
    if(!id || !nama||!deskripsi||!divisi?.length) {
      return NextResponse.json({ success:false,error:'Data tidak lengkap'},{status:400})
    }
    if(jenisRangkaian==='single'&&!tanggal) {
      return NextResponse.json({ success:false,error:'Tanggal harus diisi untuk kegiatan 1 rangkaian'},{status:400})
    }
    if(jenisRangkaian==='multiple'&&(!rangkaian||rangkaian.length===0)) {
      return NextResponse.json({ success:false,error:'Minimal satu rangkaian harus diisi'},{status:400})
    }

    // Cek apakah kegiatan ada
    const [existingKegiatan] = await conn.execute<KegiatanRow[]>(
      `SELECT id FROM kegiatan WHERE id = ? AND status != 'deleted'`, 
      [id]
    )
    if(existingKegiatan.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Kegiatan tidak ditemukan' 
      }, { status: 404 })
    }

    // Cek apakah nama kegiatan sudah digunakan oleh kegiatan lain
    const [duplicateNama] = await conn.execute<KegiatanRow[]>(
      `SELECT id FROM kegiatan WHERE nama = ? AND id != ? AND status != 'deleted'`, 
      [nama.trim(), id]
    )
    if(duplicateNama.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Nama kegiatan sudah digunakan' 
      }, { status: 400 })
    }

    // Proses divisi
    let finalDivisi=(divisi as string[]).map(d=>d.trim()).filter(Boolean)
    if(finalDivisi.includes('Semua')){
      const [all]=await conn.execute<DivisiRow[]>(
        `SELECT DISTINCT divisi FROM panitia_peserta 
         WHERE divisi IS NOT NULL AND divisi!='' AND is_active=1`
      )
      finalDivisi=all.map(r=>r.divisi.trim())
    }
    // Pastikan tidak ada duplikasi divisi
    finalDivisi=[...new Set(finalDivisi.filter(Boolean))]
    
    console.log('Final divisi for update:', finalDivisi)
    
    if(finalDivisi.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'Minimal satu divisi harus dipilih' 
      }, { status: 400 })
    }

    // Update kegiatan
    await conn.execute(
      `UPDATE kegiatan SET 
       nama=?, deskripsi=?, jenis_rangkaian=?, tanggal_single=?, updated_at=NOW() 
       WHERE id=?`,
      [nama.trim(), deskripsi.trim(), jenisRangkaian, jenisRangkaian==='single'?tanggal:null, id]
    )
    console.log('Kegiatan updated with ID:', id)

    // Delete dan insert ulang divisi
    await conn.execute(`DELETE FROM kegiatan_divisi WHERE kegiatan_id=?`, [id])
    console.log('Old divisi deleted for kegiatan:', id)
    
    // Insert divisi satu per satu dengan error handling
    for(const d of finalDivisi) {
      try {
        await conn.execute(
          `INSERT INTO kegiatan_divisi(kegiatan_id,divisi,created_at) VALUES(?,?,NOW())`,
          [id, d]
        )
        console.log(`Divisi ${d} inserted for kegiatan ${id}`)
      } catch (divisiError: any) {
        if (divisiError.code === 'ER_DUP_ENTRY') {
          // Skip jika sudah ada, tapi lanjutkan proses
          console.warn(`Divisi ${d} sudah ada untuk kegiatan ${id}`)
          continue
        } else {
          throw divisiError // Re-throw jika bukan duplicate error
        }
      }
    }

    // Delete dan insert ulang rangkaian
    await conn.execute(`DELETE FROM kegiatan_rangkaian WHERE kegiatan_id=?`, [id])
    console.log('Old rangkaian deleted for kegiatan:', id)
    
    if(jenisRangkaian==='multiple'){
      const validRangkaian = rangkaian.filter((r:any)=>r.judul&&r.tanggal)
      console.log('Valid rangkaian for update:', validRangkaian.length)
      
      // Insert rangkaian satu per satu dengan error handling
      for(let i = 0; i < validRangkaian.length; i++) {
        const urutan = i + 1
        try {
          await conn.execute(
            `INSERT INTO kegiatan_rangkaian(kegiatan_id,judul,tanggal,urutan,status,created_at) 
             VALUES(?,?,?,?, 'draft',NOW())`,
            [id, validRangkaian[i].judul.trim(), validRangkaian[i].tanggal, urutan]
          )
          console.log(`Rangkaian ${urutan} inserted for kegiatan ${id}`)
        } catch (rangkaianError: any) {
          if (rangkaianError.code === 'ER_DUP_ENTRY') {
            console.warn(`Rangkaian urutan ${urutan} sudah ada untuk kegiatan ${id}`)
            continue
          } else {
            throw rangkaianError
          }
        }
      }
    }

    await conn.commit()
    console.log('Update transaction committed successfully')
    return NextResponse.json({ 
      success:true, 
      data:{ id }, 
      message:'Kegiatan berhasil diperbarui' 
    })
  }catch(e:any){
    await conn.rollback()
    console.error('Error updating kegiatan:', e)
    return NextResponse.json({ 
      success:false, 
      error: 'Gagal memperbarui kegiatan' 
    },{status:500})
  }finally{ 
    conn.release() 
  }
}