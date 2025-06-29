// app/api/debug/qr/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db, RowDataPacket } from '@/lib/db';

interface PanitiaRow extends RowDataPacket {
  id: number;
  unique_id: string;
  nama_lengkap: string;
  nim: string;
  divisi: string;
  qr_code: string;
  is_active: number;
}

// GET - Debug QR Code data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const unique_id = searchParams.get('unique_id');
    const nim = searchParams.get('nim');
    const action = searchParams.get('action'); // 'compare', 'list', 'parse'

    if (action === 'list') {
      // List semua panitia dengan QR code
      const [rows] = await db.execute<PanitiaRow[]>(
        `SELECT id, unique_id, nama_lengkap, nim, divisi, 
                LENGTH(qr_code) as qr_code_length, is_active
         FROM panitia_peserta 
         WHERE is_active = 1 
         ORDER BY created_at DESC 
         LIMIT 20`
      );

      return NextResponse.json({
        success: true,
        message: 'Daftar panitia dengan QR code',
        data: rows.map(row => ({
          id: row.id,
          unique_id: row.unique_id,
          nama_lengkap: row.nama_lengkap,
          nim: row.nim,
          divisi: row.divisi,
          has_qr_code: row.qr_code_length > 0,
          qr_code_size: row.qr_code_length
        }))
      });
    }

    if (action === 'parse' && unique_id) {
      // Parse QR code dari database
      const [rows] = await db.execute<PanitiaRow[]>(
        'SELECT unique_id, nama_lengkap, nim, divisi, qr_code FROM panitia_peserta WHERE unique_id = ? AND is_active = 1',
        [unique_id]
      );

      if (rows.length === 0) {
        return NextResponse.json({
          success: false,
          message: 'Panitia tidak ditemukan'
        }, { status: 404 });
      }

      const panitia = rows[0];
      
      // Generate expected QR data
      const expectedQRData = JSON.stringify({
        id: panitia.unique_id,
        nama: panitia.nama_lengkap,
        nim: panitia.nim,
        divisi: panitia.divisi,
        timestamp: new Date().toISOString()
      });

      return NextResponse.json({
        success: true,
        message: 'Data QR code untuk panitia',
        data: {
          database_record: {
            unique_id: panitia.unique_id,
            nama_lengkap: panitia.nama_lengkap,
            nim: panitia.nim,
            divisi: panitia.divisi
          },
          expected_qr_format: expectedQRData,
          expected_qr_parsed: {
            id: panitia.unique_id,
            nama: panitia.nama_lengkap,
            nim: panitia.nim,
            divisi: panitia.divisi,
            timestamp: 'YYYY-MM-DDTHH:mm:ss.sssZ'
          },
          has_stored_qr: !!panitia.qr_code,
          qr_code_preview: panitia.qr_code ? panitia.qr_code.substring(0, 100) + '...' : null
        }
      });
    }

    if (action === 'compare' && unique_id) {
      // Compare QR data dengan database
      const [rows] = await db.execute<PanitiaRow[]>(
        'SELECT unique_id, nama_lengkap, nim, divisi FROM panitia_peserta WHERE unique_id = ? AND is_active = 1',
        [unique_id]
      );

      if (rows.length === 0) {
        return NextResponse.json({
          success: false,
          message: 'Panitia tidak ditemukan'
        }, { status: 404 });
      }

      const panitia = rows[0];

      // Simulate QR data yang mungkin di-scan
      const sampleQRData = {
        id: panitia.unique_id,
        nama: panitia.nama_lengkap,
        nim: panitia.nim,
        divisi: panitia.divisi,
        timestamp: new Date().toISOString()
      };

      // Fungsi normalisasi
      const normalizeString = (str: string): string => {
        return str.trim().toLowerCase().replace(/\s+/g, ' ');
      };

      const comparison = {
        unique_id: {
          db: panitia.unique_id,
          qr: sampleQRData.id,
          match: panitia.unique_id === sampleQRData.id
        },
        nama: {
          db: panitia.nama_lengkap,
          qr: sampleQRData.nama,
          match: normalizeString(panitia.nama_lengkap) === normalizeString(sampleQRData.nama),
          normalized_db: normalizeString(panitia.nama_lengkap),
          normalized_qr: normalizeString(sampleQRData.nama)
        },
        nim: {
          db: panitia.nim,
          qr: sampleQRData.nim,
          match: normalizeString(panitia.nim) === normalizeString(sampleQRData.nim),
          normalized_db: normalizeString(panitia.nim),
          normalized_qr: normalizeString(sampleQRData.nim)
        },
        divisi: {
          db: panitia.divisi,
          qr: sampleQRData.divisi,
          match: normalizeString(panitia.divisi) === normalizeString(sampleQRData.divisi),
          normalized_db: normalizeString(panitia.divisi),
          normalized_qr: normalizeString(sampleQRData.divisi)
        }
      };

      return NextResponse.json({
        success: true,
        message: 'Perbandingan data QR dengan database',
        data: {
          database_record: panitia,
          sample_qr_data: sampleQRData,
          comparison,
          all_match: Object.values(comparison).every(item => item.match),
          validation_result: Object.values(comparison).every(item => item.match) ? 'VALID' : 'INVALID'
        }
      });
    }

    if (nim) {
      // Search by NIM
      const [rows] = await db.execute<PanitiaRow[]>(
        'SELECT unique_id, nama_lengkap, nim, divisi, is_active FROM panitia_peserta WHERE nim LIKE ? ORDER BY nim',
        [`%${nim}%`]
      );

      return NextResponse.json({
        success: true,
        message: `Hasil pencarian untuk NIM: ${nim}`,
        data: rows.map(row => ({
          unique_id: row.unique_id,
          nama_lengkap: row.nama_lengkap,
          nim: row.nim,
          divisi: row.divisi,
          is_active: row.is_active === 1
        }))
      });
    }

    // Default: tampilkan instruksi
    return NextResponse.json({
      success: true,
      message: 'Debug QR Code API',
      usage: {
        list_panitia: '/api/debug/qr?action=list',
        parse_qr: '/api/debug/qr?action=parse&unique_id=MC642A4WGM9BF',
        compare_data: '/api/debug/qr?action=compare&unique_id=MC642A4WGM9BF',
        search_nim: '/api/debug/qr?nim=235040200111171'
      },
      examples: {
        check_specific_qr: 'GET /api/debug/qr?action=parse&unique_id=MC642A4WGM9BF',
        validate_qr_match: 'GET /api/debug/qr?action=compare&unique_id=MC642A4WGM9BF',
        search_by_nim: 'GET /api/debug/qr?nim=235040200111171'
      }
    });

  } catch (error: any) {
    console.error('Debug QR Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error debugging QR', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Test QR scan validation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { qr_data } = body;

    if (!qr_data) {
      return NextResponse.json(
        { success: false, message: 'qr_data diperlukan' },
        { status: 400 }
      );
    }

    // Parse QR data
    let qrParsed;
    try {
      qrParsed = JSON.parse(qr_data);
    } catch (parseError) {
      return NextResponse.json(
        { success: false, message: 'Format QR Code tidak valid', qr_data },
        { status: 400 }
      );
    }

    // Validasi struktur QR
    const requiredFields = ['id', 'nama', 'nim', 'divisi'];
    const missingFields = requiredFields.filter(field => !qrParsed[field]);
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: `QR Code tidak lengkap. Missing fields: ${missingFields.join(', ')}`,
          received_fields: Object.keys(qrParsed),
          missing_fields: missingFields
        },
        { status: 400 }
      );
    }

    // Cari di database
    const [panitiaRows] = await db.execute<RowDataPacket[]>(
      'SELECT id, unique_id, nama_lengkap, nim, divisi FROM panitia_peserta WHERE unique_id = ? AND is_active = 1',
      [qrParsed.id]
    );

    if (panitiaRows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'unique_id tidak ditemukan di database',
        searched_unique_id: qrParsed.id,
        suggestion: 'Periksa apakah data sudah di-import dengan benar'
      }, { status: 404 });
    }

    const panitia = panitiaRows[0];

    // Fungsi normalisasi
    const normalizeString = (str: string): string => {
      return str.trim().toLowerCase().replace(/\s+/g, ' ');
    };

    // Detailed validation
    const validation = {
      unique_id: {
        qr: qrParsed.id,
        db: panitia.unique_id,
        match: qrParsed.id === panitia.unique_id
      },
      nama: {
        qr: qrParsed.nama,
        db: panitia.nama_lengkap,
        qr_normalized: normalizeString(qrParsed.nama),
        db_normalized: normalizeString(panitia.nama_lengkap),
        match: normalizeString(qrParsed.nama) === normalizeString(panitia.nama_lengkap)
      },
      nim: {
        qr: qrParsed.nim,
        db: panitia.nim,
        qr_normalized: normalizeString(qrParsed.nim),
        db_normalized: normalizeString(panitia.nim),
        match: normalizeString(qrParsed.nim) === normalizeString(panitia.nim)
      },
      divisi: {
        qr: qrParsed.divisi,
        db: panitia.divisi,
        qr_normalized: normalizeString(qrParsed.divisi),
        db_normalized: normalizeString(panitia.divisi),
        match: normalizeString(qrParsed.divisi) === normalizeString(panitia.divisi)
      }
    };

    const allValid = Object.values(validation).every(field => field.match);

    return NextResponse.json({
      success: allValid,
      message: allValid ? 'QR Code valid dan sesuai database' : 'QR Code tidak sesuai dengan database',
      qr_parsed: qrParsed,
      database_record: panitia,
      validation,
      overall_result: allValid ? 'VALID' : 'INVALID',
      failed_validations: Object.entries(validation)
        .filter(([_, field]) => !field.match)
        .map(([fieldName, _]) => fieldName)
    });

  } catch (error: any) {
    console.error('Test QR Validation Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error testing QR validation', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}