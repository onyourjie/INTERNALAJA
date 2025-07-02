/* eslint-disable @typescript-eslint/no-explicit-any */
// app/api/absensi/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db, RowDataPacket } from '@/lib/db';

// Enhanced cache with shorter TTL for dashboard
const DASHBOARD_CACHE = new Map<string, { data: any, timestamp: number, ttl: number }>();
const CACHE_TTL = 1000; // 1 second for real-time updates

interface DashboardAbsensiRow extends RowDataPacket {
  // Absensi fields
  absensi_id: number | null;
  panitia_id: number;
  status: 'Hadir' | 'Tidak Hadir' | 'Izin' | 'Sakit';
  waktu_absensi: string | null;
  metode_absensi: 'QR Code' | 'Manual';
  tanggal_absensi: string;
  catatan: string | null;
  
  // Panitia fields
  nim: string;
  nama_lengkap: string;
  divisi: string;
  unique_id: string;
  
  // Kegiatan fields
  kegiatan_nama: string;
  kegiatan_id: number;
  kegiatan_rangkaian_id: number | null;
}

// Cache helper functions
const getCachedData = (key: string) => {
  const cached = DASHBOARD_CACHE.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data;
  }
  DASHBOARD_CACHE.delete(key);
  return null;
};

const setCachedData = (key: string, data: any, ttl = CACHE_TTL) => {
  DASHBOARD_CACHE.set(key, { data, timestamp: Date.now(), ttl });
  
  // Clean old cache entries
  if (DASHBOARD_CACHE.size > 100) {
    const entries = Array.from(DASHBOARD_CACHE.entries());
    entries.slice(0, 30).forEach(([k]) => DASHBOARD_CACHE.delete(k));
  }
};

const clearDashboardCache = (kegiatan_id: string, tanggal?: string) => {
  const keysToDelete: string[] = [];
  
  for (const key of DASHBOARD_CACHE.keys()) {
    if (
      key.includes(`dashboard_${kegiatan_id}`) ||
      key.includes('dashboard_all') ||
      (tanggal && key.includes(tanggal))
    ) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => DASHBOARD_CACHE.delete(key));
  console.log(`🧹 Cleared ${keysToDelete.length} dashboard cache entries for kegiatan ${kegiatan_id}`);
};

// Format date for database
const formatDateForDB = (dateInput: string): string => {
  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date');
    }
    return date.toISOString().split('T')[0];
  } catch (error) {
    throw new Error(`Invalid date format: ${dateInput}`);
  }
};

