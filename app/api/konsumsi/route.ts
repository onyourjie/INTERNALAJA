// app/api/konsumsi/route.ts - FIXED VERSION
import { NextRequest, NextResponse } from 'next/server';
import { db, RowDataPacket } from '@/lib/db';

interface KonsumsiRow extends RowDataPacket {
  konsumsi_id: number;
  panitia_id: number;
  kegiatan_id: number;
  kegiatan_rangkaian_id: number | null;
  tanggal_konsumsi: string;
  jenis_konsumsi: 'konsumsi_1' | 'konsumsi_2';
  status_pengambilan: 'sudah_diambil' | 'belum_diambil';
  waktu_pengambilan: string | null;
  metode_konfirmasi: 'QR Code' | 'Manual' | 'Barcode' | 'NFC';
  unique_id: string;
  nim: string;
  nama_lengkap: string;
  divisi: string;
  kegiatan_nama: string;
  jenis_rangkaian: 'single' | 'multiple';
  rangkaian_nama: string | null;
  petugas_konfirmasi: string | null;
  catatan: string | null;
}

interface Statistics {
  konsumsi_1: {
    total: number;
    sudah_diambil: number;
    belum_diambil: number;
    persentase: number;
  };
  konsumsi_2: {
    total: number;
    sudah_diambil: number;
    belum_diambil: number;
    persentase: number;
  };
}

// Helper function to normalize kegiatan_rangkaian_id
const normalizeRangkaianId = (rangkaianId: string | null): number | null => {
  if (!rangkaianId || rangkaianId === 'null' || rangkaianId === 'undefined') {
    return null;
  }
  const parsed = parseInt(rangkaianId, 10);
  return isNaN(parsed) ? null : parsed;
};

