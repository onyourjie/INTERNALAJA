/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// File: app/api/panitia/edit/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Utilitas: Validasi format email UB
const isValidUBEmail = (email: string): boolean => {
  return email.endsWith("@student.ub.ac.id") && email.includes("@");
};

// Handler untuk `GET` request: Mengambil data panitia berdasarkan ID
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    console.log(`API: GET /api/panitia/edit/${id} called`);
    
    // Validasi ID
    if (!id) {
      return NextResponse.json({
        error: "ID is required",
      }, { status: 400 });
    }

    const panitiaId = parseInt(id);
    if (isNaN(panitiaId) || panitiaId <= 0) {
      return NextResponse.json({
        error: "Invalid ID format",
        details: "ID must be a positive number"
      }, { status: 400 });
    }

    console.log(`API: Fetching panitia data for ID: ${panitiaId}`);

    try {
      // First, try simple query to check if panitia exists
      const [checkRows] = await db.query(`
        SELECT id, nama_lengkap, email, divisi_id, jabatan_id, created_at
        FROM panitia 
        WHERE id = ?
      `, [panitiaId]);

      if (!Array.isArray(checkRows) || checkRows.length === 0) {
        console.log(`API: Panitia with ID ${panitiaId} not found in simple query`);
        return NextResponse.json({
          error: "Panitia not found",
          details: `No panitia found with ID ${panitiaId}`
        }, { status: 404 });
      }

      const basicData = checkRows[0] as any;
      console.log(`API: Found basic panitia data:`, basicData);

      // Now try to get additional data with joins
      try {
        const [joinRows] = await db.query(`
          SELECT 
            p.id,
            COALESCE(p.nama_lengkap, u.name, '') as nama_lengkap,
            u.email,
            p.divisi_id,
            p.jabatan_id,
            COALESCE(d.nama, '') as nama_divisi,
            COALESCE(j.nama, '') as nama_jabatan,
            DATE_FORMAT(p.created_at, '%d %M %Y %H:%i') as created_at_formatted,
            DATE_FORMAT(COALESCE(p.updated_at, p.created_at), '%d %M %Y %H:%i') as updated_at_formatted
          FROM panitia p
          LEFT JOIN users u ON p.email = u.email
          LEFT JOIN divisi d ON p.divisi_id = d.id
          LEFT JOIN jabatan j ON p.jabatan_id = j.id
          WHERE p.id = ?
        `, [panitiaId]);

        if (Array.isArray(joinRows) && joinRows.length > 0) {
          console.log(`API: Found complete panitia data:`, joinRows[0]);
          return NextResponse.json(joinRows[0], {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, max-age=0',
            },
          });
        }
      } catch (joinError: any) {
        console.error(`API: Join query failed, falling back to basic data:`, joinError.message);
        
        // Fallback: get divisi and jabatan names separately
        let nama_divisi = '';
        let nama_jabatan = '';
        
        if (basicData.divisi_id) {
          try {
            const [divisiRows] = await db.query(`SELECT nama FROM divisi WHERE id = ?`, [basicData.divisi_id]);
            if (Array.isArray(divisiRows) && divisiRows.length > 0) {
              nama_divisi = (divisiRows[0] as any).nama;
            }
          } catch (divisiErr) {
            console.log('Could not fetch divisi name:', divisiErr);
          }
        }
        
        if (basicData.jabatan_id) {
          try {
            const [jabatanRows] = await db.query(`SELECT nama FROM jabatan WHERE id = ?`, [basicData.jabatan_id]);
            if (Array.isArray(jabatanRows) && jabatanRows.length > 0) {
              nama_jabatan = (jabatanRows[0] as any).nama;
            }
          } catch (jabatanErr) {
            console.log('Could not fetch jabatan name:', jabatanErr);
          }
        }

        // Return basic data with manually fetched names
        const fallbackData = {
          ...basicData,
          nama_divisi,
          nama_jabatan,
          created_at_formatted: new Date(basicData.created_at).toLocaleDateString('id-ID'),
          updated_at_formatted: new Date(basicData.created_at).toLocaleDateString('id-ID')
        };

        console.log(`API: Returning fallback data:`, fallbackData);
        return NextResponse.json(fallbackData, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, max-age=0',
          },
        });
      }

      // If we reach here, return basic data
      console.log(`API: Returning basic panitia data:`, basicData);
      return NextResponse.json({
        ...basicData,
        nama_divisi: '',
        nama_jabatan: '',
        created_at_formatted: new Date(basicData.created_at).toLocaleDateString('id-ID'),
        updated_at_formatted: new Date(basicData.created_at).toLocaleDateString('id-ID')
      }, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, max-age=0',
        },
      });

    } catch (queryError: any) {
      console.error(`API: Database query error for panitia ID ${panitiaId}:`, queryError);
      
      // Check if it's a connection error
      if (queryError.code === 'ECONNREFUSED' || queryError.code === 'ER_BAD_DB_ERROR') {
        return NextResponse.json({
          error: "Database connection failed",
          details: "Cannot connect to database. Please check database configuration.",
          code: queryError.code
        }, { status: 503 });
      }
      
      // Check if it's a table doesn't exist error
      if (queryError.code === 'ER_NO_SUCH_TABLE') {
        return NextResponse.json({
          error: "Database table not found",
          details: "The panitia table doesn't exist. Please run database migrations.",
          code: queryError.code
        }, { status: 500 });
      }
      
      throw queryError; // Re-throw to be caught by outer catch
    }

    const panitiaData = rows[0];
    console.log(`API: Found panitia data:`, panitiaData);

    return NextResponse.json(panitiaData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    });

  } catch (err: any) {
    console.error(`API: Database error in GET /api/panitia/edit/${params.id}:`, err);
    return NextResponse.json({
      error: "Failed to fetch panitia data",
      message: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 });
  }
}

