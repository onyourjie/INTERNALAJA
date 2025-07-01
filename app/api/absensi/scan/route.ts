/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { db, RowDataPacket } from "@/lib/db";

class LRU {
  private c = new Map<string, any>();
  constructor(private m = 1000) {}
  get(k: string) {
    const v = this.c.get(k);
    if (!v) return null;
    this.c.delete(k);
    this.c.set(k, v);
    return v;
  }
  set(k: string, v: any) {
    if (this.c.has(k)) this.c.delete(k);
    else if (this.c.size >= this.m) {
      const firstKey = this.c.keys().next().value;
      if (typeof firstKey !== "undefined") this.c.delete(firstKey);
    }
    this.c.set(k, v);
  }
}

const pCache = new LRU(500);
const kCache = new LRU(100);
const vCache = new LRU(1000);
const dCache = new LRU(200); // ✅ NEW: Cache untuk divisi kegiatan
const nCache = new Map<string, string>();

const norm = (s = "", t: "nim" | "nama" | "div") => {
  const k = `${t}_${s}`;
  if (nCache.has(k)) return nCache.get(k)!;
  let r = s.trim().toLowerCase();
  if (t === "nim") r = r.replace(/\s+/g, "").replace(/[^\w]/g, "");
  else if (t === "nama")
    r = r.replace(/[.,;:!?'"()\-]/g, "").replace(/\s+/g, " ");
  else
    r = r
      .replace(/[&]/g, "dan")
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ");
  nCache.set(k, r);
  if (nCache.size > 2000)
    [...nCache.keys()].slice(0, 500).forEach((k) => nCache.delete(k));
  return r;
};

const lev = (a: string, b: string, m = 8) => {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > m) return m + 1;
  const d = Array.from({ length: b.length + 1 }, (_, i) =>
    Array(a.length + 1).fill(0)
  );
  for (let i = 0; i <= b.length; i++) d[i][0] = i;
  for (let j = 0; j <= a.length; j++) d[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    let min = 1e9;
    for (let j = 1; j <= a.length; j++) {
      const c = a[j - 1] === b[i - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      min = Math.min(min, d[i][j]);
    }
    if (min > m) return m + 1;
  }
  return d[b.length][a.length];
};

const sim = (x: string, y: string) => {
  if (!x || !y) return 0;
  if (x === y) return 1;
  const l = Math.max(x.length, y.length);
  return Math.max(0, (l - lev(x, y, l)) / l);
};

const match = (d: string, q: string, t: "nim" | "nama" | "div") => {
  const s = sim(norm(d, t), norm(q, t));
  if (t === "nim") return s >= 0.95;
  if (t === "nama") return s >= 0.9;
  return s >= 0.8;
};

const validate = (s: string) => {
  const c = vCache.get(s);
  if (c) return c;
  try {
    const o = JSON.parse(s);
    const ok = !!o.id && !!o.nama && !!o.nim && !!o.divisi;
    const r = { ok, obj: o };
    vCache.set(s, r);
    return r;
  } catch {
    return { ok: false };
  }
};

// ✅ NEW: Function untuk validasi divisi
const validateDivisi = async (kegiatanId: number, panitiaId: number) => {
  const cacheKey = `divisi_${kegiatanId}`;
  let allowedDivisi = dCache.get(cacheKey);
  
  if (!allowedDivisi) {
    // Ambil divisi yang diizinkan untuk kegiatan ini
    const [divisiRows] = await db.execute<RowDataPacket[]>(
      `SELECT DISTINCT divisi FROM kegiatan_divisi 
       WHERE kegiatan_id = ? AND is_active = 1 
       ORDER BY divisi`,
      [kegiatanId]
    );
    
    allowedDivisi = divisiRows.map((row: RowDataPacket) => (row.divisi as string).trim());
    dCache.set(cacheKey, allowedDivisi);
  }
  
  if (allowedDivisi.length === 0) {
    return {
      isAllowed: false,
      error: "Tidak ada divisi yang diizinkan untuk kegiatan ini",
      allowedDivisi: []
    };
  }
  
  // Ambil divisi panitia
  const [panitiaRows] = await db.execute<RowDataPacket[]>(
    `SELECT divisi FROM panitia_peserta 
     WHERE id = ? AND is_active = 1 
     LIMIT 1`,
    [panitiaId]
  );
  
  if (panitiaRows.length === 0) {
    return {
      isAllowed: false,
      error: "Data panitia tidak ditemukan",
      allowedDivisi
    };
  }
  
  const panitiaDiv = (panitiaRows[0].divisi as string).trim();
  
  // Cek apakah divisi panitia termasuk dalam divisi yang diizinkan
  const isAllowed = allowedDivisi.some((allowedDiv: string) => 
    match(allowedDiv, panitiaDiv, "div")
  );
  
  return {
    isAllowed,
    panitiaDiv,
    allowedDivisi,
    error: isAllowed ? null : `Divisi "${panitiaDiv}" tidak diizinkan untuk kegiatan ini`
  };
};

const push = async (req: NextRequest, p: any) => {
  await fetch(`${req.nextUrl.origin}/api/absensi/live`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  }).catch(() => {});
};

export async function POST(req: NextRequest) {
  const {
    qr_data,
    kegiatan_id,
    kegiatan_rangkaian_id = null,
    koordinat_lat = null,
    koordinat_lng = null,
  } = await req.json();
  
  if (!qr_data || !kegiatan_id)
    return NextResponse.json({ success: false, message: "Data tidak lengkap" }, { status: 400 });
  
  const v = validate(qr_data);
  if (!v.ok) 
    return NextResponse.json({ success: false, message: "QR Code tidak valid" }, { status: 400 });
  
  const q = v.obj;
  
  // ✅ 1. Validasi panitia
  let panitia = pCache.get(`uid_${q.id}`);
  if (!panitia) {
    const [r] = await db.execute<RowDataPacket[]>(
      "SELECT id,unique_id,nama_lengkap,nim,divisi FROM panitia_peserta WHERE unique_id=? AND is_active=1 LIMIT 1",
      [q.id]
    );
    if (!r.length)
      return NextResponse.json({ 
        success: false, 
        message: "Panitia tidak ditemukan" 
      }, { status: 404 });
    panitia = r[0];
    pCache.set(`uid_${q.id}`, panitia);
  }
  
  // ✅ 2. Validasi matching nim dan nama
  if (
    !match(panitia.nim as string, q.nim, "nim") ||
    !match(panitia.nama_lengkap as string, q.nama, "nama")
  )
    return NextResponse.json({ 
      success: false, 
      message: "Data QR tidak sesuai dengan data panitia" 
    }, { status: 400 });
  
  // ✅ 3. Validasi kegiatan
  let keg = kCache.get(`k_${kegiatan_id}`);
  if (!keg) {
    const [r] = await db.execute<RowDataPacket[]>(
      "SELECT id,nama FROM kegiatan WHERE id=? AND is_active=1 LIMIT 1",
      [kegiatan_id]
    );
    if (!r.length)
      return NextResponse.json({ 
        success: false, 
        message: "Kegiatan tidak ditemukan" 
      }, { status: 404 });
    keg = r[0];
    kCache.set(`k_${kegiatan_id}`, keg);
  }
  
  // ✅ 4. VALIDASI DIVISI - INI YANG HILANG!
  try {
    const divisiValidation = await validateDivisi(kegiatan_id, panitia.id as number);
    
    if (!divisiValidation.isAllowed) {
      console.log(`❌ DIVISI TIDAK DIIZINKAN: ${panitia.nim} (${divisiValidation.panitiaDiv}) untuk kegiatan ${keg.nama}`);
      
      return NextResponse.json({
        success: false,
        message: divisiValidation.error,
        data: {
          panitia_divisi: divisiValidation.panitiaDiv,
          divisi_yang_diizinkan: divisiValidation.allowedDivisi.map((div: string) => ({
            nama: div
          }))
        }
      }, { status: 403 }); // 403 Forbidden
    }
    
    console.log(`✅ DIVISI VALID: ${panitia.nim} (${divisiValidation.panitiaDiv}) diizinkan untuk kegiatan ${keg.nama}`);
    
  } catch (divisiError) {
    console.error("Error validating divisi:", divisiError);
    return NextResponse.json({
      success: false,
      message: "Gagal memvalidasi divisi"
    }, { status: 500 });
  }
  
  // ✅ 5. Cek duplikasi absensi
  const today = new Date().toISOString().slice(0, 10);
  const [dup] = await db.execute<RowDataPacket[]>(
    `SELECT id,status FROM absensi 
     WHERE panitia_id=? AND kegiatan_id=? AND tanggal_absensi=? 
     AND ( (kegiatan_rangkaian_id IS NULL AND ? IS NULL) OR kegiatan_rangkaian_id = ? )
     LIMIT 1`,
    [
      panitia.id,
      kegiatan_id,
      today,
      kegiatan_rangkaian_id,
      kegiatan_rangkaian_id,
    ]
  );
  
  let id = dup[0]?.id;
  if (dup.length) {
    if (dup[0].status === "Hadir")
      return NextResponse.json({ 
        success: false, 
        message: "Anda sudah melakukan absensi sebelumnya" 
      }, { status: 409 });
    
    // Update absensi yang sudah ada
    await db.execute(
      'UPDATE absensi SET status="Hadir",waktu_absensi=NOW(),metode_absensi="QR Code",qr_data=? WHERE id=?',
      [qr_data, id]
    );
  } else {
    // Insert absensi baru
    const [ins] = await db.execute(
      "INSERT INTO absensi (panitia_id,kegiatan_id,kegiatan_rangkaian_id,tanggal_absensi,status,waktu_absensi,metode_absensi,qr_data,koordinat_lat,koordinat_lng) VALUES (?,?,?,?,'Hadir',NOW(),'QR Code',?,?,?)",
      [
        panitia.id,
        kegiatan_id,
        kegiatan_rangkaian_id,
        today,
        qr_data,
        koordinat_lat,
        koordinat_lng,
      ]
    );
    id = (ins as any).insertId;
  }
  
  // ✅ 6. Push notification
  await push(req, { kind: "update", kegiatan_id, tanggal: today });
  
  // ✅ 7. Response sukses dengan detail
  const rangkaianInfo = kegiatan_rangkaian_id ? await getRangkaianInfo(kegiatan_rangkaian_id) : null;
  
  return NextResponse.json({ 
    success: true, 
    message: "Absensi berhasil dicatat",
    data: {
      id,
      panitia: {
        nama: panitia.nama_lengkap,
        nim: panitia.nim,
        divisi: panitia.divisi
      },
      kegiatan: {
        nama: keg.nama
      },
      rangkaian_nama: rangkaianInfo?.judul || null,
      tanggal: today,
      waktu: new Date().toLocaleTimeString('id-ID')
    }
  });
}

// ✅ Helper function untuk get rangkaian info
async function getRangkaianInfo(rangkaianId: number) {
  try {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT judul FROM kegiatan_rangkaian WHERE id=? AND is_active=1 LIMIT 1",
      [rangkaianId]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}