// AUTO-GENERATE function untuk membuat data konsumsi otomatis
async function autoGenerateKonsumsi(kegiatan_id: number, tanggal_konsumsi: string, kegiatan_rangkaian_id: string | null) {
  try {
    // Normalize rangkaian_id
    const normalizedRangkaianId = normalizeRangkaianId(kegiatan_rangkaian_id);
    
    console.log('🔧 Auto-generate konsumsi:', {
      kegiatan_id,
      tanggal_konsumsi,
      kegiatan_rangkaian_id_input: kegiatan_rangkaian_id,
      normalizedRangkaianId
    });

    // Validasi kegiatan
    const [kegiatanRows] = await db.execute<RowDataPacket[]>(
      `SELECT k.id, k.nama, k.jenis_rangkaian, k.tanggal_single
       FROM kegiatan k
       WHERE k.id = ? AND k.is_active = 1`,
      [kegiatan_id]
    );

    if (kegiatanRows.length === 0) {
      console.log('❌ Kegiatan tidak ditemukan:', kegiatan_id);
      return false;
    }

    const kegiatan = kegiatanRows[0];

    // Validasi rangkaian untuk multiple event
    if (kegiatan.jenis_rangkaian === 'multiple' && normalizedRangkaianId) {
      const [rangkaianRows] = await db.execute<RowDataPacket[]>(
        'SELECT id FROM kegiatan_rangkaian WHERE id = ? AND kegiatan_id = ? AND is_active = 1',
        [normalizedRangkaianId, kegiatan_id]
      );

      if (rangkaianRows.length === 0) {
        console.log('❌ Rangkaian tidak ditemukan:', { normalizedRangkaianId, kegiatan_id });
        return false;
      }
    }

    // Get daftar divisi untuk kegiatan ini
    const [divisiRows] = await db.execute<RowDataPacket[]>(
      'SELECT divisi FROM kegiatan_divisi WHERE kegiatan_id = ? AND is_active = 1',
      [kegiatan_id]
    );

    if (divisiRows.length === 0) {
      console.log('❌ Tidak ada divisi untuk kegiatan:', kegiatan_id);
      return false;
    }

    const divisiList = divisiRows.map(row => row.divisi);
    const includesAll = divisiList.includes('Semua');

    // Get panitia yang sesuai divisi
    let panitiaQuery = 'SELECT id FROM panitia_peserta WHERE is_active = 1';
    let panitiaParams: any[] = [];

    if (!includesAll) {
      const placeholders = divisiList.map(() => '?').join(',');
      panitiaQuery += ` AND divisi IN (${placeholders})`;
      panitiaParams = divisiList;
    }

    const [panitiaRows] = await db.execute<RowDataPacket[]>(panitiaQuery, panitiaParams);

    if (panitiaRows.length === 0) {
      console.log('❌ Tidak ada panitia yang sesuai divisi');
      return false;
    }

    // Check existing konsumsi untuk menghindari duplikasi
    const existingQuery = `
      SELECT panitia_id, jenis_konsumsi FROM absensi_konsumsi 
      WHERE kegiatan_id = ? 
      AND (kegiatan_rangkaian_id = ? OR (kegiatan_rangkaian_id IS NULL AND ? IS NULL))
      AND tanggal_konsumsi = ?
    `;
    
    const [existingRows] = await db.execute<RowDataPacket[]>(
      existingQuery,
      [kegiatan_id, normalizedRangkaianId, normalizedRangkaianId, tanggal_konsumsi]
    );

    // Create set of existing konsumsi combinations
    const existingKombinasi = new Set(
      existingRows.map(row => `${row.panitia_id}-${row.jenis_konsumsi}`)
    );

    // Generate kombinasi panitia-konsumsi yang belum ada
    const newKonsumsiRecords = [];
    const jenisKonsumsiList = ['konsumsi_1', 'konsumsi_2'];

    for (const panitiaRow of panitiaRows) {
      for (const jenisKonsumsi of jenisKonsumsiList) {
        const kombinasiKey = `${panitiaRow.id}-${jenisKonsumsi}`;
        if (!existingKombinasi.has(kombinasiKey)) {
          newKonsumsiRecords.push({
            panitia_id: panitiaRow.id,
            jenis_konsumsi: jenisKonsumsi
          });
        }
      }
    }

    if (newKonsumsiRecords.length === 0) {
      console.log('✅ Konsumsi sudah ter-generate sebelumnya');
      return true; // Already generated
    }

    console.log(`🔄 Generating ${newKonsumsiRecords.length} konsumsi records...`);

    // Generate konsumsi untuk kombinasi yang belum ada
    const insertPromises = newKonsumsiRecords.map(record => {
      return db.execute(
        `INSERT INTO absensi_konsumsi (panitia_id, kegiatan_id, kegiatan_rangkaian_id, tanggal_konsumsi, jenis_konsumsi, status_pengambilan)
         VALUES (?, ?, ?, ?, ?, 'belum_diambil')`,
        [record.panitia_id, kegiatan_id, normalizedRangkaianId, tanggal_konsumsi, record.jenis_konsumsi]
      );
    });

    await Promise.all(insertPromises);
    console.log('✅ Auto-generate konsumsi berhasil');
    return true;

  } catch (error) {
    console.error('❌ Auto-generate konsumsi error:', error);
    return false;
  }
}