// GET - Enhanced dashboard data with real-time absensi status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const kegiatan_id = searchParams.get('kegiatan_id');
    const kegiatan_rangkaian_id = searchParams.get('kegiatan_rangkaian_id');
    const tanggal = searchParams.get('tanggal');
    const status = searchParams.get('status');
    const divisi = searchParams.get('divisi');
    const forceRefresh = searchParams.get('_refresh') === 'true';
    const clearCache = searchParams.get('clear_cache') === 'true';

    console.log(`🎯 GET /api/absensi/dashboard - kegiatan_id: ${kegiatan_id}, tanggal: ${tanggal}, refresh: ${forceRefresh}`);

    // Clear cache if requested
    if (clearCache) {
      DASHBOARD_CACHE.clear();
      console.log('🧹 All dashboard cache cleared on request');
    }

    const offset = (page - 1) * limit;

    if (!kegiatan_id) {
      return NextResponse.json({
        success: true,
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
        message: 'No kegiatan_id provided'
      });
    }

    // Format date for database
    let formattedDate = '';
    if (tanggal) {
      formattedDate = formatDateForDB(tanggal);
    }

    // Create cache key
    const cacheKey = `dashboard_${kegiatan_id}_${kegiatan_rangkaian_id || 'null'}_${formattedDate}_${search}_${status}_${divisi}_${page}_${limit}`;
    
    // Check cache first (skip if force refresh)
    if (!forceRefresh && !clearCache) {
      const cachedData = getCachedData(cacheKey);
      if (cachedData) {
        console.log('✅ Returning cached dashboard data');
        return NextResponse.json({
          ...cachedData,
          _cached: true,
          _cache_key: cacheKey.substring(0, 50) + '...'
        });
      }
    }

    // IMPROVED QUERY: Direct join with absensi table for real-time data
    let baseQuery = `
      SELECT DISTINCT
        COALESCE(a.id, 0) as absensi_id,
        p.id as panitia_id,
        p.nim,
        p.nama_lengkap,
        p.divisi,
        p.unique_id,
        COALESCE(a.status, 'Tidak Hadir') as status,
        a.waktu_absensi,
        COALESCE(a.metode_absensi, 'Manual') as metode_absensi,
        COALESCE(a.tanggal_absensi, ?) as tanggal_absensi,
        a.catatan,
        k.nama as kegiatan_nama,
        k.id as kegiatan_id,
        a.kegiatan_rangkaian_id
      FROM panitia_peserta p
      INNER JOIN kegiatan_divisi kd ON (kd.divisi = 'Semua' OR kd.divisi = p.divisi)
      INNER JOIN kegiatan k ON k.id = kd.kegiatan_id
      LEFT JOIN absensi a ON (
        a.panitia_id = p.id 
        AND a.kegiatan_id = k.id 
        AND a.tanggal_absensi = ?
        AND (a.kegiatan_rangkaian_id = ? OR (a.kegiatan_rangkaian_id IS NULL AND ? IS NULL))
      )
      WHERE k.id = ? 
        AND k.is_active = 1
        AND p.is_active = 1
        AND kd.is_active = 1
    `;

    let queryParams: any[] = [
      formattedDate, // For COALESCE tanggal_absensi
      formattedDate, // For absensi join condition
      kegiatan_rangkaian_id, // For rangkaian filter
      kegiatan_rangkaian_id, // For rangkaian filter (IS NULL check)
      kegiatan_id // For kegiatan filter
    ];

    // Additional filters
    const additionalFilters: string[] = [];

    // Filter search
    if (search) {
      additionalFilters.push('(p.nama_lengkap LIKE ? OR p.nim LIKE ? OR p.divisi LIKE ?)');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    // Filter status
    if (status) {
      if (status === 'Hadir') {
        additionalFilters.push('a.status = "Hadir"');
      } else if (status === 'Tidak Hadir') {
        additionalFilters.push('(a.status IS NULL OR a.status = "Tidak Hadir")');
      } else if (status === 'Izin') {
        additionalFilters.push('a.status = "Izin"');
      } else if (status === 'Sakit') {
        additionalFilters.push('a.status = "Sakit"');
      }
    }

    // Filter divisi
    if (divisi) {
      additionalFilters.push('p.divisi = ?');
      queryParams.push(divisi);
    }

    // Apply additional filters
    if (additionalFilters.length > 0) {
      baseQuery += ' AND ' + additionalFilters.join(' AND ');
    }

    baseQuery += ' ORDER BY p.divisi ASC, p.nama_lengkap ASC';

    console.log(`📊 Executing enhanced dashboard query with ${queryParams.length} parameters`);
    const queryStart = Date.now();

    const [rows] = await db.execute<DashboardAbsensiRow[]>(baseQuery, queryParams);

    const queryTime = Date.now() - queryStart;
    console.log(`📦 Retrieved ${rows.length} records in ${queryTime}ms`);

    // Format data for response with real-time status
    const formattedData = rows.map(row => ({
      id: row.absensi_id || 0,
      panitia_id: row.panitia_id,
      kegiatan_id: row.kegiatan_id,
      kegiatan_rangkaian_id: row.kegiatan_rangkaian_id,
      nim: row.nim,
      nama_lengkap: row.nama_lengkap,
      divisi: row.divisi,
      unique_id: row.unique_id,
      kehadiran: row.status, // For compatibility
      status: row.status,
      tanggal_absensi: row.tanggal_absensi || formattedDate,
      waktu_hadir: row.waktu_absensi ? 
        new Date(row.waktu_absensi).toLocaleTimeString('id-ID', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }) : '-',
      waktu_absensi: row.waktu_absensi,
      metode_absensi: row.metode_absensi,
      kegiatan_nama: row.kegiatan_nama,
      catatan: row.catatan,
      _real_time_status: row.status, // Explicit real-time status indicator
      _last_updated: row.waktu_absensi || 'Never'
    }));

    // Apply pagination
    const totalEntries = formattedData.length;
    const startIndex = offset;
    const endIndex = startIndex + limit;
    const paginatedData = formattedData.slice(startIndex, endIndex);

    const response = {
      success: true,
      data: paginatedData,
      pagination: {
        page,
        limit,
        total: totalEntries,
        totalPages: Math.ceil(totalEntries / limit)
      },
      query_info: {
        query_time_ms: queryTime,
        total_records: totalEntries,
        filtered_records: paginatedData.length,
        kegiatan_id,
        tanggal: formattedDate,
        has_search: !!search,
        has_filters: !!(status || divisi),
        real_time_data: true,
        cache_ttl: CACHE_TTL
      },
      statistics: {
        total: totalEntries,
        hadir: formattedData.filter(p => p.status === 'Hadir').length,
        tidak_hadir: formattedData.filter(p => p.status === 'Tidak Hadir').length,
        izin: formattedData.filter(p => p.status === 'Izin').length,
        sakit: formattedData.filter(p => p.status === 'Sakit').length
      }
    };

    // Cache the response with shorter TTL for real-time updates
    setCachedData(cacheKey, response, CACHE_TTL);

    console.log(`✅ Returning ${paginatedData.length} paginated records out of ${totalEntries} total (real-time data)`);

    return NextResponse.json({
      ...response,
      _cached: false,
      _cache_key: cacheKey.substring(0, 50) + '...',
      _real_time: true
    });

  } catch (error: any) {
    console.error('❌ GET Dashboard Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error fetching dashboard data', 
        error: error?.message || 'Unknown error',
        error_type: error.constructor.name
      },
      { status: 500 }
    );
  }
}

