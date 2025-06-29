// app/api/konsumsi/edit/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db, RowDataPacket } from '@/lib/db';

interface KonsumsiDetailRow extends RowDataPacket {
  id: number;
  panitia_id: number;
  kegiatan_id: number;
  kegiatan_rangkaian_id: number | null;
  tanggal_konsumsi: string;
  jenis_konsumsi: 'konsumsi_1' | 'konsumsi_2';
  status_pengambilan: 'sudah_diambil' | 'belum_diambil';
  waktu_pengambilan: string | null;
  metode_konfirmasi: string | null;
  catatan: string | null;
  petugas_konfirmasi: string | null;
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

// GET - Ambil detail konsumsi berdasarkan NIM (parameter id = NIM)
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
    
    console.log(`🔍 GET /api/konsumsi/edit/${nimParam} (NIM) - kegiatan_id: ${kegiatan_id}, tanggal: ${tanggal}`);
    
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
    
    // Cek apakah panitia berhak konsumsi di kegiatan ini
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

    // 4. KEEMPAT: Cari record konsumsi yang sudah ada
    let query = `
      SELECT 
        k.id,
        k.panitia_id,
        k.kegiatan_id,
        k.kegiatan_rangkaian_id,
        k.tanggal_konsumsi,
        k.jenis_konsumsi,
        k.status_pengambilan,
        k.waktu_pengambilan,
        k.metode_konfirmasi,
        k.catatan,
        k.petugas_konfirmasi,
        p.nim,
        p.nama_lengkap,
        p.divisi,
        p.unique_id,
        kg.nama as kegiatan_nama,
        kr.judul as rangkaian_judul
      FROM absensi_konsumsi k
      INNER JOIN panitia_peserta p ON k.panitia_id = p.id
      INNER JOIN kegiatan kg ON k.kegiatan_id = kg.id
      LEFT JOIN kegiatan_rangkaian kr ON k.kegiatan_rangkaian_id = kr.id
      WHERE p.nim = ? 
        AND k.kegiatan_id = ? 
        AND k.tanggal_konsumsi = ?
        AND (k.kegiatan_rangkaian_id = ? OR (k.kegiatan_rangkaian_id IS NULL AND ? IS NULL))
      ORDER BY k.jenis_konsumsi ASC
    `;

    const queryParams = [
      nimParam,
      kegiatan_id,
      formattedDate,
      kegiatan_rangkaian_id,
      kegiatan_rangkaian_id
    ];

    let [rows] = await db.execute<KonsumsiDetailRow[]>(query, queryParams);

    // Jika belum ada record konsumsi, buat baru untuk kedua jenis
    if (rows.length === 0) {
      console.log(`📝 Creating new konsumsi records for NIM: ${nimParam}`);
      
      try {
        // Insert konsumsi_1 dan konsumsi_2 baru dengan status default "belum_diambil"
        const jenisKonsumsiList = ['konsumsi_1', 'konsumsi_2'];
        
        for (const jenisKonsumsi of jenisKonsumsiList) {
          await db.execute(
            `INSERT INTO absensi_konsumsi 
             (panitia_id, kegiatan_id, kegiatan_rangkaian_id, tanggal_konsumsi, jenis_konsumsi, status_pengambilan, metode_konfirmasi, created_by)
             VALUES (?, ?, ?, ?, ?, 'belum_diambil', 'Manual', 'system_auto_nim')`,
            [
              panitia.id, 
              kegiatan_id, 
              kegiatan_rangkaian_id || null, 
              formattedDate,
              jenisKonsumsi
            ]
          );
        }

        console.log(`✅ Created new konsumsi records for ${panitia.nama_lengkap}`);

        // Fetch the newly created records
        [rows] = await db.execute<KonsumsiDetailRow[]>(query, queryParams);
      } catch (insertError: any) {
        console.error('❌ Error creating konsumsi records:', insertError);
        return NextResponse.json(
          { 
            success: false, 
            message: 'Gagal membuat record konsumsi baru',
            error: insertError.message 
          },
          { status: 500 }
        );
      }
    }

