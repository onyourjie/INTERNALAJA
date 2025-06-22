/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
// testwebpanit/app/api/panitiapeserta/qr/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db, RowDataPacket } from '@/lib/db';
import QRCode from 'qrcode';
import JSZip from 'jszip';

interface PesertaQR extends RowDataPacket {
  id: number;
  unique_id: string;
  nama_lengkap: string;
  nim: string;
  divisi: string;
  qr_code?: string;
  created_at: Date;
  updated_at: Date;
}

// Generate QR code data (TANPA FAKULTAS)
function generateQRData(peserta: PesertaQR) {
  return JSON.stringify({
    id: peserta.unique_id,
    nama: peserta.nama_lengkap,
    nim: peserta.nim,
    divisi: peserta.divisi,
    timestamp: new Date().toISOString(),
    version: '1.0'
  });
}

// Sanitize filename untuk Windows/Mac compatibility - FORMAT: NIM_Nama_Lengkap
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid chars
    .replace(/\s+/g, '_') // Replace spaces with underscore
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, '') // Remove leading/trailing underscores
    .substring(0, 100); // Limit length
}

// Format filename for QR code: NIM_Nama_Lengkap.png
function formatQRFilename(peserta: PesertaQR): string {
  const cleanNama = sanitizeFilename(peserta.nama_lengkap);
  return `${peserta.nim}_${cleanNama}.png`;
}

