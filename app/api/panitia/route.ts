/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db"; // Mengimpor koneksi database
import { v4 as uuidv4 } from "uuid";

// Utilitas: Validasi format NIM (jika diperlukan untuk future use)
const isValidNIM = (nim: string): boolean => {
  return /^\d{8,15}$/.test(nim); // Memastikan panjang NIM di antara 8-15 digit
};

// Handler untuk `GET` request: Mengambil data panitia
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (email) {
      // Ambil data panitia spesifik berdasarkan email dengan join ke tabel divisi dan jabatan
      const [rows] = await db.query(`
        SELECT 
          p.id,
          p.nama_lengkap as name,
          p.email,
          d.nama as divisi,
          j.nama as role,
          DATE_FORMAT(p.created_at, '%d %M %Y') as bergabung
        FROM panitia p
        LEFT JOIN divisi d ON p.divisi_id = d.id
        LEFT JOIN jabatan j ON p.jabatan_id = j.id
        WHERE p.email = ?
      `, [email]);

      if (Array.isArray(rows) && rows.length > 0) {
        return NextResponse.json(rows[0]);
      } else {
        return NextResponse.json({
          error: "Panitia not found",
        }, { status: 404 });
      }
    } else {
      // Ambil semua data panitia dengan join ke tabel divisi dan jabatan
      const [rows] = await db.query(`
        SELECT 
          p.id, 
          p.nama_lengkap, 
          p.email,
          d.nama as nama_divisi,
          j.nama as nama_jabatan,
          DATE_FORMAT(p.created_at, '%d %M %Y %H:%i:%s') AS created_at_formatted
        FROM panitia p
        LEFT JOIN divisi d ON p.divisi_id = d.id
        LEFT JOIN jabatan j ON p.jabatan_id = j.id
        ORDER BY p.created_at DESC
        LIMIT 50
      `);

      return NextResponse.json(rows);
    }
  } catch (err) {
    console.error("Database error:", err);
    return NextResponse.json({
      error: "Failed to fetch panitia data",
    }, { status: 500 });
  }
}

// Handler untuk `POST` request: Menambahkan panitia baru
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { nama_lengkap, email, divisi_id, jabatan_id } = data;

    // Validasi: Memastikan semua data wajib diisi
    if (!nama_lengkap || !email || !divisi_id || !jabatan_id) {
      return NextResponse.json({
        error: "All required fields must be filled",
      }, { status: 400 });
    }

    // Validasi email UB
    const domain = email.split("@")[1];
    if (domain !== "student.ub.ac.id") {
      return NextResponse.json({
        error: "Email must be from student.ub.ac.id domain",
      }, { status: 400 });
    }

    // Menyimpan data ke database
    const [result]: any = await db.query(
      `INSERT INTO panitia 
        (nama_lengkap, email, divisi_id, jabatan_id) 
      VALUES (?, ?, ?, ?)`,
      [nama_lengkap, email, divisi_id, jabatan_id]
    );

    const insertedId = result.insertId;

    // Mengambil data yang baru saja ditambahkan dengan join
    const [insertedData] = await db.query<any[]>(
      `SELECT 
        p.id, 
        p.nama_lengkap, 
        p.email,
        d.nama as nama_divisi,
        j.nama as nama_jabatan,
        DATE_FORMAT(p.created_at, '%d %M %Y %H:%i') AS created_at_formatted
      FROM panitia p
      LEFT JOIN divisi d ON p.divisi_id = d.id
      LEFT JOIN jabatan j ON p.jabatan_id = j.id
      WHERE p.id = ?`,
      [insertedId]
    );

    return NextResponse.json({
      success: true,
      message: "Panitia added successfully",
      data: insertedData[0] || null,
    });
  } catch (err: any) {
    console.error("Database error:", err);

    // Error handling khusus untuk duplikasi
    if (err.code === "ER_DUP_ENTRY") {
      if (err.sqlMessage.includes("email")) {
        return NextResponse.json({
          error: "Email already exists",
        }, { status: 409 });
      }
    }

    return NextResponse.json(
      { error: "Failed to add panitia" },
      { status: 500 }
    );
  }
}

// Handler untuk `PUT` request: Update data panitia
export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({
        error: "ID is required",
      }, { status: 400 });
    }

    const { nama_lengkap, divisi_id, jabatan_id } = await req.json();

    // Validasi: Nama diperlukan
    if (!nama_lengkap) {
      return NextResponse.json({
        error: "Nama lengkap is required",
      }, { status: 400 });
    }

    // Update data panitia
    await db.query(
      `UPDATE panitia 
       SET nama_lengkap = ?, divisi_id = ?, jabatan_id = ?
       WHERE id = ?`,
      [nama_lengkap, divisi_id, jabatan_id, id]
    );

    // Ambil data yang sudah diupdate
    const [updatedData] = await db.query<any[]>(
      `SELECT 
        p.id, 
        p.nama_lengkap, 
        p.email,
        d.nama as nama_divisi,
        j.nama as nama_jabatan,
        DATE_FORMAT(p.created_at, '%d %M %Y %H:%i') AS created_at_formatted
      FROM panitia p
      LEFT JOIN divisi d ON p.divisi_id = d.id
      LEFT JOIN jabatan j ON p.jabatan_id = j.id
      WHERE p.id = ?`,
      [id]
    );

    return NextResponse.json({
      success: true,
      message: "Panitia updated successfully",
      data: updatedData[0] || null,
    });
  } catch (err) {
    console.error("Error updating panitia:", err);
    return NextResponse.json({
      error: "Failed to update panitia",
    }, { status: 500 });
  }
}

// Handler untuk `DELETE` request: Hapus data panitia
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({
        error: "ID is required",
      }, { status: 400 });
    }

    // Hapus data panitia
    await db.query("DELETE FROM panitia WHERE id = ?", [id]);

    return NextResponse.json({
      success: true,
      message: "Panitia deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting panitia:", err);
    return NextResponse.json({
      error: "Failed to delete panitia",
    }, { status: 500 });
  }
}