import { NextRequest, NextResponse } from 'next/server';
import { db, RowDataPacket } from '@/lib/db';

interface KonsumsiDetailRow extends RowDataPacket {
  panitia_id: number;
  nim: string;
  nama_lengkap: string;
  divisi: string;
  kegiatan_nama: string;
  rangkaian_nama: string | null;
  tanggal_konsumsi: string;
  kegiatan_id: number;
  kegiatan_rangkaian_id: number | null;
  konsumsi_1_id: number | null;
  konsumsi_1_status: 'sudah_diambil' | 'belum_diambil' | null;
  konsumsi_1_waktu: string | null;
  konsumsi_2_id: number | null;
  konsumsi_2_status: 'sudah_diambil' | 'belum_diambil' | null;
  konsumsi_2_waktu: string | null;
}

// GET - Ambil detail konsumsi berdasarkan absensi.id (jika id adalah absensi_konsumsi.id),
// atau fallback ke panitia_id + kegiatan_id + tanggal + rangkaian
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await context.params; // Await the params promise
    const { searchParams } = new URL(request.url);
    const kegiatan_id = searchParams.get('kegiatan_id');
    const tanggal = searchParams.get('tanggal');
    const kegiatan_rangkaian_id = searchParams.get('kegiatan_rangkaian_id');

    if (!idParam) {
      return NextResponse.json(
        { success: false, message: 'ID diperlukan' },
        { status: 400 }
      );
    }

    // 1. Coba treat idParam sebagai absensi_konsumsi.id
    const [absensiRows] = await db.execute<RowDataPacket[]>(
      `SELECT 
        k1.id as konsumsi_1_id,
        k1.panitia_id,
        p.nim,
        p.nama_lengkap,
        p.divisi,
        k1.kegiatan_id,
        k.nama as kegiatan_nama,
        k1.kegiatan_rangkaian_id,
        kr.judul as rangkaian_nama,
        k1.tanggal_konsumsi,
        k1.status_pengambilan as konsumsi_1_status,
        k1.waktu_pengambilan as konsumsi_1_waktu,
        k2.id as konsumsi_2_id,
        k2.status_pengambilan as konsumsi_2_status,
        k2.waktu_pengambilan as konsumsi_2_waktu
      FROM absensi_konsumsi k1
      LEFT JOIN absensi_konsumsi k2 ON (
        k1.panitia_id = k2.panitia_id
        AND k1.kegiatan_id = k2.kegiatan_id
        AND (k1.kegiatan_rangkaian_id = k2.kegiatan_rangkaian_id OR (k1.kegiatan_rangkaian_id IS NULL AND k2.kegiatan_rangkaian_id IS NULL))
        AND k1.tanggal_konsumsi = k2.tanggal_konsumsi
        AND k2.jenis_konsumsi = 'konsumsi_2'
      )
      LEFT JOIN panitia_peserta p ON k1.panitia_id = p.id
      LEFT JOIN kegiatan k ON k1.kegiatan_id = k.id
      LEFT JOIN kegiatan_rangkaian kr ON k1.kegiatan_rangkaian_id = kr.id
      WHERE k1.id = ? AND k1.jenis_konsumsi = 'konsumsi_1'
      LIMIT 1`,
      [idParam]
    );
    if (absensiRows.length > 0) {
      const data = absensiRows[0];
      const formattedData = {
        panitia_id: data.panitia_id,
        nim: data.nim,
        nama_lengkap: data.nama_lengkap,
        divisi: data.divisi,
        kegiatan_id: data.kegiatan_id,
        kegiatan_nama: data.kegiatan_nama,
        kegiatan_rangkaian_id: data.kegiatan_rangkaian_id,
        rangkaian_nama: data.rangkaian_nama,
        tanggal_konsumsi: data.tanggal_konsumsi,
        konsumsi_1_status: data.konsumsi_1_status || 'belum_diambil',
        konsumsi_2_status: data.konsumsi_2_status || 'belum_diambil',
        konsumsi_1_waktu: data.konsumsi_1_waktu ? new Date(data.konsumsi_1_waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : null,
        konsumsi_2_waktu: data.konsumsi_2_waktu ? new Date(data.konsumsi_2_waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : null
      };
      return NextResponse.json({ success: true, data: formattedData });
    }

    // 2. Fallback: treat idParam as panitia_id (lama)
    if (!kegiatan_id || !tanggal) {
      return NextResponse.json(
        { success: false, message: 'kegiatan_id dan tanggal diperlukan jika bukan absensi.id' },
        { status: 400 }
      );
    }
    // Query detail konsumsi spesifik event/tanggal/rangkaian
    const [rows] = await db.execute<KonsumsiDetailRow[]>(
      `SELECT 
        p.id as panitia_id,
        p.nim,
        p.nama_lengkap,
        p.divisi,
        k.id as kegiatan_id,
        k.nama as kegiatan_nama,
        kr.id as kegiatan_rangkaian_id,
        kr.judul as rangkaian_nama,
        k1.id as konsumsi_1_id,
        k1.status_pengambilan as konsumsi_1_status,
        k1.waktu_pengambilan as konsumsi_1_waktu,
        k1.tanggal_konsumsi,
        k2.id as konsumsi_2_id,
        k2.status_pengambilan as konsumsi_2_status,
        k2.waktu_pengambilan as konsumsi_2_waktu
      FROM panitia_peserta p
      LEFT JOIN absensi_konsumsi k1 ON (
        p.id = k1.panitia_id AND k1.jenis_konsumsi = 'konsumsi_1'
        AND k1.kegiatan_id = ?
        AND k1.tanggal_konsumsi = ?
        AND (k1.kegiatan_rangkaian_id = ? OR (k1.kegiatan_rangkaian_id IS NULL AND ? IS NULL))
      )
      LEFT JOIN absensi_konsumsi k2 ON (
        p.id = k2.panitia_id AND k2.jenis_konsumsi = 'konsumsi_2'
        AND k2.kegiatan_id = ?
        AND k2.tanggal_konsumsi = ?
        AND (k2.kegiatan_rangkaian_id = ? OR (k2.kegiatan_rangkaian_id IS NULL AND ? IS NULL))
      )
      LEFT JOIN kegiatan k ON k1.kegiatan_id = k.id
      LEFT JOIN kegiatan_rangkaian kr ON k1.kegiatan_rangkaian_id = kr.id
      WHERE p.id = ? AND p.is_active = 1
      LIMIT 1
    `, [
      kegiatan_id, tanggal, kegiatan_rangkaian_id, kegiatan_rangkaian_id,
      kegiatan_id, tanggal, kegiatan_rangkaian_id, kegiatan_rangkaian_id,
      idParam
    ]);
    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Data konsumsi panitia tidak ditemukan' },
        { status: 404 }
      );
    }
    const data = rows[0];
    const formattedData = {
      panitia_id: data.panitia_id,
      nim: data.nim,
      nama_lengkap: data.nama_lengkap,
      divisi: data.divisi,
      kegiatan_id: data.kegiatan_id,
      kegiatan_nama: data.kegiatan_nama,
      kegiatan_rangkaian_id: data.kegiatan_rangkaian_id,
      rangkaian_nama: data.rangkaian_nama,
      tanggal_konsumsi: data.tanggal_konsumsi,
      konsumsi_1_status: data.konsumsi_1_status || 'belum_diambil',
      konsumsi_2_status: data.konsumsi_2_status || 'belum_diambil',
      konsumsi_1_waktu: data.konsumsi_1_waktu ? new Date(data.konsumsi_1_waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : null,
      konsumsi_2_waktu: data.konsumsi_2_waktu ? new Date(data.konsumsi_2_waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : null
    };
    return NextResponse.json({ success: true, data: formattedData });
  } catch (error: unknown) {
    console.error('GET Konsumsi Detail Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error fetching konsumsi detail', error: (error as Error)?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT - Update status konsumsi (kedua jenis sekaligus, spesifik event/tanggal/rangkaian)
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: panitiaId } = await context.params; // Await the params promise
    const { searchParams } = new URL(request.url);
    const kegiatan_id = searchParams.get('kegiatan_id');
    const tanggal = searchParams.get('tanggal');
    const kegiatan_rangkaian_id = searchParams.get('kegiatan_rangkaian_id');
    const body = await request.json();
    const { 
      konsumsi_1_status,
      konsumsi_2_status,
      catatan = null,
      petugas = 'admin'
    } = body;

    if (!panitiaId || !kegiatan_id || !tanggal) {
      return NextResponse.json(
        { success: false, message: 'ID panitia, kegiatan_id, dan tanggal diperlukan' },
        { status: 400 }
      );
    }
    if (!konsumsi_1_status || !konsumsi_2_status) {
      return NextResponse.json(
        { success: false, message: 'Status konsumsi_1 dan konsumsi_2 harus diisi' },
        { status: 400 }
      );
    }
    if (!['sudah_diambil', 'belum_diambil'].includes(konsumsi_1_status) || 
        !['sudah_diambil', 'belum_diambil'].includes(konsumsi_2_status)) {
      return NextResponse.json(
        { success: false, message: 'Status harus sudah_diambil atau belum_diambil' },
        { status: 400 }
      );
    }
    // Get existing konsumsi data untuk panitia ini (spesifik event/tanggal/rangkaian)
    const [existingRows] = await db.execute<RowDataPacket[]>(`
      SELECT 
        k1.id as konsumsi_1_id,
        k1.kegiatan_id,
        k1.kegiatan_rangkaian_id,
        k1.tanggal_konsumsi,
        k1.status_pengambilan as konsumsi_1_current_status,
        k2.id as konsumsi_2_id,
        k2.status_pengambilan as konsumsi_2_current_status
      FROM absensi_konsumsi k1
      LEFT JOIN absensi_konsumsi k2 ON (
        k1.panitia_id = k2.panitia_id 
        AND k1.kegiatan_id = k2.kegiatan_id
        AND (k1.kegiatan_rangkaian_id = k2.kegiatan_rangkaian_id 
             OR (k1.kegiatan_rangkaian_id IS NULL AND k2.kegiatan_rangkaian_id IS NULL))
        AND k1.tanggal_konsumsi = k2.tanggal_konsumsi
        AND k2.jenis_konsumsi = 'konsumsi_2'
      )
      WHERE k1.panitia_id = ? AND k1.jenis_konsumsi = 'konsumsi_1'
        AND k1.kegiatan_id = ?
        AND k1.tanggal_konsumsi = ?
        AND (k1.kegiatan_rangkaian_id = ? OR (k1.kegiatan_rangkaian_id IS NULL AND ? IS NULL))
      LIMIT 1
    `, [panitiaId, kegiatan_id, tanggal, kegiatan_rangkaian_id, kegiatan_rangkaian_id]);

    if (existingRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Data konsumsi tidak ditemukan untuk panitia ini' },
        { status: 404 }
      );
    }

    const existing = existingRows[0];

    // Begin transaction
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      // Update konsumsi_1
      if (existing.konsumsi_1_id) {
        const waktu1 = konsumsi_1_status === 'sudah_diambil' ? new Date() : null;
        await connection.execute(
          `UPDATE absensi_konsumsi SET 
           status_pengambilan = ?, 
           waktu_pengambilan = ?, 
           metode_konfirmasi = 'Manual',
           catatan = ?,
           petugas_konfirmasi = ?,
           updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [konsumsi_1_status, waktu1, catatan, petugas, existing.konsumsi_1_id]
        );
      }
      // Update atau create konsumsi_2
      if (existing.konsumsi_2_id) {
        const waktu2 = konsumsi_2_status === 'sudah_diambil' ? new Date() : null;
        await connection.execute(
          `UPDATE absensi_konsumsi SET 
           status_pengambilan = ?, 
           waktu_pengambilan = ?, 
           metode_konfirmasi = 'Manual',
           catatan = ?,
           petugas_konfirmasi = ?,
           updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [konsumsi_2_status, waktu2, catatan, petugas, existing.konsumsi_2_id]
        );
      } else {
        // Create new konsumsi_2 record
        const waktu2 = konsumsi_2_status === 'sudah_diambil' ? new Date() : null;
        await connection.execute(
          `INSERT INTO absensi_konsumsi 
           (panitia_id, kegiatan_id, kegiatan_rangkaian_id, tanggal_konsumsi, jenis_konsumsi, status_pengambilan, waktu_pengambilan, metode_konfirmasi, catatan, petugas_konfirmasi)
           VALUES (?, ?, ?, ?, 'konsumsi_2', ?, ?, 'Manual', ?, ?)`,
          [panitiaId, kegiatan_id, kegiatan_rangkaian_id, tanggal, konsumsi_2_status, waktu2, catatan, petugas]
        );
      }
      await connection.commit();
      return NextResponse.json({
        success: true,
        message: 'Status konsumsi berhasil diperbarui',
        data: {
          panitia_id: parseInt(panitiaId),
          konsumsi_1_status,
          konsumsi_2_status,
          previous_konsumsi_1: existing.konsumsi_1_current_status,
          previous_konsumsi_2: existing.konsumsi_2_current_status
        }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error: unknown) {
    console.error('PUT Konsumsi Detail Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error updating konsumsi', error: (error as Error)?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}