// Handler untuk `PUT` request: Update data panitia berdasarkan ID
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    console.log(`API: PUT /api/panitia/edit/${id} called`);
    
    // Validasi ID
    if (!id) {
      return NextResponse.json({
        error: "ID is required",
      }, { status: 400 });
    }

    const panitiaId = parseInt(id);
    if (isNaN(panitiaId) || panitiaId <= 0) {
      return NextResponse.json({
        error: "Invalid ID format",
        details: "ID must be a positive number"
      }, { status: 400 });
    }

    // Parse request body
    const data = await req.json();
    const { nama_lengkap, divisi_id, jabatan_id } = data;

    console.log(`API: Update data for panitia ID ${panitiaId}:`, { nama_lengkap, divisi_id, jabatan_id });

    // Validasi: Nama diperlukan
    if (!nama_lengkap || typeof nama_lengkap !== 'string') {
      return NextResponse.json({
        error: "Nama lengkap is required and must be a string",
      }, { status: 400 });
    }

    // Validasi nama lengkap
    if (nama_lengkap.trim().length < 2) {
      return NextResponse.json({
        error: "Nama lengkap must be at least 2 characters",
      }, { status: 400 });
    }

    if (nama_lengkap.trim().length > 255) {
      return NextResponse.json({
        error: "Nama lengkap must not exceed 255 characters",
      }, { status: 400 });
    }

    // Validasi divisi_id dan jabatan_id jika ada
    if (divisi_id !== undefined) {
      const divisiIdNum = parseInt(divisi_id);
      if (isNaN(divisiIdNum) || divisiIdNum <= 0) {
        return NextResponse.json({
          error: "Divisi ID must be a positive number",
        }, { status: 400 });
      }
    }

    if (jabatan_id !== undefined) {
      const jabatanIdNum = parseInt(jabatan_id);
      if (isNaN(jabatanIdNum) || jabatanIdNum <= 0) {
        return NextResponse.json({
          error: "Jabatan ID must be a positive number",
        }, { status: 400 });
      }
    }

    // Cek apakah panitia exists dan ambil data saat ini
    const [panitiaCheck] = await db.query(
      "SELECT id, nama_lengkap, email, divisi_id, jabatan_id FROM panitia WHERE id = ?",
      [panitiaId]
    );
    
    if (!Array.isArray(panitiaCheck) || panitiaCheck.length === 0) {
      console.log(`API: Panitia with ID ${panitiaId} not found for update`);
      return NextResponse.json({
        error: "Panitia not found",
        details: `No panitia found with ID ${panitiaId}`
      }, { status: 404 });
    }

    const currentData = panitiaCheck[0] as any;
    const panitiaEmail = currentData.email;

    console.log(`API: Current panitia data:`, currentData);

    // Mulai transaksi
    await db.query("START TRANSACTION");

    try {
      // Validasi divisi_id jika ada perubahan
      if (divisi_id !== undefined) {
        const divisiIdNum = parseInt(divisi_id);
        const [divisiCheckUpdate] = await db.query(
          "SELECT id, nama FROM divisi WHERE id = ?",
          [divisiIdNum]
        );
        
        if (!Array.isArray(divisiCheckUpdate) || divisiCheckUpdate.length === 0) {
          console.log(`API: Invalid divisi_id: ${divisiIdNum}`);
          await db.query("ROLLBACK");
          return NextResponse.json({
            error: "Invalid divisi ID",
            details: `Divisi with ID ${divisiIdNum} not found`
          }, { status: 400 });
        }
      }

      // Validasi jabatan_id jika ada perubahan
      if (jabatan_id !== undefined) {
        const jabatanIdNum = parseInt(jabatan_id);
        const [jabatanCheckUpdate] = await db.query(
          "SELECT id, nama FROM jabatan WHERE id = ?",
          [jabatanIdNum]
        );
        
        if (!Array.isArray(jabatanCheckUpdate) || jabatanCheckUpdate.length === 0) {
          console.log(`API: Invalid jabatan_id: ${jabatanIdNum}`);
          await db.query("ROLLBACK");
          return NextResponse.json({
            error: "Invalid jabatan ID",
            details: `Jabatan with ID ${jabatanIdNum} not found`
          }, { status: 400 });
        }
      }

      // Update nama di tabel users
      await db.query(
        "UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?",
        [nama_lengkap.trim(), panitiaEmail]
      );

      console.log(`API: Updated users table for email: ${panitiaEmail}`);

      // Build update query untuk panitia dynamically
      const updateFields = [];
      const updateValues = [];
      
      // Nama lengkap selalu diupdate
      updateFields.push("nama_lengkap = ?");
      updateValues.push(nama_lengkap.trim());

      // Update divisi_id jika ada
      if (divisi_id !== undefined) {
        const divisiIdNum = parseInt(divisi_id);
        updateFields.push("divisi_id = ?");
        updateValues.push(divisiIdNum);
      }

      // Update jabatan_id jika ada
      if (jabatan_id !== undefined) {
        const jabatanIdNum = parseInt(jabatan_id);
        updateFields.push("jabatan_id = ?");
        updateValues.push(jabatanIdNum);
      }

      // Add updated_at
      updateFields.push("updated_at = CURRENT_TIMESTAMP");
      updateValues.push(panitiaId);

      // Update data panitia
      const updateQuery = `UPDATE panitia SET ${updateFields.join(", ")} WHERE id = ?`;
      console.log(`API: Executing update query:`, updateQuery, updateValues);

      await db.query(updateQuery, updateValues);

      // Commit transaksi
      await db.query("COMMIT");
      console.log(`API: Transaction committed successfully for panitia ID: ${panitiaId}`);

      // Ambil data yang sudah diupdate dengan join
      const [updatedData] = await db.query<any[]>(
        `SELECT 
          p.id, 
          p.nama_lengkap, 
          u.email,
          p.divisi_id,
          p.jabatan_id,
          d.nama as nama_divisi,
          j.nama as nama_jabatan,
          DATE_FORMAT(p.created_at, '%d %M %Y %H:%i') AS created_at_formatted,
          DATE_FORMAT(p.updated_at, '%d %M %Y %H:%i') AS updated_at_formatted
        FROM panitia p
        INNER JOIN users u ON p.email = u.email
        LEFT JOIN divisi d ON p.divisi_id = d.id
        LEFT JOIN jabatan j ON p.jabatan_id = j.id
        WHERE p.id = ?`,
        [panitiaId]
      );

      console.log(`API: Updated panitia data:`, updatedData[0]);

      return NextResponse.json({
        success: true,
        message: "Panitia updated successfully",
        data: updatedData[0] || null,
      }, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });

    } catch (innerErr: any) {
      await db.query("ROLLBACK");
      console.error(`API: Transaction error for panitia ID ${panitiaId}:`, innerErr);
      throw innerErr;
    }

  } catch (err: any) {
    console.error(`API: Error updating panitia ID ${params.id}:`, err);

    // Error handling untuk foreign key constraint
    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return NextResponse.json({
        error: "Invalid divisi or jabatan ID",
        details: "The specified divisi or jabatan does not exist"
      }, { status: 400 });
    }

    // Error handling untuk constraint violations
    if (err.code === "ER_BAD_NULL_ERROR") {
      return NextResponse.json({
        error: "Required field cannot be null",
        details: err.message
      }, { status: 400 });
    }

    return NextResponse.json({
      error: "Failed to update panitia",
      message: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 });
  }
}

