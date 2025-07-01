// File: app/api/auth/redirect/route.ts (Debug Version)

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth"; // Change this line
import { db, RowDataPacket } from "@/lib/db";

interface PanitiaData extends RowDataPacket {
  divisi_nama: string;
  nama_lengkap: string;
  email: string;
}

export async function GET() {
  try {
    console.log("🔍 Debug: Starting redirect API check...");
    
    const session = await getServerSession(authOptions);
    console.log("🔍 Debug: Session data:", JSON.stringify(session, null, 2));
    
    if (!session?.user?.email) {
      console.log("❌ Debug: No session or email found");
      return NextResponse.json(
        { error: "Unauthorized", redirectTo: "/" },
        { status: 401 }
      );
    }

    console.log("🔍 Debug: Looking for user with email:", session.user.email);

    // Query untuk mendapatkan divisi user dengan lebih detail untuk debugging
    const [rows] = await db.query<PanitiaData[]>(`
      SELECT 
        p.nama_lengkap,
        p.email,
        d.nama as divisi_nama,
        j.nama as jabatan_nama
      FROM panitia p
      LEFT JOIN divisi d ON p.divisi_id = d.id
      LEFT JOIN jabatan j ON p.jabatan_id = j.id
      WHERE p.email = ?
    `, [session.user.email]);

    console.log("🔍 Debug: Query result:", JSON.stringify(rows, null, 2));

    if (!rows || rows.length === 0) {
      console.log("❌ Debug: User not found in panitia table");
      return NextResponse.json(
        { error: "User not found in panitia table", redirectTo: "/" },
        { status: 404 }
      );
    }

    const userData = rows[0];
    const divisiNama = userData.divisi_nama;
    
    console.log("🔍 Debug: Found user:", userData.nama_lengkap);
    console.log("🔍 Debug: User divisi:", divisiNama);

    let redirectTo = "/dashboard"; // Default redirect

    // Tentukan redirect berdasarkan divisi (sesuai dengan data yang ada)
    switch (divisiNama) {
      case "KESTARI":
        redirectTo = "/dashboardkestari";
        console.log("✅ Debug: Redirecting to KESTARI dashboard");
        break;
      case "Konsumsi":
        redirectTo = "/dashboardkonsumsi";
        console.log("✅ Debug: Redirecting to Konsumsi dashboard");
        break;
      case "PIT":
        redirectTo = "/dashboard";
        console.log("✅ Debug: Redirecting to PIT dashboard");
        break;
      default:
        redirectTo = "/dashboard";
        console.log("✅ Debug: Redirecting to default dashboard for divisi:", divisiNama);
        break;
    }

    console.log("🎯 Debug: Final redirect decision:", redirectTo);

    return NextResponse.json({
      success: true,
      user: {
        nama: userData.nama_lengkap,
        email: userData.email,
        divisi: divisiNama
      },
      redirectTo
    }, { status: 200 });

  } catch (error: any) {
    console.error("❌ Debug: Error in redirect API:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to determine redirect",
        redirectTo: "/dashboard",
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}