// FIXED: Fungsi untuk menghitung statistik yang akurat
async function calculateStatistics(kegiatan_id: number, kegiatan_rangkaian_id: string | null, tanggal: string): Promise<{ statistics: Statistics, meta: any }> {
  try {
    // Normalize rangkaian_id
    const normalizedRangkaianId = normalizeRangkaianId(kegiatan_rangkaian_id);
    
    console.log('📊 Calculating statistics:', {
      kegiatan_id,
      kegiatan_rangkaian_id_input: kegiatan_rangkaian_id,
      normalizedRangkaianId,
      tanggal
    });

    // 1. Hitung total panitia yang eligible untuk kegiatan ini
    const [eligibleRows] = await db.execute<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT p.id) as total_eligible, GROUP_CONCAT(DISTINCT kd.divisi) as divisi_list
       FROM panitia_peserta p
       CROSS JOIN kegiatan_divisi kd
       WHERE kd.kegiatan_id = ? AND kd.is_active = 1 AND p.is_active = 1
       AND (kd.divisi = 'Semua' OR kd.divisi = p.divisi)`,
      [kegiatan_id]
    );

    const totalEligible = eligibleRows[0]?.total_eligible || 0;
    const divisiList = eligibleRows[0]?.divisi_list ? eligibleRows[0].divisi_list.split(',') : [];

    // 2. Hitung konsumsi yang sudah diambil untuk setiap jenis
    const rangkaianCondition = normalizedRangkaianId !== null 
      ? 'AND ak.kegiatan_rangkaian_id = ?' 
      : 'AND ak.kegiatan_rangkaian_id IS NULL';
    
    const baseParams = [kegiatan_id, tanggal];
    if (normalizedRangkaianId !== null) {
      baseParams.push(normalizedRangkaianId);
    }

    // Count Konsumsi 1 - Sudah Diambil
    const [k1SudahRows] = await db.execute<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT ak.panitia_id) as count
       FROM absensi_konsumsi ak
       JOIN panitia_peserta p ON ak.panitia_id = p.id
       WHERE ak.kegiatan_id = ? 
       AND ak.tanggal_konsumsi = ?
       ${rangkaianCondition}
       AND ak.jenis_konsumsi = 'konsumsi_1'
       AND ak.status_pengambilan = 'sudah_diambil'
       AND p.is_active = 1`,
      baseParams
    );

    // Count Konsumsi 2 - Sudah Diambil
    const [k2SudahRows] = await db.execute<RowDataPacket[]>(
      `SELECT COUNT(DISTINCT ak.panitia_id) as count
       FROM absensi_konsumsi ak
       JOIN panitia_peserta p ON ak.panitia_id = p.id
       WHERE ak.kegiatan_id = ? 
       AND ak.tanggal_konsumsi = ?
       ${rangkaianCondition}
       AND ak.jenis_konsumsi = 'konsumsi_2'
       AND ak.status_pengambilan = 'sudah_diambil'
       AND p.is_active = 1`,
      baseParams
    );

    const konsumsi1Sudah = k1SudahRows[0]?.count || 0;
    const konsumsi2Sudah = k2SudahRows[0]?.count || 0;
    
    const konsumsi1Belum = Math.max(totalEligible - konsumsi1Sudah, 0);
    const konsumsi2Belum = Math.max(totalEligible - konsumsi2Sudah, 0);

    const statistics: Statistics = {
      konsumsi_1: {
        total: totalEligible,
        sudah_diambil: konsumsi1Sudah,
        belum_diambil: konsumsi1Belum,
        persentase: totalEligible > 0 ? Math.round((konsumsi1Sudah / totalEligible) * 100) : 0
      },
      konsumsi_2: {
        total: totalEligible,
        sudah_diambil: konsumsi2Sudah,
        belum_diambil: konsumsi2Belum,
        persentase: totalEligible > 0 ? Math.round((konsumsi2Sudah / totalEligible) * 100) : 0
      }
    };

    const meta = {
      total_panitia_eligible: totalEligible,
      divisi_included: divisiList,
      is_semua_divisi: divisiList.includes('Semua')
    };

    console.log('📊 Statistics Calculated:', {
      totalEligible,
      konsumsi1Sudah,
      konsumsi2Sudah,
      statistics
    });

    return { statistics, meta };

  } catch (error) {
    console.error('❌ Error calculating statistics:', error);
    return {
      statistics: {
        konsumsi_1: { total: 0, sudah_diambil: 0, belum_diambil: 0, persentase: 0 },
        konsumsi_2: { total: 0, sudah_diambil: 0, belum_diambil: 0, persentase: 0 }
      },
      meta: { total_panitia_eligible: 0, divisi_included: [], is_semua_divisi: false }
    };
  }
}

