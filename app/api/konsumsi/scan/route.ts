/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/konsumsi/scan/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db, RowDataPacket } from "@/lib/db";

interface PanitiaRow extends RowDataPacket {
  id: number;
  nama_lengkap: string;
  nim: string;
  divisi: string;
  is_active: number;
}

interface KegiatanRow extends RowDataPacket {
  id: number;
  nama: string;
  status: string;
  is_active: number;
}

interface KonsumsiExistingRow extends RowDataPacket {
  jenis_konsumsi: 'konsumsi_1' | 'konsumsi_2';
  status_pengambilan: 'belum_diambil' | 'sudah_diambil';
}

interface DivisiAllowedRow extends RowDataPacket {
  divisi: string;
  is_wajib: number;
}

export async function POST(request: NextRequest) {
  const connection = await db.getConnection();
  
  try {
    console.log('🍽️ KONSUMSI SCAN API - Starting request processing');
    
    // Parse request body
    const body = await request.json();
    const { 
      qr_data, 
      kegiatan_id, 
      kegiatan_rangkaian_id = null, 
      jenis_konsumsi, 
      tanggal 
    } = body;

    console.log('📋 Request data:', { 
      kegiatan_id, 
      kegiatan_rangkaian_id, 
      jenis_konsumsi, 
      tanggal,
      qr_preview: qr_data?.substring(0, 50) + '...'
    });

    // Validasi parameter wajib
    if (!qr_data || !kegiatan_id || !jenis_konsumsi || !tanggal) {
      return NextResponse.json(
        { 
          success: false, 
          message: "Parameter qr_data, kegiatan_id, jenis_konsumsi, dan tanggal diperlukan" 
        },
        { status: 400 }
      );
    }

    // Validasi jenis_konsumsi
    if (!['konsumsi_1', 'konsumsi_2'].includes(jenis_konsumsi)) {
      return NextResponse.json(
        { 
          success: false, 
          message: "jenis_konsumsi harus 'konsumsi_1' atau 'konsumsi_2'" 
        },
        { status: 400 }
      );
    }

    // Parse QR data
    let panitiaData: { nama: string; nim: string; divisi: string };
    try {
      panitiaData = JSON.parse(qr_data);
      if (!panitiaData.nama || !panitiaData.nim || !panitiaData.divisi) {
        throw new Error("Data QR tidak lengkap");
      }
    } catch (error) {
      console.error('❌ QR Parse Error:', error);
      return NextResponse.json(
        { 
          success: false, 
          message: "Format QR Code tidak valid atau data tidak lengkap" 
        },
        { status: 400 }
      );
    }

    console.log('👤 QR Data parsed:', { 
      nama: panitiaData.nama, 
      nim: panitiaData.nim, 
      divisi: panitiaData.divisi 
    });

    await connection.beginTransaction();

    // 1. Validasi panitia
    const [panitiaRows] = await connection.execute<PanitiaRow[]>(
      "SELECT id, nama_lengkap, nim, divisi, is_active FROM panitia_peserta WHERE nim = ? AND is_active = 1",
      [panitiaData.nim.toUpperCase()]
    );

    if (panitiaRows.length === 0) {
      await connection.rollback();
      console.log('❌ Panitia not found for NIM:', panitiaData.nim);
      return NextResponse.json(
        { 
          success: false, 
          message: `Panitia dengan NIM ${panitiaData.nim} tidak ditemukan atau tidak aktif` 
        },
        { status: 404 }
      );
    }

    const panitia = panitiaRows[0];
    console.log('✅ Panitia found:', { id: panitia.id, nama: panitia.nama_lengkap, divisi: panitia.divisi });

    // 2. Validasi kegiatan
    const [kegiatanRows] = await connection.execute<KegiatanRow[]>(
      "SELECT id, nama, status, is_active FROM kegiatan WHERE id = ? AND is_active = 1",
      [kegiatan_id]
    );

    if (kegiatanRows.length === 0) {
      await connection.rollback();
      console.log('❌ Kegiatan not found for ID:', kegiatan_id);
      return NextResponse.json(
        { 
          success: false, 
          message: `Kegiatan dengan ID ${kegiatan_id} tidak ditemukan atau tidak aktif` 
        },
        { status: 404 }
      );
    }

    const kegiatan = kegiatanRows[0];
    console.log('✅ Kegiatan found:', { id: kegiatan.id, nama: kegiatan.nama });

    // 3. Validasi divisi yang diizinkan untuk kegiatan ini
    const [divisiRows] = await connection.execute<DivisiAllowedRow[]>(
      "SELECT divisi, is_wajib FROM kegiatan_divisi WHERE kegiatan_id = ? AND divisi = ? AND is_active = 1",
      [kegiatan_id, panitia.divisi]
    );

    console.log('🔍 Divisi check result:', { 
      panitia_divisi: panitia.divisi, 
      allowed_count: divisiRows.length 
    });

    // Get all allowed divisi for error message
    const [allDivisiRows] = await connection.execute<DivisiAllowedRow[]>(
      "SELECT divisi, is_wajib FROM kegiatan_divisi WHERE kegiatan_id = ? AND is_active = 1 ORDER BY divisi ASC",
      [kegiatan_id]
    );

    if (divisiRows.length === 0) {
      await connection.rollback();
      
      // Prepare simple, serializable response
      const allowedDivisiList = allDivisiRows.map(row => ({
        nama: String(row.divisi || ''),
        wajib: row.is_wajib === 1 ? 'Wajib' : 'Opsional'
      }));

      console.log('❌ Divisi tidak diizinkan:', {
        panitia_divisi: panitia.divisi,
        allowed_divisi: allowedDivisiList
      });

      const errorResponse = {
        success: false,
        message: `🚫 DIVISI TIDAK DIIZINKAN - Divisi "${panitia.divisi}" tidak memiliki akses konsumsi untuk kegiatan "${kegiatan.nama}"`,
        data: {
          panitia: {
            nama: String(panitia.nama_lengkap || ''),
            nim: String(panitia.nim || ''),
            divisi: String(panitia.divisi || '')
          },
          kegiatan: {
            id: Number(kegiatan.id),
            nama: String(kegiatan.nama || '')
          },
          divisi_validation: {
            divisi_panitia: String(panitia.divisi || ''),
            status_akses: 'TIDAK DIIZINKAN',
            alasan: 'Divisi tidak terdaftar dalam daftar divisi yang diizinkan untuk kegiatan ini'
          },
          divisi_yang_diizinkan: allowedDivisiList.length > 0 ? allowedDivisiList : [{
            nama: 'Tidak ada divisi yang dikonfigurasi',
            wajib: 'N/A'
          }],
          solusi: [
            'Pastikan QR Code panitia yang benar',
            'Hubungi admin untuk verifikasi divisi',
            'Periksa konfigurasi divisi kegiatan'
          ]
        }
      };

      console.log('📤 Sending 403 response:', JSON.stringify(errorResponse, null, 2));
      
      return NextResponse.json(errorResponse, { 
        status: 403,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('✅ Divisi validation passed');

    // 4. Cek status konsumsi yang sudah ada
    let konsumsiQuery = `
      SELECT jenis_konsumsi, status_pengambilan 
      FROM absensi_konsumsi 
      WHERE panitia_id = ? AND kegiatan_id = ? AND tanggal_konsumsi = ? AND is_active = 1
    `;
    const konsumsiParams: any[] = [panitia.id, kegiatan_id, tanggal];

    if (kegiatan_rangkaian_id) {
      konsumsiQuery += " AND kegiatan_rangkaian_id = ?";
      konsumsiParams.push(kegiatan_rangkaian_id);
    } else {
      konsumsiQuery += " AND kegiatan_rangkaian_id IS NULL";
    }

    const [existingKonsumsi] = await connection.execute<KonsumsiExistingRow[]>(
      konsumsiQuery,
      konsumsiParams
    );

    // Analisis status konsumsi yang sudah ada
    const konsumsiStatus = {
      konsumsi_1: false,
      konsumsi_2: false
    };

    for (const record of existingKonsumsi) {
      if (record.status_pengambilan === 'sudah_diambil') {
        konsumsiStatus[record.jenis_konsumsi] = true;
      }
    }

    console.log('📊 Current konsumsi status:', konsumsiStatus);

    // 5. Validasi berdasarkan jenis konsumsi yang diminta
    if (jenis_konsumsi === 'konsumsi_1' && konsumsiStatus.konsumsi_1) {
      await connection.rollback();
      
      const errorResponse = {
        success: false,
        message: "❌ KONSUMSI 1 SUDAH DIAMBIL - Scan ini sudah pernah dilakukan sebelumnya",
        data: {
          panitia: { 
            nama: String(panitia.nama_lengkap || ''), 
            nim: String(panitia.nim || ''), 
            divisi: String(panitia.divisi || '') 
          },
          kegiatan_nama: String(kegiatan.nama || ''),
          jenis_yang_dicoba: 'Konsumsi 1',
          status_saat_ini: 'Sudah Diambil',
          saran: 'Coba scan untuk Konsumsi 2 jika belum diambil',
          status_detail: {
            konsumsi_1: konsumsiStatus.konsumsi_1 ? '✅ Sudah Diambil' : '❌ Belum Diambil',
            konsumsi_2: konsumsiStatus.konsumsi_2 ? '✅ Sudah Diambil' : '❌ Belum Diambil'
          }
        }
      };

      console.log('❌ Konsumsi 1 already taken, sending 409 response');
      
      return NextResponse.json(errorResponse, { 
        status: 409,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    if (jenis_konsumsi === 'konsumsi_2') {
      if (!konsumsiStatus.konsumsi_1) {
        await connection.rollback();
        
        const errorResponse = {
          success: false,
          message: "❌ KONSUMSI 2 TIDAK DAPAT DIAMBIL - Harus mengambil Konsumsi 1 terlebih dahulu",
          data: {
            panitia: { 
              nama: String(panitia.nama_lengkap || ''), 
              nim: String(panitia.nim || ''), 
              divisi: String(panitia.divisi || '') 
            },
            kegiatan_nama: String(kegiatan.nama || ''),
            jenis_yang_dicoba: 'Konsumsi 2',
            konsumsi_1_status: konsumsiStatus.konsumsi_1 ? '✅ Sudah Diambil' : '❌ Belum Diambil',
            saran: 'Silakan scan QR untuk mengambil Konsumsi 1 terlebih dahulu',
            status_detail: {
              konsumsi_1: konsumsiStatus.konsumsi_1 ? '✅ Sudah Diambil' : '❌ Belum Diambil',
              konsumsi_2: konsumsiStatus.konsumsi_2 ? '✅ Sudah Diambil' : '❌ Belum Diambil'
            }
          }
        };

        console.log('❌ Konsumsi 2 attempted before Konsumsi 1, sending 409 response');
        
        return NextResponse.json(errorResponse, { 
          status: 409,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }

      if (konsumsiStatus.konsumsi_2) {
        await connection.rollback();
        
        const errorResponse = {
          success: false,
          message: "❌ KONSUMSI 2 SUDAH DIAMBIL - Scan ini sudah pernah dilakukan sebelumnya",
          data: {
            panitia: { 
              nama: String(panitia.nama_lengkap || ''), 
              nim: String(panitia.nim || ''), 
              divisi: String(panitia.divisi || '') 
            },
            kegiatan_nama: String(kegiatan.nama || ''),
            jenis_yang_dicoba: 'Konsumsi 2',
            status_saat_ini: 'Sudah Diambil',
            total_konsumsi: 'Lengkap (2/2)',
            pesan_tambahan: '🎉 Semua konsumsi sudah lengkap',
            status_detail: {
              konsumsi_1: '✅ Sudah Diambil',
              konsumsi_2: '✅ Sudah Diambil'
            }
          }
        };

        console.log('❌ Konsumsi 2 already taken, sending 409 response');
        
        return NextResponse.json(errorResponse, { 
          status: 409,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
    }

    // 6. Insert atau update record konsumsi
    const currentTime = new Date();
    const insertData = {
      panitia_id: panitia.id,
      kegiatan_id: parseInt(kegiatan_id),
      kegiatan_rangkaian_id: kegiatan_rangkaian_id ? parseInt(kegiatan_rangkaian_id) : null,
      tanggal_konsumsi: tanggal,
      jenis_konsumsi: jenis_konsumsi,
      status_pengambilan: 'sudah_diambil',
      waktu_pengambilan: currentTime,
      waktu_scan_ambil: currentTime,
      qr_data: qr_data,
      metode_konfirmasi: 'QR Code',
      petugas_konfirmasi: 'QR Scanner System',
      catatan: `Konsumsi diambil via QR Scanner pada ${currentTime.toLocaleString('id-ID')}`,
      validasi_admin: 1,
      validasi_by: 'QR Scanner System',
      validasi_at: currentTime,
      created_by: 'qr_scanner',
      updated_by: 'qr_scanner'
    };

    // Check if record already exists (untuk kasus edge dimana ada record tapi status belum_diambil)
    const [existingRecord] = await connection.execute<RowDataPacket[]>(
      `SELECT id, status_pengambilan FROM absensi_konsumsi 
       WHERE panitia_id = ? AND kegiatan_id = ? AND tanggal_konsumsi = ? 
       AND jenis_konsumsi = ? AND is_active = 1
       ${kegiatan_rangkaian_id ? 'AND kegiatan_rangkaian_id = ?' : 'AND kegiatan_rangkaian_id IS NULL'}`,
      kegiatan_rangkaian_id 
        ? [panitia.id, kegiatan_id, tanggal, jenis_konsumsi, kegiatan_rangkaian_id]
        : [panitia.id, kegiatan_id, tanggal, jenis_konsumsi]
    );

    if (existingRecord.length > 0) {
      // Update existing record
      await connection.execute(
        `UPDATE absensi_konsumsi SET 
         status_pengambilan = 'sudah_diambil',
         waktu_pengambilan = ?,
         waktu_scan_ambil = ?,
         qr_data = ?,
         catatan = ?,
         validasi_admin = 1,
         validasi_by = 'QR Scanner System',
         validasi_at = ?,
         updated_by = 'qr_scanner',
         updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          currentTime,
          currentTime, 
          qr_data,
          insertData.catatan,
          currentTime,
          existingRecord[0].id
        ]
      );
      
      console.log('✅ Updated existing record ID:', existingRecord[0].id);
    } else {
      // Insert new record
      await connection.execute(
        `INSERT INTO absensi_konsumsi (
          panitia_id, kegiatan_id, kegiatan_rangkaian_id, tanggal_konsumsi, 
          jenis_konsumsi, status_pengambilan, waktu_pengambilan, waktu_scan_ambil,
          qr_data, metode_konfirmasi, petugas_konfirmasi, catatan,
          validasi_admin, validasi_by, validasi_at, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          insertData.panitia_id,
          insertData.kegiatan_id,
          insertData.kegiatan_rangkaian_id,
          insertData.tanggal_konsumsi,
          insertData.jenis_konsumsi,
          insertData.status_pengambilan,
          insertData.waktu_pengambilan,
          insertData.waktu_scan_ambil,
          insertData.qr_data,
          insertData.metode_konfirmasi,
          insertData.petugas_konfirmasi,
          insertData.catatan,
          insertData.validasi_admin,
          insertData.validasi_by,
          insertData.validasi_at,
          insertData.created_by,
          insertData.updated_by
        ]
      );
      
      console.log('✅ Created new konsumsi record');
    }

    await connection.commit();

    // Update status untuk response
    const updatedStatus = { ...konsumsiStatus };
    updatedStatus[jenis_konsumsi as 'konsumsi_1' | 'konsumsi_2'] = true;

    const totalKonsumsi = Object.values(updatedStatus).filter(Boolean).length;
    const konsumsiLabel = jenis_konsumsi === 'konsumsi_1' ? 'Konsumsi 1' : 'Konsumsi 2';
    const konsumsiKe = jenis_konsumsi === 'konsumsi_1' ? 1 : 2;
    const isKonsumsiLengkap = totalKonsumsi >= 2;

    const successResponse = {
      success: true,
      message: `🎉 ${konsumsiLabel.toUpperCase()} BERHASIL DICATAT! - ${panitia.nama_lengkap}`,
      data: {
        panitia: {
          id: Number(panitia.id),
          nama: String(panitia.nama_lengkap || ''),
          nim: String(panitia.nim || ''),
          divisi: String(panitia.divisi || '')
        },
        kegiatan: {
          id: Number(kegiatan.id),
          nama: String(kegiatan.nama || '')
        },
        konsumsi: {
          jenis: String(jenis_konsumsi),
          jenis_display: konsumsiLabel,
          konsumsi_ke: konsumsiKe,
          tanggal: String(tanggal),
          waktu_pengambilan: currentTime.toISOString(),
          status_setelah_scan: updatedStatus,
          total_konsumsi_diambil: totalKonsumsi,
          maksimal_konsumsi: 2,
          konsumsi_lengkap: isKonsumsiLengkap
        },
        status_setelah_scan: {
          konsumsi_1: updatedStatus.konsumsi_1 ? '✅ Sudah Diambil' : '⏳ Belum Diambil',
          konsumsi_2: updatedStatus.konsumsi_2 ? '✅ Sudah Diambil' : '⏳ Belum Diambil'
        },
        pesan_tambahan: isKonsumsiLengkap 
          ? '🎉 Konsumsi sudah lengkap (2/2)! Terima kasih.' 
          : `💡 ${konsumsiKe === 1 ? 'Masih bisa scan untuk Konsumsi 2' : 'Semua konsumsi sudah lengkap'}`
      }
    };

    console.log('✅ Success! Konsumsi recorded:', { jenis: jenis_konsumsi, total: totalKonsumsi });

    return NextResponse.json(successResponse, {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error("🚨 CRITICAL ERROR in /api/konsumsi/scan:", error);
    
    // Handle specific MySQL errors
    if (error instanceof Error) {
      if (error.message.includes('Duplicate entry')) {
        const duplicateErrorResponse = {
          success: false,
          message: "❌ KONSUMSI DUPLICATE DETECTED - Konsumsi ini sudah pernah dicatat di database",
          error_details: {
            type: 'DUPLICATE_ENTRY',
            message: 'Record konsumsi dengan kombinasi panitia + kegiatan + jenis sudah ada',
            saran: 'Refresh halaman dan coba scan ulang, atau periksa status konsumsi panitia ini'
          }
        };
        
        return NextResponse.json(duplicateErrorResponse, { 
          status: 409,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
      
      if (error.message.includes('foreign key')) {
        const foreignKeyErrorResponse = {
          success: false,
          message: "❌ KONSUMSI REFERENCE ERROR - Data referensi tidak valid",
          error_details: {
            type: 'FOREIGN_KEY_ERROR',
            message: 'Panitia ID atau Kegiatan ID tidak ditemukan di database',
            saran: 'Pastikan data panitia dan kegiatan masih aktif'
          }
        };
        
        return NextResponse.json(foreignKeyErrorResponse, { 
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
    }

    const genericErrorResponse = {
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? String(error) : "An unexpected error occurred"
    };

    return NextResponse.json(genericErrorResponse, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } finally {
    connection.release();
  }
}