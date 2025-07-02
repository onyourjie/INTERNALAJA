import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth"; 
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

    // 4. Database query with better error handling and logging
    console.log("🔍 Checking PIT access for:", email);
    
    let rows;
    try {
      // First, check if user exists at all
      const [userCheckResult] = await db.query(`
        SELECT COUNT(*) as count FROM panitia WHERE email = ?
      `, [email]);
      
      const userExists = (userCheckResult as any)[0]?.count > 0;
      console.log("👤 User exists in panitia table:", userExists);
      
      if (!userExists) {
        console.log("❌ User not found in panitia table");
        return NextResponse.json({
          hasAccess: false,
          error: "User not registered",
          message: "Your email is not registered in the panitia system"
        }, { status: 404 });
      }

      // Check PIT access with more detailed query
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
        LEFT JOIN divisi d ON p.divisi_id = d.id
        LEFT JOIN jabatan j ON p.jabatan_id = j.id
        WHERE p.email = ?
      `, [email]);
      
      rows = queryResult[0];
      console.log("📊 All user data:", rows);
      
      // Check specifically for PIT division
      if (Array.isArray(rows) && rows.length > 0) {
        const userData = rows[0] as any;
        console.log("🏢 User division:", userData.divisi_nama);
        
        // Case-insensitive comparison for PIT
        const isPIT = userData.divisi_nama && 
                     userData.divisi_nama.toString().toUpperCase().trim() === 'PIT';
        
        if (!isPIT) {
          console.log("❌ User not in PIT division, current division:", userData.divisi_nama);
          return NextResponse.json({
            hasAccess: false,
            error: "Not a PIT member",
            message: userData.divisi_nama 
              ? `You are in ${userData.divisi_nama} division, but this requires PIT division access`
              : "Your division is not set or invalid"
          }, { status: 403 });
        }

        // User is in PIT division
        console.log("✅ PIT access granted for:", userData.nama_lengkap);
        
        return NextResponse.json({
          hasAccess: true,
          panitiaData: {
            id: userData.id,
            nama_lengkap: userData.nama_lengkap,
            email: userData.email,
            divisi_id: userData.divisi_id,
            jabatan_id: userData.jabatan_id,
            divisi_nama: userData.divisi_nama,
            jabatan_nama: userData.jabatan_nama
          }
        }, { status: 200 });
      } else {
        console.log("❌ No user data found");
        return NextResponse.json({
          hasAccess: false,
          error: "User data not found",
          message: "Unable to retrieve your panitia information"
        }, { status: 404 });
      }
      
    } catch (dbError: any) {
      console.error("💥 Database query error:", dbError);
      console.error("Error details:", {
        message: dbError.message,
        code: dbError.code,
        sqlState: dbError.sqlState,
        sql: dbError.sql
      });
      
      return NextResponse.json(
        { 
          hasAccess: false, 
          error: "Database connection error",
          message: "Unable to verify your access. Please try again later.",
          details: process.env.NODE_ENV === 'development' ? {
            error: dbError.message,
            code: dbError.code
          } : undefined
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error("💥 Unexpected error in PIT access check:", error);
    console.error("Error stack:", error.stack);
    
    return NextResponse.json(
      { 
        hasAccess: false, 
        error: "Server error",
        message: "An unexpected error occurred. Please contact support.",
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack
        } : undefined
      },
      { status: 500 }
    );
  }
}

// Enhanced debug endpoint
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
    
    // Get all divisions
    const [divisiRows] = await db.query("SELECT * FROM divisi ORDER BY nama");
    
    // Get all jabatan
    const [jabatanRows] = await db.query("SELECT * FROM jabatan ORDER BY nama");
    
    // Get PIT members
    const [pitRows] = await db.query(`
      SELECT p.nama_lengkap, p.email, p.divisi_id, p.jabatan_id, d.nama as divisi_nama, j.nama as jabatan_nama
      FROM panitia p
      LEFT JOIN divisi d ON p.divisi_id = d.id
      LEFT JOIN jabatan j ON p.jabatan_id = j.id
      WHERE d.nama = 'PIT'
      ORDER BY j.nama, p.nama_lengkap
    `);

    // Get current user info if session exists
    let currentUserInfo = null;
    if (session?.user?.email) {
      const [userRows] = await db.query(`
        SELECT p.*, d.nama as divisi_nama, j.nama as jabatan_nama
        FROM panitia p
        LEFT JOIN divisi d ON p.divisi_id = d.id
        LEFT JOIN jabatan j ON p.jabatan_id = j.id
        WHERE p.email = ?
      `, [session.user.email]);
      
      currentUserInfo = Array.isArray(userRows) && userRows.length > 0 ? userRows[0] : null;
    }

    return NextResponse.json({
      debug: true,
      timestamp: new Date().toISOString(),
      session: session ? {
        email: session.user?.email,
        name: session.user?.name
      } : null,
      currentUser: currentUserInfo,
      database: {
        totalPanitia,
        totalDivisi: Array.isArray(divisiRows) ? divisiRows.length : 0,
        totalJabatan: Array.isArray(jabatanRows) ? jabatanRows.length : 0,
        pitMembersCount: Array.isArray(pitRows) ? pitRows.length : 0,
        divisions: divisiRows,
        positions: jabatanRows,
        pitMembers: pitRows
      }
    });

  } catch (error: any) {
    console.error("Debug endpoint error:", error);
    return NextResponse.json({
      debug: true,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}