import { NextRequest, NextResponse } from 'next/server';
import { db, RowDataPacket } from '@/lib/db';

// POST - Generate konsumsi untuk kegiatan tertentu (2 jenis konsumsi per panitia)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { kegiatan_id, tanggal_konsumsi, kegiatan_rangkaian_id = null } = body;

    if (!kegiatan_id || !tanggal_konsumsi) {
      return NextResponse.json(
        { success: false, message: 'kegiatan_id dan tanggal_konsumsi harus diisi' },
        { status: 400 }
      );
    }

    // Validasi kegiatan
    const [kegiatanRows] = await db.execute<RowDataPacket[]>(
      `SELECT k.id, k.nama, k.jenis_rangkaian, k.tanggal_single
       FROM kegiatan k
       WHERE k.id = ? AND k.is_active = 1`,
      [kegiatan_id]
    );

    if (kegiatanRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Kegiatan tidak ditemukan' },
        { status: 404 }
      );
    }

    const kegiatan = kegiatanRows[0];

    // Validasi rangkaian untuk multiple event
    if (kegiatan.jenis_rangkaian === 'multiple' && kegiatan_rangkaian_id) {
      const [rangkaianRows] = await db.execute<RowDataPacket[]>(
        'SELECT id FROM kegiatan_rangkaian WHERE id = ? AND kegiatan_id = ? AND is_active = 1',
        [kegiatan_rangkaian_id, kegiatan_id]
      );

      if (rangkaianRows.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Rangkaian kegiatan tidak ditemukan' },
          { status: 404 }
        );
      }
    }

    // Get daftar divisi untuk kegiatan ini
    const [divisiRows] = await db.execute<RowDataPacket[]>(
      'SELECT divisi FROM kegiatan_divisi WHERE kegiatan_id = ? AND is_active = 1',
      [kegiatan_id]
    );

    if (divisiRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Tidak ada divisi yang terdaftar untuk kegiatan ini' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { success: false, message: 'Tidak ada panitia yang sesuai divisi' },
        { status: 400 }
      );
    }

    // Format tanggal untuk database
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

    // Check existing konsumsi untuk menghindari duplikasi
    const existingQuery = `
      SELECT panitia_id, jenis_konsumsi FROM absensi_konsumsi 
      WHERE kegiatan_id = ? 
      AND (kegiatan_rangkaian_id = ? OR (kegiatan_rangkaian_id IS NULL AND ? IS NULL))
      AND tanggal_konsumsi = ?
    `;
    
    const [existingRows] = await db.execute<RowDataPacket[]>(
      existingQuery,
      [kegiatan_id, kegiatan_rangkaian_id, kegiatan_rangkaian_id, formattedDate]
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
      return NextResponse.json({
        success: true,
        message: 'Konsumsi sudah pernah di-generate untuk semua panitia dan jenis konsumsi',
        data: {
          total_existing: existingRows.length,
          total_new: 0,
          total_panitia: panitiaRows.length,
          jenis_konsumsi: jenisKonsumsiList.length
        }
      });
    }

    // Generate konsumsi untuk kombinasi yang belum ada
    const insertPromises = newKonsumsiRecords.map(record => {
      return db.execute(
        `INSERT INTO absensi_konsumsi (panitia_id, kegiatan_id, kegiatan_rangkaian_id, tanggal_konsumsi, jenis_konsumsi, status_pengambilan)
         VALUES (?, ?, ?, ?, ?, 'belum_diambil')`,
        [record.panitia_id, kegiatan_id, kegiatan_rangkaian_id, formattedDate, record.jenis_konsumsi]
      );
    });

    await Promise.all(insertPromises);

    // Hitung statistik
    const konsumsi1New = newKonsumsiRecords.filter(r => r.jenis_konsumsi === 'konsumsi_1').length;
    const konsumsi2New = newKonsumsiRecords.filter(r => r.jenis_konsumsi === 'konsumsi_2').length;

    return NextResponse.json({
      success: true,
      message: `Berhasil generate konsumsi untuk ${panitiaRows.length} panitia`,
      data: {
        kegiatan_id,
        kegiatan_rangkaian_id,
        tanggal_konsumsi: formattedDate,
        total_existing: existingRows.length,
        total_new: newKonsumsiRecords.length,
        total_panitia: panitiaRows.length,
        breakdown: {
          konsumsi_1_new: konsumsi1New,
          konsumsi_2_new: konsumsi2New,
          existing_konsumsi_1: existingRows.filter(r => r.jenis_konsumsi === 'konsumsi_1').length,
          existing_konsumsi_2: existingRows.filter(r => r.jenis_konsumsi === 'konsumsi_2').length
        }
      }
    });

  } catch (error: any) {
    console.error('Generate Konsumsi Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error generating konsumsi', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Reset konsumsi (set semua ke 'belum_diambil')
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kegiatan_id = searchParams.get('kegiatan_id');
    const tanggal_konsumsi = searchParams.get('tanggal_konsumsi');
    const kegiatan_rangkaian_id = searchParams.get('kegiatan_rangkaian_id');
    const jenis_konsumsi = searchParams.get('jenis_konsumsi'); // optional: 'konsumsi_1' | 'konsumsi_2'

    if (!kegiatan_id || !tanggal_konsumsi) {
      return NextResponse.json(
        { success: false, message: 'kegiatan_id dan tanggal_konsumsi harus diisi' },
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

    // Reset konsumsi menjadi 'belum_diambil'
    let resetQuery = `
      UPDATE absensi_konsumsi SET 
      status_pengambilan = 'belum_diambil', 
      waktu_pengambilan = NULL,
      metode_konfirmasi = 'Manual',
      koordinat_lat = NULL,
      koordinat_lng = NULL,
      catatan = 'Reset oleh sistem',
      qr_data = NULL,
      petugas_konfirmasi = 'system',
      updated_at = CURRENT_TIMESTAMP
      WHERE kegiatan_id = ? 
      AND (kegiatan_rangkaian_id = ? OR (kegiatan_rangkaian_id IS NULL AND ? IS NULL))
      AND tanggal_konsumsi = ?
    `;

    let resetParams = [kegiatan_id, kegiatan_rangkaian_id, kegiatan_rangkaian_id, formattedDate];

    // Filter berdasarkan jenis konsumsi jika dispesifikasi
    if (jenis_konsumsi && ['konsumsi_1', 'konsumsi_2'].includes(jenis_konsumsi)) {
      resetQuery += ' AND jenis_konsumsi = ?';
      resetParams.push(jenis_konsumsi);
    }

    const [result] = await db.execute(resetQuery, resetParams);

    const affectedRows = (result as any).affectedRows;
    const jenisMessage = jenis_konsumsi ? 
      ` untuk ${jenis_konsumsi === 'konsumsi_1' ? 'Konsumsi 1' : 'Konsumsi 2'}` : 
      ' untuk semua jenis konsumsi';

    return NextResponse.json({
      success: true,
      message: `Berhasil reset konsumsi${jenisMessage}, ${affectedRows} record direset`,
      data: {
        affected_rows: affectedRows,
        jenis_konsumsi: jenis_konsumsi || 'semua',
        kegiatan_id,
        kegiatan_rangkaian_id,
        tanggal_konsumsi: formattedDate
      }
    });

  } catch (error: any) {
    console.error('Reset Konsumsi Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error resetting konsumsi', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH - Bulk update status konsumsi berdasarkan kriteria tertentu
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      kegiatan_id, 
      tanggal_konsumsi,
      kegiatan_rangkaian_id = null,
      jenis_konsumsi, // 'konsumsi_1' | 'konsumsi_2' | 'semua'
      divisi = null, // optional: filter by divisi
      status_pengambilan, // target status: 'sudah_diambil' | 'belum_diambil'
      catatan = 'Bulk update oleh admin',
      petugas = 'admin'
    } = body;

    if (!kegiatan_id || !tanggal_konsumsi || !status_pengambilan) {
      return NextResponse.json(
        { success: false, message: 'kegiatan_id, tanggal_konsumsi, dan status_pengambilan harus diisi' },
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
    const now = new Date();
    const updateWaktu = status_pengambilan === 'sudah_diambil' ? now : null;

    // Build update query with filters
    let updateQuery = `
      UPDATE absensi_konsumsi k
      JOIN panitia_peserta p ON k.panitia_id = p.id
      SET k.status_pengambilan = ?,
          k.waktu_pengambilan = ?,
          k.metode_konfirmasi = 'Manual',
          k.catatan = ?,
          k.petugas_konfirmasi = ?,
          k.updated_at = CURRENT_TIMESTAMP
      WHERE k.kegiatan_id = ?
      AND (k.kegiatan_rangkaian_id = ? OR (k.kegiatan_rangkaian_id IS NULL AND ? IS NULL))
      AND k.tanggal_konsumsi = ?
    `;

    let updateParams = [
      status_pengambilan, 
      updateWaktu, 
      catatan, 
      petugas,
      kegiatan_id, 
      kegiatan_rangkaian_id, 
      kegiatan_rangkaian_id, 
      formattedDate
    ];

    // Filter by jenis konsumsi
    if (jenis_konsumsi && jenis_konsumsi !== 'semua') {
      updateQuery += ' AND k.jenis_konsumsi = ?';
      updateParams.push(jenis_konsumsi);
    }

    // Filter by divisi
    if (divisi) {
      updateQuery += ' AND p.divisi = ?';
      updateParams.push(divisi);
    }

    const [result] = await db.execute(updateQuery, updateParams);

    const affectedRows = (result as any).affectedRows;
    const jenisMessage = jenis_konsumsi && jenis_konsumsi !== 'semua' ? 
      ` untuk ${jenis_konsumsi === 'konsumsi_1' ? 'Konsumsi 1' : 'Konsumsi 2'}` : 
      ' untuk semua jenis konsumsi';
    
    const divisiMessage = divisi ? ` divisi ${divisi}` : ' semua divisi';
    const statusMessage = status_pengambilan === 'sudah_diambil' ? 'Sudah Diambil' : 'Belum Diambil';

    return NextResponse.json({
      success: true,
      message: `Berhasil update ${affectedRows} record konsumsi${jenisMessage}${divisiMessage} menjadi ${statusMessage}`,
      data: {
        affected_rows: affectedRows,
        jenis_konsumsi: jenis_konsumsi || 'semua',
        divisi_filter: divisi,
        status_pengambilan,
        kegiatan_id,
        kegiatan_rangkaian_id,
        tanggal_konsumsi: formattedDate
      }
    });

  } catch (error: any) {
    console.error('Bulk Update Konsumsi Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error bulk updating konsumsi', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}