/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { 
  Upload, Download, Search, Eye, Trash2, FileText, Users, CheckCircle, XCircle, 
  BarChart3, RefreshCw, QrCode, Archive, Filter, AlertTriangle,
  TrendingUp, Award, MessageSquare, ImageIcon, Settings, Clock, Zap,
  Info, ChevronDown, ChevronUp, Loader, CheckSquare, Square, X, Plus, Minus,
  Type, Palette
} from 'lucide-react';
import DownloadQRTemplate from '@/components/DownloadQRTemplate';

// Enhanced interfaces with text overlay
interface PesertaData {
  id: number;
  unique_id: string;
  nama_lengkap: string;
  nim: string;
  divisi: string;
  qr_code?: string;
  created_at: string;
}

interface QRPosition {
  preset: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center' | 'left-center' | 'right-center' | 'custom';
  offsetX: number;
  offsetY: number;
  scale: number;
}

// NEW: Text overlay interface
interface TextOverlay {
  enabled: boolean;
  preset: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'custom';
  offsetX: number;
  offsetY: number;
  fontSize: number;
  fontWeight: 'normal' | 'bold' | 'bolder';
  fontColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  padding: number;
  borderRadius: number;
  textAlign: 'left' | 'center' | 'right';
  fontFamily: string;
  strokeWidth: number;
  strokeColor: string;
}

interface TemplateSettings {
  qrPosition: QRPosition;
  textOverlay: TextOverlay;
}

interface ImportResult {
  success: Array<{
    unique_id: string;
    nama_lengkap: string;
    nim: string;
    divisi: string;
  }>;
  errors: Array<{
    row: number;
    nim: string;
    nama_lengkap: string;
    error: string;
  }>;
  total_processed: number;
  success_count: number;
  error_count: number;
}

interface Statistics {
  total: number;
  divisi: Array<{ divisi: string; count: number }>;
  recent_30_days: Array<{ date: string; count: number }>;
}

interface OperationProgress {
  show: boolean;
  current: number;
  total: number;
  stage: string;
  startTime: number;
  estimatedTimeRemaining?: number;
  operation: string;
  currentDivisi?: string;
}

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
}

// Custom hooks
const useToast = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { ...toast, id }]);
    
    if (toast.duration !== 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, toast.duration || 5000);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
};

const useOperations = () => {
  const [operations, setOperations] = useState<{ [key: string]: boolean }>({});

  const setOperation = useCallback((key: string, loading: boolean) => {
    setOperations(prev => ({ ...prev, [key]: loading }));
  }, []);

  const isLoading = useCallback((key: string) => operations[key] || false, [operations]);

  return { setOperation, isLoading };
};

