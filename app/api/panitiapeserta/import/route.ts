/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { db, RowDataPacket } from '@/lib/db';
import QRCode from 'qrcode';
import Papa from 'papaparse';

interface CSVRow {
  nama_lengkap: string;
  nim: string;
  divisi: string;
}

// Generate unique ID
function generateUniqueId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `${timestamp}${random}`.toUpperCase();
}

// Capitalize setiap kata (Title Case)
function capitalizeWords(str: string): string {
  if (!str) return str;
  
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ') // Replace multiple spaces dengan single space
    .split(' ')
    .map((word, index, array) => {
      if (word.length === 0) return word;
      
      // Handle special cases untuk kata-kata yang tidak perlu di-capitalize
      const lowerCaseWords = ['dan', 'atau', 'di', 'ke', 'dari', 'untuk', 'dengan', 'pada', 'dalam', 'oleh', 'atas', 'bawah', 'antara', 'yang'];
      
      // Kata pertama dan terakhir selalu capitalize, atau bukan kata kecil
      if (index === 0 || index === array.length - 1 || !lowerCaseWords.includes(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      
      return word;
    })
    .join(' ');
}

// Capitalize untuk NIM (uppercase semua)
function capitalizeNIM(str: string): string {
  if (!str) return str;
  return str.trim().toUpperCase().replace(/\s+/g, '');
}

// STANDARDIZED QR code data generator - CONSISTENT FORMAT
function generateQRData(peserta: any) {
  return JSON.stringify({
    id: peserta.unique_id,        // unique_id dari database
    nama: peserta.nama_lengkap,   // nama_lengkap yang sudah di-capitalize
    nim: peserta.nim,             // nim yang sudah di-uppercase
    divisi: peserta.divisi,       // divisi yang sudah di-capitalize
    timestamp: new Date().toISOString(), // ISO timestamp saat generate
    // TIDAK ada field 'version' - agar consistent dengan scanner
  });
}

// Normalize string untuk perbandingan
function normalizeString(str: string): string {
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

// GET - Generate dan download template CSV
export async function GET() {
  try {
    const dummyData = [
      {
        nama_lengkap: 'Ahmad Budi Santoso',
        nim: '2021110001',
        divisi: 'Acara'
      },
      {
        nama_lengkap: 'Siti Nurhaliza',
        nim: '2021110002', 
        divisi: 'Publikasi'
      },
      {
        nama_lengkap: 'Muhammad Rizki Pratama',
        nim: '2021110003',
        divisi: 'Teknologi'
      },
      {
        nama_lengkap: 'Dewi Maharani',
        nim: '2021110004',
        divisi: 'Administrasi'
      },
      {
        nama_lengkap: 'Fajar Nugroho',
        nim: '2021110005',
        divisi: 'Kesehatan'
      },
      {
        nama_lengkap: 'Rina Kartika Sari',
        nim: '2021110006',
        divisi: 'Konsumsi'
      },
      {
        nama_lengkap: 'Dedy Setiawan',
        nim: '2021110007',
        divisi: 'Dekorasi'
      },
      {
        nama_lengkap: 'Lisa Permata',
        nim: '2021110008',
        divisi: 'Hiburan'
      },
      {
        nama_lengkap: 'Budi Hermawan',
        nim: '2021110009',
        divisi: 'Keamanan'
      },
      {
        nama_lengkap: 'Maya Indira Sari',
        nim: '2021110010',
        divisi: 'Dokumentasi'
      }
    ];

    // Generate CSV dengan Papa Parse
    const csv = Papa.unparse(dummyData, {
      header: true,
      delimiter: ',',
      newline: '\r\n'
    });
    
    // Add BOM untuk proper UTF-8 encoding di Excel
    const csvWithBOM = '\uFEFF' + csv;
    
    return new NextResponse(csvWithBOM, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="template_panitia.csv"',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error: any) {
    console.error('Template Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error generating template', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Import CSV dengan kapitalisasi OTOMATIS dan QR generation yang STANDARDIZED
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const formData = await request.formData();
    const file = formData.get('csv') as File;

    // Validasi file
    if (!file) {
      return NextResponse.json(
        { success: false, message: 'File CSV diperlukan' },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json(
        { success: false, message: 'File harus berformat CSV' },
        { status: 400 }
      );
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: 'File terlalu besar. Maksimal 10MB' },
        { status: 400 }
      );
    }

    const text = await file.text();
    
    if (!text.trim()) {
      return NextResponse.json(
        { success: false, message: 'File CSV kosong' },
        { status: 400 }
      );
    }

    // Parse CSV dengan error handling
    const parseResult = Papa.parse<CSVRow>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => {
        // Normalize header names
        const normalized = header.toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^\w_]/g, '');
        return normalized;
      },
      transform: (value) => value.trim() // Trim semua values
    });

    if (parseResult.errors.length > 0) {
      const criticalErrors = parseResult.errors.filter(err => err.type === 'Delimiter');
      if (criticalErrors.length > 0) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Error parsing CSV: Format file tidak valid',
            errors: parseResult.errors 
          },
          { status: 400 }
        );
      }
    }

    const data = parseResult.data;
    
    if (data.length === 0) {
      return NextResponse.json(
        { success: false, message: 'File CSV tidak berisi data' },
        { status: 400 }
      );
    }

    if (data.length > 1000) {
      return NextResponse.json(
        { success: false, message: `Maksimal 1000 data per import. File berisi ${data.length} data` },
        { status: 400 }
      );
    }

    // Validasi required fields
    const requiredFields = ['nama_lengkap', 'nim', 'divisi'];
    const invalidRows: Array<{ row: number; issues: string[] }> = [];
    
    data.forEach((row, index) => {
      const issues: string[] = [];
      
      requiredFields.forEach(field => {
        const value = row[field as keyof CSVRow];
        if (!value || !value.toString().trim()) {
          issues.push(`${field} kosong`);
        }
      });
      
      // Validasi panjang data
      if (row.nama_lengkap && row.nama_lengkap.length > 255) {
        issues.push('nama_lengkap terlalu panjang (max 255)');
      }
      if (row.nim && row.nim.length > 20) {
        issues.push('nim terlalu panjang (max 20)');
      }
      if (row.divisi && row.divisi.length > 255) {
        issues.push('divisi terlalu panjang (max 255)');
      }
      
      if (issues.length > 0) {
        invalidRows.push({ row: index + 1, issues });
      }
    });

    if (invalidRows.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: `${invalidRows.length} baris tidak valid`,
          details: invalidRows.slice(0, 10), // Show first 10 errors
          total_errors: invalidRows.length
        },
        { status: 400 }
      );
    }

    // Check untuk duplicate NIMs dalam CSV
    const processedNims = data.map(row => capitalizeNIM(row.nim));
    const nims = processedNims.map(nim => normalizeString(nim));
    const duplicateNims = nims.filter((nim, index) => nims.indexOf(nim) !== index);
    
    if (duplicateNims.length > 0) {
      const uniqueDuplicates = [...new Set(duplicateNims)];
      return NextResponse.json(
        { 
          success: false, 
          message: `NIM duplikat dalam CSV: ${uniqueDuplicates.slice(0, 5).join(', ')}${uniqueDuplicates.length > 5 ? ` dan ${uniqueDuplicates.length - 5} lainnya` : ''}` 
        },
        { status: 400 }
      );
    }

    // Process data dalam batch dengan KAPITALISASI OTOMATIS
    const successData: any[] = [];
    const errorData: any[] = [];
    const qrGenerationStats = {
      total_processed: 0,
      qr_generated: 0,
      qr_failed: 0
    };
    const batchSize = 50;

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      for (const [batchIndex, row] of batch.entries()) {
        const globalIndex = i + batchIndex;
        qrGenerationStats.total_processed++;
        
        try {
          const { nama_lengkap, nim, divisi } = row;

          // Clean dan CAPITALIZE data OTOMATIS
          const cleanData = {
            nama_lengkap: capitalizeWords(nama_lengkap),
            nim: capitalizeNIM(nim),
            divisi: capitalizeWords(divisi)
          };

          // Check if NIM already exists in database
          const [existing] = await db.execute<RowDataPacket[]>(
            'SELECT id, nama_lengkap FROM panitia_peserta WHERE nim = ?',
            [cleanData.nim]
          );

          if (existing.length > 0) {
            errorData.push({
              row: globalIndex + 1,
              nim: cleanData.nim,
              nama_lengkap: cleanData.nama_lengkap,
              error: `NIM sudah ada di database (${existing[0].nama_lengkap})`
            });
            continue;
          }

          // Generate unique ID dengan validation
          let unique_id = generateUniqueId();
          let isUnique = false;
          let attempts = 0;
          
          while (!isUnique && attempts < 5) {
            const [existingUniqueId] = await db.execute<RowDataPacket[]>(
              'SELECT id FROM panitia_peserta WHERE unique_id = ?',
              [unique_id]
            );
            
            if (existingUniqueId.length === 0) {
              isUnique = true;
            } else {
              unique_id = generateUniqueId();
              attempts++;
            }
          }

          if (!isUnique) {
            errorData.push({
              row: globalIndex + 1,
              nim: cleanData.nim,
              nama_lengkap: cleanData.nama_lengkap,
              error: 'Gagal generate unique ID'
            });
            continue;
          }

          // Generate STANDARDIZED QR Code dengan format yang consistent
          const pesertaData = { ...cleanData, unique_id };
          const qrData = generateQRData(pesertaData);
          
          try {
            const qrCode = await QRCode.toDataURL(qrData, {
              width: 300,
              margin: 2,
              color: {
                dark: '#000000',
                light: '#FFFFFF'
              },
              errorCorrectionLevel: 'M'
            });
            
            qrGenerationStats.qr_generated++;

            // Insert to database
            await db.execute(
              'INSERT INTO panitia_peserta (unique_id, nama_lengkap, nim, divisi, qr_code) VALUES (?, ?, ?, ?, ?)',
              [unique_id, cleanData.nama_lengkap, cleanData.nim, cleanData.divisi, qrCode]
            );

            successData.push({
              unique_id,
              nama_lengkap: cleanData.nama_lengkap,
              nim: cleanData.nim,
              divisi: cleanData.divisi,
              qr_data_structure: JSON.parse(qrData), // Show QR structure for verification
              original_input: {
                nama_lengkap: nama_lengkap,
                nim: nim,
                divisi: divisi
              }
            });
            
          } catch (qrError: any) {
            console.error(`QR Generation error for ${unique_id}:`, qrError);
            qrGenerationStats.qr_failed++;
            
            // Insert without QR code jika QR generation gagal
            await db.execute(
              'INSERT INTO panitia_peserta (unique_id, nama_lengkap, nim, divisi, qr_code) VALUES (?, ?, ?, ?, NULL)',
              [unique_id, cleanData.nama_lengkap, cleanData.nim, cleanData.divisi]
            );

            successData.push({
              unique_id,
              nama_lengkap: cleanData.nama_lengkap,
              nim: cleanData.nim,
              divisi: cleanData.divisi,
              qr_generation_error: qrError.message,
              original_input: {
                nama_lengkap: nama_lengkap,
                nim: nim,
                divisi: divisi
              }
            });
          }

        } catch (error: any) {
          console.error(`Error processing row ${globalIndex + 1}:`, error);
          errorData.push({
            row: globalIndex + 1,
            nim: row.nim,
            nama_lengkap: row.nama_lengkap,
            error: `Error database: ${error?.message || 'Unknown error'}`
          });
        }
      }
    }

    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: `Import selesai dalam ${(processingTime / 1000).toFixed(1)}s. ${successData.length} berhasil, ${errorData.length} gagal. QR Code: ${qrGenerationStats.qr_generated} berhasil, ${qrGenerationStats.qr_failed} gagal.`,
      data: {
        success: successData,
        errors: errorData,
        total_processed: data.length,
        success_count: successData.length,
        error_count: errorData.length,
        processing_time_ms: processingTime,
        qr_generation_stats: qrGenerationStats,
        qr_data_format: {
          structure: "standardized_format",
          fields: ["id", "nama", "nim", "divisi", "timestamp"],
          note: "Consistent dengan scanner - tanpa field 'version'"
        },
        capitalization_applied: true,
        fields_imported: ['nama_lengkap', 'nim', 'divisi']
      }
    });

  } catch (error: any) {
    console.error('Import Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error processing import', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}