import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket } from '@/lib/db'

interface KegiatanDetailRow extends RowDataPacket {
  id: number
  nama: string
  deskripsi: string
  jenis_rangkaian: 'single' | 'multiple'
  tanggal_single: string | null
  status: string
  created_at: string
  updated_at: string
}

interface DivisiRow extends RowDataPacket {
  divisi: string
}

interface RangkaianRow extends RowDataPacket {
  id: number
  judul: string
  tanggal: string
  urutan: number
}

// Helper function untuk normalisasi tanggal
const normalizeDateToISO = (dateStr: string | null): string | null => {
  if (!dateStr) return null
  
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr
      }
      return null
    }
    
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch (error) {
    console.error('Error normalizing date:', error)
    return null
  }
}

// GET - Ambil detail kegiatan untuk edit
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const kegiatanId = parseInt(params.id)
    
    if (isNaN(kegiatanId)) {
      return NextResponse.json({
        success: false,
        error: 'ID kegiatan tidak valid'
      }, { status: 400 })
    }

    // Get kegiatan detail
    const [kegiatanRows] = await db.execute<KegiatanDetailRow[]>(
      `SELECT id, nama, deskripsi, jenis_rangkaian, tanggal_single, status, created_at, updated_at
       FROM kegiatan 
       WHERE id = ? AND is_active = 1`,
      [kegiatanId]
    )

    if (kegiatanRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Kegiatan tidak ditemukan'
      }, { status: 404 })
    }

    const kegiatan = kegiatanRows[0]

    // Get divisi
    const [divisiRows] = await db.execute<DivisiRow[]>(
      `SELECT divisi FROM kegiatan_divisi 
       WHERE kegiatan_id = ? AND is_active = 1`,
      [kegiatanId]
    )

    // Get rangkaian (jika multiple)
    const [rangkaianRows] = await db.execute<RangkaianRow[]>(
      `SELECT id, judul, tanggal, urutan 
       FROM kegiatan_rangkaian 
       WHERE kegiatan_id = ? AND is_active = 1 
       ORDER BY urutan`,
      [kegiatanId]
    )

    // Format response
    const response = {
      id: kegiatan.id,
      nama: kegiatan.nama,
      deskripsi: kegiatan.deskripsi,
      jenisRangkaian: kegiatan.jenis_rangkaian,
      tanggal: kegiatan.jenis_rangkaian === 'single' 
        ? normalizeDateToISO(kegiatan.tanggal_single) 
        : null,
      divisi: divisiRows.map(d => d.divisi),
      rangkaian: rangkaianRows.map(r => ({
        id: r.id,
        judul: r.judul,
        tanggal: normalizeDateToISO(r.tanggal),
        urutan: r.urutan
      }))
    }

    return NextResponse.json({
      success: true,
      data: response
    })

  } catch (error: any) {
    console.error('Error fetching kegiatan detail:', error)
    return NextResponse.json({
      success: false,
      error: 'Gagal mengambil detail kegiatan'
    }, { status: 500 })
  }
}

