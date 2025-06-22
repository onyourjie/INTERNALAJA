/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// testwebpanit/app/(panel)/panitia/buatqr/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { 
  Upload, Download, Search, Eye, Trash2, FileText, Users, CheckCircle, XCircle, 
  BarChart3, RefreshCw, QrCode, Archive, Filter,
  TrendingUp, Award, MessageSquare
} from 'lucide-react';

interface PesertaData {
  id: number;
  unique_id: string;
  nama_lengkap: string;
  nim: string;
  divisi: string;
  qr_code?: string;
  created_at: string;
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

const BuatQRPage: React.FC = () => {
  // States
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [pesertaData, setPesertaData] = useState<PesertaData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedQR, setSelectedQR] = useState<string | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [selectedDivisi, setSelectedDivisi] = useState('');
  const [operationLoading, setOperationLoading] = useState<{ [key: string]: boolean }>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [previewStructure, setPreviewStructure] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Preview QR folder structure
  const handlePreviewStructure = async () => {
    try {
      setOperationLoading(prev => ({ ...prev, preview: true }));
      
      const response = await fetch('/api/panitiapeserta/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'preview_structure' })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setPreviewStructure(result);
        setShowPreview(true);
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('Preview error:', error);
      alert('Error saat preview struktur');
    } finally {
      setOperationLoading(prev => ({ ...prev, preview: false }));
    }
  };

  // Fetch data peserta
  const fetchPeserta = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        search: searchTerm
      });
      
      if (selectedDivisi) {
        params.append('divisi', selectedDivisi);
      }
      
      const response = await fetch(`/api/panitiapeserta?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setPesertaData(result.data);
        setTotalPages(result.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, [currentPage, searchTerm, selectedDivisi]);

  // Fetch statistics
  const fetchStatistics = async () => {
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
  };

  useEffect(() => {
    fetchPeserta();
    fetchStatistics();
  }, [fetchPeserta]);

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.name.toLowerCase().endsWith('.csv')) {
      setFile(selectedFile);
      setImportResult(null);
    } else {
      alert('Silakan pilih file CSV');
      e.target.value = '';
    }
  };

  // Download template CSV
  const downloadTemplate = async () => {
    try {
      setOperationLoading(prev => ({ ...prev, template: true }));
      const response = await fetch('/api/panitiapeserta/import');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'template_panitia.csv';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading template:', error);
      alert('Error downloading template');
    } finally {
      setOperationLoading(prev => ({ ...prev, template: false }));
    }
  };

  // Import CSV
  const handleImport = async () => {
    if (!file) {
      alert('Pilih file CSV terlebih dahulu');
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
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Error saat import');
    } finally {
      setLoading(false);
    }
  };

  // Export data
  const handleExport = async (format: 'csv' | 'json' = 'csv') => {
    try {
      setOperationLoading(prev => ({ ...prev, export: true }));
      const params = new URLSearchParams({ format });
      
      if (selectedDivisi) params.append('divisi', selectedDivisi);
      if (searchTerm) params.append('search', searchTerm);
      
      const response = await fetch(`/api/panitiapeserta/export?${params}`);
      
      if (format === 'json') {
        const result = await response.json();
        console.log('Exported data:', result);
        alert(`Data berhasil diekspor: ${result.total} records`);
      } else {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `panitia_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Error saat export');
    } finally {
      setOperationLoading(prev => ({ ...prev, export: false }));
    }
  };

  // Download QR codes dengan struktur folder divisi
  const downloadQR = async (type: 'single' | 'bulk' | 'all', id?: string) => {
    try {
      setOperationLoading(prev => ({ ...prev, [`qr_${type}_${id || 'all'}`]: true }));
      
      const params = new URLSearchParams({ type });
      if (id) params.append('id', id);
      if (selectedDivisi && type !== 'single') params.append('divisi', selectedDivisi);
      
      const response = await fetch(`/api/panitiapeserta/qr?${params}`);
      
      if (!response.ok) {
        const errorResult = await response.json();
        throw new Error(errorResult.message || 'Failed to download QR');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Set filename berdasarkan tipe download
      if (type === 'single') {
        const peserta = pesertaData.find(p => p.unique_id === id);
        link.download = `${peserta?.nim}_${peserta?.nama_lengkap.replace(/\s+/g, '_')}.png`;
      } else if (type === 'all') {
        link.download = `qr_codes_all_divisi_${new Date().toISOString().split('T')[0]}.zip`;
      } else if (selectedDivisi) {
        link.download = `qr_codes_${selectedDivisi.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.zip`;
      } else {
        link.download = `qr_codes_bulk_${new Date().toISOString().split('T')[0]}.zip`;
      }
      
      link.click();
      window.URL.revokeObjectURL(url);
      
      // Show success message
      if (type === 'all') {
        alert('QR codes berhasil didownload! File terorganisir berdasarkan folder divisi.');
      } else if (type === 'single') {
        alert('QR code berhasil didownload!');
      } else {
        alert(`QR codes berhasil didownload untuk ${selectedDivisi || 'data yang dipilih'}!`);
      }
      
    } catch (error: any) {
      console.error('QR download error:', error);
      alert(`Error saat download QR: ${error.message || 'Unknown error'}`);
    } finally {
      setOperationLoading(prev => ({ ...prev, [`qr_${type}_${id || 'all'}`]: false }));
    }
  };

  // Regenerate QR codes
  const regenerateQR = async (scope: 'all' | 'selected' = 'all') => {
    try {
      setOperationLoading(prev => ({ ...prev, regenerate: true }));
      
      const body: any = { action: 'regenerate' };
      
      if (scope === 'selected' && selectedItems.length > 0) {
        body.unique_ids = selectedItems;
      } else {
        if (selectedDivisi) body.divisi = selectedDivisi;
      }
      
      const response = await fetch('/api/panitiapeserta/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(result.message);
        await fetchPeserta();
        setSelectedItems([]);
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('Regenerate error:', error);
      alert('Error saat regenerate QR');
    } finally {
      setOperationLoading(prev => ({ ...prev, regenerate: false }));
    }
  };

  // Delete peserta
  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus data ini?')) return;

    try {
      const response = await fetch(`/api/panitiapeserta?id=${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (result.success) {
        await fetchPeserta();
        await fetchStatistics();
        alert('Data berhasil dihapus');
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Error saat menghapus');
    }
  };

  // View QR Code
  const viewQR = (qrCode: string) => {
    setSelectedQR(qrCode);
  };

  // Toggle selection
  const toggleSelection = (uniqueId: string) => {
    setSelectedItems(prev => 
      prev.includes(uniqueId) 
        ? prev.filter(id => id !== uniqueId)
        : [...prev, uniqueId]
    );
  };

  // Select all
  const toggleSelectAll = () => {
    setSelectedItems(prev => 
      prev.length === pesertaData.length 
        ? []
        : pesertaData.map(p => p.unique_id)
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Data Panitia & QR Code Management
        </h1>
        <p className="text-gray-600">
          Sistem lengkap untuk manajemen data panitia, import CSV, dan operasi <strong>QR Code</strong>
        </p>
      </div>

      {/* Statistics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 rounded-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100">Total Peserta</p>
              <p className="text-3xl font-bold">{statistics?.total || 0}</p>
            </div>
            <Users className="h-8 w-8 text-blue-200" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 rounded-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100">Total Divisi</p>
              <p className="text-3xl font-bold">{statistics?.divisi?.length || 0}</p>
            </div>
            <Award className="h-8 w-8 text-purple-200" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100">30 Hari Terakhir</p>
              <p className="text-3xl font-bold">
                {statistics?.recent_30_days?.reduce((sum, day) => sum + day.count, 0) || 0}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-orange-200" />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex flex-wrap gap-4 mb-4">
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
            Filter
          </button>
          
          <button
            onClick={() => handleExport('csv')}
            disabled={operationLoading.export}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 transition-colors"
          >
            {operationLoading.export ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Download className="mr-2" size={16} />
            )}
            Export CSV
          </button>
          
          <button
            onClick={() => downloadQR('all')}
            disabled={operationLoading.qr_all_all}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 transition-colors"
          >
            {operationLoading.qr_all_all ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Archive className="mr-2" size={16} />
            )}
            Download All QR
          </button>
          
          <button
            onClick={handlePreviewStructure}
            disabled={operationLoading.preview}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 transition-colors"
          >
            {operationLoading.preview ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Eye className="mr-2" size={16} />
            )}
            Preview Struktur QR
          </button>
          
          <button
            onClick={() => regenerateQR('all')}
            disabled={operationLoading.regenerate}
            className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 transition-colors"
          >
            {operationLoading.regenerate ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <RefreshCw className="mr-2" size={16} />
            )}
            Regenerate QR
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="grid md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <select
              value={selectedDivisi}
              onChange={(e) => setSelectedDivisi(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Semua Divisi</option>
              {statistics?.divisi?.map(d => (
                <option key={d.divisi} value={d.divisi}>
                  {d.divisi} ({d.count})
                </option>
              ))}
            </select>
            
            <div className="text-sm text-gray-600 flex items-center">
              📁 Download QR: Terorganisir per <strong>DIVISI</strong>
            </div>
            
            {selectedItems.length > 0 && (
              <button
                onClick={() => regenerateQR('selected')}
                className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="mr-2" size={16} />
                Regenerate Selected ({selectedItems.length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Statistics Detail */}
      {showStats && statistics && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Award className="mr-2" size={20} />
            Data per Divisi
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {statistics.divisi?.map(d => (
              <div key={d.divisi} className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                <span className="text-gray-700 font-medium">{d.divisi}</span>
                <span className="font-bold text-purple-600">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Upload className="mr-2" size={20} />
          Import CSV
        </h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload File CSV
            </label>
            <input
              id="csvFile"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-gray-300 rounded-lg"
            />
            {file && (
              <p className="mt-2 text-sm text-green-600">
                File dipilih: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>
          
          <div className="flex flex-col gap-3">
            <button
              onClick={downloadTemplate}
              disabled={operationLoading.template}
              className="flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:bg-gray-300 transition-colors"
            >
              {operationLoading.template ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
              ) : (
                <Download className="mr-2" size={16} />
              )}
              Download Template CSV
            </button>
            
            <button
              onClick={handleImport}
              disabled={!file || loading}
              className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
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
          <p className="text-sm text-blue-700">
            File harus berisi kolom: <strong>nama_lengkap, nim, divisi</strong>
          </p>
          <p className="text-sm text-blue-700 mt-1">
            ⚠️ <strong>Maksimal 1000 data per import.</strong> NIM harus berupa angka/huruf unik untuk setiap peserta.
          </p>
          <p className="text-sm text-blue-700 mt-1">
            📁 <strong>Download QR:</strong> File akan terorganisir dalam folder berdasarkan <strong>DIVISI</strong>.
          </p>
          <p className="text-sm text-blue-700 mt-1">
            💡 Jika ingin menambah lebih dari 1000 peserta, gunakan beberapa file CSV terpisah.
          </p>
        </div>
      </div>

      {/* Import Result */}
      {importResult && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Hasil Import</h2>
          
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center">
                <FileText className="text-blue-600 mr-2" size={20} />
                <div>
                  <p className="text-sm text-blue-600">Total Diproses</p>
                  <p className="text-2xl font-bold text-blue-800">{importResult.total_processed}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center">
                <CheckCircle className="text-green-600 mr-2" size={20} />
                <div>
                  <p className="text-sm text-green-600">Berhasil</p>
                  <p className="text-2xl font-bold text-green-800">{importResult.success_count}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="flex items-center">
                <XCircle className="text-red-600 mr-2" size={20} />
                <div>
                  <p className="text-sm text-red-600">Gagal</p>
                  <p className="text-2xl font-bold text-red-800">{importResult.error_count}</p>
                </div>
              </div>
            </div>
          </div>

          {importResult.errors.length > 0 && (
            <div className="bg-red-50 p-4 rounded-lg">
              <h3 className="font-medium text-red-800 mb-2">Data Gagal Import:</h3>
              <div className="max-h-48 overflow-y-auto">
                {importResult.errors.map((error, idx) => (
                  <div key={idx} className="text-sm text-red-700 mb-1">
                    Baris {error.row}: {error.nama_lengkap} ({error.nim}) - {error.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-xl font-semibold flex items-center">
              <Users className="mr-2" size={20} />
              Data Panitia ({pesertaData.length})
              {selectedItems.length > 0 && (
                <span className="ml-2 text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {selectedItems.length} dipilih
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
                  <input
                    type="checkbox"
                    checked={selectedItems.length === pesertaData.length && pesertaData.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
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
              {pesertaData.map((peserta) => (
                <tr key={peserta.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(peserta.unique_id)}
                      onChange={() => toggleSelection(peserta.unique_id)}
                      className="rounded"
                    />
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
                    {peserta.divisi}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex space-x-2">
                      {peserta.qr_code && (
                        <button
                          onClick={() => viewQR(peserta.qr_code!)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Lihat QR Code"
                        >
                          <Eye size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => downloadQR('single', peserta.unique_id)}
                        disabled={operationLoading[`qr_single_${peserta.unique_id}`]}
                        className="text-purple-600 hover:text-purple-800 disabled:text-gray-400"
                        title="Download QR"
                      >
                        {operationLoading[`qr_single_${peserta.unique_id}`] ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                        ) : (
                          <QrCode size={16} />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(peserta.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Hapus"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t">
            <div className="flex justify-between items-center">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded disabled:opacity-50"
              >
                Previous
              </button>
              
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded disabled:opacity-50"
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
          <div className="bg-white p-6 rounded-lg max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">QR Code</h3>
            <div className="flex justify-center mb-4">
              <Image 
                src={selectedQR} 
                alt="QR Code" 
                width={192} 
                height={192}
                className="w-48 h-48"
                unoptimized={true}
              />
            </div>
            <button
              onClick={() => setSelectedQR(null)}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Preview Structure Modal */}
      {showPreview && previewStructure && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Archive className="mr-2" size={20} />
              Preview Struktur Folder QR
            </h3>
            
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>📁 {previewStructure.zip_filename_format}</strong>
              </p>
              <p className="text-sm text-blue-700 mt-1">
                Total: {previewStructure.total_files} file QR dalam {previewStructure.total_divisi} folder divisi
              </p>
              <p className="text-sm text-blue-700">
                Format file: <strong>{previewStructure.file_naming_format}</strong>
              </p>
              {/* <p className="text-sm text-blue-700">
                Fields: <strong>{previewStructure.fields_included?.join(', ')}</strong>
              </p> */}
            </div>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {previewStructure.preview_structure?.map((folder: any, idx: number) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-800 flex items-center">
                      📁 {folder.folder}/
                    </h4>
                    <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      {folder.file_count} file
                    </span>
                  </div>
                  
                  {folder.sample_files.length > 0 && (
                    <div className="text-xs text-gray-500">
                      <p className="mb-1">Sample files:</p>
                      {folder.sample_files.map((file: any, fileIdx: number) => (
                        <p key={fileIdx} className="ml-4">• {file.filename}</p>
                      ))}
                      {folder.file_count > 3 && (
                        <p className="ml-4 text-gray-400">... dan {folder.file_count - 3} file lainnya</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPreview(false)}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  setShowPreview(false);
                  downloadQR('all');
                }}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Download Sekarang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuatQRPage;