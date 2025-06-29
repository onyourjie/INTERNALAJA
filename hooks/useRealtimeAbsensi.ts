// hooks/useRealtimeAbsensi.ts
import { useState, useEffect, useCallback, useRef } from 'react';

interface AbsensiData {
  id: number;
  panitia_id: number;
  unique_id: string;
  kegiatan_id: number;
  kegiatan_rangkaian_id: number | null;
  nim: string;
  nama_lengkap: string;
  divisi: string;
  kehadiran: 'Hadir' | 'Tidak Hadir' | 'Izin' | 'Sakit';
  status: 'Hadir' | 'Tidak Hadir' | 'Izin' | 'Sakit';
  tanggal_absensi: string;
  waktu_hadir: string;
  waktu_absensi: string | null;
  metode_absensi: 'QR Code' | 'Manual' | 'Fingerprint' | 'Face Recognition';
  kegiatan_nama: string;
  rangkaian_nama: string | null;
  catatan: string | null;
  koordinat_lat: number | null;
  koordinat_lng: number | null;
  qr_data: string | null;
  validasi_admin: boolean;
  last_updated: string | null;
  is_new_record: boolean;
  has_location: boolean;
  scan_method: string;
}

interface Statistics {
  total_panitia: number;
  hadir: number;
  tidak_hadir: number;
  izin: number;
  sakit: number;
  percentage_hadir: number;
  last_scan: AbsensiData | null;
  qr_scans: number;
  manual_entries: number;
}

interface AbsensiResponse {
  success: boolean;
  data: AbsensiData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  statistics: Statistics;
  realtime: boolean;
  cache_hit: boolean;
  response_time_ms: number;
  server_time: string;
  query_params: any;
}

interface DashboardEvent {
  type: string;
  data: any;
  timestamp: string;
  id: string;
}

interface UseRealtimeAbsensiProps {
  kegiatan_id: string | null;
  kegiatan_rangkaian_id?: string | null;
  tanggal?: string | null;
  search?: string;
  status?: string;
  divisi?: string;
  page?: number;
  limit?: number;
  // Real-time options
  enableRealtime?: boolean;
  pollingInterval?: number; // milliseconds
  maxRetries?: number;
  onNewScan?: (data: AbsensiData) => void;
  onStatusUpdate?: (data: AbsensiData) => void;
  onError?: (error: string) => void;
}

interface UseRealtimeAbsensiReturn {
  data: AbsensiData[];
  statistics: Statistics | null;
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  isRealtime: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
  // Actions
  refresh: () => Promise<void>;
  forceRefresh: () => Promise<void>;
  updateStatus: (id: number, status: string, catatan?: string) => Promise<boolean>;
  deleteAbsensi: (id: number) => Promise<boolean>;
  // Real-time controls
  startRealtime: () => void;
  stopRealtime: () => void;
  // Event listeners
  events: DashboardEvent[];
  clearEvents: () => void;
}

