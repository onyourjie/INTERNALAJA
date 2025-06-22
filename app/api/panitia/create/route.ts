/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/panitia/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Validasi format NIM (contoh: 12 digit angka)
const isValidNIM = (nim: string): boolean => {
  return /^\d{8,15}$/.test(nim);
};

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { nama_lengkap, nim, fakultas, divisi_id, qr_code } = data;

    // Validasi data
    if (!nama_lengkap || !nim || !divisi_id || !qr_code) {
      return NextResponse.json(
        { error: 'Semua field wajib diisi kecuali fakultas' },
        { status: 400 }
      );
    }

    if (nama_lengkap.length < 3) {
      return NextResponse.json(
        { error: 'Nama lengkap minimal 3 karakter' },
        { status: 400 }
      );
    }

    if (!isValidNIM(nim)) {
      return NextResponse.json(
        { error: 'Format NIM tidak valid (harus angka 8-15 digit)' },
        { status: 400 }
      );
    }

    // Insert data ke database
    const [result] = await db.query(
      `INSERT INTO pesertapanitia 
        (nama_lengkap, nim, fakultas, divisi_id, qr_code)
        VALUES (?, ?, ?, ?, ?)`,
      [nama_lengkap, nim, fakultas || '', divisi_id, qr_code]
    );

     
    const insertedId = (result as any).insertId;

    // Ambil data yang baru disimpan
    const [insertedData] = await db.query(
      `SELECT 
         id, 
         nama_lengkap, 
         nim, 
         fakultas, 
         divisi_id, 
         qr_code,
         DATE_FORMAT(created_at, '%d %b %Y %H:%i') AS created_at_formatted
       FROM pesertapanitia 
       WHERE id = ?`,
      [insertedId]
    );

    return NextResponse.json({
      success: true,
      message: 'Data peserta berhasil disimpan',
      data: Array.isArray(insertedData) ? insertedData[0] : null
    });

  } catch (error: any) {
    console.error('Database error:', error);
    
    // Handle error duplikat
    if (error.code === 'ER_DUP_ENTRY') {
      if (error.sqlMessage.includes('nim')) {
        return NextResponse.json(
          { error: 'NIM sudah terdaftar' },
          { status: 409 }
        );
      } else if (error.sqlMessage.includes('qr_code')) {
        return NextResponse.json(
          { error: 'Kode QR sudah digunakan' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
