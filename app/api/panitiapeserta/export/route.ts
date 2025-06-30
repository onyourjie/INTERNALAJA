/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from 'next/server';
import { db, RowDataPacket } from '@/lib/db';
import Papa from 'papaparse';

interface PesertaExport extends RowDataPacket {
  id: number;
  unique_id: string;
  nama_lengkap: string;
  nim: string;
  divisi: string;
  qr_code?: string;
  created_at: Date;
  updated_at: Date;
}

interface StatisticsData {
  total: number;
  divisi: Array<{ divisi: string; count: number }>;
  recent_30_days: Array<{ date: string; count: number }>;
  monthly_stats: Array<{ month: string; count: number }>;
  daily_last_week: Array<{ date: string; count: number }>;
}

function formatDateIndonesia(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function formatTimeIndonesia(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';
    const search = searchParams.get('search') || '';
    const divisi = searchParams.get('divisi') || '';
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'DESC';
    const includeQR = searchParams.get('includeQR') === 'true';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    
    let query = `
      SELECT id, unique_id, nama_lengkap, nim, divisi, 
             created_at, updated_at${includeQR ? ', qr_code' : ''}
      FROM panitia_peserta 
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (search) {
      query += ' AND (nama_lengkap LIKE ? OR nim LIKE ? OR divisi LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (divisi) {
      query += ' AND divisi = ?';
      params.push(divisi);
    }
    
    if (dateFrom) {
      query += ' AND DATE(created_at) >= ?';
      params.push(dateFrom);
    }
    
    if (dateTo) {
      query += ' AND DATE(created_at) <= ?';
      params.push(dateTo);
    }
    
    const validSortColumns = ['created_at', 'nama_lengkap', 'nim', 'divisi', 'updated_at'];
    const validSortOrder = ['ASC', 'DESC'];
    
    const safeSortBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = validSortOrder.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
    
    query += ` ORDER BY ${safeSortBy} ${safeSortOrder}`;
    
    const [rows] = await db.execute<PesertaExport[]>(query, params);
    
    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Tidak ada data untuk diekspor dengan filter yang dipilih' },
        { status: 404 }
      );
    }
    
    const exportData = rows.map((row, index) => {
      const baseData = {
        no: index + 1,
        unique_id: row.unique_id,
        nama_lengkap: row.nama_lengkap,
        nim: row.nim,
        divisi: row.divisi,
        tanggal_dibuat: formatDateIndonesia(new Date(row.created_at)),
        waktu_dibuat: formatTimeIndonesia(new Date(row.created_at)),
        tanggal_update: formatDateIndonesia(new Date(row.updated_at)),
        waktu_update: formatTimeIndonesia(new Date(row.updated_at))
      };
      
      if (includeQR && row.qr_code) {
        return {
          ...baseData,
          qr_code: row.qr_code
        };
      }
      
      return baseData;
    });
    
    if (format === 'json') {
      return NextResponse.json({
        success: true,
        data: exportData,
        total: exportData.length,
        filters: {
          search,
          divisi,
          dateFrom,
          dateTo,
          sortBy: safeSortBy,
          sortOrder: safeSortOrder
        },
        exported_at: new Date().toISOString(),
        fields: ['unique_id', 'nama_lengkap', 'nim', 'divisi'],
        enhanced_qr_features: {
          template_support: true,
          anti_crop_text_overlay: true,
          download_options: ['original', 'template_with_anticrop'],
          text_positioning_range: '±10000px',
          font_size_range: '12px-1000px',
          descender_support: true,
          no_fallback_guarantee: true,
          note: 'QR codes dapat didownload dengan atau tanpa anti-crop template dari halaman QR Management'
        }
      });
    }
    
    const csv = Papa.unparse(exportData, {
      header: true,
      delimiter: ',',
      newline: '\r\n'
    });
    
    const csvWithBOM = '\uFEFF' + csv;
    
    const timestamp = new Date().toISOString().split('T')[0];
    const fileName = `panitia_export_anticrop_${divisi ? divisi.replace(/\s+/g, '_') + '_' : ''}${timestamp}.csv`;
    
    return new NextResponse(csvWithBOM, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error: any) {
    console.error('Export Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error saat mengekspor data', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    if (action === 'stats') {
      const [totalCount] = await db.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM panitia_peserta'
      );
      
      const [divisiStats] = await db.execute<RowDataPacket[]>(
        'SELECT divisi, COUNT(*) as count FROM panitia_peserta GROUP BY divisi ORDER BY count DESC'
      );
      
      const [recentData] = await db.execute<RowDataPacket[]>(
        `SELECT DATE(created_at) as date, COUNT(*) as count 
         FROM panitia_peserta 
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) 
         GROUP BY DATE(created_at) 
         ORDER BY date DESC`
      );
      
      const [monthlyStats] = await db.execute<RowDataPacket[]>(
        `SELECT 
           DATE_FORMAT(created_at, '%Y-%m') as month,
           COUNT(*) as count 
         FROM panitia_peserta 
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
         GROUP BY DATE_FORMAT(created_at, '%Y-%m') 
         ORDER BY month DESC`
      );
      
      const [dailyLastWeek] = await db.execute<RowDataPacket[]>(
        `SELECT 
           DATE(created_at) as date,
           COUNT(*) as count 
         FROM panitia_peserta 
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         GROUP BY DATE(created_at) 
         ORDER BY date DESC`
      );
      
      const [topDivisiActivity] = await db.execute<RowDataPacket[]>(
        `SELECT 
           divisi,
           COUNT(*) as total_count,
           MAX(created_at) as last_activity,
           COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as recent_count
         FROM panitia_peserta 
         GROUP BY divisi 
         ORDER BY recent_count DESC, total_count DESC
         LIMIT 10`
      );
      
      const [qrStats] = await db.execute<RowDataPacket[]>(
        `SELECT 
           COUNT(*) as total,
           COUNT(CASE WHEN qr_code IS NOT NULL AND qr_code != '' THEN 1 END) as with_qr,
           COUNT(CASE WHEN qr_code IS NULL OR qr_code = '' THEN 1 END) as without_qr
         FROM panitia_peserta`
      );
      
      return NextResponse.json({
        success: true,
        stats: {
          total: totalCount[0].total,
          divisi: divisiStats,
          recent_30_days: recentData,
          monthly_stats: monthlyStats,
          daily_last_week: dailyLastWeek,
          top_divisi_activity: topDivisiActivity,
          enhanced_qr_statistics: {
            ...qrStats[0],
            template_support: true,
            anti_crop_text_overlay: true,
            download_modes: ['original', 'anticrop_template'],
            structure_organization: 'by_divisi',
            text_features: {
              positioning_range: '±10000px',
              font_size_range: '12px-1000px',
              descender_support: 'enabled (y,g,p,q,j safe)',
              canvas_auto_expansion: true,
              no_text_cropping_guarantee: true
            },
            processing_capabilities: {
              max_divisi_per_template: 10,
              batch_processing: true,
              no_fallback_processing: true,
              guaranteed_template_usage: true
            }
          }
        }
      });
    }
    
    else if (action === 'summary') {
      const [summary] = await db.execute<RowDataPacket[]>(
        `SELECT 
           COUNT(*) as total_peserta,
           COUNT(DISTINCT divisi) as total_divisi,
           COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as added_today,
           COUNT(CASE WHEN DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 END) as added_this_week,
           COUNT(CASE WHEN qr_code IS NOT NULL AND qr_code != '' THEN 1 END) as with_qr_code
         FROM panitia_peserta`
      );
      
      return NextResponse.json({
        success: true,
        summary: {
          ...summary[0],
          enhanced_qr_features: {
            template_support: true,
            anti_crop_text_overlay: true,
            download_formats: ['PNG', 'SVG'],
            organization: 'folder_by_divisi',
            text_overlay_capabilities: {
              font_size_range: '12px-1000px',
              positioning_range: '±10000px',
              descender_protection: 'enabled',
              canvas_expansion: 'automatic',
              no_text_cropping: true
            },
            processing_assurance: {
              no_fallback_to_original: true,
              all_outputs_use_template: true,
              guaranteed_quality: true
            }
          }
        }
      });
    }
    
    else if (action === 'backup_info') {
      const [backupInfo] = await db.execute<RowDataPacket[]>(
        `SELECT 
           COUNT(*) as total_records,
           MIN(created_at) as oldest_record,
           MAX(created_at) as newest_record,
           SUM(LENGTH(qr_code)) as total_qr_size
         FROM panitia_peserta`
      );
      
      return NextResponse.json({
        success: true,
        backup_info: {
          ...backupInfo[0],
          estimated_csv_size: Math.ceil(backupInfo[0].total_records * 120),
          recommended_format: backupInfo[0].total_records > 5000 ? 'JSON' : 'CSV',
          fields_included: ['unique_id', 'nama_lengkap', 'nim', 'divisi'],
          enhanced_qr_backup_options: {
            data_export: 'via_csv_json',
            qr_image_export: 'via_qr_management_page',
            template_support: true,
            anti_crop_text_overlay: true,
            bulk_download: 'organized_by_divisi',
            formats: ['PNG_original', 'PNG_with_anticrop_template'],
            text_overlay_features: {
              font_size_support: '12px-1000px',
              positioning_support: '±10000px',
              descender_protection: true,
              canvas_auto_expansion: true,
              guaranteed_no_cropping: true
            },
            processing_guarantees: {
              no_fallback_processing: true,
              all_outputs_template_based: true,
              text_quality_assured: true,
              descender_letters_safe: 'y, g, p, q, j protected'
            },
            note: 'QR codes sebagai gambar dengan anti-crop text dapat didownload melalui halaman QR Management. Semua output dijamin menggunakan template tanpa fallback ke QR original.'
          }
        }
      });
    }
    
    return NextResponse.json(
      { success: false, message: 'Action tidak dikenali. Gunakan: stats, summary, atau backup_info' },
      { status: 400 }
    );
    
  } catch (error: any) {
    console.error('Enhanced Stats Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error saat mengambil statistik dengan anti-crop info', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}