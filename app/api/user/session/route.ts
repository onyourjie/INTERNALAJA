// File: app/api/user/session/route.ts (Versi Optimized)

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db, RowDataPacket } from "@/lib/db";

// Interface untuk data panitia dari database
interface PanitiaData extends RowDataPacket {
  id: number;
  nama_lengkap: string;
  email: string;
  divisi_id: number;
  jabatan_id: number;
  divisi_nama: string;
  jabatan_nama: string;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Query untuk mendapatkan data panitia lengkap dengan divisi dan jabatan
    const [rows] = await db.query<PanitiaData[]>(`
      SELECT 
        p.id,
        p.nama_lengkap,
        p.email,
        p.divisi_id,
        p.jabatan_id,
        d.nama as divisi_nama,
        j.nama as jabatan_nama
      FROM panitia p
      LEFT JOIN divisi d ON p.divisi_id = d.id
      LEFT JOIN jabatan j ON p.jabatan_id = j.id
      WHERE p.email = ?
    `, [session.user.email]);

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: "User not found in panitia table" },
        { status: 404 }
      );
    }

    const panitiaData = rows[0];
    
    return NextResponse.json({
      user: {
        // Data dari session
        session_id: session.user.id,
        session_name: session.user.name,
        session_image: session.user.image,
        // Data dari tabel panitia
        panitia_id: panitiaData.id,
        nama_lengkap: panitiaData.nama_lengkap,
        email: panitiaData.email,
        divisi_id: panitiaData.divisi_id,
        jabatan_id: panitiaData.jabatan_id,
        divisi_nama: panitiaData.divisi_nama,
        jabatan_nama: panitiaData.jabatan_nama,
        // Flag untuk cek divisi PIT
        isPIT: panitiaData.divisi_nama === 'PIT'
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error("Error fetching user session data:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to fetch user data",
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}