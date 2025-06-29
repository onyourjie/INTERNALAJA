import { NextRequest, NextResponse } from 'next/server'
import { db, RowDataPacket } from '@/lib/db'

interface KegiatanRow extends RowDataPacket {
  id: number
  nama: string
  deskripsi: string
  jenis_rangkaian: 'single' | 'multiple'
  tanggal_single: string
  status: string
  created_at: string
  divisi_list: string
}

interface DivisiRow extends RowDataPacket {
  kegiatan_id: number
  divisi: string
}

interface RangkaianRow extends RowDataPacket {
  id: number
  kegiatan_id: number
  judul: string
  tanggal: string
  urutan: number
}

// Helper function to normalize date to YYYY-MM-DD
const normalizeDateToISO = (dateStr: string | null): string | null => {
  if (!dateStr) return null
  
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      // Try to parse if it's already in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr
      }
      return null
    }
    
    // Convert to YYYY-MM-DD format
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch (error) {
    console.error('Error normalizing date:', error)
    return null
  }
}

// Helper function to format date to Indonesian
const formatDateIndonesian = (dateStr: string | null): string => {
  if (!dateStr) return 'Tanggal belum ditentukan'
  
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return dateStr
    
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  } catch (error) {
    console.error('Error formatting date:', error)
    return dateStr
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const onlyActive = searchParams.get('active') !== 'false'
    const todayOnly = searchParams.get('today') === 'true'
    
    const offset = (page - 1) * limit
    const whereClauses: string[] = []
    const params: any[] = []
    
    if (onlyActive) {
      whereClauses.push('k.is_active = 1')
    }
    
    if (search) {
      whereClauses.push('(k.nama LIKE ? OR k.deskripsi LIKE ?)')
      params.push(`%${search}%`, `%${search}%`)
    }
    
    const todayDate = new Date().toISOString().split('T')[0]
    if (todayOnly) {
      whereClauses.push(`(
        (k.jenis_rangkaian = 'single' AND DATE(k.tanggal_single) = ?)
        OR (k.jenis_rangkaian = 'multiple' AND EXISTS (
          SELECT 1 FROM kegiatan_rangkaian kr
          WHERE kr.kegiatan_id = k.id AND kr.is_active = 1 AND DATE(kr.tanggal) = ?
        ))
      )`)
      params.push(todayDate, todayDate)
    }
    
    const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''
    
    // Count total entries
    const [countResult] = await db.execute<RowDataPacket[]>(`
      SELECT COUNT(DISTINCT k.id) as total
      FROM kegiatan k
      LEFT JOIN kegiatan_divisi kd ON kd.kegiatan_id = k.id AND kd.is_active = 1
      ${where}`, params)
    
    const totalEntries = countResult[0]?.total || 0
    const totalPages = Math.ceil(totalEntries / limit)
    
    // Get paginated data
    const [rows] = await db.execute<KegiatanRow[]>(`
      SELECT k.id, k.nama, k.deskripsi, k.jenis_rangkaian, k.tanggal_single,
             k.status, k.created_at,
             GROUP_CONCAT(DISTINCT kd.divisi) AS divisi_list
      FROM kegiatan k
      LEFT JOIN kegiatan_divisi kd ON kd.kegiatan_id = k.id AND kd.is_active = 1
      ${where}
      GROUP BY k.id
      ORDER BY k.created_at DESC
      LIMIT ? OFFSET ?`, [...params, limit, offset])
    
    // If no data found, return empty result with proper pagination
    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_entries: totalEntries,
          per_page: limit
        }
      })
    }
    
    // Get all available divisi for comparison
    const [allDivisiRows] = await db.execute<RowDataPacket[]>(`
      SELECT DISTINCT divisi FROM panitia_peserta 
      WHERE divisi IS NOT NULL AND divisi != '' AND is_active = 1
      ORDER BY divisi
    `)
    const allAvailableDivisi = allDivisiRows.map(row => row.divisi.trim())
    
    // Get kegiatan IDs for sub-queries
    const kegiatanIds = rows.map(r => r.id)
    const placeholders = kegiatanIds.map(() => '?').join(',')
    
    // Get rangkaian data
    const [subRows] = await db.execute<RangkaianRow[]>(`
      SELECT id, kegiatan_id, judul, tanggal, urutan
      FROM kegiatan_rangkaian
      WHERE kegiatan_id IN (${placeholders}) AND is_active = 1
      ORDER BY kegiatan_id, urutan`, kegiatanIds)
    
    // Map rangkaian to kegiatan
    const rangkaianMap = new Map<number, any[]>()
    subRows.forEach(r => {
      if (!rangkaianMap.has(r.kegiatan_id)) {
        rangkaianMap.set(r.kegiatan_id, [])
      }
      
      // Normalize tanggal to ISO format and format for display
      const tanggalISO = normalizeDateToISO(r.tanggal)
      const tanggalFormatted = formatDateIndonesian(r.tanggal)
      
      rangkaianMap.get(r.kegiatan_id)!.push({
        id: r.id,
        nama: r.judul,
        tanggal: tanggalFormatted, // Formatted untuk display
        tanggalRaw: tanggalISO, // Raw ISO format untuk logic
        tanggalFormatted: tanggalFormatted, // Explicit format Indonesia
        urutan: r.urutan,
        panitia: 'Multiple Event Day'
      })
    })
    
    // Format data for frontend
    const data = rows.map(r => {
      const divisiList = r.divisi_list ? r.divisi_list.split(',').map(d => d.trim()) : []
      const rangkaianData = rangkaianMap.get(r.id) || []
      
      // Normalize dan format tanggal kegiatan utama
      const tanggalSingleISO = normalizeDateToISO(r.tanggal_single)
      let tanggalFormatted = 'Tanggal belum ditentukan'
      
      if (r.jenis_rangkaian === 'single' && tanggalSingleISO) {
        tanggalFormatted = formatDateIndonesian(tanggalSingleISO)
      } else if (r.jenis_rangkaian === 'multiple') {
        if (rangkaianData.length > 0) {
          const validRangkaian = rangkaianData.filter(rd => rd.tanggalRaw)
          if (validRangkaian.length > 0) {
            const firstDate = validRangkaian[0].tanggalRaw
            const lastDate = validRangkaian[validRangkaian.length - 1].tanggalRaw
            
            if (firstDate === lastDate) {
              tanggalFormatted = formatDateIndonesian(firstDate)
            } else {
              try {
                const startDate = new Date(firstDate)
                const endDate = new Date(lastDate)
                tanggalFormatted = `${startDate.toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'short'
                })} - ${endDate.toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}`
              } catch (error) {
                tanggalFormatted = `${firstDate} - ${lastDate}`
              }
            }
          }
        }
      }
      
      // NEW: Enhanced logic untuk menentukan panitia display
      let panitiaDisplay = 'Tidak ada divisi'
      
      if (divisiList.length === 0) {
        panitiaDisplay = 'Tidak ada divisi'
      } else if (divisiList.length === 1) {
        panitiaDisplay = divisiList[0]
      } else {
        // Check if kegiatan contains ALL available divisi
        const sortedKegiatanDivisi = [...divisiList].sort()
        const sortedAllDivisi = [...allAvailableDivisi].sort()
        
        // Compare arrays to see if they're the same
        const isAllDivisi = sortedKegiatanDivisi.length === sortedAllDivisi.length &&
                           sortedKegiatanDivisi.every((div, index) => div === sortedAllDivisi[index])
        
        if (isAllDivisi) {
          panitiaDisplay = 'Semua Divisi'
        } else {
          panitiaDisplay = 'Divisi Terpilih'  // ← FIXED: Use "Divisi Terpilih" for partial selection
        }
      }
      
      // Format subKegiatan untuk multiple rangkaian
      const subKegiatan = rangkaianData.map(sub => ({
        id: sub.id,
        nama: sub.nama,
        tanggal: sub.tanggalFormatted, // Display format
        tanggalRaw: sub.tanggalRaw, // ISO format untuk logic
        tanggalFormatted: sub.tanggalFormatted, // Explicit format Indonesia
        panitia: `Day ${sub.urutan}`,
        urutan: sub.urutan
      }))
      
      return {
        id: r.id,
        nama: r.nama,
        tanggal: tanggalFormatted,
        panitia: panitiaDisplay, // ← Now properly shows "Divisi Terpilih" vs "Semua Divisi"
        deskripsi: r.deskripsi,
        divisi: divisiList,
        jenisRangkaian: r.jenis_rangkaian,
        tanggalRaw: tanggalSingleISO, // ISO format atau null untuk single
        subKegiatan: subKegiatan,
        status: r.status
      }
    })
    
    return NextResponse.json({
      success: true,
      data,
      pagination: {
        current_page: page,
        total_pages: totalPages,
        total_entries: totalEntries,
        per_page: limit
      }
    })
    
  } catch (error: any) {
    console.error('Error fetching kegiatan:', error)
    return NextResponse.json({
      success: false,
      message: 'Error fetch kegiatan',
      error: error.message,
      data: [],
      pagination: {
        current_page: 1,
        total_pages: 0,
        total_entries: 0,
        per_page: 20
      }
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required' },
        { status: 400 }
      )
    }

    const connection = await db.getConnection()
    
    try {
      await connection.beginTransaction()

      // Soft delete kegiatan
      await connection.execute(
        'UPDATE kegiatan SET is_active = 0, updated_at = NOW(), updated_by = ? WHERE id = ?',
        ['system', id]
      )

      // Soft delete kegiatan_divisi
      await connection.execute(
        'UPDATE kegiatan_divisi SET is_active = 0, updated_at = NOW(), updated_by = ? WHERE kegiatan_id = ?',
        ['system', id]
      )

      // Soft delete kegiatan_rangkaian
      await connection.execute(
        'UPDATE kegiatan_rangkaian SET is_active = 0, updated_at = NOW(), updated_by = ? WHERE kegiatan_id = ?',
        ['system', id]
      )

      await connection.commit()

      return NextResponse.json({
        success: true,
        message: 'Kegiatan berhasil dihapus'
      })

    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }

  } catch (error: any) {
    console.error('Error deleting kegiatan:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete kegiatan' },
      { status: 500 }
    )
  }
}