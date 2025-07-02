import { NextRequest, NextResponse } from 'next/server';
import { db, RowDataPacket } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const panitia_id = searchParams.get('panitia_id');
    const kegiatan_id = searchParams.get('kegiatan_id');
    const tanggal = searchParams.get('tanggal');
    const kegiatan_rangkaian_id = searchParams.get('kegiatan_rangkaian_id');

    if (!panitia_id || !kegiatan_id || !tanggal) {
      return NextResponse.json({
        success: false,
        message: 'Missing required parameters: panitia_id, kegiatan_id, tanggal'
      }, { status: 400 });
    }

    // Format date
    const formatDate = (dateInput: string): string => {
      const date = new Date(dateInput);
      return date.toISOString().split('T')[0];
    };

    const formattedDate = formatDate(tanggal);
    const rangkaianId = kegiatan_rangkaian_id === 'null' ? null : kegiatan_rangkaian_id;

    // Check existing consumption records
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT id, jenis_konsumsi, status_pengambilan, waktu_pengambilan, metode_konfirmasi
       FROM absensi_konsumsi 
       WHERE panitia_id = ? AND kegiatan_id = ? 
       AND (kegiatan_rangkaian_id = ? OR (kegiatan_rangkaian_id IS NULL AND ? IS NULL))
       AND tanggal_konsumsi = ? AND is_active = 1
       ORDER BY jenis_konsumsi`,
      [panitia_id, kegiatan_id, rangkaianId, rangkaianId, formattedDate]
    );

    return NextResponse.json({
      success: true,
      data: rows,
      message: `Found ${rows.length} consumption records`,
      metadata: {
        panitia_id: parseInt(panitia_id),
        kegiatan_id: parseInt(kegiatan_id),
        tanggal: formattedDate,
        kegiatan_rangkaian_id: rangkaianId ? parseInt(rangkaianId) : null
      }
    });

  } catch (error: any) {
    console.error('Error checking consumption status:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to check consumption status',
      error: error.message
    }, { status: 500 });
  }
}