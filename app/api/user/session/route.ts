import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, RowDataPacket } from "@/lib/db";

// Interface untuk data panitia dari database - updated to match your actual schema
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
        { 
          success: false, 
          error: "Unauthorized",
          message: "No session or email found" 
        },
        { status: 401 }
      );
    }

    console.log("🔍 Session API - Checking user:", session.user.email);

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

    console.log("🔍 Session API - Query result:", {
      rowCount: rows?.length || 0,
      email: session.user.email,
      hasData: rows && rows.length > 0
    });

    if (!rows || rows.length === 0) {
      console.log("❌ Session API - No panitia data found for:", session.user.email);
      return NextResponse.json(
        { 
          success: false,
          error: "User not found in panitia table",
          message: `No panitia record found for email: ${session.user.email}`,
          data: {
            session: {
              user: {
                id: session.user.id,
                name: session.user.name,
                email: session.user.email,
                image: session.user.image
              }
            },
            panitia: null
          }
        },
        { status: 404 }
      );
    }

    const panitiaData = rows[0];
    
    console.log("✅ Session API - Found panitia data:", {
      id: panitiaData.id,
      nama: panitiaData.nama_lengkap,
      divisi: panitiaData.divisi_nama
    });
    
    return NextResponse.json({
      success: true,
      data: {
        session: {
          user: {
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            image: session.user.image
          }
        },
        panitia: {
          id: panitiaData.id,
          nama_lengkap: panitiaData.nama_lengkap,
          email: panitiaData.email,
          divisi_id: panitiaData.divisi_id,
          jabatan_id: panitiaData.jabatan_id,
          divisi_nama: panitiaData.divisi_nama || null,
          jabatan_nama: panitiaData.jabatan_nama || null,
          isPIT: panitiaData.divisi_nama === 'PIT',
          is_active: true
        }
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error("❌ Session API Error:", error);
    
    return NextResponse.json(
      { 
        success: false,
        error: "Internal server error",
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}