// PUT - Update kegiatan
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const kegiatanId = parseInt(params.id)
    
    if (isNaN(kegiatanId)) {
      return NextResponse.json({
        success: false,
        error: 'ID kegiatan tidak valid'
      }, { status: 400 })
    }

    const body = await request.json()
    const { nama, deskripsi, divisi, jenisRangkaian, tanggal, rangkaian } = body

    // Validasi input
    if (!nama?.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Nama kegiatan harus diisi'
      }, { status: 400 })
    }

    if (!Array.isArray(divisi) || divisi.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Minimal pilih satu divisi'
      }, { status: 400 })
    }

    if (jenisRangkaian === 'single' && !tanggal) {
      return NextResponse.json({
        success: false,
        error: 'Tanggal harus diisi untuk kegiatan single rangkaian'
      }, { status: 400 })
    }

    if (jenisRangkaian === 'multiple') {
      if (!Array.isArray(rangkaian) || rangkaian.length < 2) {
        return NextResponse.json({
          success: false,
          error: 'Minimal harus ada 2 rangkaian untuk kegiatan multiple'
        }, { status: 400 })
      }

      // Validasi duplikat judul dan tanggal
      const judulList = rangkaian.map(r => r.judul?.trim().toLowerCase())
      const tanggalList = rangkaian.map(r => r.tanggal)
      
      if (new Set(judulList).size !== judulList.length) {
        return NextResponse.json({
          success: false,
          error: 'Judul rangkaian tidak boleh sama'
        }, { status: 400 })
      }

      if (new Set(tanggalList).size !== tanggalList.length) {
        return NextResponse.json({
          success: false,
          error: 'Tanggal setiap rangkaian tidak boleh sama'
        }, { status: 400 })
      }
    }

    // Cek apakah kegiatan exists
    const [existingRows] = await db.execute<RowDataPacket[]>(
      'SELECT id FROM kegiatan WHERE id = ? AND is_active = 1',
      [kegiatanId]
    )

    if (existingRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Kegiatan tidak ditemukan'
      }, { status: 404 })
    }

    const connection = await db.getConnection()

    try {
      await connection.beginTransaction()

      // 1. Update kegiatan utama
      await connection.execute(
        `UPDATE kegiatan 
         SET nama = ?, deskripsi = ?, jenis_rangkaian = ?, tanggal_single = ?, 
             updated_at = NOW(), updated_by = ? 
         WHERE id = ?`,
        [
          nama.trim(),
          deskripsi?.trim() || null,
          jenisRangkaian,
          jenisRangkaian === 'single' ? tanggal : null,
          'system',
          kegiatanId
        ]
      )

      // 2. Update divisi - hapus yang lama, insert yang baru
      await connection.execute(
        'UPDATE kegiatan_divisi SET is_active = 0, updated_at = NOW(), updated_by = ? WHERE kegiatan_id = ?',
        ['system', kegiatanId]
      )

      for (const divisiName of divisi) {
        if (divisiName?.trim()) {
          await connection.execute(
            `INSERT INTO kegiatan_divisi (kegiatan_id, divisi, is_wajib, created_by, updated_by) 
             VALUES (?, ?, 1, ?, ?)
             ON DUPLICATE KEY UPDATE 
               is_active = 1, 
               is_wajib = 1,
               updated_at = NOW(),
               updated_by = ?`,
            [kegiatanId, divisiName.trim(), 'system', 'system', 'system']
          )
        }
      }

      // 3. Update rangkaian (jika multiple)
      if (jenisRangkaian === 'multiple') {
        // Soft delete rangkaian lama
        await connection.execute(
          'UPDATE kegiatan_rangkaian SET is_active = 0, updated_at = NOW(), updated_by = ? WHERE kegiatan_id = ?',
          ['system', kegiatanId]
        )

        // Insert rangkaian baru
        for (let i = 0; i < rangkaian.length; i++) {
          const r = rangkaian[i]
          if (r.judul?.trim() && r.tanggal) {
            await connection.execute(
              `INSERT INTO kegiatan_rangkaian 
               (kegiatan_id, judul, tanggal, urutan, created_by, updated_by) 
               VALUES (?, ?, ?, ?, ?, ?)`,
              [kegiatanId, r.judul.trim(), r.tanggal, i + 1, 'system', 'system']
            )
          }
        }
      } else {
        // Jika berubah dari multiple ke single, hapus semua rangkaian
        await connection.execute(
          'UPDATE kegiatan_rangkaian SET is_active = 0, updated_at = NOW(), updated_by = ? WHERE kegiatan_id = ?',
          ['system', kegiatanId]
        )
      }

      await connection.commit()

      return NextResponse.json({
        success: true,
        message: 'Kegiatan berhasil diperbarui',
        data: { id: kegiatanId }
      })

    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }

  } catch (error: any) {
    console.error('Error updating kegiatan:', error)
    return NextResponse.json({
      success: false,
      error: 'Gagal memperbarui kegiatan'
    }, { status: 500 })
  }
}

