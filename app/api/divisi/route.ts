import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    console.log("API: Fetching divisi data...");
    
    const [rows] = await db.query(`
      SELECT 
        id, 
        nama
      FROM divisi 
      ORDER BY nama ASC
    `);

    console.log("API: Divisi data fetched successfully:", rows);
    
    return NextResponse.json(rows, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error("API: Database error during divisi fetch:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to fetch divisi data",
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

// Handler untuk POST - menambah divisi baru (opsional)
export async function POST(req: Request) {
  try {
    const { nama, deskripsi } = await req.json();
    
    if (!nama) {
      return NextResponse.json(
        { error: "Nama divisi is required" },
        { status: 400 }
      );
    }

    const [result]: any = await db.query(
      "INSERT INTO divisi (nama) VALUES (?)",
      [nama.trim()]
    );

    const [newDivisi] = await db.query(
      "SELECT id, nama FROM divisi WHERE id = ?",
      [result.insertId]
    );

    return NextResponse.json({
      success: true,
      message: "Divisi created successfully",
      data: newDivisi[0]
    }, { status: 201 });

  } catch (error: any) {
    console.error("Error creating divisi:", error);
    
    if (error.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "Divisi name already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { 
        error: "Failed to create divisi",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}