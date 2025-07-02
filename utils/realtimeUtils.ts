/* eslint-disable prefer-spread */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
// utils/realtimeUtils.ts

// Types and interfaces for real-time system
export interface RealtimeEvent {
  type: 'absensi_created' | 'absensi_updated' | 'absensi_deleted' | 'scan_success' | 'scan_failed' | 'connection_status';
  data: any;
  timestamp: string;
  id: string;
  kegiatan_id?: string;
  panitia_id?: string;
}

export interface ConnectionStatus {
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  lastSeen: Date;
  retryCount: number;
  latency: number;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

// Real-time Cache Manager
export class RealtimeCacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize: number;
  private defaultTTL: number;

  constructor(maxSize = 1000, defaultTTL = 30000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = Array.from(this.cache.keys())[0];
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      hits: 0
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update hits counter
    entry.hits++;
    return entry.data as T;
  }

  invalidate(pattern: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    const entries = Array.from(this.cache.values());
    return {
      size: this.cache.size,
      totalHits: entries.reduce((sum, entry) => sum + entry.hits, 0),
      avgAge: entries.reduce((sum, entry) => sum + (Date.now() - entry.timestamp), 0) / entries.length,
      expiredCount: entries.filter(entry => Date.now() - entry.timestamp > entry.ttl).length
    };
  }
}

// Event Bus for real-time communication
export class RealtimeEventBus {
  private listeners = new Map<string, Set<Function>>();
  private eventHistory: RealtimeEvent[] = [];
  private maxHistory = 100;

  on(eventType: string, callback: Function): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    this.listeners.get(eventType)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  emit(event: RealtimeEvent): void {
    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }

    // Notify listeners
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Event listener error:', error);
        }
      });
    }

    // Notify wildcard listeners
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error('Wildcard event listener error:', error);
        }
      });
    }
  }

  getHistory(eventType?: string, limit = 10): RealtimeEvent[] {
    let events = eventType 
      ? this.eventHistory.filter(e => e.type === eventType)
      : this.eventHistory;
    
    return events.slice(-limit);
  }

  clearHistory(): void {
    this.eventHistory = [];
  }
}

// Performance Monitor
export class PerformanceMonitor {
  private metrics = new Map<string, number[]>();
  private maxSamples = 100;

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const samples = this.metrics.get(name)!;
    samples.push(value);

    if (samples.length > this.maxSamples) {
      samples.shift();
    }
  }

  getMetrics(name: string) {
    const samples = this.metrics.get(name) || [];
    if (samples.length === 0) {
      return { avg: 0, min: 0, max: 0, count: 0 };
    }

    const sum = samples.reduce((a, b) => a + b, 0);
    return {
      avg: sum / samples.length,
      min: Math.min(...samples),
      max: Math.max(...samples),
      count: samples.length,
      latest: samples[samples.length - 1]
    };
  }

  getAllMetrics() {
    const result: Record<string, any> = {};
    for (const [name, _] of this.metrics) {
      result[name] = this.getMetrics(name);
    }
    return result;
  }

  clearMetrics(): void {
    this.metrics.clear();
  }
}

// Connection Health Monitor
export class ConnectionHealthMonitor {
  private status: ConnectionStatus = {
    status: 'disconnected',
    lastSeen: new Date(),
    retryCount: 0,
    latency: 0
  };
  
  private pingInterval: NodeJS.Timeout | null = null;
  private healthCheckUrl: string;
  private onStatusChange?: (status: ConnectionStatus) => void;

  constructor(healthCheckUrl: string, onStatusChange?: (status: ConnectionStatus) => void) {
    this.healthCheckUrl = healthCheckUrl;
    this.onStatusChange = onStatusChange;
  }

  start(intervalMs = 5000): void {
    this.stop(); // Stop existing monitor
    
    this.pingInterval = setInterval(() => {
      this.performHealthCheck();
    }, intervalMs);
    
    // Initial check
    this.performHealthCheck();
  }

  stop(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private async performHealthCheck(): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.updateStatus('connecting');
      
      const response = await fetch(this.healthCheckUrl, {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      const latency = Date.now() - startTime;
      
      if (response.ok) {
        this.status = {
          status: 'connected',
          lastSeen: new Date(),
          retryCount: 0,
          latency
        };
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      this.status = {
        ...this.status,
        status: 'error',
        retryCount: this.status.retryCount + 1,
        latency: Date.now() - startTime
      };
    }

    this.onStatusChange?.(this.status);
  }

  private updateStatus(status: ConnectionStatus['status']): void {
    if (this.status.status !== status) {
      this.status.status = status;
      this.onStatusChange?.(this.status);
    }
  }

  getStatus(): ConnectionStatus {
    return { ...this.status };
  }
}

// Debounce utility for search and filtering
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), waitMs);
  };
}