// DELETE - Hapus kegiatan dan semua data terkait (HARD DELETE)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const kegiatanId = parseInt(params.id)
    
    if (isNaN(kegiatanId)) {
      return NextResponse.json({
        success: false,
        error: 'ID kegiatan tidak valid'
      }, { status: 400 })
    }

    // Cek apakah kegiatan exists
    const [existingRows] = await db.execute<RowDataPacket[]>(
      'SELECT id, nama FROM kegiatan WHERE id = ? AND is_active = 1',
      [kegiatanId]
    )

    if (existingRows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Kegiatan tidak ditemukan'
      }, { status: 404 })
    }

    const kegiatanNama = existingRows[0].nama

    const connection = await db.getConnection()

    try {
      await connection.beginTransaction()

      // HARD DELETE - Hapus dalam urutan yang benar untuk menghindari foreign key constraint

      // 1. Hapus absensi (referensi ke kegiatan_id)
      const [deletedAbsensi] = await connection.execute(
        'DELETE FROM absensi WHERE kegiatan_id = ?',
        [kegiatanId]
      )

      // 2. Hapus absensi_konsumsi (referensi ke kegiatan_id)
      const [deletedKonsumsi] = await connection.execute(
        'DELETE FROM absensi_konsumsi WHERE kegiatan_id = ?',
        [kegiatanId]
      )

      // 3. Hapus kegiatan_rangkaian (referensi ke kegiatan_id)
      const [deletedRangkaian] = await connection.execute(
        'DELETE FROM kegiatan_rangkaian WHERE kegiatan_id = ?',
        [kegiatanId]
      )

      // 4. Hapus kegiatan_divisi (referensi ke kegiatan_id)
      const [deletedDivisi] = await connection.execute(
        'DELETE FROM kegiatan_divisi WHERE kegiatan_id = ?',
        [kegiatanId]
      )

      // 5. Hapus kegiatan utama
      const [deletedKegiatan] = await connection.execute(
        'DELETE FROM kegiatan WHERE id = ?',
        [kegiatanId]
      )

      await connection.commit()

      // Get affected rows count for logging
      const absensiCount = (deletedAbsensi as any).affectedRows || 0
      const konsumsiCount = (deletedKonsumsi as any).affectedRows || 0
      const rangkaianCount = (deletedRangkaian as any).affectedRows || 0
      const divisiCount = (deletedDivisi as any).affectedRows || 0

      console.log(`✅ HARD DELETE - Kegiatan "${kegiatanNama}" (ID: ${kegiatanId})`)
      console.log(`- Deleted ${absensiCount} absensi records`)
      console.log(`- Deleted ${konsumsiCount} konsumsi records`)
      console.log(`- Deleted ${rangkaianCount} rangkaian records`)
      console.log(`- Deleted ${divisiCount} divisi records`)

      return NextResponse.json({
        success: true,
        message: `Kegiatan "${kegiatanNama}" berhasil dihapus permanen`,
        data: {
          deleted_counts: {
            absensi: absensiCount,
            konsumsi: konsumsiCount,
            rangkaian: rangkaianCount,
            divisi: divisiCount
          }
        }
      })

    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }

  } catch (error: any) {
    console.error('❌ Error hard deleting kegiatan:', error)
    
    // Handle foreign key constraint errors
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return NextResponse.json({
        success: false,
        error: 'Tidak dapat menghapus kegiatan karena masih ada data yang terkait. Silakan hubungi administrator.'
      }, { status: 409 })
    }

    return NextResponse.json({
      success: false,
      error: 'Gagal menghapus kegiatan secara permanen'
    }, { status: 500 })
  }
}