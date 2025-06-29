// app/api/absensi/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db, RowDataPacket } from '@/lib/db';

// POST - Generate absensi untuk kegiatan tertentu
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { kegiatan_id, tanggal_absensi, kegiatan_rangkaian_id = null } = body;

    if (!kegiatan_id || !tanggal_absensi) {
      return NextResponse.json(
        { success: false, message: 'kegiatan_id dan tanggal_absensi harus diisi' },
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
    let panitiaQuery = 'SELECT id FROM panitia_peserta';
    let panitiaParams: any[] = [];

    if (!includesAll) {
      const placeholders = divisiList.map(() => '?').join(',');
      panitiaQuery += ` WHERE divisi IN (${placeholders})`;
      panitiaParams = divisiList;
    }

    const [panitiaRows] = await db.execute<RowDataPacket[]>(panitiaQuery, panitiaParams);

    if (panitiaRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Tidak ada panitia yang sesuai divisi' },
        { status: 400 }
      );
    }

    // Check existing absensi untuk menghindari duplikasi
    const existingQuery = `
      SELECT panitia_id FROM absensi 
      WHERE kegiatan_id = ? 
      AND (kegiatan_rangkaian_id = ? OR (kegiatan_rangkaian_id IS NULL AND ? IS NULL))
      AND tanggal_absensi = ?
    `;
    
    const [existingRows] = await db.execute<RowDataPacket[]>(
      existingQuery,
      [kegiatan_id, kegiatan_rangkaian_id, kegiatan_rangkaian_id, tanggal_absensi]
    );

    const existingPanitiaIds = existingRows.map(row => row.panitia_id);

    // Filter panitia yang belum ada absensinya
    const newPanitiaIds = panitiaRows
      .map(row => row.id)
      .filter(id => !existingPanitiaIds.includes(id));

    if (newPanitiaIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Absensi sudah pernah di-generate untuk semua panitia',
        data: {
          total_existing: existingPanitiaIds.length,
          total_new: 0
        }
      });
    }

    // Generate absensi untuk panitia yang belum ada
    const insertPromises = newPanitiaIds.map(panitia_id => {
      return db.execute(
        `INSERT INTO absensi (panitia_id, kegiatan_id, kegiatan_rangkaian_id, tanggal_absensi, status)
         VALUES (?, ?, ?, ?, 'Tidak Hadir')`,
        [panitia_id, kegiatan_id, kegiatan_rangkaian_id, tanggal_absensi]
      );
    });

    await Promise.all(insertPromises);

    return NextResponse.json({
      success: true,
      message: `Berhasil generate absensi untuk ${newPanitiaIds.length} panitia`,
      data: {
        kegiatan_id,
        kegiatan_rangkaian_id,
        tanggal_absensi,
        total_existing: existingPanitiaIds.length,
        total_new: newPanitiaIds.length,
        total_panitia: panitiaRows.length
      }
    });

  } catch (error: any) {
    console.error('Generate Absensi Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error generating absensi', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Reset absensi (set semua ke 'Tidak Hadir')
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kegiatan_id = searchParams.get('kegiatan_id');
    const tanggal_absensi = searchParams.get('tanggal_absensi');
    const kegiatan_rangkaian_id = searchParams.get('kegiatan_rangkaian_id');

    if (!kegiatan_id || !tanggal_absensi) {
      return NextResponse.json(
        { success: false, message: 'kegiatan_id dan tanggal_absensi harus diisi' },
        { status: 400 }
      );
    }

    // Reset semua absensi menjadi 'Tidak Hadir'
    const [result] = await db.execute(
      `UPDATE absensi SET 
       status = 'Tidak Hadir', 
       waktu_absensi = NULL,
       metode_absensi = 'Manual',
       koordinat_lat = NULL,
       koordinat_lng = NULL,
       catatan = 'Reset oleh sistem',
       qr_data = NULL,
       updated_at = CURRENT_TIMESTAMP
       WHERE kegiatan_id = ? 
       AND (kegiatan_rangkaian_id = ? OR (kegiatan_rangkaian_id IS NULL AND ? IS NULL))
       AND tanggal_absensi = ?`,
      [kegiatan_id, kegiatan_rangkaian_id, kegiatan_rangkaian_id, tanggal_absensi]
    );

    return NextResponse.json({
      success: true,
      message: `Berhasil reset absensi, ${(result as any).affectedRows} record direset`,
      data: {
        affected_rows: (result as any).affectedRows
      }
    });

  } catch (error: any) {
    console.error('Reset Absensi Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error resetting absensi', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}