// Handler untuk `DELETE` request: Hapus data panitia berdasarkan ID
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    console.log(`API: DELETE /api/panitia/edit/${id} called`);
    
    // Validasi ID
    if (!id) {
      return NextResponse.json({
        error: "ID is required",
      }, { status: 400 });
    }

    const panitiaId = parseInt(id);
    if (isNaN(panitiaId) || panitiaId <= 0) {
      return NextResponse.json({
        error: "Invalid ID format",
        details: "ID must be a positive number"
      }, { status: 400 });
    }

    // Cek apakah panitia exists dan ambil data
    const [panitiaCheck] = await db.query(
      "SELECT p.id, p.nama_lengkap, p.email, d.nama as nama_divisi, j.nama as nama_jabatan FROM panitia p LEFT JOIN divisi d ON p.divisi_id = d.id LEFT JOIN jabatan j ON p.jabatan_id = j.id WHERE p.id = ?",
      [panitiaId]
    );
    
    if (!Array.isArray(panitiaCheck) || panitiaCheck.length === 0) {
      console.log(`API: Panitia with ID ${panitiaId} not found for deletion`);
      return NextResponse.json({
        error: "Panitia not found",
        details: `No panitia found with ID ${panitiaId}`
      }, { status: 404 });
    }

    const panitiaData = panitiaCheck[0] as any;
    console.log(`API: Deleting panitia:`, panitiaData);

    // Mulai transaksi
    await db.query("START TRANSACTION");

    try {
      // Hapus data panitia terlebih dahulu
      const [deleteResult]: any = await db.query("DELETE FROM panitia WHERE id = ?", [panitiaId]);
      
      if (deleteResult.affectedRows === 0) {
        await db.query("ROLLBACK");
        return NextResponse.json({
          error: "Failed to delete panitia",
          details: "No rows were affected"
        }, { status: 500 });
      }

      console.log(`API: Panitia with ID ${panitiaId} deleted successfully`);

      // Cek apakah user masih digunakan di tabel lain
      // Untuk sekarang, kita tidak hapus user dari tabel users untuk menjaga integritas data login
      // Jika ingin menghapus user juga, bisa ditambahkan logika pengecekan di sini
      
      // Commit transaksi
      await db.query("COMMIT");
      console.log(`API: Delete transaction committed for panitia ID: ${panitiaId}`);

      return NextResponse.json({
        success: true,
        message: "Panitia deleted successfully",
        data: panitiaData
      }, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });

    } catch (innerErr: any) {
      await db.query("ROLLBACK");
      console.error(`API: Delete transaction error for panitia ID ${panitiaId}:`, innerErr);
      throw innerErr;
    }

  } catch (err: any) {
    console.error(`API: Error deleting panitia ID ${params.id}:`, err);

    // Error handling untuk foreign key constraint
    if (err.code === "ER_ROW_IS_REFERENCED_2") {
      return NextResponse.json({
        error: "Cannot delete panitia",
        details: "This panitia is referenced by other records and cannot be deleted"
      }, { status: 409 });
    }

    return NextResponse.json({
      error: "Failed to delete panitia",
      message: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 });
  }
}