    // Pastikan ada kedua jenis konsumsi (jika hanya ada 1, buat yang missing)
    const existingJenis = rows.map(r => r.jenis_konsumsi);
    const missingJenis = ['konsumsi_1', 'konsumsi_2'].filter(j => !existingJenis.includes(j as any));
    
    if (missingJenis.length > 0) {
      console.log(`📝 Creating missing konsumsi types: ${missingJenis.join(', ')} for NIM: ${nimParam}`);
      
      try {
        for (const jenisKonsumsi of missingJenis) {
          await db.execute(
            `INSERT INTO absensi_konsumsi 
             (panitia_id, kegiatan_id, kegiatan_rangkaian_id, tanggal_konsumsi, jenis_konsumsi, status_pengambilan, metode_konfirmasi, created_by)
             VALUES (?, ?, ?, ?, ?, 'belum_diambil', 'Manual', 'system_auto_complete')`,
            [
              panitia.id, 
              kegiatan_id, 
              kegiatan_rangkaian_id || null, 
              formattedDate,
              jenisKonsumsi
            ]
          );
        }

        // Fetch the complete records
        [rows] = await db.execute<KonsumsiDetailRow[]>(query, queryParams);
      } catch (insertError: any) {
        console.error('❌ Error creating missing konsumsi records:', insertError);
        return NextResponse.json(
          { 
            success: false, 
            message: 'Gagal melengkapi record konsumsi',
            error: insertError.message 
          },
          { status: 500 }
        );
      }
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Gagal mengambil data konsumsi setelah pembuatan record' },
        { status: 500 }
      );
    }

    console.log(`✅ Found/Created ${rows.length} konsumsi records for ${rows[0].nama_lengkap} (NIM: ${rows[0].nim})`);

    // 5. KELIMA: Format response data
    const konsumsi1 = rows.find(r => r.jenis_konsumsi === 'konsumsi_1');
    const konsumsi2 = rows.find(r => r.jenis_konsumsi === 'konsumsi_2');

    const responseData = {
      panitia_id: panitia.id,
      kegiatan_id: parseInt(kegiatan_id),
      kegiatan_rangkaian_id: kegiatan_rangkaian_id ? parseInt(kegiatan_rangkaian_id) : null,
      nim: panitia.nim,
      nama_lengkap: panitia.nama_lengkap,
      divisi: panitia.divisi,
      unique_id: panitia.unique_id,
      tanggal_konsumsi: formattedDate,
      kegiatan_nama: rows[0].kegiatan_nama,
      rangkaian_nama: rows[0].rangkaian_judul,
      konsumsi_1_status: konsumsi1?.status_pengambilan || 'belum_diambil',
      konsumsi_2_status: konsumsi2?.status_pengambilan || 'belum_diambil',
      konsumsi_1_waktu: konsumsi1?.waktu_pengambilan ? 
        new Date(konsumsi1.waktu_pengambilan).toLocaleTimeString('id-ID', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }) : null,
      konsumsi_2_waktu: konsumsi2?.waktu_pengambilan ? 
        new Date(konsumsi2.waktu_pengambilan).toLocaleTimeString('id-ID', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }) : null,
      konsumsi_1_id: konsumsi1?.id || null,
      konsumsi_2_id: konsumsi2?.id || null
    };

    return NextResponse.json({
      success: true,
      data: responseData,
      message: `Data konsumsi berhasil ditemukan untuk NIM ${nimParam}`
    });

  } catch (error: any) {
    console.error('❌ GET Konsumsi Detail by NIM Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error fetching konsumsi detail by NIM', 
        error: error?.message || 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// PUT - Update konsumsi berdasarkan NIM (parameter id = NIM)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const nimParam = params.id; // Parameter [id] yang berisi NIM
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    
    const { 
      konsumsi_1_status,
      konsumsi_2_status,
      catatan = null,
      petugas = 'admin_edit'
    } = body;

    const kegiatan_id = searchParams.get('kegiatan_id');
    const kegiatan_rangkaian_id = searchParams.get('kegiatan_rangkaian_id');
    const tanggal = searchParams.get('tanggal');

    console.log(`📝 PUT /api/konsumsi/edit/${nimParam} (NIM) - Updating konsumsi status`);

    // Validasi parameter wajib
    if (!nimParam) {
      return NextResponse.json(
        { success: false, message: 'Parameter NIM diperlukan' },
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

    // 2. Cari existing konsumsi records berdasarkan panitia.id dan parameter lainnya
    const [existingKonsumsi] = await db.execute<RowDataPacket[]>(
      `SELECT k.id, k.jenis_konsumsi, k.status_pengambilan
       FROM absensi_konsumsi k
       INNER JOIN panitia_peserta p ON k.panitia_id = p.id
       WHERE p.nim = ? 
         AND k.kegiatan_id = ? 
         AND k.tanggal_konsumsi = ?
         AND (k.kegiatan_rangkaian_id = ? OR (k.kegiatan_rangkaian_id IS NULL AND ? IS NULL))
       ORDER BY k.jenis_konsumsi ASC`,
      [
        nimParam,
        kegiatan_id,
        formattedDate,
        kegiatan_rangkaian_id,
        kegiatan_rangkaian_id
      ]
    );

    if (existingKonsumsi.length === 0) {
      return NextResponse.json(
        { success: false, message: `Data konsumsi untuk NIM ${nimParam} tidak ditemukan. Silakan akses halaman edit terlebih dahulu untuk membuat record.` },
        { status: 404 }
      );
    }

    // Pisahkan record berdasarkan jenis konsumsi
    const konsumsi1Record = existingKonsumsi.find(k => k.jenis_konsumsi === 'konsumsi_1');
    const konsumsi2Record = existingKonsumsi.find(k => k.jenis_konsumsi === 'konsumsi_2');

    if (!konsumsi1Record || !konsumsi2Record) {
      return NextResponse.json(
        { success: false, message: 'Data konsumsi tidak lengkap (missing konsumsi_1 atau konsumsi_2)' },
        { status: 400 }
      );
    }

    // Store previous status for response
    const previousStatus = {
      konsumsi_1: konsumsi1Record.status_pengambilan,
      konsumsi_2: konsumsi2Record.status_pengambilan
    };

    // 3. Begin transaction untuk update kedua jenis konsumsi
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      // Update konsumsi_1
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
        [konsumsi_1_status, waktu1, catatan, petugas, konsumsi1Record.id]
      );

      // Update konsumsi_2
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
        [konsumsi_2_status, waktu2, catatan, petugas, konsumsi2Record.id]
      );

      await connection.commit();

      console.log(`✅ Updated konsumsi for NIM: ${nimParam} - konsumsi_1: ${previousStatus.konsumsi_1} → ${konsumsi_1_status}, konsumsi_2: ${previousStatus.konsumsi_2} → ${konsumsi_2_status}`);

    } catch (updateError: any) {
      await connection.rollback();
      console.error('❌ Error updating konsumsi:', updateError);
      return NextResponse.json(
        { 
          success: false, 
          message: 'Gagal memperbarui data konsumsi',
          error: updateError.message 
        },
        { status: 500 }
      );
    } finally {
      connection.release();
    }

    return NextResponse.json({
      success: true,
      message: `Status konsumsi untuk ${panitia.nama_lengkap} (NIM: ${nimParam}) berhasil diperbarui`,
      data: {
        panitia_id: panitia.id,
        kegiatan_id: parseInt(kegiatan_id),
        kegiatan_rangkaian_id: kegiatan_rangkaian_id ? parseInt(kegiatan_rangkaian_id) : null,
        tanggal_konsumsi: formattedDate,
        konsumsi_1_status,
        konsumsi_2_status,
        previous_status: previousStatus,
        panitia: {
          nim: panitia.nim,
          nama_lengkap: panitia.nama_lengkap,
          divisi: panitia.divisi
        }
      }
    });

  } catch (error: any) {
    console.error('❌ PUT Konsumsi Detail by NIM Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error updating konsumsi by NIM', 
        error: error?.message || 'Unknown error' 
      },
      { status: 500 }
    );
  }
}