import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    console.log("📊 API: Fetching dashboard statistics...");
    
    // 1. Get total panitia_peserta
    const [totalPesertaResult] = await db.query(`
      SELECT COUNT(*) as total FROM panitia_peserta
    `);
    const totalPanitia = (totalPesertaResult as any)[0].total;
    
    // 2. Get total unique divisi
    const [totalDivisiResult] = await db.query(`
      SELECT COUNT(DISTINCT divisi) as total FROM panitia_peserta
    `);
    const totalDivisi = (totalDivisiResult as any)[0].total;
    
    // 3. Get panitia_peserta count per divisi (sorted by count DESC)
    const [divisiStats] = await db.query(`
      SELECT 
        divisi as nama_divisi,
        COUNT(*) as jumlah_panitia
      FROM panitia_peserta 
      GROUP BY divisi 
      ORDER BY jumlah_panitia DESC, divisi ASC
    `);
    
    console.log("📊 Stats fetched successfully:", {
      totalPanitia,
      totalDivisi,
      divisiCount: (divisiStats as any[]).length
    });
    
    return NextResponse.json({
      success: true,
      data: {
        totalPanitia,
        totalDivisi,
        divisiStats: divisiStats
      }
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
    
  } catch (error: any) {
    console.error("💥 API: Database error during stats fetch:", error);
    
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch dashboard statistics",
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
  }
}