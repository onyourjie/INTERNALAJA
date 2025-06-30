/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
// testwebpanit/app/api/panitiapeserta/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db, RowDataPacket } from '@/lib/db';
import QRCode from 'qrcode';

interface PesertaData extends RowDataPacket {
  id: number;
  unique_id: string;
  nama_lengkap: string;
  nim: string;
  divisi: string;
  qr_code?: string;
  created_at: Date;
  updated_at: Date;
}

// Generate unique ID
function generateUniqueId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `${timestamp}${random}`.toUpperCase();
}

// Capitalize setiap kata (Title Case)
function capitalizeWords(str: string): string {
  if (!str) return str;
  
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ') // Replace multiple spaces dengan single space
    .split(' ')
    .map((word, index, array) => {
      if (word.length === 0) return word;
      
      // Handle special cases untuk kata-kata yang tidak perlu di-capitalize
      const lowerCaseWords = ['dan', 'atau', 'di', 'ke', 'dari', 'untuk', 'dengan', 'pada', 'dalam', 'oleh', 'atas', 'bawah', 'antara', 'yang'];
      
      // Kata pertama dan terakhir selalu capitalize, atau bukan kata kecil
      if (index === 0 || index === array.length - 1 || !lowerCaseWords.includes(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      
      return word;
    })
    .join(' ');
}

// Capitalize untuk NIM (uppercase semua)
function capitalizeNIM(str: string): string {
  if (!str) return str;
  return str.trim().toUpperCase().replace(/\s+/g, '');
}

// Generate QR code data
function generateQRData(peserta: any) {
  return JSON.stringify({
    id: peserta.unique_id,
    nama: peserta.nama_lengkap,
    nim: peserta.nim,
    divisi: peserta.divisi,
    timestamp: new Date().toISOString()
  });
}

// GET - Ambil semua data peserta dengan pagination dan search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const divisi = searchParams.get('divisi') || '';
    
    const offset = (page - 1) * limit;
    
    // Build dynamic query
    let whereConditions = [];
    let queryParams: any[] = [];
    
    if (search) {
      whereConditions.push('(nama_lengkap LIKE ? OR nim LIKE ? OR divisi LIKE ?)');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }
    
    if (divisi) {
      whereConditions.push('divisi = ?');
      queryParams.push(divisi);
    }
    
    const whereClause = whereConditions.length > 0 ? 
      `WHERE ${whereConditions.join(' AND ')}` : '';
    
    let query = `
      SELECT * FROM panitia_peserta 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    
    queryParams.push(limit, offset);
    
    const [rows] = await db.execute<PesertaData[]>(query, queryParams);

    // Count total dengan filter yang sama
    let countQuery = `SELECT COUNT(*) as total FROM panitia_peserta ${whereClause}`;
    const countParams = queryParams.slice(0, -2); // Remove limit dan offset
    
    const [countResult] = await db.execute<RowDataPacket[]>(countQuery, countParams);
    const total = countResult[0].total;
    
    return NextResponse.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('GET Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error fetching data', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Tambah peserta baru
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nama_lengkap, nim, divisi } = body;

    // Validasi input
    if (!nama_lengkap || !nim || !divisi) {
      return NextResponse.json(
        { success: false, message: 'Semua field harus diisi (nama_lengkap, nim, divisi)' },
        { status: 400 }
      );
    }

    // Clean dan capitalize data OTOMATIS
    const cleanData = {
      nama_lengkap: capitalizeWords(nama_lengkap),
      nim: capitalizeNIM(nim),
      divisi: capitalizeWords(divisi)
    };

    // Validasi panjang data
    if (cleanData.nama_lengkap.length > 255 || cleanData.nim.length > 20 || cleanData.divisi.length > 255) {
      return NextResponse.json(
        { success: false, message: 'Data terlalu panjang. Nama max 255, NIM max 20 karakter' },
        { status: 400 }
      );
    }

    // Check if NIM already exists
    const [existingNim] = await db.execute<RowDataPacket[]>(
      'SELECT id FROM panitia_peserta WHERE nim = ?',
      [cleanData.nim]
    );
    
    if (existingNim.length > 0) {
      return NextResponse.json(
        { success: false, message: 'NIM sudah ada dalam database' },
        { status: 400 }
      );
    }

    // Generate unique ID dengan retry mechanism
    let unique_id = generateUniqueId();
    let isUnique = false;
    let attempts = 0;
    
    while (!isUnique && attempts < 10) {
      const [existing] = await db.execute<RowDataPacket[]>(
        'SELECT id FROM panitia_peserta WHERE unique_id = ?',
        [unique_id]
      );
      
      if (existing.length === 0) {
        isUnique = true;
      } else {
        unique_id = generateUniqueId();
        attempts++;
      }
    }

    if (!isUnique) {
      return NextResponse.json(
        { success: false, message: 'Gagal generate unique ID setelah 10 percobaan' },
        { status: 500 }
      );
    }

    // Generate QR Code
    const pesertaData = { ...cleanData, unique_id };
    const qrData = generateQRData(pesertaData);
    
    const qrCode = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });

    // Insert to database dengan data yang sudah di-capitalize
    const [result] = await db.execute(
      'INSERT INTO panitia_peserta (unique_id, nama_lengkap, nim, divisi, qr_code) VALUES (?, ?, ?, ?, ?)',
      [unique_id, cleanData.nama_lengkap, cleanData.nim, cleanData.divisi, qrCode]
    );

    return NextResponse.json({
      success: true,
      message: 'Peserta berhasil ditambahkan dengan format yang benar',
      data: { 
        id: (result as any).insertId,
        unique_id, 
        nama_lengkap: cleanData.nama_lengkap,
        nim: cleanData.nim,
        divisi: cleanData.divisi,
        qr_code: qrCode 
      }
    });
  } catch (error: any) {
    console.error('POST Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error adding peserta', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT - Update peserta
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, nama_lengkap, nim, divisi } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID peserta diperlukan' },
        { status: 400 }
      );
    }

    // Validasi input
    if (!nama_lengkap || !nim || !divisi) {
      return NextResponse.json(
        { success: false, message: 'Semua field harus diisi' },
        { status: 400 }
      );
    }

    // Clean dan capitalize data OTOMATIS
    const cleanData = {
      nama_lengkap: capitalizeWords(nama_lengkap),
      nim: capitalizeNIM(nim),
      divisi: capitalizeWords(divisi)
    };

    // Check if peserta exists
    const [existingPeserta] = await db.execute<PesertaData[]>(
      'SELECT * FROM panitia_peserta WHERE id = ?',
      [id]
    );

    if (existingPeserta.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Peserta tidak ditemukan' },
        { status: 404 }
      );
    }

    // Check if NIM is being changed and if new NIM already exists
    if (existingPeserta[0].nim !== cleanData.nim) {
      const [existingNim] = await db.execute<RowDataPacket[]>(
        'SELECT id FROM panitia_peserta WHERE nim = ? AND id != ?',
        [cleanData.nim, id]
      );
      
      if (existingNim.length > 0) {
        return NextResponse.json(
          { success: false, message: 'NIM sudah digunakan peserta lain' },
          { status: 400 }
        );
      }
    }

    // Regenerate QR code dengan data baru yang sudah di-capitalize
    const pesertaData = { 
      unique_id: existingPeserta[0].unique_id, 
      ...cleanData
    };
    const qrData = generateQRData(pesertaData);
    
    const qrCode = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });

    // Update database dengan data yang sudah di-capitalize
    await db.execute(
      'UPDATE panitia_peserta SET nama_lengkap = ?, nim = ?, divisi = ?, qr_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [cleanData.nama_lengkap, cleanData.nim, cleanData.divisi, qrCode, id]
    );

    return NextResponse.json({
      success: true,
      message: 'Peserta berhasil diupdate dengan format yang benar',
      data: { 
        id, 
        unique_id: existingPeserta[0].unique_id, 
        ...cleanData,
        qr_code: qrCode 
      }
    });
  } catch (error: any) {
    console.error('PUT Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error updating peserta', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Hapus peserta
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const unique_id = searchParams.get('unique_id');

    if (!id && !unique_id) {
      return NextResponse.json(
        { success: false, message: 'ID atau Unique ID diperlukan' },
        { status: 400 }
      );
    }

    // Check if peserta exists
    const whereClause = id ? 'id = ?' : 'unique_id = ?';
    const paramValue = id || unique_id;
    
    const [existingPeserta] = await db.execute<RowDataPacket[]>(
      `SELECT id FROM panitia_peserta WHERE ${whereClause}`,
      [paramValue]
    );

    if (existingPeserta.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Peserta tidak ditemukan' },
        { status: 404 }
      );
    }

    // Delete peserta
    await db.execute(`DELETE FROM panitia_peserta WHERE ${whereClause}`, [paramValue]);

    return NextResponse.json({
      success: true,
      message: 'Peserta berhasil dihapus'
    });
  } catch (error: any) {
    console.error('DELETE Error:', error);
    return NextResponse.json(
      { success: false, message: 'Error deleting peserta', error: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}