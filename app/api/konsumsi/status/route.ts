// app/api/konsumsi/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db, RowDataPacket } from "@/lib/db";

interface KonsumsiStatusRow extends RowDataPacket {
  jenis_konsumsi: 'konsumsi_1' | 'konsumsi_2';
  status_pengambilan: 'belum_diambil' | 'sudah_diambil';
  waktu_pengambilan: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const panitia_id = searchParams.get("panitia_id");
    const kegiatan_id = searchParams.get("kegiatan_id");
    const tanggal = searchParams.get("tanggal");
    const kegiatan_rangkaian_id = searchParams.get("kegiatan_rangkaian_id");

    // Validasi parameter wajib
    if (!panitia_id || !kegiatan_id || !tanggal) {
      return NextResponse.json(
        { 
          success: false, 
          message: "Parameter panitia_id, kegiatan_id, dan tanggal diperlukan" 
        },
        { status: 400 }
      );
    }

    // Query untuk mendapatkan status konsumsi
    let query = `
      SELECT 
        jenis_konsumsi, 
        status_pengambilan, 
        waktu_pengambilan
      FROM absensi_konsumsi 
      WHERE panitia_id = ? 
        AND kegiatan_id = ? 
        AND tanggal_konsumsi = ? 
        AND is_active = 1
    `;
    
    const params: any[] = [panitia_id, kegiatan_id, tanggal];

    // Tambahkan filter rangkaian jika ada
    if (kegiatan_rangkaian_id) {
      query += " AND kegiatan_rangkaian_id = ?";
      params.push(kegiatan_rangkaian_id);
    } else {
      query += " AND kegiatan_rangkaian_id IS NULL";
    }

    query += " ORDER BY jenis_konsumsi ASC";

    const [rows] = await db.execute<KonsumsiStatusRow[]>(query, params);

    // Analisis status konsumsi
    let status = 0; // 0 = belum ada konsumsi
    const konsumsiData: Record<string, any> = {};

    for (const row of rows) {
      konsumsiData[row.jenis_konsumsi] = {
        status: row.status_pengambilan,
        waktu_pengambilan: row.waktu_pengambilan
      };

      if (row.jenis_konsumsi === 'konsumsi_1' && row.status_pengambilan === 'sudah_diambil') {
        status = Math.max(status, 1);
      }
      if (row.jenis_konsumsi === 'konsumsi_2' && row.status_pengambilan === 'sudah_diambil') {
        status = Math.max(status, 2);
      }
    }

    // Summary untuk response
    const summary = {
      konsumsi_1: konsumsiData.konsumsi_1?.status === 'sudah_diambil' ? 'sudah_diambil' : 'belum_diambil',
      konsumsi_2: konsumsiData.konsumsi_2?.status === 'sudah_diambil' ? 'sudah_diambil' : 'belum_diambil',
      total_konsumsi_diambil: status,
      max_konsumsi_allowed: 2
    };

    return NextResponse.json({
      success: true,
      message: `Status konsumsi: ${status}/2 konsumsi sudah diambil`,
      status: status, // 0 = belum ada, 1 = sudah konsumsi_1, 2 = sudah konsumsi_1 + konsumsi_2
      data: {
        panitia_id: parseInt(panitia_id),
        kegiatan_id: parseInt(kegiatan_id),
        tanggal: tanggal,
        kegiatan_rangkaian_id: kegiatan_rangkaian_id ? parseInt(kegiatan_rangkaian_id) : null,
        summary: summary,
        detail: konsumsiData
      }
    });

  } catch (error) {
    console.error("Error in /api/konsumsi/status:", error);
    return NextResponse.json(
      { 
        success: false, 
        message: "Internal server error", 
        error: process.env.NODE_ENV === "development" ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}