// Throttle utility for high-frequency events
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limitMs);
    }
  };
}

// Retry utility with exponential backoff
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000,
  maxDelayMs = 10000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt),
        maxDelayMs
      );
      
      console.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// Date utilities for Indonesian locale
export const dateUtils = {
  formatIndonesian: (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  },

  formatTime: (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  },

  formatDateTime: (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  formatRelativeTime: (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) return `${diffSeconds} detik yang lalu`;
    if (diffMinutes < 60) return `${diffMinutes} menit yang lalu`;
    if (diffHours < 24) return `${diffHours} jam yang lalu`;
    if (diffDays < 7) return `${diffDays} hari yang lalu`;
    
    return dateUtils.formatIndonesian(d);
  },

  isToday: (date: Date | string): boolean => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();
    return d.toDateString() === today.toDateString();
  },

  isSameDay: (date1: Date | string, date2: Date | string): boolean => {
    const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
    const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
    return d1.toDateString() === d2.toDateString();
  }
};

// Audio notification utilities
export const audioUtils = {
  playSuccessSound: (): void => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5 note
      oscillator.frequency.setValueAtTime(1174.66, audioContext.currentTime + 0.1); // D6 note
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn('Could not play success sound:', error);
    }
  },

  playErrorSound: (): void => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
    } catch (error) {
      console.warn('Could not play error sound:', error);
    }
  },

  playNotificationSound: (): void => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }
};

// Local storage utilities with error handling
export const storageUtils = {
  set: (key: string, value: any): boolean => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('Could not save to localStorage:', error);
      return false;
    }
  },

  get: <T>(key: string, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn('Could not read from localStorage:', error);
      return defaultValue;
    }
  },

  remove: (key: string): boolean => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn('Could not remove from localStorage:', error);
      return false;
    }
  },

  clear: (): boolean => {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.warn('Could not clear localStorage:', error);
      return false;
    }
  }
};

// Network status utilities
export const networkUtils = {
  isOnline: (): boolean => {
    return navigator.onLine;
  },

  onOnline: (callback: () => void): () => void => {
    const handler = () => callback();
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  },

  onOffline: (callback: () => void): () => void => {
    const handler = () => callback();
    window.addEventListener('offline', handler);
    return () => window.removeEventListener('offline', handler);
  },

  getConnectionType: (): string => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    return connection ? connection.effectiveType || 'unknown' : 'unknown';
  }
};

// Export singleton instances for global use
export const globalCache = new RealtimeCacheManager(2000, 60000); // 2000 entries, 60s TTL
export const globalEventBus = new RealtimeEventBus();
export const globalPerformanceMonitor = new PerformanceMonitor();

// Initialize global event handlers
if (typeof window !== 'undefined') {
  // Network status monitoring
  networkUtils.onOnline(() => {
    globalEventBus.emit({
      type: 'connection_status',
      data: { online: true },
      timestamp: new Date().toISOString(),
      id: `connection_${Date.now()}`
    });
  });

  networkUtils.onOffline(() => {
    globalEventBus.emit({
      type: 'connection_status',
      data: { online: false },
      timestamp: new Date().toISOString(),
      id: `connection_${Date.now()}`
    });
  });

  // Performance monitoring
  window.addEventListener('beforeunload', () => {
    const metrics = globalPerformanceMonitor.getAllMetrics();
    console.log('Performance metrics on unload:', metrics);
  });
}

// Helper function to generate unique IDs
export const generateId = (): string => {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Helper function to format file sizes
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Helper function to validate Indonesian NIM format
export const validateNIM = (nim: string): boolean => {
  // Basic NIM validation: 8-15 digits
  return /^\d{8,15}$/.test(nim.replace(/\s/g, ''));
};

// Helper function to normalize Indonesian names
export const normalizeIndonesianName = (name: string): string => {
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// Helper function to generate QR data
export const generateQRData = (panitia: {
  unique_id: string;
  nama_lengkap: string;
  nim: string;
  divisi: string;
}): string => {
  return JSON.stringify({
    id: panitia.unique_id,
    nama: panitia.nama_lengkap,
    nim: panitia.nim,
    divisi: panitia.divisi,
    timestamp: new Date().toISOString(),
    version: '2.0'
  });
};