// POST - Trigger cache invalidation and real-time update
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, kegiatan_id, tanggal, panitia_id, trigger_refresh } = body;

    if (action === 'invalidate_cache') {
      clearDashboardCache(kegiatan_id?.toString(), tanggal);
      
      // Trigger frontend refresh event
      if (trigger_refresh && typeof global !== 'undefined' && global.process?.emit) {
        global.process.emit('dashboard-refresh', {
          kegiatan_id,
          tanggal,
          panitia_id,
          timestamp: new Date().toISOString()
        });
      }

      return NextResponse.json({
        success: true,
        message: `🧹 Dashboard cache invalidated for kegiatan ${kegiatan_id}`,
        action: 'cache_invalidated',
        kegiatan_id,
        tanggal,
        trigger_refresh
      });
    }

    if (action === 'force_refresh') {
      clearDashboardCache(kegiatan_id?.toString(), tanggal);
      
      return NextResponse.json({
        success: true,
        message: `🔄 Dashboard force refresh triggered for kegiatan ${kegiatan_id}`,
        action: 'force_refresh',
        kegiatan_id,
        tanggal
      });
    }

    if (action === 'stats') {
      const stats = {
        cache_size: DASHBOARD_CACHE.size,
        cache_ttl: CACHE_TTL,
        memory_usage: process.memoryUsage(),
        cache_entries: Array.from(DASHBOARD_CACHE.keys()).slice(0, 10)
      };

      return NextResponse.json({
        success: true,
        data: stats,
        message: '📊 Dashboard cache stats retrieved'
      });
    }

    return NextResponse.json({
      success: false,
      message: 'Invalid action. Available: invalidate_cache, force_refresh, stats'
    }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: 'Dashboard action error',
      error: error.message
    }, { status: 500 });
  }
}

// PATCH - Real-time status update
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { kegiatan_id, tanggal, panitia_id, new_status } = body;

    console.log(`🔄 Dashboard PATCH - Real-time update for panitia ${panitia_id}`);

    // Clear related cache immediately
    if (kegiatan_id && tanggal) {
      clearDashboardCache(kegiatan_id.toString(), tanggal);
    }

    return NextResponse.json({
      success: true,
      message: `📊 Dashboard updated for panitia ${panitia_id}`,
      data: {
        kegiatan_id,
        tanggal,
        panitia_id,
        new_status,
        cache_cleared: true,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: 'Dashboard update error',
      error: error.message
    }, { status: 500 });
  }
}