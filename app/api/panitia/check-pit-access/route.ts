import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  console.log("🔍 PIT Access Check API called");
  
  try {
    // 1. Verify session
    console.log("📝 Getting server session...");
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      console.log("❌ No session or email found");
      return NextResponse.json(
        { hasAccess: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    console.log("✅ Session found for:", session.user.email);

    // 2. Parse request body safely
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.log("❌ Failed to parse request body:", parseError);
      return NextResponse.json(
        { hasAccess: false, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { email } = requestBody;
    
    if (!email) {
      console.log("❌ No email in request body");
      return NextResponse.json(
        { hasAccess: false, error: "Email is required" },
        { status: 400 }
      );
    }

    // 3. Security check
    if (email !== session.user.email) {
      console.log("❌ Email mismatch - Session:", session.user.email, "Request:", email);
      return NextResponse.json(
        { hasAccess: false, error: "Email mismatch" },
        { status: 403 }
      );
    }

    // 4. Database query with error handling
    console.log("🔍 Checking PIT access for:", email);
    
    let rows;
    try {
      const queryResult = await db.query(`
        SELECT 
          p.id, 
          p.nama_lengkap, 
          p.email,
          p.divisi_id,
          p.jabatan_id,
          d.nama as divisi_nama,
          j.nama as jabatan_nama
        FROM panitia p
        INNER JOIN divisi d ON p.divisi_id = d.id
        INNER JOIN jabatan j ON p.jabatan_id = j.id
        WHERE p.email = ? AND d.nama = 'PIT'
      `, [email]);
      
      rows = queryResult[0];
      console.log("📊 Query result count:", Array.isArray(rows) ? rows.length : 0);
      
    } catch (dbError: any) {
      console.error("💥 Database query error:", dbError);
      return NextResponse.json(
        { 
          hasAccess: false, 
          error: "Database error",
          details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
        },
        { status: 500 }
      );
    }

    // 5. Check result
    if (Array.isArray(rows) && rows.length > 0) {
      const panitiaData = rows[0] as any;
      
      console.log("✅ PIT access granted for:", panitiaData.nama_lengkap);
      
      return NextResponse.json({
        hasAccess: true,
        panitiaData: {
          id: panitiaData.id,
          nama_lengkap: panitiaData.nama_lengkap,
          email: panitiaData.email,
          divisi_id: panitiaData.divisi_id,
          jabatan_id: panitiaData.jabatan_id,
          divisi_nama: panitiaData.divisi_nama,
          jabatan_nama: panitiaData.jabatan_nama
        }
      }, { status: 200 });
    } else {
      console.log("❌ User not found in PIT division");
      
      // Optional: Check if user exists in other divisions for better error message
      try {
        const [allPanitiaRows] = await db.query(`
          SELECT d.nama as divisi_nama, j.nama as jabatan_nama
          FROM panitia p
          INNER JOIN divisi d ON p.divisi_id = d.id
          INNER JOIN jabatan j ON p.jabatan_id = j.id
          WHERE p.email = ?
        `, [email]);
        
        if (Array.isArray(allPanitiaRows) && allPanitiaRows.length > 0) {
          const userDivisi = (allPanitiaRows[0] as any).divisi_nama;
          console.log("ℹ️ User found in division:", userDivisi);
          
          return NextResponse.json({
            hasAccess: false,
            error: "Not a PIT member",
            message: `You are in ${userDivisi} division, but this panel requires PIT division access`
          }, { status: 403 });
        }
      } catch (secondQueryError) {
        console.log("⚠️ Secondary query failed:", secondQueryError);
      }
      
      return NextResponse.json({
        hasAccess: false,
        error: "Not a PIT member",
        message: "You are not registered as a PIT division member"
      }, { status: 403 });
    }

  } catch (error: any) {
    console.error("💥 Unexpected error in PIT access check:", error);
    return NextResponse.json(
      { 
        hasAccess: false, 
        error: "Internal server error",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// Debug endpoint untuk development
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: "Debug endpoint only available in development" },
      { status: 404 }
    );
  }

  try {
    const session = await getServerSession(authOptions);
    
    // Test database connection
    const [testRows] = await db.query("SELECT COUNT(*) as count FROM panitia");
    const totalPanitia = (testRows as any)[0]?.count || 0;
    
    // Get PIT members
    const [pitRows] = await db.query(`
      SELECT p.nama_lengkap, p.email, j.nama as jabatan_nama
      FROM panitia p
      INNER JOIN divisi d ON p.divisi_id = d.id
      INNER JOIN jabatan j ON p.jabatan_id = j.id
      WHERE d.nama = 'PIT'
      ORDER BY j.nama, p.nama_lengkap
    `);

    return NextResponse.json({
      debug: true,
      timestamp: new Date().toISOString(),
      session: session ? {
        email: session.user?.email,
        name: session.user?.name
      } : null,
      database: {
        totalPanitia,
        pitMembers: pitRows
      }
    });

  } catch (error: any) {
    return NextResponse.json({
      debug: true,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}