// Components
const Toast: React.FC<{ toast: ToastMessage; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <XCircle className="w-5 h-5 text-red-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />
  };

  const bgColors = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
    info: 'bg-blue-50 border-blue-200'
  };

  return (
    <div className={`${bgColors[toast.type]} border rounded-lg p-4 shadow-lg max-w-md w-full`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {icons[toast.type]}
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium text-gray-900">{toast.title}</p>
          <p className="text-sm text-gray-600 mt-1">{toast.message}</p>
        </div>
        <button
          onClick={() => onRemove(toast.id)}
          className="ml-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  return (
    <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${sizeClasses[size]}`} />
  );
};

const ProgressModal: React.FC<{
  progress: OperationProgress;
  onClose: () => void;
}> = ({ progress, onClose }) => {
  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const elapsed = Date.now() - progress.startTime;
  const estimatedTotal = progress.current > 0 ? (elapsed * progress.total) / progress.current : 0;
  const remaining = Math.max(0, estimatedTotal - elapsed);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-xl max-w-md w-full mx-4 shadow-2xl">
        <h3 className="text-xl font-semibold mb-6 flex items-center text-gray-800">
          <Settings className="mr-3 animate-spin text-blue-600" size={24} />
          {progress.operation}
        </h3>
        
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>{progress.current} / {progress.total}</span>
            <span>{percentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Status and Time */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center text-sm text-gray-700">
            <Clock className="w-4 h-4 mr-2 text-gray-500" />
            <span className="font-medium">Status:</span>
            <span className="ml-2">{progress.stage}</span>
          </div>
          
          {progress.currentDivisi && (
            <div className="flex items-center text-sm text-gray-700">
              <Award className="w-4 h-4 mr-2 text-purple-500" />
              <span className="font-medium">Divisi:</span>
              <span className="ml-2 bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                {progress.currentDivisi}
              </span>
            </div>
          )}
          
          <div className="flex items-center text-sm text-gray-700">
            <TrendingUp className="w-4 h-4 mr-2 text-gray-500" />
            <span className="font-medium">Waktu berlalu:</span>
            <span className="ml-2">{formatTime(elapsed)}</span>
          </div>
          
          {remaining > 1000 && (
            <div className="flex items-center text-sm text-gray-700">
              <Clock className="w-4 h-4 mr-2 text-gray-500" />
              <span className="font-medium">Estimasi sisa:</span>
              <span className="ml-2">{formatTime(remaining)}</span>
            </div>
          )}
        </div>

        {/* Enhanced Info Box for Text Overlay */}
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <div className="flex items-start">
            <Info className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Template processing dengan QR + Text Overlay...</p>
              <p>Nama peserta akan ditambahkan otomatis pada setiap QR code. Download akan dimulai setelah selesai.</p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
          >
            Minimkan (Processing tetap berjalan)
          </button>
        </div>
      </div>
    </div>
  );
};

// Enhanced Download Dropdown Component
const DownloadDropdown: React.FC<{
  onDownloadOriginal: () => void;
  onDownloadTemplate: () => void;
  isLoadingOriginal: boolean;
  selectedDivisiFilter: string;
}> = ({ onDownloadOriginal, onDownloadTemplate, isLoadingOriginal, selectedDivisiFilter }) => {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
      >
        <Download className="mr-2" size={16} />
        Download QR Code
        <ChevronDown className="ml-2" size={14} />
      </button>

      {showDropdown && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 min-w-80">
          <div className="p-2">
            <button
              onClick={() => {
                onDownloadOriginal();
                setShowDropdown(false);
              }}
              disabled={isLoadingOriginal}
              className="w-full flex items-center px-3 py-3 text-left hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
            >
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg mr-3">
                {isLoadingOriginal ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <Archive className="w-4 h-4 text-blue-600" />
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900">Download Original QR</p>
                <p className="text-xs text-gray-500">
                  QR code standar tanpa template {selectedDivisiFilter ? `divisi ${selectedDivisiFilter}` : 'semua divisi'}
                </p>
              </div>
            </button>

            <button
              onClick={() => {
                onDownloadTemplate();
                setShowDropdown(false);
              }}
              className="w-full flex items-center px-3 py-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="flex items-center justify-center w-8 h-8 bg-purple-100 rounded-lg mr-3">
                <QrCode className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Download dengan Template + Text</p>
                <p className="text-xs text-gray-500">
                  QR + nama peserta dengan extended range: ±10K positioning, 1K font (max 10 divisi)
                </p>
              </div>
            </button>

            {/* Enhanced Feature highlight */}
            <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center text-green-800 text-xs font-medium mb-1">
                <Type className="w-3 h-3 mr-1" />
                Extended Range Text Overlay
              </div>
              <p className="text-xs text-green-700">
                Nama peserta otomatis dengan positioning ±10000px & font scale 12px-1000px. Canvas auto-extend untuk positioning ekstrem.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const BuatQRPage: React.FC = () => {
  // Core states
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [pesertaData, setPesertaData] = useState<PesertaData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedQR, setSelectedQR] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  
  // UI states
  const [showStats, setShowStats] = useState(false);
  const [selectedDivisiFilter, setSelectedDivisiFilter] = useState(''); // For filtering table
  const [showFilters, setShowFilters] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [previewStructure, setPreviewStructure] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Template modal state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  
  // Progress and operation states
  const [progress, setProgress] = useState<OperationProgress>({
    show: false,
    current: 0,
    total: 0,
    stage: '',
    startTime: 0,
    operation: ''
  });

  // Custom hooks
  const { toasts, addToast, removeToast } = useToast();
  const { setOperation, isLoading } = useOperations();
  
  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);

  // Memoized values
  const availableDivisi = useMemo(() => 
    statistics?.divisi || [], 
    [statistics]
  );

  const filteredPesertaCount = useMemo(() => 
    pesertaData.length, 
    [pesertaData]
  );

  const selectedItemsCount = useMemo(() => 
    selectedItems.length, 
    [selectedItems]
  );

  // Progress management
  const showProgressModal = useCallback((operation: string, total: number = 1) => {
    setProgress({
      show: true,
      current: 0,
      total,
      stage: 'Memulai...',
      startTime: Date.now(),
      operation
    });
  }, []);

  const updateProgress = useCallback((current: number, stage: string, currentDivisi?: string) => {
    setProgress(prev => ({
      ...prev,
      current,
      stage,
      currentDivisi
    }));
  }, []);

  const hideProgressModal = useCallback(() => {
    setProgress(prev => ({ ...prev, show: false }));
  }, []);

  // Data fetching
  const fetchPeserta = useCallback(async () => {
    try {
      setOperation('fetch', true);
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        search: searchTerm
      });
      
      if (selectedDivisiFilter) {
        params.append('divisi', selectedDivisiFilter);
      }
      
      const response = await fetch(`/api/panitiapeserta?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setPesertaData(result.data);
        setTotalPages(result.pagination.totalPages);
      } else {
        addToast({
          type: 'error',
          title: 'Error Fetch Data',
          message: result.message
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Gagal mengambil data peserta'
      });
    } finally {
      setOperation('fetch', false);
    }
  }, [currentPage, searchTerm, selectedDivisiFilter, addToast, setOperation]);

  const fetchStatistics = useCallback(async () => {
    try {
      const response = await fetch('/api/panitiapeserta/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stats' })
      });
      const result = await response.json();
      
      if (result.success) {
        setStatistics(result.stats);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  }, []);

  // File operations
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.name.toLowerCase().endsWith('.csv')) {
      if (selectedFile.size > 5 * 1024 * 1024) {
        addToast({
          type: 'error',
          title: 'File Terlalu Besar',
          message: 'Maksimal ukuran file CSV adalah 5MB'
        });
        e.target.value = '';
        return;
      }
      
      setFile(selectedFile);
      setImportResult(null);
      
      addToast({
        type: 'success',
        title: 'File CSV Dipilih',
        message: `${selectedFile.name} siap untuk diimport`
      });
    } else {
      addToast({
        type: 'error',
        title: 'File Tidak Valid',
        message: 'Silakan pilih file CSV'
      });
      e.target.value = '';
    }
  }, [addToast]);

  const downloadTemplate = useCallback(async () => {
    try {
      setOperation('template_download', true);
      
      const response = await fetch('/api/panitiapeserta/import');
      if (!response.ok) throw new Error('Gagal download template');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'template_panitia.csv';
      link.click();
      window.URL.revokeObjectURL(url);
      
      addToast({
        type: 'success',
        title: 'Template Downloaded',
        message: 'Template CSV berhasil didownload'
      });
    } catch (error) {
      console.error('Error downloading template:', error);
      addToast({
        type: 'error',
        title: 'Download Gagal',
        message: 'Gagal mendownload template CSV'
      });
    } finally {
      setOperation('template_download', false);
    }
  }, [addToast, setOperation]);

  const handleImport = useCallback(async () => {
    if (!file) {
      addToast({
        type: 'warning',
        title: 'File Belum Dipilih',
        message: 'Pilih file CSV terlebih dahulu'
      });
      return;
    }

    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('csv', file);

      const response = await fetch('/api/panitiapeserta/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (result.success) {
        setImportResult(result.data);
        setFile(null);
        const fileInput = document.getElementById('csvFile') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        
        await fetchPeserta();
        await fetchStatistics();
        
        addToast({
          type: 'success',
          title: 'Import Berhasil',
          message: `${result.data.success_count} data berhasil diimport`
        });
      } else {
        addToast({
          type: 'error',
          title: 'Import Gagal',
          message: result.message
        });
      }
    } catch (error) {
      console.error('Import error:', error);
      addToast({
        type: 'error',
        title: 'Error Import',
        message: 'Terjadi kesalahan saat import data'
      });
    } finally {
      setLoading(false);
    }
  }, [file, addToast, fetchPeserta, fetchStatistics]);

  // QR Operations
  const downloadOriginalQR = useCallback(async () => {
    try {
      setOperation('qr_original', true);
      
      const params = new URLSearchParams({ type: 'bulk' });
      if (selectedDivisiFilter) params.append('divisi', selectedDivisiFilter);
      
      const response = await fetch(`/api/panitiapeserta/qr?${params}`);
      
      if (!response.ok) {
        const errorResult = await response.json().catch(() => ({ message: 'Server error' }));
        throw new Error(errorResult.message || `Server error: ${response.status}`);
      }
      
      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error('File kosong');
      }
      
      // Create download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const timestamp = new Date().toISOString().split('T')[0];
      const divisiName = selectedDivisiFilter || 'bulk';
      link.download = `qr_codes_${divisiName}_${timestamp}.zip`;
      
      link.click();
      window.URL.revokeObjectURL(url);
      
      addToast({
        type: 'success',
        title: 'Download Berhasil',
        message: 'QR codes original berhasil didownload'
      });
      
    } catch (error: any) {
      console.error('QR download error:', error);
      addToast({
        type: 'error',
        title: 'Download Gagal',
        message: error.message || 'Error saat download QR'
      });
    } finally {
      setOperation('qr_original', false);
    }
  }, [selectedDivisiFilter, addToast, setOperation]);

  // Enhanced template download handler with text overlay support
  const handleTemplateDownload = useCallback(async (templateFile: File, selectedDivisi: string[], templateSettings: TemplateSettings) => {
    try {
      setOperation('qr_template', true);
      
      const totalQR = selectedDivisi.reduce((total, divisi) => {
        const divisiData = availableDivisi.find(d => d.divisi === divisi);
        return total + (divisiData?.count || 0);
      }, 0);

      const operationName = templateSettings.textOverlay.enabled 
        ? `Template + Text Processing ${selectedDivisi.length} Divisi` 
        : `Template Processing ${selectedDivisi.length} Divisi`;

      showProgressModal(operationName, totalQR);
      
      abortControllerRef.current = new AbortController();
      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort();
      }, 20 * 60 * 1000); // Increased timeout for text rendering
      
      const formData = new FormData();
      formData.append('template', templateFile);
      formData.append('selectedDivisi', JSON.stringify(selectedDivisi));
      formData.append('templateSettings', JSON.stringify(templateSettings)); // Send enhanced template settings
      
      const processingDesc = templateSettings.textOverlay.enabled 
        ? `template + text overlay (nama pada Y:${templateSettings.textOverlay.offsetY}px)`
        : `template dengan ${templateSettings.qrPosition.preset} positioning`;

      updateProgress(0, `Mengirim ${processingDesc} ke server...`);
      
      const response = await fetch('/api/panitiapeserta/qr', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorResult = await response.json().catch(() => ({ message: 'Server error' }));
        throw new Error(errorResult.message || `Server error: ${response.status}`);
      }
      
      updateProgress(totalQR, 'Processing selesai, mempersiapkan download...');
      
      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error('File kosong - error dalam processing');
      }
      
      hideProgressModal();
      
      // Create download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const timestamp = new Date().toISOString().split('T')[0];
      const divisiNames = selectedDivisi.slice(0, 2).join('_');
      const textSuffix = templateSettings.textOverlay.enabled ? 'with_text' : 'qr_only';
      const positionSuffix = templateSettings.qrPosition.preset === 'custom' ? 'custom' : templateSettings.qrPosition.preset;
      const scaleSuffix = `${Math.round(templateSettings.qrPosition.scale * 100)}pct`;
      link.download = `qr_template_${divisiNames}${selectedDivisi.length > 2 ? '_etc' : ''}_${textSuffix}_${positionSuffix}_${scaleSuffix}_${timestamp}.zip`;
      
      link.click();
      window.URL.revokeObjectURL(url);
      
      const fileSizeMB = Math.round(blob.size / 1024 / 1024 * 100) / 100;
      const successMessage = templateSettings.textOverlay.enabled 
        ? `${selectedDivisi.length} divisi berhasil diproses dengan QR ${templateSettings.qrPosition.preset} + text overlay pada Y:${templateSettings.textOverlay.offsetY}px (${fileSizeMB} MB)`
        : `${selectedDivisi.length} divisi berhasil diproses dengan QR ${templateSettings.qrPosition.preset} ukuran ${Math.round(templateSettings.qrPosition.scale * 100)}% (${fileSizeMB} MB)`;

      addToast({
        type: 'success',
        title: 'Template Processing Berhasil',
        message: successMessage
      });
      
      // Close modal
      setShowTemplateModal(false);
      
    } catch (error: any) {
      hideProgressModal();
      if (error.name === 'AbortError') {
        addToast({
          type: 'error',
          title: 'Download Timeout',
          message: 'Request timeout - coba dengan divisi yang lebih sedikit atau tanpa text overlay'
        });
      } else {
        addToast({
          type: 'error',
          title: 'Template Processing Gagal',
          message: error.message || 'Error saat processing template'
        });
      }
    } finally {
      setOperation('qr_template', false);
    }
  }, [availableDivisi, addToast, setOperation, showProgressModal, updateProgress, hideProgressModal]);

  const downloadSingleQR = useCallback(async (peserta: PesertaData) => {
    try {
      const operationKey = `qr_single_${peserta.unique_id}`;
      setOperation(operationKey, true);
      
      if (!peserta.qr_code) {
        addToast({
          type: 'error',
          title: 'QR Tidak Ditemukan',
          message: 'QR code tidak tersedia untuk peserta ini'
        });
        return;
      }
      
      const response = await fetch(`/api/panitiapeserta/qr?type=single&id=${peserta.unique_id}`);
      
      if (!response.ok) {
        throw new Error('Gagal download QR');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${peserta.nim}_${peserta.nama_lengkap.replace(/\s+/g, '_')}.png`;
      link.click();
      window.URL.revokeObjectURL(url);
      
      addToast({
        type: 'success',
        title: 'QR Downloaded',
        message: 'QR code berhasil didownload'
      });
      
    } catch (error: any) {
      console.error('Single QR download error:', error);
      addToast({
        type: 'error',
        title: 'Download Gagal',
        message: error.message || 'Gagal download QR'
      });
    } finally {
      setOperation(`qr_single_${peserta.unique_id}`, false);
    }
  }, [addToast, setOperation]);

  // Selection management
  const toggleSelection = useCallback((uniqueId: string) => {
    setSelectedItems(prev => 
      prev.includes(uniqueId) 
        ? prev.filter(id => id !== uniqueId)
        : [...prev, uniqueId]
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedItems(prev => 
      prev.length === pesertaData.length 
        ? []
        : pesertaData.map(p => p.unique_id)
    );
  }, [pesertaData]);

  // Effects
  useEffect(() => {
    fetchPeserta();
    fetchStatistics();
  }, [fetchPeserta, fetchStatistics]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>

      {/* Progress Modal */}
      {progress.show && (
        <ProgressModal progress={progress} onClose={hideProgressModal} />
      )}

      {/* Enhanced Template Download Modal */}
      <DownloadQRTemplate
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        availableDivisi={availableDivisi}
        onDownload={handleTemplateDownload}
        addToast={addToast}
        isLoading={isLoading('qr_template')}
      />

      {/* Enhanced Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          QR Code Management System
        </h1>
        <p className="text-gray-600">
          Sistem manajemen lengkap untuk data panitia dan operasi QR Code per divisi dengan template + text overlay (Extended Range Support)
        </p>
        <div className="mt-3 flex items-center gap-6 text-sm">
          <span className="flex items-center text-green-600">
            <Zap className="w-4 h-4 mr-1" />
            Max 10 Divisi per Template
          </span>
          <span className="flex items-center text-blue-600">
            <Clock className="w-4 h-4 mr-1" />
            Processing: 3-10 menit
          </span>
          <span className="flex items-center text-purple-600">
            <Award className="w-4 h-4 mr-1" />
            Position: ±10000px Range
          </span>
          <span className="flex items-center text-orange-600">
            <Type className="w-4 h-4 mr-1" />
            Font: 12px-1000px Scale
          </span>
        </div>
      </div>

      {/* Enhanced Statistics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 rounded-xl text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Peserta</p>
              <p className="text-3xl font-bold">{statistics?.total || 0}</p>
              <p className="text-blue-200 text-xs mt-1">Data tersimpan</p>
            </div>
            <Users className="h-8 w-8 text-blue-200" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 rounded-xl text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Total Divisi</p>
              <p className="text-3xl font-bold">{statistics?.divisi?.length || 0}</p>
              <p className="text-purple-200 text-xs mt-1">Kategori aktif</p>
            </div>
            <Award className="h-8 w-8 text-purple-200" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-xl text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">Template Ready</p>
              <p className="text-3xl font-bold">
                {availableDivisi.length}
              </p>
              <p className="text-orange-200 text-xs mt-1">Divisi tersedia</p>
            </div>
            <TrendingUp className="h-8 w-8 text-orange-200" />
          </div>
        </div>

        {/* NEW: Text Overlay Feature Card */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 rounded-xl text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">Text Overlay</p>
              <p className="text-3xl font-bold">Ready</p>
              <p className="text-green-200 text-xs mt-1">Nama otomatis</p>
            </div>
            <Type className="h-8 w-8 text-green-200" />
          </div>
        </div>
      </div>

      {/* Enhanced Action Buttons */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-100">
        <div className="flex flex-wrap gap-3 mb-4">
          <button
            onClick={() => setShowStats(!showStats)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <BarChart3 className="mr-2" size={16} />
            {showStats ? 'Sembunyikan' : 'Tampilkan'} Statistik
          </button>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Filter className="mr-2" size={16} />
            Filter {showFilters && <ChevronUp className="ml-1" size={14} />}
            {!showFilters && <ChevronDown className="ml-1" size={14} />}
          </button>
          
          {/* Enhanced Download Dropdown */}
          <DownloadDropdown
            onDownloadOriginal={downloadOriginalQR}
            onDownloadTemplate={() => setShowTemplateModal(true)}
            isLoadingOriginal={isLoading('qr_original')}
            selectedDivisiFilter={selectedDivisiFilter}
          />
          
          {selectedItemsCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {selectedItemsCount} dipilih
              </span>
              <button
                onClick={() => setSelectedItems([])}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Enhanced Filters */}
        {showFilters && (
          <div className="grid md:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg">
            <select
              value={selectedDivisiFilter}
              onChange={(e) => setSelectedDivisiFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Semua Divisi (Table Filter)</option>
              {availableDivisi.map(({ divisi }) => (
                <option key={divisi} value={divisi}>
                  {divisi}
                </option>
              ))}
            </select>
            
            <div className="flex items-center text-sm text-gray-600">
              <Archive className="w-4 h-4 mr-1" />
              Organisasi: Per DIVISI
            </div>
            
            <div className="flex items-center text-sm text-gray-600">
              <Users className="w-4 h-4 mr-1" />
              Total: {filteredPesertaCount} peserta
            </div>
            
            <div className="flex items-center text-sm text-green-600">
              <Zap className="w-4 h-4 mr-1" />
              Template: Ready + Positioning
            </div>

            <div className="flex items-center text-sm text-purple-600">
              <Type className="w-4 h-4 mr-1" />
              Extended: ±10K Range + 1K Font
            </div>
          </div>
        )}
      </div>

      {/* Statistics Detail */}
      {showStats && statistics && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-100">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Award className="mr-2 text-purple-600" size={20} />
            Statistik Detail per Divisi
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {statistics.divisi?.map(d => (
              <div key={d.divisi} className="flex justify-between items-center p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-100">
                <span className="text-gray-700 font-medium">{d.divisi}</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-purple-600 bg-white px-2 py-1 rounded">{d.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import Section */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-100">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Upload className="mr-2 text-green-600" size={20} />
          Import Data CSV
        </h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload File CSV (Max 5MB)
            </label>
            <input
              id="csvFile"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-gray-300 rounded-lg"
            />
            {file && (
              <div className="mt-2 flex items-center p-2 bg-green-50 rounded">
                <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                <span className="text-sm text-green-700">
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            )}
          </div>
          
          <div className="space-y-3">
            <button
              onClick={downloadTemplate}
              disabled={isLoading('template_download')}
              className="w-full flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:bg-gray-300 transition-colors"
            >
              {isLoading('template_download') ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Download className="mr-2" size={16} />
              )}
              Download Template CSV
            </button>
            
            <button
              onClick={handleImport}
              disabled={!file || loading}
              className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span className="ml-2">Processing...</span>
                </>
              ) : (
                <>
                  <Upload className="mr-2" size={16} />
                  Import CSV
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-800 mb-2">Format CSV:</h3>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• Kolom wajib: <strong>nama_lengkap, nim, divisi</strong></p>
            <p>• Maksimal 1500 data per import</p>
            <p>• NIM harus unik untuk setiap peserta</p>
            <p>• File akan terorganisir berdasarkan <strong>DIVISI</strong></p>
            <p>• Template processing: max 10 divisi dengan <strong>QR + text overlay otomatis</strong></p>
          </div>
        </div>
      </div>

      {/* Import Result */}
      {importResult && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-100">
          <h2 className="text-xl font-semibold mb-4">Hasil Import</h2>
          
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center">
                <FileText className="text-blue-600 mr-2" size={20} />
                <div>
                  <p className="text-sm text-blue-600 font-medium">Total Diproses</p>
                  <p className="text-2xl font-bold text-blue-800">{importResult.total_processed}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center">
                <CheckCircle className="text-green-600 mr-2" size={20} />
                <div>
                  <p className="text-sm text-green-600 font-medium">Berhasil</p>
                  <p className="text-2xl font-bold text-green-800">{importResult.success_count}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="flex items-center">
                <XCircle className="text-red-600 mr-2" size={20} />
                <div>
                  <p className="text-sm text-red-600 font-medium">Gagal</p>
                  <p className="text-2xl font-bold text-red-800">{importResult.error_count}</p>
                </div>
              </div>
            </div>
          </div>

          {importResult.errors.length > 0 && (
            <div className="bg-red-50 p-4 rounded-lg">
              <h3 className="font-medium text-red-800 mb-2">Data Gagal Import:</h3>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {importResult.errors.map((error, idx) => (
                  <div key={idx} className="text-sm text-red-700 p-2 bg-white rounded">
                    <strong>Baris {error.row}:</strong> {error.nama_lengkap} ({error.nim}) - {error.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100">
        <div className="p-6 border-b">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-xl font-semibold flex items-center">
              <Users className="mr-2" size={20} />
              Data Panitia ({filteredPesertaCount})
              {selectedItemsCount > 0 && (
                <span className="ml-2 text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {selectedItemsCount} dipilih
                </span>
              )}
            </h2>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Cari nama, NIM, divisi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center"
                  >
                    {selectedItemsCount === pesertaData.length && pesertaData.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : selectedItemsCount > 0 ? (
                      <Square className="w-4 h-4 text-blue-600 fill-current" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unique ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nama Lengkap
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  NIM
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Divisi
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading('fetch') ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center">
                    <div className="flex items-center justify-center">
                      <LoadingSpinner />
                      <span className="ml-2 text-gray-600">Memuat data...</span>
                    </div>
                  </td>
                </tr>
              ) : pesertaData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Tidak ada data peserta
                  </td>
                </tr>
              ) : (
                pesertaData.map((peserta) => (
                  <tr key={peserta.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleSelection(peserta.unique_id)}
                        className="flex items-center"
                      >
                        {selectedItems.includes(peserta.unique_id) ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-blue-600">
                      {peserta.unique_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {peserta.nama_lengkap}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {peserta.nim}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {peserta.divisi}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex space-x-2">
                        {peserta.qr_code && (
                          <button
                            onClick={() => setSelectedQR(peserta.qr_code!)}
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                            title="Lihat QR Code"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => downloadSingleQR(peserta)}
                          disabled={isLoading(`qr_single_${peserta.unique_id}`)}
                          className="p-1 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded disabled:text-gray-400"
                          title="Download QR Original"
                        >
                          {isLoading(`qr_single_${peserta.unique_id}`) ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <QrCode size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t bg-gray-50">
            <div className="flex justify-between items-center">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm bg-white border border-gray-300 text-gray-600 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm bg-white border border-gray-300 text-gray-600 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {selectedQR && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold mb-4 text-center">QR Code Preview</h3>
            <div className="flex justify-center mb-4">
              <Image 
                src={selectedQR} 
                alt="QR Code" 
                width={200} 
                height={200}
                className="w-50 h-50 border border-gray-200 rounded-lg"
                unoptimized={true}
              />
            </div>
            <button
              onClick={() => setSelectedQR(null)}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuatQRPage;