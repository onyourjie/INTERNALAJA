// app/api/absensi/route.ts - FIXED VERSION
import { NextRequest, NextResponse } from 'next/server';
import { db, RowDataPacket } from '@/lib/db';

interface AbsensiRow extends RowDataPacket {
  absensi_id: number;
  panitia_id: number;
  kegiatan_id: number;
  kegiatan_rangkaian_id: number | null;
  tanggal_absensi: string;
  status: 'Hadir' | 'Tidak Hadir';
  waktu_absensi: string | null;
  metode_absensi: 'QR Code' | 'Manual';
  unique_id: string;
  nim: string;
  nama_lengkap: string;
  divisi: string;
  kegiatan_nama: string;
  jenis_rangkaian: 'single' | 'multiple';
  rangkaian_nama: string | null;
  rangkaian_tanggal: string | null;
  tanggal_single: string | null;
}

interface QRData {
  id: string;
  nama: string;
  nim: string;
  divisi: string;
  timestamp: string;
}

// GET - Ambil data absensi dengan AUTO-POPULATE (FIXED VERSION)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const kegiatan_id = searchParams.get('kegiatan_id');
    const kegiatan_rangkaian_id = searchParams.get('kegiatan_rangkaian_id');
    const tanggal = searchParams.get('tanggal');
    const status = searchParams.get('status');
    const divisi = searchParams.get('divisi');
    const forceRefresh = searchParams.get('_refresh') === 'true';
    
    console.log('🔍 API Absensi GET called with params:', {
      kegiatan_id,
      kegiatan_rangkaian_id,
      tanggal,
      search,
      status,
      divisi,
      forceRefresh,
      page,
      limit
    });

    const offset = (page - 1) * limit;

    // Jika tidak ada kegiatan_id, return kosong
    if (!kegiatan_id) {
      console.log('❌ No kegiatan_id provided');
      return NextResponse.json({
        success: true,
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 }
      });
    }

    // Fungsi untuk convert date/datetime ke format DATE MySQL (YYYY-MM-DD)
    const formatDateForDB = (dateInput: string): string => {
      try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) {
          throw new Error('Invalid date');
        }
        const formatted = date.toISOString().split('T')[0];
        console.log(`📅 Date formatted: ${dateInput} -> ${formatted}`);
        return formatted;
      } catch (error) {
        console.error('❌ Date format error:', error);
        throw new Error(`Invalid date format: ${dateInput}`);
      }
    };

    let formattedDate = '';
    if (tanggal) {
      formattedDate = formatDateForDB(tanggal);
    }

    // FIXED: Consistent handling of kegiatan_rangkaian_id like in scan API
    const normalizedRangkaianId = (kegiatan_rangkaian_id && kegiatan_rangkaian_id !== 'null') 
      ? parseInt(kegiatan_rangkaian_id) 
      : null;

    console.log('🎯 Normalized params:', {
      kegiatan_id: parseInt(kegiatan_id),
      normalizedRangkaianId,
      formattedDate
    });

    // ENHANCED: Query dengan logic yang sama seperti scan API
    let panitiaQuery = `
      SELECT DISTINCT
        p.id as panitia_id,
        p.unique_id,
        p.nim,
        p.nama_lengkap,
        p.divisi,
        k.nama as kegiatan_nama,
        k.jenis_rangkaian,
        kr.judul as rangkaian_nama,
        a.id as absensi_id,
        a.status,
        a.waktu_absensi,
        a.metode_absensi,
        a.tanggal_absensi,
        a.koordinat_lat,
        a.koordinat_lng,
        a.catatan,
        a.qr_data
      FROM panitia_peserta p
      CROSS JOIN kegiatan k
      LEFT JOIN kegiatan_rangkaian kr ON kr.kegiatan_id = k.id AND kr.is_active = 1
      LEFT JOIN kegiatan_divisi kd ON kd.kegiatan_id = k.id AND kd.is_active = 1
      LEFT JOIN absensi a ON (
        a.panitia_id = p.id 
        AND a.kegiatan_id = k.id 
        AND ( 
          (a.kegiatan_rangkaian_id IS NULL AND ? IS NULL) 
          OR a.kegiatan_rangkaian_id = ? 
        )
        ${formattedDate ? 'AND a.tanggal_absensi = ?' : ''}
      )
      WHERE k.id = ? 
        AND k.is_active = 1
        AND p.is_active = 1
        AND (kd.divisi = 'Semua' OR kd.divisi = p.divisi)
    `;

    let queryParams: any[] = [];
    
    // FIXED: Add rangkaian params first (for JOIN condition)
    queryParams.push(normalizedRangkaianId, normalizedRangkaianId);
    
    if (formattedDate) {
      queryParams.push(formattedDate);
    }
    
    queryParams.push(kegiatan_id);

    // ENHANCED: Filter berdasarkan rangkaian dengan logic yang tepat
    if (normalizedRangkaianId !== null) {
      panitiaQuery += ' AND (kr.id = ? OR kr.id IS NULL)';
      queryParams.push(normalizedRangkaianId);
    } else {
      panitiaQuery += ' AND kr.id IS NULL';
    }

    // Filter search
    if (search) {
      panitiaQuery += ' AND (p.nama_lengkap LIKE ? OR p.nim LIKE ? OR p.divisi LIKE ?)';
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    // Filter status
    if (status) {
      if (status === 'Hadir') {
        panitiaQuery += ' AND a.status = "Hadir"';
      } else if (status === 'Tidak Hadir') {
        panitiaQuery += ' AND (a.status IS NULL OR a.status = "Tidak Hadir")';
      }
    }

    // Filter divisi
    if (divisi) {
      panitiaQuery += ' AND p.divisi = ?';
      queryParams.push(divisi);
    }

    panitiaQuery += ' ORDER BY p.nama_lengkap ASC';

    console.log('🔍 Executing query with params:', queryParams);
    console.log('📝 Query:', panitiaQuery);

    const [rows] = await db.execute<RowDataPacket[]>(panitiaQuery, queryParams);

    console.log(`✅ Query executed, found ${rows.length} rows`);

    // ENHANCED: Format data dengan debug info
    const formattedData = rows.map((row, index) => {
      const result = {
        id: row.absensi_id || 0,
        panitia_id: row.panitia_id,
        kegiatan_id: parseInt(kegiatan_id),
        kegiatan_rangkaian_id: normalizedRangkaianId,
        nim: row.nim,
        nama_lengkap: row.nama_lengkap,
        divisi: row.divisi,
        kehadiran: row.status || 'Tidak Hadir',
        status: row.status || 'Tidak Hadir',
        tanggal_absensi: row.tanggal_absensi || formattedDate,
        waktu_hadir: row.waktu_absensi ? 
          new Date(row.waktu_absensi).toLocaleTimeString('id-ID', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }) : '-',
        waktu_absensi: row.waktu_absensi,
        metode_absensi: row.metode_absensi || 'Manual',
        kegiatan_nama: row.kegiatan_nama,
        rangkaian_nama: row.rangkaian_nama,
        koordinat_lat: row.koordinat_lat,
        koordinat_lng: row.koordinat_lng,
        catatan: row.catatan,
        qr_data: row.qr_data,
        // Debug info
        _debug: {
          raw_status: row.status,
          raw_absensi_id: row.absensi_id,
          raw_waktu: row.waktu_absensi,
          query_index: index
        }
      };

      // Log untuk debug
      if (row.status === 'Hadir') {
        console.log(`✅ Found HADIR record: ${row.nama_lengkap} (${row.nim}) - Absensi ID: ${row.absensi_id}`);
      }

      return result;
    });

    // Apply pagination
    const totalEntries = formattedData.length;
    const startIndex = offset;
    const endIndex = startIndex + limit;
    const paginatedData = formattedData.slice(startIndex, endIndex);

    // ENHANCED: Log summary
    const hadirCount = formattedData.filter(p => p.kehadiran === 'Hadir').length;
    const tidakHadirCount = totalEntries - hadirCount;
    
    console.log('📊 Data summary:', {
      total: totalEntries,
      hadir: hadirCount,
      tidakHadir: tidakHadirCount,
      paginatedCount: paginatedData.length,
      page,
      totalPages: Math.ceil(totalEntries / limit)
    });
    
    return NextResponse.json({
      success: true,
      data: paginatedData,
      pagination: {
        page,
        limit,
        total: totalEntries,
        totalPages: Math.ceil(totalEntries / limit)
      },
      debug: {
        query_params: queryParams,
        kegiatan_id: parseInt(kegiatan_id),
        rangkaian_id: normalizedRangkaianId,
        formatted_date: formattedDate,
        total_found: totalEntries,
        hadir_count: hadirCount,
        force_refresh: forceRefresh
      }
    });

  } catch (error: any) {
    console.error('❌ GET Absensi Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error fetching absensi data', 
        error: error?.message || 'Unknown error',
        debug: {
          stack: error?.stack,
          params: {
            kegiatan_id: request.nextUrl.searchParams.get('kegiatan_id'),
            kegiatan_rangkaian_id: request.nextUrl.searchParams.get('kegiatan_rangkaian_id'),
            tanggal: request.nextUrl.searchParams.get('tanggal')
          }
        }
      },
      { status: 500 }
    );
  }
}

