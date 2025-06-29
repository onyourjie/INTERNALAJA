// app/api/panitia/kestari/route.ts
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const [participants] = await db.query(`
      SELECT id, nim, nama_lengkap, divisi
      FROM panitia_peserta
      WHERE divisi = 'Kestari'
      AND is_active = 1
      ORDER BY nama_lengkap ASC
    `);
    
    return NextResponse.json(participants);
  } catch (error) {
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
