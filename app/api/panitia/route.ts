/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Utilitas: Validasi format email UB
const isValidUBEmail = (email: string): boolean => {
  return email.endsWith("@student.ub.ac.id") && email.includes("@");
};

// Handler untuk `GET` request: Mengambil data panitia
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const id = searchParams.get('id');

    if (id) {
      const panitiaId = parseInt(id);
      if (isNaN(panitiaId)) {
        return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
      }

      const [rows] = await db.query(`
        SELECT p.id, COALESCE(p.nama_lengkap, u.name) as nama_lengkap, u.email,
               p.divisi_id, p.jabatan_id, COALESCE(d.nama, '') as nama_divisi, 
               COALESCE(j.nama, '') as nama_jabatan,
               DATE_FORMAT(p.created_at, '%d %M %Y %H:%i:%s') as created_at_formatted
        FROM panitia p
        INNER JOIN users u ON p.email = u.email
        LEFT JOIN divisi d ON p.divisi_id = d.id
        LEFT JOIN jabatan j ON p.jabatan_id = j.id
        WHERE p.id = ?`, [panitiaId]);

      if (Array.isArray(rows) && rows.length > 0) {
        return NextResponse.json(rows[0]);
      } else {
        return NextResponse.json({ error: "Panitia not found" }, { status: 404 });
      }
    } else if (email) {
      const [rows] = await db.query(`
        SELECT p.id, u.name as nama_lengkap, u.email,
               d.nama as divisi, j.nama as role,
               DATE_FORMAT(p.created_at, '%d %M %Y') as bergabung
        FROM panitia p
        INNER JOIN users u ON p.email = u.email
        LEFT JOIN divisi d ON p.divisi_id = d.id
        LEFT JOIN jabatan j ON p.jabatan_id = j.id
        WHERE p.email = ?`, [email]);

      return Array.isArray(rows) && rows.length > 0
        ? NextResponse.json(rows[0])
        : NextResponse.json({ error: "Panitia not found" }, { status: 404 });
    } else {
      const [rows] = await db.query(`
        SELECT p.id, COALESCE(p.nama_lengkap, u.name) as nama_lengkap, u.email,
               COALESCE(d.nama, '') as nama_divisi, COALESCE(j.nama, '') as nama_jabatan,
               DATE_FORMAT(p.created_at, '%d %M %Y %H:%i:%s') AS created_at_formatted
        FROM panitia p
        INNER JOIN users u ON p.email = u.email
        LEFT JOIN divisi d ON p.divisi_id = d.id
        LEFT JOIN jabatan j ON p.jabatan_id = j.id
        ORDER BY p.created_at DESC
        LIMIT 50`);

      return NextResponse.json(rows);
    }
  } catch (err: any) {
    console.error("Database error:", err);
    return NextResponse.json({
      error: "Failed to fetch panitia data",
      message: err.message
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { nama_lengkap, email, divisi_id, jabatan_id } = data;

    // Validasi dasar
    if (!nama_lengkap || !email || !divisi_id || !jabatan_id) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    if (!isValidUBEmail(email)) {
      return NextResponse.json({ error: "Invalid UB email address" }, { status: 400 });
    }

    // Validasi existensi foreign keys
    const [divisiCheck] = await db.query("SELECT id FROM divisi WHERE id = ?", [divisi_id]);
    const [jabatanCheck] = await db.query("SELECT id FROM jabatan WHERE id = ?", [jabatan_id]);

    if (!Array.isArray(divisiCheck) || divisiCheck.length === 0) {
      return NextResponse.json({ error: "Invalid divisi ID" }, { status: 400 });
    }

    if (!Array.isArray(jabatanCheck) || jabatanCheck.length === 0) {
      return NextResponse.json({ error: "Invalid jabatan ID" }, { status: 400 });
    }

    // Mulai transaksi
    await db.query("START TRANSACTION");

    try {
      // Update atau insert ke users
      const [existingUser] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
      let userId;

      if (Array.isArray(existingUser) && existingUser.length > 0) {
        userId = (existingUser[0] as any).id;
        await db.query("UPDATE users SET name = ? WHERE id = ?", [nama_lengkap, userId]);
      } else {
        const [userResult]: any = await db.query(
          "INSERT INTO users (email, name) VALUES (?, ?)",
          [email, nama_lengkap]
        );
        userId = userResult.insertId;
      }

      // Insert ke panitia
      const [panitiaResult]: any = await db.query(
        `INSERT INTO panitia (nama_lengkap, email, divisi_id, jabatan_id) 
         VALUES (?, ?, ?, ?)`,
        [nama_lengkap, email, divisi_id, jabatan_id]
      );

      // Commit transaksi
      await db.query("COMMIT");

      // Ambil data yang baru dibuat
      const [insertedData] = await db.query<any[]>(
        `SELECT p.id, u.name as nama_lengkap, u.email, d.nama as nama_divisi, j.nama as nama_jabatan
         FROM panitia p
         JOIN users u ON p.email = u.email
         LEFT JOIN divisi d ON p.divisi_id = d.id
         LEFT JOIN jabatan j ON p.jabatan_id = j.id
         WHERE p.id = ?`,
        [panitiaResult.insertId]
      );

      return NextResponse.json({
        success: true,
        data: insertedData[0] || null,
      }, { status: 201 });

    } catch (innerErr: any) {
      // Rollback jika ada error
      await db.query("ROLLBACK");
      console.error("Transaction error:", innerErr);

      if (innerErr.code === "ER_DUP_ENTRY") {
        return NextResponse.json({ error: "Duplicate email entry" }, { status: 409 });
      }

      return NextResponse.json({ 
        error: "Database operation failed",
        details: innerErr.message
      }, { status: 500 });
    }

  } catch (err: any) {
    console.error("Server error:", err);
    return NextResponse.json({
      error: "Internal server error",
      message: err.message
    }, { status: 500 });
  }
}


// Handler untuk `PUT` request: Update data panitia
export async function PUT(req: NextRequest) {
  try {
    console.log("API: PUT /api/panitia called");
    
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

    // Validasi nama lengkap
    if (nama_lengkap.trim().length < 2) {
      return NextResponse.json({
        error: "Nama lengkap must be at least 2 characters",
      }, { status: 400 });
    }

    // Cek apakah panitia exists dan ambil email
    const [panitiaCheck] = await db.query(
      "SELECT id, email FROM panitia WHERE id = ?",
      [id]
    );
    
    if (!Array.isArray(panitiaCheck) || panitiaCheck.length === 0) {
      return NextResponse.json({
        error: "Panitia not found",
      }, { status: 404 });
    }

    const panitiaEmail = (panitiaCheck[0] as any).email;

    // Mulai transaksi
    await db.query("START TRANSACTION");

    try {
      // Update nama di tabel users
      await db.query(
        "UPDATE users SET name = ? WHERE email = ?",
        [nama_lengkap.trim(), panitiaEmail]
      );

      // Build update query untuk panitia dynamically
      const updateFields = [];
      const updateValues = [];
      
      updateFields.push("nama_lengkap = ?");
      updateValues.push(nama_lengkap.trim());

      if (divisi_id) {
        const divisiIdNum = parseInt(divisi_id);
        if (!isNaN(divisiIdNum)) {
          // Validate divisi exists
          const [divisiCheckUpdate] = await db.query(
            "SELECT id FROM divisi WHERE id = ?",
            [divisiIdNum]
          );
          
          if (Array.isArray(divisiCheckUpdate) && divisiCheckUpdate.length > 0) {
            updateFields.push("divisi_id = ?");
            updateValues.push(divisiIdNum);
          }
        }
      }

      if (jabatan_id) {
        const jabatanIdNum = parseInt(jabatan_id);
        if (!isNaN(jabatanIdNum)) {
          // Validate jabatan exists
          const [jabatanCheckUpdate] = await db.query(
            "SELECT id FROM jabatan WHERE id = ?",
            [jabatanIdNum]
          );
          
          if (Array.isArray(jabatanCheckUpdate) && jabatanCheckUpdate.length > 0) {
            updateFields.push("jabatan_id = ?");
            updateValues.push(jabatanIdNum);
          }
        }
      }

      updateValues.push(id);

      // Update data panitia
      await db.query(
        `UPDATE panitia SET ${updateFields.join(", ")} WHERE id = ?`,
        updateValues
      );

      // Commit transaksi
      await db.query("COMMIT");

      // Ambil data yang sudah diupdate
      const [updatedData] = await db.query<any[]>(
        `SELECT 
          p.id, 
          u.name as nama_lengkap, 
          u.email,
          d.nama as nama_divisi,
          j.nama as nama_jabatan,
          DATE_FORMAT(p.created_at, '%d %M %Y %H:%i') AS created_at_formatted
        FROM panitia p
        INNER JOIN users u ON p.email = u.email
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

    } catch (innerErr: any) {
      await db.query("ROLLBACK");
      throw innerErr;
    }

  } catch (err: any) {
    console.error("API: Error updating panitia:", err);
    return NextResponse.json({
      error: "Failed to update panitia",
      message: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 });
  }
}

// Handler untuk `DELETE` request: Hapus data panitia
export async function DELETE(req: NextRequest) {
  try {
    console.log("API: DELETE /api/panitia called");
    
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({
        error: "ID is required",
      }, { status: 400 });
    }

    // Cek apakah panitia exists dan ambil data
    const [panitiaCheck] = await db.query(
      "SELECT id, nama_lengkap, email FROM panitia WHERE id = ?",
      [id]
    );
    
    if (!Array.isArray(panitiaCheck) || panitiaCheck.length === 0) {
      return NextResponse.json({
        error: "Panitia not found",
      }, { status: 404 });
    }

    const panitiaData = panitiaCheck[0] as any;

    // Mulai transaksi
    await db.query("START TRANSACTION");

    try {
      // Hapus data panitia terlebih dahulu
      await db.query("DELETE FROM panitia WHERE id = ?", [id]);

      // Cek apakah user masih digunakan di tabel lain (misalnya sessions, accounts, etc.)
      // Untuk sekarang, kita tidak hapus user dari tabel users untuk menjaga integritas data login
      // Jika ingin menghapus user juga, bisa ditambahkan logika pengecekan di sini

      // Commit transaksi
      await db.query("COMMIT");

      return NextResponse.json({
        success: true,
        message: "Panitia deleted successfully",
        data: panitiaData
      });

    } catch (innerErr: any) {
      await db.query("ROLLBACK");
      throw innerErr;
    }

  } catch (err: any) {
    console.error("API: Error deleting panitia:", err);
    return NextResponse.json({
      error: "Failed to delete panitia",
      message: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 });
  }
}