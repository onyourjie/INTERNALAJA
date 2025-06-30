// app/api/absensi/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db, RowDataPacket } from '@/lib/db';

interface AbsensiDetailRow extends RowDataPacket {
  id: number;
  panitia_id: number;
  kegiatan_id: number;
  kegiatan_rangkaian_id: number | null;
  tanggal_absensi: string;
  status: 'Hadir' | 'Tidak Hadir' | 'Izin' | 'Sakit';
  waktu_absensi: string | null;
  metode_absensi: 'QR Code' | 'Manual' | 'Fingerprint' | 'Face Recognition';
  koordinat_lat: number | null;
  koordinat_lng: number | null;
  alamat_lokasi: string | null;
  catatan: string | null;
  keterangan: string | null;
  nim: string;
  nama_lengkap: string;
  divisi: string;
  unique_id: string;
  kegiatan_nama: string;
  rangkaian_judul: string | null;
}

interface PanitiaRow extends RowDataPacket {
  id: number;
  nim: string;
  nama_lengkap: string;
  divisi: string;
  unique_id: string;
}

interface KegiatanRow extends RowDataPacket {
  id: number;
  nama: string;
  jenis_rangkaian: 'single' | 'multiple';
  divisi_list: string | null;
}

interface RangkaianRow extends RowDataPacket {
  id: number;
  judul: string;
}

// Utility function untuk format tanggal
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

