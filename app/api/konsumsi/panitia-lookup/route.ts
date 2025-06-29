// File: /api/konsumsi/panitia-lookup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db, RowDataPacket } from '@/lib/db';

interface QRData {
  id: string;
  nama: string;
  nim: string;
  divisi: string;
  timestamp?: string;
  version?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { qr_data } = body;

    if (!qr_data) {
      return NextResponse.json({
        success: false,
        message: 'QR data is required'
      }, { status: 400 });
    }

    // Parse QR data
    let qrParsed: QRData;
    try {
      qrParsed = JSON.parse(qr_data);
    } catch (error) {
      return NextResponse.json({
        success: false,
        message: 'Invalid QR data format'
      }, { status: 400 });
    }

    if (!qrParsed.id && !qrParsed.nim) {
      return NextResponse.json({
        success: false,
        message: 'QR data must contain either ID or NIM'
      }, { status: 400 });
    }

    // Search panitia by unique_id first, then by NIM
    let panitia = null;
    
    if (qrParsed.id) {
      const [uidRows] = await db.execute<RowDataPacket[]>(
        'SELECT id, unique_id, nama_lengkap, nim, divisi FROM panitia_peserta WHERE unique_id = ? AND is_active = 1 LIMIT 1',
        [qrParsed.id]
      );
      
      if (uidRows.length > 0) {
        panitia = uidRows[0];
      }
    }

    if (!panitia && qrParsed.nim) {
      const [nimRows] = await db.execute<RowDataPacket[]>(
        'SELECT id, unique_id, nama_lengkap, nim, divisi FROM panitia_peserta WHERE nim = ? AND is_active = 1 LIMIT 1',
        [qrParsed.nim]
      );
      
      if (nimRows.length > 0) {
        panitia = nimRows[0];
      }
    }

    if (!panitia) {
      return NextResponse.json({
        success: false,
        message: 'Panitia not found in database',
        qr_info: {
          id: qrParsed.id,
          nim: qrParsed.nim,
          nama: qrParsed.nama
        }
      }, { status: 404 });
    }

    // Validate QR data against database
    const validation = {
      nim_match: panitia.nim === qrParsed.nim,
      nama_similarity: calculateSimilarity(panitia.nama_lengkap.toLowerCase(), qrParsed.nama.toLowerCase()),
      divisi_match: panitia.divisi.toLowerCase() === qrParsed.divisi.toLowerCase()
    };

    const overallConfidence = calculateOverallConfidence(validation);

    if (overallConfidence < 70) {
      return NextResponse.json({
        success: false,
        message: `Data validation failed. Confidence: ${overallConfidence}%`,
        validation,
        qr_info: qrParsed,
        db_info: {
          nama: panitia.nama_lengkap,
          nim: panitia.nim,
          divisi: panitia.divisi
        }
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Panitia found and validated',
      data: {
        panitia_id: panitia.id,
        unique_id: panitia.unique_id,
        nama_lengkap: panitia.nama_lengkap,
        nim: panitia.nim,
        divisi: panitia.divisi
      },
      validation,
      confidence: overallConfidence
    });

  } catch (error: any) {
    console.error('Error in panitia lookup:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Failed to lookup panitia',
      error: error.message
    }, { status: 500 });
  }
}

// Helper function to calculate string similarity
function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 100;

  const words1 = str1.split(' ').filter(w => w.length > 2);
  const words2 = str2.split(' ').filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return 0;

  let matches = 0;
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1 === word2 || word1.includes(word2) || word2.includes(word1)) {
        matches++;
        break;
      }
    }
  }

  return Math.round((matches / Math.max(words1.length, words2.length)) * 100);
}

// Helper function to calculate overall confidence
function calculateOverallConfidence(validation: any): number {
  let confidence = 0;
  
  // NIM match is most important (40%)
  if (validation.nim_match) {
    confidence += 40;
  }
  
  // Name similarity (40%)
  confidence += (validation.nama_similarity * 0.4);
  
  // Divisi match (20%)
  if (validation.divisi_match) {
    confidence += 20;
  }
  
  return Math.round(confidence);
}