// Handler untuk `PATCH` request: Update sebagian data panitia
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    console.log(`API: PATCH /api/panitia/edit/${id} called`);
    
    // Validasi ID
    if (!id) {
      return NextResponse.json({
        error: "ID is required",
      }, { status: 400 });
    }

    const panitiaId = parseInt(id);
    if (isNaN(panitiaId) || panitiaId <= 0) {
      return NextResponse.json({
        error: "Invalid ID format",
        details: "ID must be a positive number"
      }, { status: 400 });
    }

    // Parse request body
    const data = await req.json();
    
    console.log(`API: PATCH data for panitia ID ${panitiaId}:`, data);

    // Validasi bahwa ada field yang akan diupdate
    const allowedFields = ['nama_lengkap', 'divisi_id', 'jabatan_id'];
    const updateFields = Object.keys(data).filter(key => allowedFields.includes(key));
    
    if (updateFields.length === 0) {
      return NextResponse.json({
        error: "No valid fields to update",
        details: `Allowed fields: ${allowedFields.join(', ')}`
      }, { status: 400 });
    }

    // Cek apakah panitia exists
    const [panitiaCheck] = await db.query(
      "SELECT id, email FROM panitia WHERE id = ?",
      [panitiaId]
    );
    
    if (!Array.isArray(panitiaCheck) || panitiaCheck.length === 0) {
      console.log(`API: Panitia with ID ${panitiaId} not found for PATCH`);
      return NextResponse.json({
        error: "Panitia not found",
        details: `No panitia found with ID ${panitiaId}`
      }, { status: 404 });
    }

    const panitiaEmail = (panitiaCheck[0] as any).email;

    // Mulai transaksi
    await db.query("START TRANSACTION");

    try {
      const updateQueries = [];
      const updateValues = [];

      // Update nama_lengkap jika ada
      if (data.nama_lengkap) {
        if (typeof data.nama_lengkap !== 'string' || data.nama_lengkap.trim().length < 2) {
          await db.query("ROLLBACK");
          return NextResponse.json({
            error: "Invalid nama_lengkap",
            details: "nama_lengkap must be a string with at least 2 characters"
          }, { status: 400 });
        }

        // Update di tabel users
        await db.query(
          "UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?",
          [data.nama_lengkap.trim(), panitiaEmail]
        );

        updateQueries.push("nama_lengkap = ?");
        updateValues.push(data.nama_lengkap.trim());
      }

      // Update divisi_id jika ada
      if (data.divisi_id !== undefined) {
        const divisiIdNum = parseInt(data.divisi_id);
        if (isNaN(divisiIdNum) || divisiIdNum <= 0) {
          await db.query("ROLLBACK");
          return NextResponse.json({
            error: "Invalid divisi_id",
            details: "divisi_id must be a positive number"
          }, { status: 400 });
        }

        // Validasi divisi exists
        const [divisiCheck] = await db.query(
          "SELECT id FROM divisi WHERE id = ?",
          [divisiIdNum]
        );
        
        if (!Array.isArray(divisiCheck) || divisiCheck.length === 0) {
          await db.query("ROLLBACK");
          return NextResponse.json({
            error: "Invalid divisi ID",
            details: `Divisi with ID ${divisiIdNum} not found`
          }, { status: 400 });
        }

        updateQueries.push("divisi_id = ?");
        updateValues.push(divisiIdNum);
      }

      // Update jabatan_id jika ada
      if (data.jabatan_id !== undefined) {
        const jabatanIdNum = parseInt(data.jabatan_id);
        if (isNaN(jabatanIdNum) || jabatanIdNum <= 0) {
          await db.query("ROLLBACK");
          return NextResponse.json({
            error: "Invalid jabatan_id",
            details: "jabatan_id must be a positive number"
          }, { status: 400 });
        }

        // Validasi jabatan exists
        const [jabatanCheck] = await db.query(
          "SELECT id FROM jabatan WHERE id = ?",
          [jabatanIdNum]
        );
        
        if (!Array.isArray(jabatanCheck) || jabatanCheck.length === 0) {
          await db.query("ROLLBACK");
          return NextResponse.json({
            error: "Invalid jabatan ID",
            details: `Jabatan with ID ${jabatanIdNum} not found`
          }, { status: 400 });
        }

        updateQueries.push("jabatan_id = ?");
        updateValues.push(jabatanIdNum);
      }

      // Update timestamp
      updateQueries.push("updated_at = CURRENT_TIMESTAMP");
      updateValues.push(panitiaId);

      // Execute update
      const updateQuery = `UPDATE panitia SET ${updateQueries.join(", ")} WHERE id = ?`;
      console.log(`API: Executing PATCH query:`, updateQuery, updateValues);

      await db.query(updateQuery, updateValues);

      // Commit transaksi
      await db.query("COMMIT");
      console.log(`API: PATCH transaction committed for panitia ID: ${panitiaId}`);

      // Ambil data yang sudah diupdate
      const [updatedData] = await db.query<any[]>(
        `SELECT 
          p.id, 
          p.nama_lengkap, 
          u.email,
          p.divisi_id,
          p.jabatan_id,
          d.nama as nama_divisi,
          j.nama as nama_jabatan,
          DATE_FORMAT(p.created_at, '%d %M %Y %H:%i') AS created_at_formatted,
          DATE_FORMAT(p.updated_at, '%d %M %Y %H:%i') AS updated_at_formatted
        FROM panitia p
        INNER JOIN users u ON p.email = u.email
        LEFT JOIN divisi d ON p.divisi_id = d.id
        LEFT JOIN jabatan j ON p.jabatan_id = j.id
        WHERE p.id = ?`,
        [panitiaId]
      );

      console.log(`API: PATCH result:`, updatedData[0]);

      return NextResponse.json({
        success: true,
        message: "Panitia updated successfully",
        data: updatedData[0] || null,
        updated_fields: updateFields
      }, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });

    } catch (innerErr: any) {
      await db.query("ROLLBACK");
      console.error(`API: PATCH transaction error for panitia ID ${panitiaId}:`, innerErr);
      throw innerErr;
    }

  } catch (err: any) {
    console.error(`API: Error in PATCH /api/panitia/edit/${params.id}:`, err);
    return NextResponse.json({
      error: "Failed to update panitia",
      message: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 });
  }
}