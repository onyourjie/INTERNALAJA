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

// Initialize absensi_config table if not exists
async function initializeConfigTable() {
  const connection = await getConnection();
  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS absensi_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        divisi VARCHAR(255) NOT NULL UNIQUE,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_divisi (divisi)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  } finally {
    await connection.end();
  }
}

// GET: Ambil daftar divisi dengan konfigurasi
export async function GET() {
  let connection;
  
  try {
    // Initialize config table
    await initializeConfigTable();
    
    connection = await getConnection();
    
    // Get distinct divisions from panitia_peserta with member count
    const [divisionsResult] = await connection.execute(`
      SELECT 
        divisi,
        COUNT(*) as total_members
      FROM panitia_peserta 
      WHERE is_active = 1
      GROUP BY divisi
      ORDER BY divisi ASC
    `);

    const divisions = divisionsResult as any[];

    if (divisions.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'Tidak ada data divisi'
      });
    }

    // Get or create config for each division
    const configPromises = divisions.map(async (div) => {
      // Check if config exists
      const [configResult] = await connection!.execute(
        'SELECT is_active FROM absensi_config WHERE divisi = ?',
        [div.divisi]
      );

      const configs = configResult as any[];
      
      if (configs.length === 0) {
        // Create default config if not exists
        await connection!.execute(
          'INSERT INTO absensi_config (divisi, is_active) VALUES (?, 1) ON DUPLICATE KEY UPDATE divisi = divisi',
          [div.divisi]
        );
        return {
          divisi: div.divisi,
          is_active: true,
          total_members: div.total_members
        };
      }

      return {
        divisi: div.divisi,
        is_active: Boolean(configs[0].is_active),
        total_members: div.total_members
      };
    });

    const result = await Promise.all(configPromises);

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error in GET /api/absensiconfig:', error);
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

// PUT: Update status divisi
export async function PUT(request: NextRequest) {
  let connection;
  
  try {
    const body = await request.json();
    const { divisi, is_active } = body;

    // Validation
    if (!divisi) {
      return NextResponse.json({
        success: false,
        message: 'Divisi harus diisi'
      }, { status: 400 });
    }

    if (typeof is_active !== 'boolean') {
      return NextResponse.json({
        success: false,
        message: 'Status aktif harus berupa boolean'
      }, { status: 400 });
    }

    connection = await getConnection();

    // Check if division exists in panitia_peserta
    const [divisionCheck] = await connection.execute(
      'SELECT COUNT(*) as count FROM panitia_peserta WHERE divisi = ? AND is_active = 1',
      [divisi]
    );

    const divisionCount = (divisionCheck as any[])[0].count;
    
    if (divisionCount === 0) {
      return NextResponse.json({
        success: false,
        message: 'Divisi tidak ditemukan atau tidak memiliki anggota aktif'
      }, { status: 404 });
    }

    // Update or insert config
    await connection.execute(`
      INSERT INTO absensi_config (divisi, is_active, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE 
        is_active = VALUES(is_active),
        updated_at = CURRENT_TIMESTAMP
    `, [divisi, is_active ? 1 : 0]);

    return NextResponse.json({
      success: true,
      message: `Status absensi divisi ${divisi} berhasil ${is_active ? 'diaktifkan' : 'dinonaktifkan'}`
    });

  } catch (error) {
    console.error('Error in PUT /api/absensiconfig:', error);
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

// POST: Batch update multiple divisions (optional feature)
export async function POST(request: NextRequest) {
  let connection;
  
  try {
    const body = await request.json();
    const { updates } = body; // Array of {divisi, is_active}

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Data update harus berupa array dan tidak boleh kosong'
      }, { status: 400 });
    }

    // Validate each update
    for (const update of updates) {
      if (!update.divisi || typeof update.is_active !== 'boolean') {
        return NextResponse.json({
          success: false,
          message: 'Setiap update harus memiliki divisi dan is_active (boolean)'
        }, { status: 400 });
      }
    }

    connection = await getConnection();
    
    // Start transaction
    await connection.beginTransaction();

    try {
      // Process each update
      for (const update of updates) {
        // Check if division exists
        const [divisionCheck] = await connection.execute(
          'SELECT COUNT(*) as count FROM panitia_peserta WHERE divisi = ? AND is_active = 1',
          [update.divisi]
        );

        const divisionCount = (divisionCheck as any[])[0].count;
        
        if (divisionCount > 0) {
          // Update or insert config
          await connection.execute(`
            INSERT INTO absensi_config (divisi, is_active, updated_at) 
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE 
              is_active = VALUES(is_active),
              updated_at = CURRENT_TIMESTAMP
          `, [update.divisi, update.is_active ? 1 : 0]);
        }
      }

      // Commit transaction
      await connection.commit();

      return NextResponse.json({
        success: true,
        message: `Berhasil mengupdate ${updates.length} konfigurasi divisi`
      });

    } catch (transactionError) {
      // Rollback on error
      await connection.rollback();
      throw transactionError;
    }

  } catch (error) {
    console.error('Error in POST /api/absensiconfig:', error);
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