// GET - Ambil data konsumsi dengan AUTO-POPULATE dan STATISTIK yang BENAR
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const kegiatan_id = searchParams.get('kegiatan_id');
    const kegiatan_rangkaian_id = searchParams.get('kegiatan_rangkaian_id');
    const tanggal = searchParams.get('tanggal');
    const jenis_konsumsi = searchParams.get('jenis_konsumsi'); // 'konsumsi_1' | 'konsumsi_2'
    const status = searchParams.get('status'); // 'sudah_diambil' | 'belum_diambil'
    const divisi = searchParams.get('divisi');

    console.log('🔍 GET Konsumsi Request:', {
      kegiatan_id,
      kegiatan_rangkaian_id,
      tanggal,
      jenis_konsumsi,
      status,
      search,
      page,
      limit
    });

    // Jika tidak ada kegiatan_id, return kosong
    if (!kegiatan_id) {
      return NextResponse.json({
        success: true,
        data: [],
        statistics: {
          konsumsi_1: { total: 0, sudah_diambil: 0, belum_diambil: 0, persentase: 0 },
          konsumsi_2: { total: 0, sudah_diambil: 0, belum_diambil: 0, persentase: 0 }
        },
        meta: { total_panitia_eligible: 0, divisi_included: [], is_semua_divisi: false },
        pagination: { page, limit, total: 0, totalPages: 0 }
      });
    }

    const formatDateForDB = (dateInput: string): string => {
      try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) throw new Error('Invalid date');
        return date.toISOString().split('T')[0];
      } catch (error) {
        throw new Error(`Invalid date format: ${dateInput}`);
      }
    };

    let formattedDate = '';
    if (tanggal) {
      formattedDate = formatDateForDB(tanggal);
    }

    // Normalize rangkaian_id for consistency
    const normalizedRangkaianId = normalizeRangkaianId(kegiatan_rangkaian_id);

    // AUTO-GENERATE: Cek dan generate konsumsi jika belum ada
    if (formattedDate) {
      await autoGenerateKonsumsi(parseInt(kegiatan_id), formattedDate, kegiatan_rangkaian_id);
    }

    // FIXED: Hitung statistik yang akurat
    const { statistics, meta } = await calculateStatistics(parseInt(kegiatan_id), kegiatan_rangkaian_id, formattedDate);

    // Query panitia yang berhak dapat konsumsi untuk kegiatan ini
    let baseQuery = `
      SELECT DISTINCT
        p.id as panitia_id,
        p.unique_id,
        p.nim,
        p.nama_lengkap,
        p.divisi,
        k.nama as kegiatan_nama,
        k.jenis_rangkaian,
        kr.judul as rangkaian_nama,
        jenis_list.jenis_konsumsi,
        COALESCE(kon.id, 0) as konsumsi_id,
        COALESCE(kon.status_pengambilan, 'belum_diambil') as status_pengambilan,
        kon.waktu_pengambilan,
        kon.metode_konfirmasi,
        kon.petugas_konfirmasi,
        kon.catatan,
        kon.tanggal_konsumsi
      FROM panitia_peserta p
      CROSS JOIN kegiatan k
      CROSS JOIN (
        SELECT 'konsumsi_1' as jenis_konsumsi
        UNION ALL
        SELECT 'konsumsi_2' as jenis_konsumsi
      ) jenis_list
      LEFT JOIN kegiatan_rangkaian kr ON kr.kegiatan_id = k.id
      LEFT JOIN kegiatan_divisi kd ON kd.kegiatan_id = k.id AND kd.is_active = 1
      LEFT JOIN absensi_konsumsi kon ON (
        kon.panitia_id = p.id 
        AND kon.kegiatan_id = k.id 
        AND kon.jenis_konsumsi = jenis_list.jenis_konsumsi
        AND (kon.kegiatan_rangkaian_id = kr.id OR (kon.kegiatan_rangkaian_id IS NULL AND kr.id IS NULL))
        ${formattedDate ? 'AND kon.tanggal_konsumsi = ?' : ''}
      )
      WHERE k.id = ? 
        AND k.is_active = 1
        AND p.is_active = 1
        AND (kd.divisi = 'Semua' OR kd.divisi = p.divisi)
    `;

    let queryParams: any[] = [];
    
    if (formattedDate) {
      queryParams.push(formattedDate);
    }
    queryParams.push(kegiatan_id);

    // Filter berdasarkan rangkaian
    if (normalizedRangkaianId !== null) {
      baseQuery += ' AND (kr.id = ? OR kr.id IS NULL)';
      queryParams.push(normalizedRangkaianId);
    } else {
      baseQuery += ' AND kr.id IS NULL';
    }

    // Filter jenis konsumsi
    if (jenis_konsumsi && jenis_konsumsi !== 'semua') {
      baseQuery += ' AND jenis_list.jenis_konsumsi = ?';
      queryParams.push(jenis_konsumsi);
    }

    // Filter search
    if (search) {
      baseQuery += ' AND (p.nama_lengkap LIKE ? OR p.nim LIKE ? OR p.divisi LIKE ?)';
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    // Filter status
    if (status) {
      if (status === 'sudah_diambil') {
        baseQuery += ' AND kon.status_pengambilan = "sudah_diambil"';
      } else if (status === 'belum_diambil') {
        baseQuery += ' AND (kon.status_pengambilan IS NULL OR kon.status_pengambilan = "belum_diambil")';
      }
    }

    // Filter divisi
    if (divisi) {
      baseQuery += ' AND p.divisi = ?';
      queryParams.push(divisi);
    }

    baseQuery += ' ORDER BY p.nama_lengkap ASC, jenis_list.jenis_konsumsi ASC';

    console.log('🔍 Executing query with params:', queryParams);

    const [rows] = await db.execute<RowDataPacket[]>(baseQuery, queryParams);

    // Format data untuk response
    const formattedData = rows.map((row: any) => ({
      id: row.konsumsi_id || 0,
      panitia_id: row.panitia_id,
      kegiatan_id: parseInt(kegiatan_id),
      kegiatan_rangkaian_id: normalizedRangkaianId,
      nim: row.nim,
      nama_lengkap: row.nama_lengkap,
      divisi: row.divisi,
      jenis_konsumsi: row.jenis_konsumsi,
      jenis_display: row.jenis_konsumsi === 'konsumsi_1' ? 'Konsumsi 1' : 'Konsumsi 2',
      status_pengambilan: row.status_pengambilan || 'belum_diambil',
      status_display: (row.status_pengambilan === 'sudah_diambil') ? 'Sudah' : 'Belum',
      tanggal_konsumsi: row.tanggal_konsumsi || formattedDate,
      waktu_pengambilan: row.waktu_pengambilan,
      waktu_display: row.waktu_pengambilan ? 
        new Date(row.waktu_pengambilan).toLocaleTimeString('id-ID', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }) : '-',
      metode_konfirmasi: row.metode_konfirmasi || 'Manual',
      petugas_konfirmasi: row.petugas_konfirmasi || '',
      kegiatan_nama: row.kegiatan_nama,
      rangkaian_nama: row.rangkaian_nama,
      catatan: row.catatan
    }));

    // Apply pagination
    const totalEntries = formattedData.length;
    const offset = (page - 1) * limit;
    const paginatedData = formattedData.slice(offset, offset + limit);
    
    console.log('📤 Sending Response:', {
      dataCount: paginatedData.length,
      totalEntries,
      statistics,
      meta
    });
    
    return NextResponse.json({
      success: true,
      data: paginatedData,
      statistics,
      meta,
      pagination: {
        page,
        limit,
        total: totalEntries,
        totalPages: Math.ceil(totalEntries / limit)
      }
    });

  } catch (error: any) {
    console.error('❌ GET Konsumsi Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error fetching konsumsi data', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT - Update status konsumsi (untuk koreksi manual) dengan REFRESH STATISTICS
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      panitia_id,
      kegiatan_id,
      kegiatan_rangkaian_id,
      tanggal_konsumsi,
      jenis_konsumsi,
      status_pengambilan,
      catatan = null,
      petugas = 'admin'
    } = body;

    console.log('🔧 PUT Konsumsi Request:', body);

    if (!panitia_id || !kegiatan_id || !tanggal_konsumsi || !jenis_konsumsi || !status_pengambilan) {
      return NextResponse.json(
        { success: false, message: 'Parameter yang diperlukan: panitia_id, kegiatan_id, tanggal_konsumsi, jenis_konsumsi, status_pengambilan' },
        { status: 400 }
      );
    }

    if (!['sudah_diambil', 'belum_diambil'].includes(status_pengambilan)) {
      return NextResponse.json(
        { success: false, message: 'status_pengambilan harus sudah_diambil atau belum_diambil' },
        { status: 400 }
      );
    }

    const formatDateForDB = (dateInput: string): string => {
      try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) throw new Error('Invalid date');
        return date.toISOString().split('T')[0];
      } catch (error) {
        throw new Error(`Invalid date format: ${dateInput}`);
      }
    };

    const formattedDate = formatDateForDB(tanggal_konsumsi);
    const normalizedRangkaianId = normalizeRangkaianId(kegiatan_rangkaian_id);

    // Check if konsumsi record exists
    const [existingKonsumsi] = await db.execute<RowDataPacket[]>(
      `SELECT id, status_pengambilan FROM absensi_konsumsi 
       WHERE panitia_id = ? AND kegiatan_id = ? AND jenis_konsumsi = ?
       AND (kegiatan_rangkaian_id = ? OR (kegiatan_rangkaian_id IS NULL AND ? IS NULL))
       AND tanggal_konsumsi = ?`,
      [panitia_id, kegiatan_id, jenis_konsumsi, normalizedRangkaianId, normalizedRangkaianId, formattedDate]
    );

    const now = new Date();
    const updateWaktu = status_pengambilan === 'sudah_diambil' ? now : null;

    if (existingKonsumsi.length > 0) {
      // Update existing record
      await db.execute(
        `UPDATE absensi_konsumsi SET 
         status_pengambilan = ?, 
         waktu_pengambilan = ?, 
         metode_konfirmasi = 'Manual',
         catatan = ?,
         petugas_konfirmasi = ?,
         updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [status_pengambilan, updateWaktu, catatan, petugas, existingKonsumsi[0].id]
      );

      console.log('✅ Updated konsumsi:', {
        id: existingKonsumsi[0].id,
        panitia_id,
        jenis_konsumsi,
        old_status: existingKonsumsi[0].status_pengambilan,
        new_status: status_pengambilan
      });

      return NextResponse.json({
        success: true,
        message: `Status konsumsi berhasil diubah menjadi ${status_pengambilan === 'sudah_diambil' ? 'Sudah Diambil' : 'Belum Diambil'}`,
        data: {
          id: existingKonsumsi[0].id,
          status_pengambilan,
          waktu_pengambilan: updateWaktu,
          previous_status: existingKonsumsi[0].status_pengambilan
        }
      });
    } else {
      // Create new record
      const [result] = await db.execute(
        `INSERT INTO absensi_konsumsi 
         (panitia_id, kegiatan_id, kegiatan_rangkaian_id, tanggal_konsumsi, jenis_konsumsi, status_pengambilan, waktu_pengambilan, metode_konfirmasi, catatan, petugas_konfirmasi)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Manual', ?, ?)`,
        [panitia_id, kegiatan_id, normalizedRangkaianId, formattedDate, jenis_konsumsi, status_pengambilan, updateWaktu, catatan, petugas]
      );

      console.log('✅ Created new konsumsi:', {
        id: (result as any).insertId,
        panitia_id,
        jenis_konsumsi,
        status: status_pengambilan
      });

      return NextResponse.json({
        success: true,
        message: `Konsumsi berhasil dicatat dengan status ${status_pengambilan === 'sudah_diambil' ? 'Sudah Diambil' : 'Belum Diambil'}`,
        data: {
          id: (result as any).insertId,
          status_pengambilan,
          waktu_pengambilan: updateWaktu
        }
      });
    }

  } catch (error: any) {
    console.error('❌ PUT Konsumsi Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error updating konsumsi', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Hapus data konsumsi
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const panitia_id = searchParams.get('panitia_id');
    const kegiatan_id = searchParams.get('kegiatan_id');
    const jenis_konsumsi = searchParams.get('jenis_konsumsi');

    if (!id && (!panitia_id || !kegiatan_id || !jenis_konsumsi)) {
      return NextResponse.json(
        { success: false, message: 'ID konsumsi atau kombinasi panitia_id + kegiatan_id + jenis_konsumsi diperlukan' },
        { status: 400 }
      );
    }

    let deleteQuery = 'DELETE FROM absensi_konsumsi WHERE ';
    let deleteParams: any[] = [];

    if (id) {
      deleteQuery += 'id = ?';
      deleteParams.push(id);
    } else {
      deleteQuery += 'panitia_id = ? AND kegiatan_id = ? AND jenis_konsumsi = ?';
      deleteParams.push(panitia_id, kegiatan_id, jenis_konsumsi);
    }

    const [result] = await db.execute(deleteQuery, deleteParams);

    if ((result as any).affectedRows === 0) {
      return NextResponse.json(
        { success: false, message: 'Data konsumsi tidak ditemukan' },
        { status: 404 }
      );
    }

    console.log('✅ Deleted konsumsi:', { id, panitia_id, kegiatan_id, jenis_konsumsi });

    return NextResponse.json({
      success: true,
      message: 'Data konsumsi berhasil dihapus',
      data: { affected_rows: (result as any).affectedRows }
    });

  } catch (error: any) {
    console.error('❌ DELETE Konsumsi Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error deleting konsumsi', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}