import { NextRequest, NextResponse } from 'next/server';
import { db, RowDataPacket } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const connection = await db.getConnection();
  
  try {
    const { id } = params;
    
    // Validasi ID parameter
    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'ID panitia tidak valid' 
        },
        { status: 400 }
      );
    }

    const panitiaId = parseInt(id);
f
    // Start transaction untuk memastikan konsistensi data
    await connection.beginTransaction();

    // 1. Cek apakah data panitia ada dan ambil email-nya
    const [existingPanitia] = await connection.execute<RowDataPacket[]>(
      'SELECT * FROM panitia WHERE id = ?',
      [panitiaId]
    );

    if (!existingPanitia || existingPanitia.length === 0) {
      await connection.rollback();
      return NextResponse.json(
        { 
          success: false, 
          error: 'Data panitia tidak ditemukan' 
        },
        { status: 404 }
      );
    }

    const panitiaData = existingPanitia[0];
    const panitiaEmail = panitiaData.email;

    // 2. Cek apakah ada user dengan email yang sama di tabel users
    const [existingUser] = await connection.execute<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ?',
      [panitiaEmail]
    );

    const userId = existingUser.length > 0 ? existingUser[0].id : null;

    // 3. Hapus data dari tabel panitia terlebih dahulu
    const [deletePanitiaResult] = await connection.execute(
      'DELETE FROM panitia WHERE id = ?',
      [panitiaId]
    );

    // 4. Hapus data dari tabel users jika ada user dengan email yang sama
    let deleteUserResult = null;
    if (userId) {
      [deleteUserResult] = await connection.execute(
        'DELETE FROM users WHERE id = ?',
        [userId]
      );
    }

    // Commit transaction jika semua berhasil
    await connection.commit();

    // Response sukses dengan detail operasi
    return NextResponse.json({
      success: true,
      message: 'Data panitia berhasil dihapus',
      data: {
        deleted_panitia_id: panitiaId,
        deleted_user_id: userId,
        nama_lengkap: panitiaData.nama_lengkap,
        email: panitiaEmail,
        nama_divisi: panitiaData.nama_divisi,
        nama_jabatan: panitiaData.nama_jabatan,
        operations: {
          panitia_deleted: true,
          user_deleted: userId ? true : false,
          affected_rows: {
            panitia: (deletePanitiaResult as any).affectedRows || 0,
            users: userId ? ((deleteUserResult as any)?.affectedRows || 0) : 0
          }
        }
      }
    }, { status: 200 });

  } catch (error: any) {
    
    await connection.rollback();
    
    console.error('Error deleting panitia:', error);
    
    let errorMessage = 'Terjadi kesalahan saat menghapus data panitia';
    let statusCode = 500;

    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      errorMessage = 'Data tidak dapat dihapus karena masih digunakan oleh data lain';
      statusCode = 409; // Conflict
    } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      errorMessage = 'Referensi data tidak valid';
      statusCode = 400; // Bad Request
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Koneksi database gagal';
      statusCode = 503; // Service Unavailable
    }

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: statusCode }
    );
  } finally {
    // Pastikan connection selalu direlease
    connection.release();
  }
}

// Method GET untuk informasi endpoint (opsional, untuk debugging)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    if (!id || isNaN(Number(id))) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'ID panitia tidak valid' 
        },
        { status: 400 }
      );
    }

    const panitiaId = parseInt(id);

    // Get panitia data for confirmation
    const [panitiaData] = await db.execute<RowDataPacket[]>(
      `SELECT p.*, 
              d.nama_divisi, j.nama_jabatan,
              DATE_FORMAT(p.created_at, '%d %M %Y %H:%i') as created_at_formatted
       FROM panitia p 
       LEFT JOIN divisi d ON p.divisi_id = d.id  
       LEFT JOIN jabatan j ON p.jabatan_id = j.id
       WHERE p.id = ?`,
      [panitiaId]
    );

    if (!panitiaData || panitiaData.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Data panitia tidak ditemukan' 
        },
        { status: 404 }
      );
    }

    // Check if user exists with same email
    const [userData] = await db.execute<RowDataPacket[]>(
      'SELECT id, email FROM users WHERE email = ?',
      [panitiaData[0].email]
    );

    return NextResponse.json({
      success: true,
      message: 'Data panitia ditemukan',
      data: {
        ...panitiaData[0],
        user_id: userData.length > 0 ? userData[0].id : null
      },
      delete_info: {
        endpoint: `DELETE /api/panitia/delete/${id}`,
        will_delete: {
          panitia_table: true,
          users_table: userData.length > 0
        }
      }
    });

  } catch (error: any) {
    console.error('Error getting panitia data:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Terjadi kesalahan saat mengambil data panitia',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}