import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    console.log("API: Fetching jabatan data...");
    
    const [rows] = await db.query(`
      SELECT 
        id, 
        nama
      FROM jabatan 
      ORDER BY 
        CASE 
          WHEN nama = 'Koordinator' THEN 1
          WHEN nama = 'Wakil Koordinator' THEN 2
          WHEN nama = 'Staf' THEN 3
          ELSE 4
        END,
        nama ASC
    `);

    console.log("API: Jabatan data fetched successfully:", rows);
    
    return NextResponse.json(rows, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error("API: Database error during jabatan fetch:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to fetch jabatan data",
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

// Handler untuk POST - menambah jabatan baru (opsional)
export async function POST(req: Request) {
  try {
    const { nama, deskripsi } = await req.json();
    
    if (!nama) {
      return NextResponse.json(
        { error: "Nama jabatan is required" },
        { status: 400 }
      );
    }

    const [result]: any = await db.query(
      "INSERT INTO jabatan (nama) VALUES (?)",
      [nama.trim()]
    );

    const [newJabatan] = await db.query(
      "SELECT id, nama FROM jabatan WHERE id = ?",
      [result.insertId]
    );

    return NextResponse.json({
      success: true,
      message: "Jabatan created successfully",
      data: newJabatan[0]
    }, { status: 201 });

  } catch (error: any) {
    console.error("Error creating jabatan:", error);
    
    if (error.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "Jabatan name already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { 
        error: "Failed to create jabatan",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}