// GET - Download QR code(s) dengan struktur folder DIVISI saja
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id'); // unique_id
    const type = searchParams.get('type') || 'single'; // single, bulk, all
    const format = searchParams.get('format') || 'png'; // png, svg
    const divisi = searchParams.get('divisi') || '';
    const size = parseInt(searchParams.get('size') || '300');
    const margin = parseInt(searchParams.get('margin') || '2');
    
    // Validasi parameters
    if (type === 'single' && !id) {
      return NextResponse.json(
        { success: false, message: 'Parameter id diperlukan untuk download single QR' },
        { status: 400 }
      );
    }
    
    if (type === 'single' && id) {
      // Download single QR code
      const [rows] = await db.execute<PesertaQR[]>(
        'SELECT * FROM panitia_peserta WHERE unique_id = ?',
        [id]
      );
      
      if (rows.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Data tidak ditemukan' },
          { status: 404 }
        );
      }
      
      const peserta = rows[0];
      const qrData = generateQRData(peserta);
      
      if (format === 'svg') {
        // SVG options untuk QRCode.toString
        const svgOptions = {
          type: 'svg' as const,
          width: Math.min(Math.max(size, 100), 1000),
          margin: Math.min(Math.max(margin, 1), 10),
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          },
          errorCorrectionLevel: 'M' as const
        };
        
        const qrSvg = await QRCode.toString(qrData, svgOptions);
        const filename = `${peserta.nim}_${sanitizeFilename(peserta.nama_lengkap)}.svg`;
        
        return new NextResponse(qrSvg, {
          headers: {
            'Content-Type': 'image/svg+xml',
            'Content-Disposition': `attachment; filename="${filename}"`
          }
        });
      } else {
        // PNG options untuk QRCode.toBuffer
        const pngOptions = {
          type: 'png' as const,
          width: Math.min(Math.max(size, 100), 1000),
          margin: Math.min(Math.max(margin, 1), 10),
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          },
          errorCorrectionLevel: 'M' as const
        };
        
        const qrBuffer = await QRCode.toBuffer(qrData, pngOptions);
        const filename = formatQRFilename(peserta);
        
        return new NextResponse(new Uint8Array(qrBuffer), {
          headers: {
            'Content-Type': 'image/png',
            'Content-Disposition': `attachment; filename="${filename}"`
          }
        });
      }
    }
    
    else if (type === 'bulk' || type === 'all') {
      // Download multiple QR codes as ZIP - STRUKTUR FOLDER DIVISI SAJA
      let query = 'SELECT * FROM panitia_peserta WHERE qr_code IS NOT NULL AND qr_code != ""';
      const params: any[] = [];
      
      if (divisi && type === 'bulk') {
        query += ' AND divisi = ?';
        params.push(divisi);
      }
      
      // Order by divisi first, then by nim for consistent organization
      query += ' ORDER BY divisi, nim, nama_lengkap';
      
      const [rows] = await db.execute<PesertaQR[]>(query, params);
      
      if (rows.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Tidak ada data dengan QR code untuk didownload' },
          { status: 404 }
        );
      }

      if (rows.length > 1000) {
        return NextResponse.json(
          { success: false, message: `Terlalu banyak data (${rows.length}). Maksimal 1000 QR codes per download. Gunakan filter divisi.` },
          { status: 400 }
        );
      }
      
      // Create ZIP file
      const zip = new JSZip();
      
      // Create folders by DIVISI only (NO FAKULTAS)
      const divisiFolder: { [key: string]: any } = {};
      let processedCount = 0;
      let divisiStats: { [key: string]: { count: number } } = {};
      
      for (const peserta of rows) {
        try {
          const divisiName = sanitizeFilename(peserta.divisi);
          
          // Create folder untuk divisi jika belum ada
          if (!divisiFolder[divisiName]) {
            divisiFolder[divisiName] = zip.folder(divisiName);
          }
          
          // Track statistics per divisi
          if (!divisiStats[peserta.divisi]) {
            divisiStats[peserta.divisi] = { count: 0 };
          }
          divisiStats[peserta.divisi].count++;
          
          // Generate QR code dengan options yang benar untuk toBuffer
          const qrData = generateQRData(peserta);
          const qrBuffer = await QRCode.toBuffer(qrData, {
            type: 'png',
            width: size,
            margin: margin,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            },
            errorCorrectionLevel: 'M'
          });
          
          // Format filename: NIM_Nama_Lengkap.png
          const fileName = formatQRFilename(peserta);
          
          // Add file ke folder divisi
          divisiFolder[divisiName].file(fileName, qrBuffer);
          processedCount++;
          
        } catch (error: any) {
          console.error(`Error processing QR for ${peserta.unique_id}:`, error?.message || error);
          // Continue processing other QR codes
        }
      }
      
      if (processedCount === 0) {
        return NextResponse.json(
          { success: false, message: 'Gagal memproses QR code' },
          { status: 500 }
        );
      }
      
      // Format divisi stats untuk summary
      const divisiStatsFormatted = Object.entries(divisiStats).map(([divisi, stats]) => ({
        divisi,
        count: stats.count
      }));
      
      // Add summary file dengan informasi lengkap (TANPA FAKULTAS)
      const summaryData = {
        total_qr_codes: processedCount,
        generated_at: new Date().toISOString(),
        structure: "organized_by_divisi_only",
        filters_applied: { 
          divisi: divisi || "all" 
        },
        divisi_breakdown: divisiStatsFormatted,
        total_divisi_count: Object.keys(divisiStats).length,
        file_naming_format: "NIM_Nama_Lengkap.png",
        qr_settings: {
          size: size,
          margin: margin,
          format: "PNG",
          error_correction: "M"
        },
        fields_included: ['unique_id', 'nama_lengkap', 'nim', 'divisi'], // TANPA FAKULTAS
        note: "Data panitia diorganisir berdasarkan DIVISI saja"
      };
      
      zip.file('summary.json', JSON.stringify(summaryData, null, 2));
      
      // Generate ZIP dengan compression
      const zipBuffer = await zip.generateAsync({ 
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      
      // Format nama file ZIP
      const timestamp = new Date().toISOString().split('T')[0];
      let zipFileName = '';
      
      if (type === 'all') {
        zipFileName = `qr_codes_all_divisi_${timestamp}.zip`;
      } else if (divisi) {
        zipFileName = `qr_codes_${sanitizeFilename(divisi)}_${timestamp}.zip`;
      } else {
        zipFileName = `qr_codes_bulk_${timestamp}.zip`;
      }
      
      return new NextResponse(new Uint8Array(zipBuffer), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${zipFileName}"`
        }
      });
    }
    
    return NextResponse.json(
      { success: false, message: 'Parameter type tidak valid. Gunakan: single, bulk, atau all' },
      { status: 400 }
    );
    
  } catch (error: any) {
    console.error('QR Download Error:', error?.message || error);
    return NextResponse.json(
      { success: false, message: 'Error saat mendownload QR code', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Regenerate QR codes dan operations lainnya
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, unique_ids, divisi, settings } = body;
    
    if (action === 'regenerate') {
      let query = 'SELECT * FROM panitia_peserta WHERE 1=1';
      const params: any[] = [];
      
      if (unique_ids && Array.isArray(unique_ids) && unique_ids.length > 0) {
        // Regenerate specific QR codes
        if (unique_ids.length > 100) {
          return NextResponse.json(
            { success: false, message: 'Maksimal 100 QR codes untuk regenerate sekaligus' },
            { status: 400 }
          );
        }
        
        const placeholders = unique_ids.map(() => '?').join(',');
        query += ` AND unique_id IN (${placeholders})`;
        params.push(...unique_ids);
      } else {
        // Regenerate by divisi (TANPA FAKULTAS)
        if (divisi) {
          query += ' AND divisi = ?';
          params.push(divisi);
        }
      }
      
      const [rows] = await db.execute<PesertaQR[]>(query, params);
      
      if (rows.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Tidak ada data untuk di-regenerate' },
          { status: 404 }
        );
      }

      if (rows.length > 500) {
        return NextResponse.json(
          { success: false, message: `Terlalu banyak data (${rows.length}). Maksimal 500 untuk regenerate sekaligus. Gunakan filter yang lebih spesifik.` },
          { status: 400 }
        );
      }
      
      const successData: any[] = [];
      const errorData: any[] = [];
      
      // QR settings dengan default values
      const qrSettings = {
        width: settings?.width || 300,
        margin: settings?.margin || 2,
        errorCorrectionLevel: settings?.errorCorrectionLevel || 'M',
        dark_color: settings?.dark_color || '#000000',
        light_color: settings?.light_color || '#FFFFFF'
      };
      
      for (const peserta of rows) {
        try {
          const qrData = generateQRData(peserta);
          const qrCode = await QRCode.toDataURL(qrData, {
            width: qrSettings.width,
            margin: qrSettings.margin,
            color: {
              dark: qrSettings.dark_color,
              light: qrSettings.light_color
            },
            errorCorrectionLevel: qrSettings.errorCorrectionLevel as any
          });
          
          await db.execute(
            'UPDATE panitia_peserta SET qr_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [qrCode, peserta.id]
          );
          
          successData.push({
            unique_id: peserta.unique_id,
            nama_lengkap: peserta.nama_lengkap,
            nim: peserta.nim,
            divisi: peserta.divisi,
            filename_format: formatQRFilename(peserta)
          });
          
        } catch (error: any) {
          console.error(`Error regenerating QR for ${peserta.unique_id}:`, error?.message || error);
          errorData.push({
            unique_id: peserta.unique_id,
            nama_lengkap: peserta.nama_lengkap,
            nim: peserta.nim,
            error: 'Gagal generate QR code'
          });
        }
      }
      
      return NextResponse.json({
        success: true,
        message: `QR code berhasil di-regenerate. ${successData.length} berhasil, ${errorData.length} gagal.`,
        data: {
          success: successData,
          errors: errorData,
          success_count: successData.length,
          error_count: errorData.length,
          settings_applied: qrSettings,
          file_naming_format: "NIM_Nama_Lengkap.png",
          fields_included: ['unique_id', 'nama_lengkap', 'nim', 'divisi']
        }
      });
    }
    
    else if (action === 'validate') {
      // Validate QR codes
      const [rows] = await db.execute<PesertaQR[]>(
        'SELECT unique_id, nama_lengkap, nim, divisi, qr_code, created_at FROM panitia_peserta ORDER BY divisi, nim'
      );
      
      const invalidQR: any[] = [];
      const validQR: any[] = [];
      const corruptedQR: any[] = [];
      
      for (const peserta of rows) {
        const baseData = {
          unique_id: peserta.unique_id,
          nama_lengkap: peserta.nama_lengkap,
          nim: peserta.nim,
          divisi: peserta.divisi,
          filename_format: formatQRFilename(peserta)
        };
        
        if (!peserta.qr_code || peserta.qr_code === '') {
          invalidQR.push({
            ...baseData,
            issue: 'QR code kosong'
          });
        } else {
          // Check if QR code is valid data URL
          if (!peserta.qr_code.startsWith('data:image/')) {
            corruptedQR.push({
              ...baseData,
              issue: 'QR code format tidak valid'
            });
          } else {
            validQR.push({
              ...baseData,
              created_at: peserta.created_at
            });
          }
        }
      }
      
      // Group by divisi untuk summary
      const divisiSummary = validQR.reduce((acc, item) => {
        if (!acc[item.divisi]) {
          acc[item.divisi] = 0;
        }
        acc[item.divisi]++;
        return acc;
      }, {} as { [key: string]: number });
      
      return NextResponse.json({
        success: true,
        data: {
          valid: validQR,
          invalid: invalidQR,
          corrupted: corruptedQR,
          valid_count: validQR.length,
          invalid_count: invalidQR.length,
          corrupted_count: corruptedQR.length,
          total_count: rows.length,
          health_percentage: ((validQR.length / rows.length) * 100).toFixed(2),
          divisi_summary: divisiSummary,
          file_naming_format: "NIM_Nama_Lengkap.png",
          fields_included: ['unique_id', 'nama_lengkap', 'nim', 'divisi']
        }
      });
    }
    
    else if (action === 'bulk_delete_qr') {
      // Delete QR codes (set to NULL)
      let query = 'UPDATE panitia_peserta SET qr_code = NULL, updated_at = CURRENT_TIMESTAMP WHERE 1=1';
      const params: any[] = [];
      
      if (unique_ids && Array.isArray(unique_ids)) {
        const placeholders = unique_ids.map(() => '?').join(',');
        query += ` AND unique_id IN (${placeholders})`;
        params.push(...unique_ids);
      } else if (divisi) {
        query += ' AND divisi = ?';
        params.push(divisi);
      } else {
        return NextResponse.json(
          { success: false, message: 'Perlu specify unique_ids atau divisi untuk delete QR' },
          { status: 400 }
        );
      }
      
      const [result] = await db.execute(query, params);
      
      return NextResponse.json({
        success: true,
        message: `${(result as any).affectedRows} QR codes berhasil dihapus`,
        affected_rows: (result as any).affectedRows
      });
    }
    
    else if (action === 'preview_structure') {
      // Preview struktur folder yang akan dibuat
      const [rows] = await db.execute<PesertaQR[]>(
        'SELECT divisi, nim, nama_lengkap FROM panitia_peserta WHERE qr_code IS NOT NULL ORDER BY divisi, nim'
      );
      
      const structure = rows.reduce((acc, peserta) => {
        if (!acc[peserta.divisi]) {
          acc[peserta.divisi] = [];
        }
        acc[peserta.divisi].push({
          filename: formatQRFilename(peserta),
          nim: peserta.nim,
          nama: peserta.nama_lengkap
        });
        return acc;
      }, {} as { [key: string]: any[] });
      
      const preview = Object.entries(structure).map(([divisi, files]) => ({
        folder: divisi,
        file_count: files.length,
        sample_files: files.slice(0, 3), // Show first 3 files as sample
        total_files_in_folder: files.length
      }));
      
      return NextResponse.json({
        success: true,
        preview_structure: preview,
        total_divisi: Object.keys(structure).length,
        total_files: rows.length,
        zip_filename_format: "qr_codes_all_divisi_YYYY-MM-DD.zip",
        file_naming_format: "NIM_Nama_Lengkap.png",
        fields_included: ['unique_id', 'nama_lengkap', 'nim', 'divisi'],
        structure_type: "organized_by_divisi_only",
        note: "Data panitia diorganisir berdasarkan DIVISI saja (tanpa fakultas)"
      });
    }
    
    else if (action === 'get_divisi_list') {
      // Get list of divisi untuk filter dropdown
      const [divisiList] = await db.execute<RowDataPacket[]>(
        'SELECT divisi, COUNT(*) as count FROM panitia_peserta WHERE qr_code IS NOT NULL GROUP BY divisi ORDER BY divisi'
      );
      
      return NextResponse.json({
        success: true,
        divisi_list: divisiList,
        total_divisi: divisiList.length
      });
    }
    
    else if (action === 'bulk_regenerate_by_divisi') {
      // Regenerate QR codes untuk divisi tertentu
      const { target_divisi } = body;
      
      if (!target_divisi) {
        return NextResponse.json(
          { success: false, message: 'Parameter target_divisi diperlukan' },
          { status: 400 }
        );
      }
      
      const [rows] = await db.execute<PesertaQR[]>(
        'SELECT * FROM panitia_peserta WHERE divisi = ?',
        [target_divisi]
      );
      
      if (rows.length === 0) {
        return NextResponse.json(
          { success: false, message: `Tidak ada data untuk divisi: ${target_divisi}` },
          { status: 404 }
        );
      }
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const peserta of rows) {
        try {
          const qrData = generateQRData(peserta);
          const qrCode = await QRCode.toDataURL(qrData, {
            width: 300,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' },
            errorCorrectionLevel: 'M'
          });
          
          await db.execute(
            'UPDATE panitia_peserta SET qr_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [qrCode, peserta.id]
          );
          
          successCount++;
        } catch (error) {
          errorCount++;
          console.error(`Error regenerating QR for ${peserta.unique_id}:`, error);
        }
      }
      
      return NextResponse.json({
        success: true,
        message: `Regenerate QR untuk divisi ${target_divisi} selesai. ${successCount} berhasil, ${errorCount} gagal.`,
        divisi: target_divisi,
        success_count: successCount,
        error_count: errorCount,
        total_processed: rows.length
      });
    }
    
    return NextResponse.json(
      { success: false, message: 'Action tidak dikenali. Gunakan: regenerate, validate, bulk_delete_qr, preview_structure, get_divisi_list, atau bulk_regenerate_by_divisi' },
      { status: 400 }
    );
    
  } catch (error: any) {
    console.error('QR Operation Error:', error?.message || error);
    return NextResponse.json(
      { success: false, message: 'Error saat operasi QR code', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT - Update QR code settings untuk specific peserta
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { unique_id, qr_settings, custom_data } = body;
    
    if (!unique_id) {
      return NextResponse.json(
        { success: false, message: 'Unique ID diperlukan' },
        { status: 400 }
      );
    }
    
    const [rows] = await db.execute<PesertaQR[]>(
      'SELECT * FROM panitia_peserta WHERE unique_id = ?',
      [unique_id]
    );
    
    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Data tidak ditemukan' },
        { status: 404 }
      );
    }
    
    const peserta = rows[0];
    
    // Generate QR data dengan custom data jika ada (TANPA FAKULTAS)
    let qrData = generateQRData(peserta);
    if (custom_data) {
      const parsedData = JSON.parse(qrData);
      qrData = JSON.stringify({ ...parsedData, ...custom_data });
    }
    
    // Apply custom QR settings
    const qrOptions = {
      width: qr_settings?.width || 300,
      margin: qr_settings?.margin || 2,
      color: {
        dark: qr_settings?.dark_color || '#000000',
        light: qr_settings?.light_color || '#FFFFFF'
      },
      errorCorrectionLevel: (qr_settings?.error_correction || 'M') as any
    };
    
    const qrCode = await QRCode.toDataURL(qrData, qrOptions);
    
    await db.execute(
      'UPDATE panitia_peserta SET qr_code = ?, updated_at = CURRENT_TIMESTAMP WHERE unique_id = ?',
      [qrCode, unique_id]
    );
    
    return NextResponse.json({
      success: true,
      message: 'QR code berhasil diupdate dengan settings custom',
      data: {
        unique_id,
        qr_code: qrCode,
        settings_applied: qrOptions,
        custom_data_applied: custom_data || null,
        filename_format: formatQRFilename(peserta),
        divisi_folder: sanitizeFilename(peserta.divisi),
        fields_included: ['unique_id', 'nama_lengkap', 'nim', 'divisi']
      }
    });
    
  } catch (error: any) {
    console.error('QR Update Error:', error?.message || error);
    return NextResponse.json(
      { success: false, message: 'Error saat update QR code', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete specific QR codes
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const unique_id = searchParams.get('unique_id');
    const permanent = searchParams.get('permanent') === 'true';
    
    if (!unique_id) {
      return NextResponse.json(
        { success: false, message: 'Unique ID diperlukan' },
        { status: 400 }
      );
    }
    
    const [rows] = await db.execute<PesertaQR[]>(
      'SELECT * FROM panitia_peserta WHERE unique_id = ?',
      [unique_id]
    );
    
    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Data tidak ditemukan' },
        { status: 404 }
      );
    }
    
    const peserta = rows[0];
    
    if (permanent) {
      // Delete entire record
      await db.execute('DELETE FROM panitia_peserta WHERE unique_id = ?', [unique_id]);
      
      return NextResponse.json({
        success: true,
        message: 'Data peserta dan QR code berhasil dihapus permanen',
        deleted_file_format: formatQRFilename(peserta),
        deleted_from_divisi: peserta.divisi
      });
    } else {
      // Just remove QR code
      await db.execute(
        'UPDATE panitia_peserta SET qr_code = NULL, updated_at = CURRENT_TIMESTAMP WHERE unique_id = ?',
        [unique_id]
      );
      
      return NextResponse.json({
        success: true,
        message: 'QR code berhasil dihapus. Data peserta tetap ada.',
        affected_file_format: formatQRFilename(peserta),
        divisi: peserta.divisi
      });
    }
    
  } catch (error: any) {
    console.error('QR Delete Error:', error?.message || error);
    return NextResponse.json(
      { success: false, message: 'Error saat menghapus QR code', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}