export const useRealtimeAbsensi = ({
  kegiatan_id,
  kegiatan_rangkaian_id,
  tanggal,
  search = '',
  status = '',
  divisi = '',
  page = 1,
  limit = 50,
  enableRealtime = true,
  pollingInterval = 3000, // 3 seconds
  maxRetries = 3,
  onNewScan,
  onStatusUpdate,
  onError
}: UseRealtimeAbsensiProps): UseRealtimeAbsensiReturn => {
  
  // State management
  const [data, setData] = useState<AbsensiData[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'error'>('disconnected');
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  
  // Refs untuk managing timers dan state
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eventPollingRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const lastEventIdRef = useRef<string | null>(null);
  const isComponentMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Build query parameters
  const buildQueryParams = useCallback((extraParams: Record<string, any> = {}) => {
    const params = new URLSearchParams();
    
    if (kegiatan_id) params.append('kegiatan_id', kegiatan_id);
    if (kegiatan_rangkaian_id && kegiatan_rangkaian_id !== 'null') {
      params.append('kegiatan_rangkaian_id', kegiatan_rangkaian_id);
    }
    if (tanggal) params.append('tanggal', tanggal);
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    if (divisi) params.append('divisi', divisi);
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    
    // Add extra params
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        params.append(key, value.toString());
      }
    });

    return params;
  }, [kegiatan_id, kegiatan_rangkaian_id, tanggal, search, status, divisi, page, limit]);

  // Fetch absensi data
  const fetchData = useCallback(async (forceRefresh = false, isRealtime = false) => {
    if (!kegiatan_id || !isComponentMountedRef.current) return;

    try {
      if (!isRealtime) setLoading(true);
      setError(null);
      
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();

      const params = buildQueryParams({
        _refresh: forceRefresh,
        realtime: isRealtime,
        _cache_bust: Date.now() // Prevent caching issues
      });

      console.log(`🔄 Fetching absensi data: ${isRealtime ? 'REALTIME' : 'NORMAL'} mode`);
      
      const response = await fetch(`/api/absensi?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': isRealtime ? 'no-cache' : 'default',
        },
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: AbsensiResponse = await response.json();
      
      if (!isComponentMountedRef.current) return;

      if (result.success) {
        const newData = result.data || [];
        const newStats = result.statistics;

        // Check for changes in real-time mode
        if (isRealtime && data.length > 0) {
          // Find new entries (just attended)
          const newAttendees = newData.filter(newItem => 
            newItem.status === 'Hadir' && 
            !data.find(oldItem => 
              oldItem.panitia_id === newItem.panitia_id && 
              oldItem.status === 'Hadir'
            )
          );

          // Find status changes
          const statusChanges = newData.filter(newItem => {
            const oldItem = data.find(old => old.panitia_id === newItem.panitia_id);
            return oldItem && oldItem.status !== newItem.status;
          });

          // Trigger callbacks
          newAttendees.forEach(attendee => {
            console.log('🔔 New scan detected:', attendee.nama_lengkap);
            if (onNewScan) onNewScan(attendee);
          });

          statusChanges.forEach(change => {
            console.log('🔄 Status change detected:', change.nama_lengkap, change.status);
            if (onStatusUpdate) onStatusUpdate(change);
          });
        }

        setData(newData);
        setStatistics(newStats);
        setLastUpdate(new Date());
        setConnectionStatus('connected');
        retryCountRef.current = 0;

        console.log(`✅ Data updated: ${newData.length} records, ${result.response_time_ms}ms`);
      } else {
        throw new Error(result.message || 'Failed to fetch data');
      }

    } catch (err: any) {
      if (!isComponentMountedRef.current) return;
      
      if (err.name === 'AbortError') {
        console.log('🛑 Request aborted');
        return;
      }

      console.error('❌ Fetch error:', err);
      
      const errorMessage = err?.message || 'Unknown error occurred';
      setError(errorMessage);
      setConnectionStatus('error');
      
      if (onError) onError(errorMessage);

      // Retry logic for real-time mode
      if (isRealtime && retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        console.log(`🔄 Retrying... Attempt ${retryCountRef.current}/${maxRetries}`);
        
        setTimeout(() => {
          if (isComponentMountedRef.current) {
            fetchData(false, true);
          }
        }, pollingInterval * retryCountRef.current); // Exponential backoff
      }
    } finally {
      if (!isRealtime && isComponentMountedRef.current) {
        setLoading(false);
      }
    }
  }, [kegiatan_id, buildQueryParams, data, maxRetries, pollingInterval, onNewScan, onStatusUpdate, onError]);

  // Fetch events for real-time updates
  const fetchEvents = useCallback(async () => {
    if (!kegiatan_id || !enableRealtime || !isComponentMountedRef.current) return;

    try {
      const params = new URLSearchParams();
      params.append('kegiatan_id', kegiatan_id);
      if (lastEventIdRef.current) {
        params.append('last_event_id', lastEventIdRef.current);
      }

      const response = await fetch(`/api/absensi/scan?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        }
      });

      if (!response.ok) return;

      const result = await response.json();
      
      if (!isComponentMountedRef.current) return;

      if (result.success && result.events && result.events.length > 0) {
        const newEvents = result.events;
        
        setEvents(prev => [...prev, ...newEvents].slice(-100)); // Keep last 100 events
        
        // Update last event ID
        if (newEvents.length > 0) {
          lastEventIdRef.current = newEvents[newEvents.length - 1].id;
        }

        // Check for scan events that require data refresh
        const hasAbsensiEvents = newEvents.some((event: DashboardEvent) => 
          ['absensi_created', 'absensi_updated', 'scan_success'].includes(event.type)
        );

        if (hasAbsensiEvents) {
          console.log('🔔 Absensi events detected, refreshing data...');
          fetchData(true, true); // Force refresh with real-time mode
        }
      }

    } catch (err: any) {
      console.warn('⚠️ Event fetch error:', err.message);
    }
  }, [kegiatan_id, enableRealtime, fetchData]);

  // Start real-time polling
  const startRealtime = useCallback(() => {
    if (!enableRealtime || !kegiatan_id) return;

    console.log('🚀 Starting real-time polling...');
    setConnectionStatus('connecting');

    // Initial data fetch
    fetchData(false, true);

    // Setup data polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    pollingIntervalRef.current = setInterval(() => {
      if (isComponentMountedRef.current) {
        fetchData(false, true);
      }
    }, pollingInterval);

    // Setup event polling (faster than data polling)
    if (eventPollingRef.current) {
      clearInterval(eventPollingRef.current);
    }
    
    eventPollingRef.current = setInterval(() => {
      if (isComponentMountedRef.current) {
        fetchEvents();
      }
    }, 1000); // Check events every second

  }, [enableRealtime, kegiatan_id, fetchData, fetchEvents, pollingInterval]);

  // Stop real-time polling
  const stopRealtime = useCallback(() => {
    console.log('🛑 Stopping real-time polling...');
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    if (eventPollingRef.current) {
      clearInterval(eventPollingRef.current);
      eventPollingRef.current = null;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setConnectionStatus('disconnected');
  }, []);

  // Manual refresh
  const refresh = useCallback(async () => {
    await fetchData(false, false);
  }, [fetchData]);

  // Force refresh (bypass cache)
  const forceRefresh = useCallback(async () => {
    await fetchData(true, false);
  }, [fetchData]);

  // Update status action
  const updateStatus = useCallback(async (id: number, newStatus: string, catatan?: string): Promise<boolean> => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/absensi', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          status: newStatus,
          catatan,
          admin_user: 'dashboard_admin',
          force_update: true
        })
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Status updated successfully');
        
        // Immediate local update untuk responsiveness
        setData(prev => prev.map(item => 
          item.id === id 
            ? { ...item, status: newStatus as any, kehadiran: newStatus as any, catatan, last_updated: new Date().toISOString() }
            : item
        ));
        
        // Refresh data to ensure consistency
        setTimeout(() => fetchData(true, true), 500);
        
        return true;
      } else {
        throw new Error(result.message || 'Failed to update status');
      }
    } catch (err: any) {
      console.error('❌ Update status error:', err);
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchData]);

  // Delete absensi action
  const deleteAbsensi = useCallback(async (id: number): Promise<boolean> => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/absensi?id=${id}&admin_user=dashboard_admin`, {
        method: 'DELETE',
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Absensi deleted successfully');
        
        // Immediate local update
        setData(prev => prev.filter(item => item.id !== id));
        
        // Refresh data
        setTimeout(() => fetchData(true, true), 500);
        
        return true;
      } else {
        throw new Error(result.message || 'Failed to delete absensi');
      }
    } catch (err: any) {
      console.error('❌ Delete absensi error:', err);
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchData]);

  // Clear events
  const clearEvents = useCallback(() => {
    setEvents([]);
    lastEventIdRef.current = null;
  }, []);

  // Effect: Initial fetch dan setup real-time
  useEffect(() => {
    if (!kegiatan_id) {
      setData([]);
      setStatistics(null);
      setError(null);
      return;
    }

    // Initial fetch
    fetchData(false, false);

    // Start real-time if enabled
    if (enableRealtime) {
      startRealtime();
    }

    return () => {
      stopRealtime();
    };
  }, [kegiatan_id, enableRealtime]); // Only depend on these core params

  // Effect: Refresh when search params change
  useEffect(() => {
    if (kegiatan_id) {
      const timeoutId = setTimeout(() => {
        fetchData(false, enableRealtime);
      }, 300); // Debounce

      return () => clearTimeout(timeoutId);
    }
  }, [kegiatan_rangkaian_id, tanggal, search, status, divisi, page, limit]);

  // Effect: Cleanup on unmount
  useEffect(() => {
    isComponentMountedRef.current = true;
    
    return () => {
      isComponentMountedRef.current = false;
      stopRealtime();
    };
  }, [stopRealtime]);

  // Effect: Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Back online, resuming real-time updates...');
      if (enableRealtime && kegiatan_id) {
        startRealtime();
      }
    };

    const handleOffline = () => {
      console.log('📵 Gone offline, pausing real-time updates...');
      setConnectionStatus('disconnected');
      stopRealtime();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enableRealtime, kegiatan_id, startRealtime, stopRealtime]);

  return {
    data,
    statistics,
    loading,
    error,
    lastUpdate,
    isRealtime: enableRealtime && connectionStatus === 'connected',
    connectionStatus,
    // Actions
    refresh,
    forceRefresh,
    updateStatus,
    deleteAbsensi,
    // Real-time controls
    startRealtime,
    stopRealtime,
    // Events
    events,
    clearEvents
  };
};

// Additional hook untuk monitoring scan events secara real-time
export const useRealtimeScanMonitor = (kegiatan_id: string | null) => {
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [scanCount, setScanCount] = useState(0);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);

  const { events } = useRealtimeAbsensi({
    kegiatan_id,
    enableRealtime: true,
    pollingInterval: 1000, // Very fast for scan monitoring
  });

  useEffect(() => {
    const scanEvents = events.filter(event => 
      ['absensi_created', 'absensi_updated', 'scan_success'].includes(event.type)
    );

    if (scanEvents.length > 0) {
      setRecentScans(prev => [...scanEvents, ...prev].slice(0, 10)); // Keep last 10 scans
      setScanCount(prev => prev + scanEvents.length);
      setLastScanTime(new Date());
    }
  }, [events]);

  const clearScanHistory = useCallback(() => {
    setRecentScans([]);
    setScanCount(0);
    setLastScanTime(null);
  }, []);

  return {
    recentScans,
    scanCount,
    lastScanTime,
    clearScanHistory
  };
};