// POST - Submit absensi via QR Code atau manual (ENHANCED)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      qr_data, 
      kegiatan_id, 
      kegiatan_rangkaian_id = null,
      tanggal_absensi,
      koordinat_lat = null,
      koordinat_lng = null,
      catatan = null,
      panitia_id = null,
      metode_absensi = 'QR Code'
    } = body;

    console.log('📝 POST Absensi called with:', {
      kegiatan_id,
      kegiatan_rangkaian_id,
      tanggal_absensi,
      metode_absensi,
      has_qr_data: !!qr_data,
      panitia_id
    });

    const formatDateForDB = (dateInput: string): string => {
      try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) {
          throw new Error('Invalid date');
        }
        return date.toISOString().split('T')[0];
      } catch (error) {
        throw new Error(`Invalid date format: ${dateInput}`);
      }
    };

    if (!kegiatan_id || !tanggal_absensi) {
      return NextResponse.json(
        { success: false, message: 'kegiatan_id dan tanggal_absensi harus diisi' },
        { status: 400 }
      );
    }

    const formattedDate = formatDateForDB(tanggal_absensi);
    let panitia_data = null;

    if (metode_absensi === 'QR Code') {
      if (!qr_data) {
        return NextResponse.json(
          { success: false, message: 'QR data diperlukan untuk absensi QR Code' },
          { status: 400 }
        );
      }

      try {
        const qrParsed: QRData = JSON.parse(qr_data);
        
        if (!qrParsed.id || !qrParsed.nama || !qrParsed.nim) {
          return NextResponse.json(
            { success: false, message: 'Format QR Code tidak valid' },
            { status: 400 }
          );
        }

        const [panitiaRows] = await db.execute<RowDataPacket[]>(
          'SELECT id, unique_id, nama_lengkap, nim, divisi FROM panitia_peserta WHERE unique_id = ? AND is_active = 1',
          [qrParsed.id]
        );

        if (panitiaRows.length === 0) {
          return NextResponse.json(
            { success: false, message: 'QR Code tidak valid atau panitia tidak ditemukan' },
            { status: 404 }
          );
        }

        panitia_data = panitiaRows[0];
      } catch (parseError) {
        return NextResponse.json(
          { success: false, message: 'QR Code format tidak valid' },
          { status: 400 }
        );
      }
    } else {
      if (!panitia_id) {
        return NextResponse.json(
          { success: false, message: 'panitia_id diperlukan untuk absensi manual' },
          { status: 400 }
        );
      }

      const [panitiaRows] = await db.execute<RowDataPacket[]>(
        'SELECT id, unique_id, nama_lengkap, nim, divisi FROM panitia_peserta WHERE id = ? AND is_active = 1',
        [panitia_id]
      );

      if (panitiaRows.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Panitia tidak ditemukan' },
          { status: 404 }
        );
      }

      panitia_data = panitiaRows[0];
    }

    // Validasi kegiatan dan divisi
    const [kegiatanRows] = await db.execute<RowDataPacket[]>(
      `SELECT k.id, k.nama, k.jenis_rangkaian, k.tanggal_single,
              GROUP_CONCAT(kd.divisi) as divisi_list
       FROM kegiatan k
       LEFT JOIN kegiatan_divisi kd ON k.id = kd.kegiatan_id AND kd.is_active = 1
       WHERE k.id = ? AND k.is_active = 1
       GROUP BY k.id`,
      [kegiatan_id]
    );

    if (kegiatanRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Kegiatan tidak ditemukan' },
        { status: 404 }
      );
    }

    const kegiatan = kegiatanRows[0];
    const divisiList = kegiatan.divisi_list ? kegiatan.divisi_list.split(',') : [];
    
    if (divisiList.length > 0 && !divisiList.includes('Semua') && !divisiList.includes(panitia_data.divisi)) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Divisi ${panitia_data.divisi} tidak berhak mengikuti kegiatan ini`,
          data: {
            panitia: panitia_data,
            kegiatan: kegiatan,
            divisi_yang_diizinkan: divisiList.map(d => ({ nama: d }))
          }
        },
        { status: 403 }
      );
    }

    // Validasi kegiatan rangkaian untuk multiple event
    if (kegiatan.jenis_rangkaian === 'multiple' && kegiatan_rangkaian_id) {
      const [rangkaianRows] = await db.execute<RowDataPacket[]>(
        'SELECT id, judul, tanggal FROM kegiatan_rangkaian WHERE id = ? AND kegiatan_id = ? AND is_active = 1',
        [kegiatan_rangkaian_id, kegiatan_id]
      );

      if (rangkaianRows.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Rangkaian kegiatan tidak ditemukan' },
          { status: 404 }
        );
      }
    }

    // FIXED: Consistent check dengan scan API
    const [existingAbsensi] = await db.execute<RowDataPacket[]>(
      `SELECT id, status FROM absensi 
       WHERE panitia_id = ? AND kegiatan_id = ? 
       AND ( (kegiatan_rangkaian_id IS NULL AND ? IS NULL) OR kegiatan_rangkaian_id = ? )
       AND tanggal_absensi = ?`,
      [panitia_data.id, kegiatan_id, kegiatan_rangkaian_id, kegiatan_rangkaian_id, formattedDate]
    );

    const now = new Date();

    if (existingAbsensi.length > 0) {
      // Cek jika sudah hadir
      if (existingAbsensi[0].status === 'Hadir') {
        return NextResponse.json({
          success: false,
          message: 'BLOCKED - Already attended',
          data: {
            panitia: panitia_data,
            status_detail: {
              sudah_hadir: true,
              waktu_absen: 'Sudah tercatat sebelumnya'
            },
            pesan_tambahan: 'Panitia sudah melakukan absensi sebelumnya'
          }
        }, { status: 409 });
      }

      // Update absensi yang sudah ada
      const [result] = await db.execute(
        `UPDATE absensi SET 
         status = 'Hadir', 
         waktu_absensi = ?, 
         metode_absensi = ?,
         koordinat_lat = ?,
         koordinat_lng = ?,
         catatan = ?,
         qr_data = ?,
         updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [now, metode_absensi, koordinat_lat, koordinat_lng, catatan, qr_data, existingAbsensi[0].id]
      );

      console.log(`✅ Updated existing absensi ID ${existingAbsensi[0].id} for ${panitia_data.nama_lengkap}`);

      return NextResponse.json({
        success: true,
        message: 'Absensi berhasil diupdate menjadi Hadir',
        data: {
          id: existingAbsensi[0].id,
          panitia: panitia_data,
          kegiatan: kegiatan,
          status: 'Hadir',
          waktu_absensi: now,
          metode_absensi,
          tanggal_absensi: formattedDate,
          previous_status: existingAbsensi[0].status
        }
      });
    } else {
      // Insert absensi baru
      const [result] = await db.execute(
        `INSERT INTO absensi 
         (panitia_id, kegiatan_id, kegiatan_rangkaian_id, tanggal_absensi, status, waktu_absensi, metode_absensi, koordinat_lat, koordinat_lng, catatan, qr_data)
         VALUES (?, ?, ?, ?, 'Hadir', ?, ?, ?, ?, ?, ?)`,
        [panitia_data.id, kegiatan_id, kegiatan_rangkaian_id, formattedDate, now, metode_absensi, koordinat_lat, koordinat_lng, catatan, qr_data]
      );

      const insertId = (result as any).insertId;
      console.log(`✅ Inserted new absensi ID ${insertId} for ${panitia_data.nama_lengkap}`);

      return NextResponse.json({
        success: true,
        message: 'Absensi berhasil dicatat sebagai Hadir',
        data: {
          id: insertId,
          panitia: panitia_data,
          kegiatan: kegiatan,
          status: 'Hadir',
          waktu_absensi: now,
          metode_absensi,
          tanggal_absensi: formattedDate
        }
      });
    }

  } catch (error: any) {
    console.error('❌ POST Absensi Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error recording absensi', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT - Update status absensi (ENHANCED)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      id, 
      status, 
      waktu_absensi = null,
      catatan = null,
      metode_absensi = 'Manual'
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID absensi diperlukan' },
        { status: 400 }
      );
    }

    if (!status || !['Hadir', 'Tidak Hadir'].includes(status)) {
      return NextResponse.json(
        { success: false, message: 'Status harus Hadir atau Tidak Hadir' },
        { status: 400 }
      );
    }

    const [existingAbsensi] = await db.execute<RowDataPacket[]>(
      'SELECT id, status FROM absensi WHERE id = ?',
      [id]
    );

    if (existingAbsensi.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Data absensi tidak ditemukan' },
        { status: 404 }
      );
    }

    const updateWaktu = status === 'Hadir' && !waktu_absensi ? new Date() : waktu_absensi;
    
    await db.execute(
      `UPDATE absensi SET 
       status = ?, 
       waktu_absensi = ?, 
       metode_absensi = ?,
       catatan = ?,
       updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, updateWaktu, metode_absensi, catatan, id]
    );

    console.log(`✅ Updated absensi ID ${id} status to ${status}`);

    return NextResponse.json({
      success: true,
      message: `Status absensi berhasil diubah menjadi ${status}`,
      data: {
        id,
        status,
        waktu_absensi: updateWaktu,
        previous_status: existingAbsensi[0].status
      }
    });

  } catch (error: any) {
    console.error('❌ PUT Absensi Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error updating absensi', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Hapus data absensi (ENHANCED)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID absensi diperlukan' },
        { status: 400 }
      );
    }

    const [existingAbsensi] = await db.execute<RowDataPacket[]>(
      'SELECT id FROM absensi WHERE id = ?',
      [id]
    );

    if (existingAbsensi.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Data absensi tidak ditemukan' },
        { status: 404 }
      );
    }

    await db.execute('DELETE FROM absensi WHERE id = ?', [id]);

    console.log(`✅ Deleted absensi ID ${id}`);

    return NextResponse.json({
      success: true,
      message: 'Data absensi berhasil dihapus'
    });

  } catch (error: any) {
    console.error('❌ DELETE Absensi Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error deleting absensi', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}