// GET - Ambil detail absensi berdasarkan NIM (parameter id = NIM)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const nimParam = params.id; // Parameter [id] yang berisi NIM
    const { searchParams } = new URL(request.url);
    const kegiatan_id = searchParams.get('kegiatan_id');
    const kegiatan_rangkaian_id = searchParams.get('kegiatan_rangkaian_id');
    const tanggal = searchParams.get('tanggal');
    
    console.log(`🔍 GET /api/absensi/${nimParam} (NIM) - kegiatan_id: ${kegiatan_id}, tanggal: ${tanggal}`);
    
    // Validasi parameter wajib
    if (!nimParam) {
      return NextResponse.json(
        { success: false, message: 'Parameter NIM diperlukan' },
        { status: 400 }
      );
    }

    if (!kegiatan_id || !tanggal) {
      return NextResponse.json(
        { success: false, message: 'Parameter kegiatan_id dan tanggal diperlukan' },
        { status: 400 }
      );
    }

    // Format tanggal untuk database
    let formattedDate: string;
    try {
      formattedDate = formatDateForDB(tanggal);
    } catch (error: any) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    // 1. PERTAMA: Cari panitia berdasarkan NIM
    const [panitiaRows] = await db.execute<PanitiaRow[]>(
      'SELECT id, nim, nama_lengkap, divisi, unique_id FROM panitia_peserta WHERE nim = ? AND is_active = 1',
      [nimParam]
    );

    if (panitiaRows.length === 0) {
      return NextResponse.json(
        { success: false, message: `Panitia dengan NIM ${nimParam} tidak ditemukan dalam sistem` },
        { status: 404 }
      );
    }

    const panitia = panitiaRows[0];
    console.log(`✅ Found panitia: ${panitia.nama_lengkap} (ID: ${panitia.id}, NIM: ${panitia.nim})`);

    // 2. KEDUA: Validasi kegiatan exists dan panitia berhak ikut
    const [kegiatanRows] = await db.execute<KegiatanRow[]>(
      `SELECT k.id, k.nama, k.jenis_rangkaian,
              GROUP_CONCAT(DISTINCT kd.divisi) as divisi_list
       FROM kegiatan k
       LEFT JOIN kegiatan_divisi kd ON k.id = kd.kegiatan_id AND kd.is_active = 1
       WHERE k.id = ? AND k.is_active = 1
       GROUP BY k.id`,
      [kegiatan_id]
    );

    if (kegiatanRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Kegiatan tidak ditemukan atau tidak aktif' },
        { status: 404 }
      );
    }

    const kegiatan = kegiatanRows[0];
    const divisiList = kegiatan.divisi_list ? kegiatan.divisi_list.split(',') : [];
    
    // Cek apakah panitia berhak absen di kegiatan ini
    if (divisiList.length > 0 && !divisiList.includes('Semua') && !divisiList.includes(panitia.divisi)) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Divisi ${panitia.divisi} tidak berhak mengikuti kegiatan ${kegiatan.nama}`,
          details: {
            panitia_divisi: panitia.divisi,
            allowed_divisi: divisiList,
            kegiatan_nama: kegiatan.nama
          }
        },
        { status: 403 }
      );
    }

    // 3. KETIGA: Validasi rangkaian jika ada
    if (kegiatan_rangkaian_id && kegiatan_rangkaian_id !== 'null') {
      const [rangkaianRows] = await db.execute<RangkaianRow[]>(
        'SELECT id, judul FROM kegiatan_rangkaian WHERE id = ? AND kegiatan_id = ? AND is_active = 1',
        [kegiatan_rangkaian_id, kegiatan_id]
      );

      if (rangkaianRows.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Rangkaian kegiatan tidak ditemukan atau tidak aktif' },
          { status: 404 }
        );
      }
    }

    // 4. KEEMPAT: Cari atau buat record absensi
    let query = `
      SELECT 
        a.id,
        a.panitia_id,
        a.kegiatan_id,
        a.kegiatan_rangkaian_id,
        a.tanggal_absensi,
        a.status,
        a.waktu_absensi,
        a.metode_absensi,
        a.koordinat_lat,
        a.koordinat_lng,
        a.alamat_lokasi,
        a.catatan,
        a.keterangan,
        p.nim,
        p.nama_lengkap,
        p.divisi,
        p.unique_id,
        k.nama as kegiatan_nama,
        kr.judul as rangkaian_judul
      FROM absensi a
      INNER JOIN panitia_peserta p ON a.panitia_id = p.id
      INNER JOIN kegiatan k ON a.kegiatan_id = k.id
      LEFT JOIN kegiatan_rangkaian kr ON a.kegiatan_rangkaian_id = kr.id
      WHERE p.nim = ? 
        AND a.kegiatan_id = ? 
        AND a.tanggal_absensi = ?
        AND (a.kegiatan_rangkaian_id = ? OR (a.kegiatan_rangkaian_id IS NULL AND ? IS NULL))
      LIMIT 1
    `;

    const queryParams = [
      nimParam,
      kegiatan_id,
      formattedDate,
      kegiatan_rangkaian_id,
      kegiatan_rangkaian_id
    ];

    let [rows] = await db.execute<AbsensiDetailRow[]>(query, queryParams);

    // Jika belum ada record absensi, buat baru
    if (rows.length === 0) {
      console.log(`📝 Creating new absensi record for NIM: ${nimParam}`);
      
      try {
        // Insert absensi baru dengan status default "Tidak Hadir"
        const [insertResult] = await db.execute(
          `INSERT INTO absensi 
           (panitia_id, kegiatan_id, kegiatan_rangkaian_id, tanggal_absensi, status, metode_absensi, created_by)
           VALUES (?, ?, ?, ?, 'Tidak Hadir', 'Manual', 'system_auto_nim')`,
          [
            panitia.id, 
            kegiatan_id, 
            kegiatan_rangkaian_id || null, 
            formattedDate
          ]
        );

        const newAbsensiId = (insertResult as any).insertId;
        console.log(`✅ Created new absensi record with ID: ${newAbsensiId} for ${panitia.nama_lengkap}`);

        // Fetch the newly created record
        [rows] = await db.execute<AbsensiDetailRow[]>(query, queryParams);
      } catch (insertError: any) {
        console.error('❌ Error creating absensi record:', insertError);
        return NextResponse.json(
          { 
            success: false, 
            message: 'Gagal membuat record absensi baru',
            error: insertError.message 
          },
          { status: 500 }
        );
      }
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Gagal mengambil data absensi setelah pembuatan record' },
        { status: 500 }
      );
    }

    const absensi = rows[0];
    console.log(`✅ Found/Created absensi record ID: ${absensi.id} for ${absensi.nama_lengkap} (NIM: ${absensi.nim})`);

    // 5. KELIMA: Format response data
    const responseData = {
      id: absensi.id, // absensi.id
      panitia_id: absensi.panitia_id,
      kegiatan_id: absensi.kegiatan_id,
      kegiatan_rangkaian_id: absensi.kegiatan_rangkaian_id,
      nim: absensi.nim,
      nama_lengkap: absensi.nama_lengkap,
      divisi: absensi.divisi,
      unique_id: absensi.unique_id,
      kehadiran: absensi.status, // untuk compatibility dengan interface PanitiaData
      status: absensi.status,
      tanggal_absensi: absensi.tanggal_absensi,
      waktu_hadir: absensi.waktu_absensi ? 
        new Date(absensi.waktu_absensi).toLocaleTimeString('id-ID', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }) : '-',
      waktu_absensi: absensi.waktu_absensi,
      metode_absensi: absensi.metode_absensi,
      koordinat_lat: absensi.koordinat_lat,
      koordinat_lng: absensi.koordinat_lng,
      alamat_lokasi: absensi.alamat_lokasi,
      catatan: absensi.catatan,
      keterangan: absensi.keterangan,
      kegiatan_nama: absensi.kegiatan_nama,
      rangkaian_judul: absensi.rangkaian_judul
    };

    return NextResponse.json({
      success: true,
      data: responseData,
      message: `Data absensi berhasil ditemukan untuk NIM ${nimParam}`
    });

  } catch (error: any) {
    console.error('❌ GET Absensi Detail by NIM Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error fetching absensi detail by NIM', 
        error: error?.message || 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// PUT - Update absensi berdasarkan NIM (parameter id = NIM)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const nimParam = params.id; // Parameter [id] yang berisi NIM
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    
    const { 
      status, 
      waktu_absensi = null,
      catatan = null,
      keterangan = null,
      metode_absensi = 'Manual'
    } = body;

    const kegiatan_id = searchParams.get('kegiatan_id');
    const kegiatan_rangkaian_id = searchParams.get('kegiatan_rangkaian_id');
    const tanggal = searchParams.get('tanggal');

    console.log(`📝 PUT /api/absensi/${nimParam} (NIM) - Updating to status: ${status}`);

    // Validasi parameter wajib
    if (!nimParam) {
      return NextResponse.json(
        { success: false, message: 'Parameter NIM diperlukan' },
        { status: 400 }
      );
    }

    if (!status || !['Hadir', 'Tidak Hadir', 'Izin', 'Sakit'].includes(status)) {
      return NextResponse.json(
        { success: false, message: 'Status harus salah satu dari: Hadir, Tidak Hadir, Izin, atau Sakit' },
        { status: 400 }
      );
    }

    if (!kegiatan_id || !tanggal) {
      return NextResponse.json(
        { success: false, message: 'Parameter kegiatan_id dan tanggal diperlukan' },
        { status: 400 }
      );
    }

    // Format tanggal untuk database
    let formattedDate: string;
    try {
      formattedDate = formatDateForDB(tanggal);
    } catch (error: any) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    // 1. Cari panitia berdasarkan NIM
    const [panitiaRows] = await db.execute<PanitiaRow[]>(
      'SELECT id, nim, nama_lengkap, divisi FROM panitia_peserta WHERE nim = ? AND is_active = 1',
      [nimParam]
    );

    if (panitiaRows.length === 0) {
      return NextResponse.json(
        { success: false, message: `Panitia dengan NIM ${nimParam} tidak ditemukan dalam sistem` },
        { status: 404 }
      );
    }

    const panitia = panitiaRows[0];

    // 2. Cari absensi record berdasarkan panitia.id dan parameter lainnya
    const [existingAbsensi] = await db.execute<RowDataPacket[]>(
      `SELECT a.id, a.status, a.panitia_id, a.kegiatan_id, a.kegiatan_rangkaian_id, a.tanggal_absensi,
              p.nim, p.nama_lengkap, p.divisi
       FROM absensi a
       INNER JOIN panitia_peserta p ON a.panitia_id = p.id
       WHERE p.nim = ? 
         AND a.kegiatan_id = ? 
         AND a.tanggal_absensi = ?
         AND (a.kegiatan_rangkaian_id = ? OR (a.kegiatan_rangkaian_id IS NULL AND ? IS NULL))`,
      [
        nimParam,
        kegiatan_id,
        formattedDate,
        kegiatan_rangkaian_id,
        kegiatan_rangkaian_id
      ]
    );

    if (existingAbsensi.length === 0) {
      return NextResponse.json(
        { success: false, message: `Data absensi untuk NIM ${nimParam} tidak ditemukan. Silakan akses halaman edit terlebih dahulu untuk membuat record.` },
        { status: 404 }
      );
    }

    const absensiRecord = existingAbsensi[0];
    const previousStatus = absensiRecord.status;

    // 3. Set waktu_absensi otomatis jika status berubah ke Hadir dan belum ada waktu
    let finalWaktuAbsensi = waktu_absensi;
    if (status === 'Hadir' && !finalWaktuAbsensi) {
      finalWaktuAbsensi = new Date();
    } else if (status !== 'Hadir') {
      finalWaktuAbsensi = null; // Reset waktu jika tidak hadir
    }

    // 4. Update absensi menggunakan absensi.id
    try {
      await db.execute(
        `UPDATE absensi SET 
         status = ?, 
         waktu_absensi = ?, 
         metode_absensi = ?,
         catatan = ?,
         keterangan = ?,
         updated_at = CURRENT_TIMESTAMP,
         updated_by = 'admin_edit_nim'
         WHERE id = ?`,
        [status, finalWaktuAbsensi, metode_absensi, catatan, keterangan, absensiRecord.id]
      );
    } catch (updateError: any) {
      console.error('❌ Error updating absensi:', updateError);
      return NextResponse.json(
        { 
          success: false, 
          message: 'Gagal memperbarui data absensi',
          error: updateError.message 
        },
        { status: 500 }
      );
    }

    console.log(`✅ Updated absensi ID: ${absensiRecord.id} for NIM: ${nimParam} from "${previousStatus}" to "${status}"`);

    // 5. Get updated data untuk response
    const [updatedData] = await db.execute<RowDataPacket[]>(
      `SELECT 
        a.id, a.panitia_id, a.status, a.waktu_absensi, a.metode_absensi,
        a.kegiatan_id, a.kegiatan_rangkaian_id, a.tanggal_absensi,
        a.catatan, a.keterangan,
        p.nim, p.nama_lengkap, p.divisi
       FROM absensi a
       INNER JOIN panitia_peserta p ON a.panitia_id = p.id
       WHERE a.id = ?`,
      [absensiRecord.id]
    );

    return NextResponse.json({
      success: true,
      message: `Status absensi untuk ${updatedData[0]?.nama_lengkap} (NIM: ${nimParam}) berhasil diubah dari "${previousStatus}" menjadi "${status}"`,
      data: {
        id: updatedData[0].id,
        panitia_id: updatedData[0].panitia_id,
        kegiatan_id: updatedData[0].kegiatan_id,
        kegiatan_rangkaian_id: updatedData[0].kegiatan_rangkaian_id,
        tanggal_absensi: updatedData[0].tanggal_absensi,
        status: updatedData[0].status,
        waktu_absensi: updatedData[0].waktu_absensi,
        metode_absensi: updatedData[0].metode_absensi,
        catatan: updatedData[0].catatan,
        keterangan: updatedData[0].keterangan,
        previous_status: previousStatus,
        panitia: {
          nim: updatedData[0].nim,
          nama_lengkap: updatedData[0].nama_lengkap,
          divisi: updatedData[0].divisi
        }
      }
    });

  } catch (error: any) {
    console.error('❌ PUT Absensi Detail by NIM Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error updating absensi by NIM', 
        error: error?.message || 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// DELETE - Hapus absensi berdasarkan NIM (parameter id = NIM)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const nimParam = params.id; // Parameter [id] yang berisi NIM
    const { searchParams } = new URL(request.url);
    
    const kegiatan_id = searchParams.get('kegiatan_id');
    const kegiatan_rangkaian_id = searchParams.get('kegiatan_rangkaian_id');
    const tanggal = searchParams.get('tanggal');

    console.log(`🗑️ DELETE /api/absensi/${nimParam} (NIM)`);

    // Validasi parameter wajib
    if (!nimParam) {
      return NextResponse.json(
        { success: false, message: 'Parameter NIM diperlukan' },
        { status: 400 }
      );
    }

    if (!kegiatan_id || !tanggal) {
      return NextResponse.json(
        { success: false, message: 'Parameter kegiatan_id dan tanggal diperlukan' },
        { status: 400 }
      );
    }

    // Format tanggal untuk database
    let formattedDate: string;
    try {
      formattedDate = formatDateForDB(tanggal);
    } catch (error: any) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    // 1. Cari absensi record berdasarkan NIM
    const [existingAbsensi] = await db.execute<RowDataPacket[]>(
      `SELECT a.id, a.panitia_id, a.status, p.nim, p.nama_lengkap, p.divisi
       FROM absensi a
       INNER JOIN panitia_peserta p ON a.panitia_id = p.id
       WHERE p.nim = ? 
         AND a.kegiatan_id = ? 
         AND a.tanggal_absensi = ?
         AND (a.kegiatan_rangkaian_id = ? OR (a.kegiatan_rangkaian_id IS NULL AND ? IS NULL))`,
      [
        nimParam,
        kegiatan_id,
        formattedDate,
        kegiatan_rangkaian_id,
        kegiatan_rangkaian_id
      ]
    );

    if (existingAbsensi.length === 0) {
      return NextResponse.json(
        { success: false, message: `Data absensi untuk NIM ${nimParam} tidak ditemukan` },
        { status: 404 }
      );
    }

    const absensiRecord = existingAbsensi[0];

    // 2. Delete absensi menggunakan absensi.id
    try {
      await db.execute('DELETE FROM absensi WHERE id = ?', [absensiRecord.id]);
    } catch (deleteError: any) {
      console.error('❌ Error deleting absensi:', deleteError);
      return NextResponse.json(
        { 
          success: false, 
          message: 'Gagal menghapus data absensi',
          error: deleteError.message 
        },
        { status: 500 }
      );
    }

    console.log(`✅ Deleted absensi record ID: ${absensiRecord.id} for NIM: ${nimParam}`);

    return NextResponse.json({
      success: true,
      message: `Data absensi untuk ${absensiRecord.nama_lengkap} (NIM: ${nimParam}) berhasil dihapus`,
      data: {
        deleted_absensi_id: absensiRecord.id,
        panitia_id: absensiRecord.panitia_id,
        nim: nimParam,
        nama_lengkap: absensiRecord.nama_lengkap,
        divisi: absensiRecord.divisi,
        previous_status: absensiRecord.status
      }
    });

  } catch (error: any) {
    console.error('❌ DELETE Absensi Detail by NIM Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error deleting absensi by NIM', 
        error: error?.message || 'Unknown error' 
      },
      { status: 500 }
    );
  }
}