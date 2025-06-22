/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'absensi_db',
  port: parseInt(process.env.DB_PORT || '3306'),
};

// Create database connection
async function getConnection() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    return connection;
  } catch (error) {
    console.error('Database connection error:', error);
    throw new Error('Gagal terhubung ke database');
  }
}

interface DivisionStatus {
  divisi: string;
  is_active: boolean;
  total_members: number;
}

interface PesertaData {
  id: number;
  unique_id: string;
  nama_lengkap: string;
  nim: string;
  divisi: string;
  is_active: boolean;
  qr_code: string | null;
}

// GET: Ambil data divisi dan peserta berdasarkan nama divisi
export async function GET(
  request: NextRequest,
  { params }: { params: { namadivisi: string } }
) {
  let connection;
  
  try {
    const namaDivisi = decodeURIComponent(params.namadivisi);
    
    if (!namaDivisi || namaDivisi.trim() === '') {
      return NextResponse.json({
        success: false,
        message: 'Nama divisi tidak valid'
      }, { status: 400 });
    }

    connection = await getConnection();

    // 1. Check if division exists and get its status from absensi_config
    const [configResult] = await connection.execute(
      `SELECT divisi, is_active FROM absensi_config WHERE divisi = ?`,
      [namaDivisi]
    );

    const configs = configResult as any[];
    
    // If division not found in config table, check if it exists in panitia_peserta
    if (configs.length === 0) {
      const [divisionCheck] = await connection.execute(
        `SELECT COUNT(*) as count FROM panitia_peserta WHERE divisi = ?`,
        [namaDivisi]
      );

      const divisionCount = (divisionCheck as any[])[0].count;
      
      if (divisionCount === 0) {
        return NextResponse.json({
          success: false,
          message: 'Divisi tidak ditemukan'
        }, { status: 404 });
      }

      // Division exists but not configured yet - create default config (inactive)
      await connection.execute(
        `INSERT INTO absensi_config (divisi, is_active) VALUES (?, 0)`,
        [namaDivisi]
      );

      return NextResponse.json({
        success: false,
        message: 'Absensi untuk divisi ini belum dikonfigurasi'
      }, { status: 403 });
    }

    const divisionConfig = configs[0];

    // 2. Check if division is active
    if (!divisionConfig.is_active) {
      return NextResponse.json({
        success: false,
        message: 'Absensi untuk divisi ini sedang tidak aktif'
      }, { status: 403 });
    }

    // 3. Get total members count for this division
    const [memberCountResult] = await connection.execute(
      `SELECT COUNT(*) as total_members FROM panitia_peserta WHERE divisi = ?`,
      [namaDivisi]
    );

    const totalMembers = (memberCountResult as any[])[0].total_members;

    // 4. Get all active peserta for this division
    const [pesertaResult] = await connection.execute(
      `SELECT 
        id,
        unique_id,
        nama_lengkap,
        nim,
        divisi,
        is_active,
        qr_code,
        created_at,
        updated_at
      FROM panitia_peserta 
      WHERE divisi = ? AND is_active = 1
      ORDER BY nama_lengkap ASC`,
      [namaDivisi]
    );

    const pesertaList = pesertaResult as PesertaData[];

    // 5. Prepare division status object
    const divisionStatus: DivisionStatus = {
      divisi: namaDivisi,
      is_active: true, // We already checked it's active
      total_members: totalMembers
    };

    return NextResponse.json({
      success: true,
      data: {
        division_status: divisionStatus,
        peserta: pesertaList
      },
      message: `Data divisi ${namaDivisi} berhasil diambil`
    });

  } catch (error) {
    console.error('Error in GET /api/absensi/divisi/[namadivisi]:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan server'
    }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// POST: Submit absensi for a specific division member
export async function POST(
  request: NextRequest,
  { params }: { params: { namadivisi: string } }
) {
  let connection;
  
  try {
    const namaDivisi = decodeURIComponent(params.namadivisi);
    const body = await request.json();
    const { unique_id, nim, timestamp } = body;

    // Validation
    if (!unique_id && !nim) {
      return NextResponse.json({
        success: false,
        message: 'Unique ID atau NIM harus diisi'
      }, { status: 400 });
    }

    connection = await getConnection();

    // 1. Check if division is active
    const [configResult] = await connection.execute(
      `SELECT is_active FROM absensi_config WHERE divisi = ?`,
      [namaDivisi]
    );

    const configs = configResult as any[];
    
    if (configs.length === 0 || !configs[0].is_active) {
      return NextResponse.json({
        success: false,
        message: 'Absensi untuk divisi ini tidak aktif'
      }, { status: 403 });
    }

    // 2. Find peserta by unique_id or nim in the specific division
    let whereClause = 'divisi = ? AND is_active = 1';
    let queryParams: any[] = [namaDivisi];

    if (unique_id) {
      whereClause += ' AND unique_id = ?';
      queryParams.push(unique_id);
    } else if (nim) {
      whereClause += ' AND nim = ?';
      queryParams.push(nim);
    }

    const [pesertaResult] = await connection.execute(
      `SELECT id, unique_id, nama_lengkap, nim, divisi FROM panitia_peserta WHERE ${whereClause}`,
      queryParams
    );

    const pesertaList = pesertaResult as any[];

    if (pesertaList.length === 0) {
      return NextResponse.json({
        success: false,
        message: `Peserta dengan ${unique_id ? 'Unique ID' : 'NIM'} tersebut tidak ditemukan di divisi ${namaDivisi}`
      }, { status: 404 });
    }

    const peserta = pesertaList[0];

    // 3. Create absensi record (assuming you have an absensi table)
    // For now, we'll just return success - you can implement actual absensi recording later
    const absensiTimestamp = timestamp || new Date().toISOString();

    // TODO: Insert into absensi table
    // await connection.execute(
    //   `INSERT INTO absensi (peserta_id, unique_id, divisi, timestamp, created_at) VALUES (?, ?, ?, ?, NOW())`,
    //   [peserta.id, peserta.unique_id, namaDivisi, absensiTimestamp]
    // );

    return NextResponse.json({
      success: true,
      data: {
        peserta: {
          id: peserta.id,
          unique_id: peserta.unique_id,
          nama_lengkap: peserta.nama_lengkap,
          nim: peserta.nim,
          divisi: peserta.divisi
        },
        timestamp: absensiTimestamp
      },
      message: `Absensi berhasil untuk ${peserta.nama_lengkap}`
    });

  } catch (error) {
    console.error('Error in POST /api/absensi/divisi/[namadivisi]:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan server'
    }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// PUT: Update division absensi status (toggle active/inactive)
export async function PUT(
  request: NextRequest,
  { params }: { params: { namadivisi: string } }
) {
  let connection;
  
  try {
    const namaDivisi = decodeURIComponent(params.namadivisi);
    const body = await request.json();
    const { is_active } = body;

    if (typeof is_active !== 'boolean') {
      return NextResponse.json({
        success: false,
        message: 'Status aktif harus berupa boolean'
      }, { status: 400 });
    }

    connection = await getConnection();

    // Check if division exists in panitia_peserta
    const [divisionCheck] = await connection.execute(
      'SELECT COUNT(*) as count FROM panitia_peserta WHERE divisi = ?',
      [namaDivisi]
    );

    const divisionCount = (divisionCheck as any[])[0].count;
    
    if (divisionCount === 0) {
      return NextResponse.json({
        success: false,
        message: 'Divisi tidak ditemukan'
      }, { status: 404 });
    }

    // Update or insert config
    await connection.execute(`
      INSERT INTO absensi_config (divisi, is_active, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE 
        is_active = VALUES(is_active),
        updated_at = CURRENT_TIMESTAMP
    `, [namaDivisi, is_active ? 1 : 0]);

    return NextResponse.json({
      success: true,
      message: `Status absensi divisi ${namaDivisi} berhasil ${is_active ? 'diaktifkan' : 'dinonaktifkan'}`
    });

  } catch (error) {
    console.error('Error in PUT /api/absensi/divisi/[namadivisi]:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan server'
    }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// OPTIONS: Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}