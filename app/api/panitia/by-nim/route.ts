// app/api/panitia/by-nim/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db, RowDataPacket } from "@/lib/db";

interface PanitiaRow extends RowDataPacket {
  id: number;
  unique_id: string;
  nama_lengkap: string;
  nim: string;
  divisi: string;
  is_active: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const nim = searchParams.get("nim");

    if (!nim) {
      return NextResponse.json(
        { success: false, message: "Parameter 'nim' diperlukan" },
        { status: 400 }
      );
    }

    // Query untuk mendapatkan data panitia berdasarkan NIM
    const [rows] = await db.execute<PanitiaRow[]>(
      `SELECT 
        id, 
        unique_id, 
        nama_lengkap, 
        nim, 
        divisi, 
        is_active
      FROM panitia_peserta 
      WHERE nim = ? AND is_active = 1`,
      [nim.toUpperCase()]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Panitia dengan NIM ${nim} tidak ditemukan atau tidak aktif` 
        },
        { status: 404 }
      );
    }

    const panitia = rows[0];

    return NextResponse.json({
      success: true,
      message: "Data panitia ditemukan",
      panitia_id: panitia.id, // Keep backward compatibility
      data: {
        panitia_id: panitia.id,
        unique_id: panitia.unique_id,
        nama_lengkap: panitia.nama_lengkap,
        nim: panitia.nim,
        divisi: panitia.divisi,
        is_active: panitia.is_active
      }
    });

  } catch (error) {
    console.error("Error in /api/panitia/by-nim:", error);
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