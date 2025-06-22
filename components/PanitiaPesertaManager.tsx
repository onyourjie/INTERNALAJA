'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, Download, Users, Search, Filter, FileSpreadsheet, 
  AlertCircle, CheckCircle, XCircle, Loader2, Eye, Edit, 
  Trash2, Plus, BarChart3, RefreshCw
} from 'lucide-react';

interface PanitiaPeserta {
  id: number;
  nama_lengkap: string;
  nim: string;
  fakultas: string;
  divisi: string;
  email?: string;
  no_telepon?: string;
  qr_code?: string;
  created_at: string;
}

interface ImportResult {
  summary: {
    total: number;
    success: number;
    failed: number;
  };
  errors: Array<{
    row: number;
    data: any;
    errors: string[];
  }>;
  logId: number;
}

const DIVISI_OPTIONS = [
  'Acara', 'Logistik', 'Publikasi', 'Konsumsi', 
  'Keamanan', 'Dokumentasi', 'Sponsor', 'IT Support'
];

const DIVISI_COLORS = {
  'Acara': 'bg-green-100 text-green-800',
  'Logistik': 'bg-blue-100 text-blue-800',
  'Publikasi': 'bg-purple-100 text-purple-800',
  'Konsumsi': 'bg-yellow-100 text-yellow-800',
  'Keamanan': 'bg-red-100 text-red-800',
  'Dokumentasi': 'bg-pink-100 text-pink-800',
  'Sponsor': 'bg-orange-100 text-orange-800',
  'IT Support': 'bg-indigo-100 text-indigo-800'
};

export default function PanitiaPesertaManager() {
  const [data, setData] = useState<PanitiaPeserta[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDivisi, setSelectedDivisi] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<any>(null);
  
  // Import states
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchData();
    fetchStats();
  }, [currentPage, searchTerm, selectedDivisi]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: itemsPerPage.toString(),
        offset: ((currentPage - 1) * itemsPerPage).toString(),
      });

      if (searchTerm) params.append('search', searchTerm);
      if (selectedDivisi) params.append('divisi', selectedDivisi);

      const response = await fetch(`/api/panitiapeserta?${params}`);
      const result = await response.json();

      if (response.ok) {
        setData(result.data);
        setTotalPages(Math.ceil(result.pagination.total / itemsPerPage));
      } else {
        console.error('Error fetching data:', result.error);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/panitiapeserta/stats');
      const result = await response.json();
      if (response.ok) {
        setStats(result);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportPreview([]);
    setImportResult(null);

    // Parse Excel file for preview
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          alert('File kosong atau tidak valid');
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        // Validate headers
        const requiredHeaders = ['nama_lengkap', 'nim', 'fakultas', 'divisi'];
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        
        if (missingHeaders.length > 0) {
          alert(`Header tidak lengkap. Missing: ${missingHeaders.join(', ')}`);
          return;
        }

        // Parse data
        const parsedData = lines.slice(1).map((line, index) => {
          const values = line.split(',').map(v => v.trim());
          return {
            row: index + 2,
            nama_lengkap: values[headers.indexOf('nama_lengkap')] || '',
            nim: values[headers.indexOf('nim')] || '',
            fakultas: values[headers.indexOf('fakultas')] || '',
            divisi: values[headers.indexOf('divisi')] || '',
            email: values[headers.indexOf('email')] || '',
            no_telepon: values[headers.indexOf('no_telepon')] || ''
          };
        });

        setImportPreview(parsedData.slice(0, 50)); // Show first 50 for preview
      };

      reader.readAsText(file);
    } catch (error) {
      console.error('Error parsing file:', error);
      alert('Error parsing file');
    }
  };

  const handleImport = async () => {
    if (!importFile) return;

    setImportLoading(true);
    setImportProgress(0);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const allData = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          return {
            nama_lengkap: values[headers.indexOf('nama_lengkap')] || '',
            nim: values[headers.indexOf('nim')] || '',
            fakultas: values[headers.indexOf('fakultas')] || '',
            divisi: values[headers.indexOf('divisi')] || '',
            email: values[headers.indexOf('email')] || '',
            no_telepon: values[headers.indexOf('no_telepon')] || ''
          };
        });

        // Process in chunks for large datasets
        const CHUNK_SIZE = 100;
        const chunks = [];
        for (let i = 0; i < allData.length; i += CHUNK_SIZE) {
          chunks.push(allData.slice(i, i + CHUNK_SIZE));
        }

        let allResults = { summary: { total: 0, success: 0, failed: 0 }, errors: [], logId: 0 };

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          
          const response = await fetch('/api/panitiapeserta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chunk)
          });

          const result = await response.json();
          
          if (response.ok) {
            allResults.summary.total += result.summary.total;
            allResults.summary.success += result.summary.success;
            allResults.summary.failed += result.summary.failed;
            allResults.errors.push(...result.errors);
            allResults.logId = result.logId;
          }

          setImportProgress(((i + 1) / chunks.length) * 100);
        }

        setImportResult(allResults);
        fetchData();
        fetchStats();
      };

      reader.readAsText(importFile);
    } catch (error) {
      console.error('Import error:', error);
      alert('Error during import');
    } finally {
      setImportLoading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = ['nama_lengkap', 'nim', 'fakultas', 'divisi', 'email', 'no_telepon'];
    const sampleData = [
      'Ahmad Budiono,215150701111001,Fakultas Teknik,Acara,ahmad@student.ub.ac.id,081234567890',
      'Siti Aminah,215150701111002,Fakultas Ekonomi dan Bisnis,Logistik,siti@student.ub.ac.id,081234567891'
    ];
    
    const csv = [headers.join(','), ...sampleData].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_panitia_peserta.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const ImportModal = () => (
    importModalOpen && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-auto">
          <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-indigo-600 p-6 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-8 h-8 text-white" />
              <h2 className="text-xl font-bold text-white">Import Data Panitia Peserta</h2>
            </div>
            <button 
              onClick={() => setImportModalOpen(false)}
              className="text-white hover:bg-white/10 p-2 rounded-full"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
          
          <div className="p-6">
            {!importFile && !importResult && (
              <div className="text-center py-8">
                <div className="mx-auto w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                  <Upload className="w-12 h-12 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Upload File Excel/CSV</h3>
                <p className="text-gray-600 mb-6 max-w-lg mx-auto">
                  Upload file Excel atau CSV dengan maksimal 1200 data panitia peserta.
                </p>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-left max-w-2xl mx-auto">
                  <h4 className="font-semibold text-yellow-800 mb-2">Format Kolom yang Diperlukan:</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm text-yellow-700">
                    <div>• <strong>nama_lengkap</strong> - Nama lengkap</div>
                    <div>• <strong>nim</strong> - NIM (8-15 digit)</div>
                    <div>• <strong>fakultas</strong> - Fakultas/Program Studi</div>
                    <div>• <strong>divisi</strong> - Divisi penugasan</div>
                    <div>• <strong>email</strong> - Email (opsional)</div>
                    <div>• <strong>no_telepon</strong> - Nomor telepon (opsional)</div>
                  </div>
                  <p className="text-xs text-yellow-600 mt-2">
                    Divisi yang valid: {DIVISI_OPTIONS.join(', ')}
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium shadow-md hover:shadow-lg transition-all"
                  >
                    Pilih File
                  </button>
                  
                  <button
                    onClick={downloadTemplate}
                    className="flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-medium shadow-md hover:shadow-lg transition-all"
                  >
                    <Download className="w-5 h-5" />
                    Download Template
                  </button>
                </div>
              </div>
            )}

            {importFile && importPreview.length > 0 && !importResult && (
              <div className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-800 mb-2">Preview Data</h4>
                  <p className="text-blue-700">File: {importFile.name}</p>
                  <p className="text-blue-700">Menampilkan 50 data pertama dari total yang akan diimport</p>
                </div>

                <div className="max-h-96 overflow-auto border rounded-lg">
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr>
                        <th className="p-3 text-left text-sm font-semibold border-b">Row</th>
                        <th className="p-3 text-left text-sm font-semibold border-b">Nama</th>
                        <th className="p-3 text-left text-sm font-semibold border-b">NIM</th>
                        <th className="p-3 text-left text-sm font-semibold border-b">Fakultas</th>
                        <th className="p-3 text-left text-sm font-semibold border-b">Divisi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.map((item, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="p-3 text-sm">{item.row}</td>
                          <td className="p-3 text-sm">{item.nama_lengkap}</td>
                          <td className="p-3 text-sm font-mono">{item.nim}</td>
                          <td className="p-3 text-sm">{item.fakultas}</td>
                          <td className="p-3 text-sm">
                            <span className={`px-2 py-1 rounded text-xs ${
                              DIVISI_COLORS[item.divisi as keyof typeof DIVISI_COLORS] || 'bg-gray-100 text-gray-800'
                            }`}>
                              {item.divisi}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {importLoading && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      <span className="font-medium text-blue-800">Importing data...</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${importProgress}%` }}
                      />
                    </div>
                    <p className="text-sm text-blue-600 mt-2">{importProgress.toFixed(1)}% complete</p>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setImportFile(null);
                      setImportPreview([]);
                    }}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    disabled={importLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={importLoading}
                    className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    {importLoading ? 'Importing...' : 'Start Import'}
                  </button>
                </div>
              </div>
            )}

            {importResult && (
              <div className="space-y-6">
                <div className={`p-6 rounded-2xl ${
                  importResult.summary.failed === 0 
                    ? 'bg-green-100 border border-green-200' 
                    : 'bg-yellow-100 border border-yellow-200'
                }`}>
                  <div className="flex items-center gap-4">
                    <div className="bg-white rounded-full p-3">
                      {importResult.summary.failed === 0 ? (
                        <CheckCircle className="w-8 h-8 text-green-600" />
                      ) : (
                        <AlertCircle className="w-8 h-8 text-yellow-600" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-800">
                        Import {importResult.summary.failed === 0 ? 'Berhasil' : 'Selesai'}!
                      </h3>
                      <p className="text-gray-600 mt-1">
                        <span className="font-semibold text-green-600">{importResult.summary.success}</span> berhasil, 
                        <span className="font-semibold text-red-600"> {importResult.summary.failed}</span> gagal
                        <span className="text-gray-500"> dari {importResult.summary.total} total data</span>
                      </p>
                    </div>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <div className="border border-red-200 rounded-lg overflow-hidden">
                    <div className="bg-red-100 p-3 text-center font-medium text-red-800">
                      Data Gagal ({importResult.errors.length})
                    </div>
                    <div className="max-h-64 overflow-auto">
                      <table className="w-full border-collapse">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="p-2 text-left text-sm text-gray-700">Row</th>
                            <th className="p-2 text-left text-sm text-gray-700">Nama</th>
                            <th className="p-2 text-left text-sm text-gray-700">NIM</th>
                            <th className="p-2 text-left text-sm text-gray-700">Error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importResult.errors.slice(0, 50).map((error, index) => (
                            <tr key={index} className="border-b hover:bg-red-50/50">
                              <td className="p-2 text-sm">{error.row}</td>
                              <td className="p-2 text-sm">{error.data?.nama_lengkap || '-'}</td>
                              <td className="p-2 text-sm font-mono">{error.data?.nim || '-'}</td>
                              <td className="p-2 text-sm text-red-600">{error.errors.join('; ')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={() => setImportModalOpen(false)}
                    className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-lg font-medium"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileUpload}
        />
      </div>
    )
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-white/10 p-3 rounded-lg">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Manajemen Panitia Peserta</h1>
                  <p className="text-indigo-100">Raja Brawijaya 2025</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setImportModalOpen(true)}
                  className="flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-all"
                >
                  <Upload className="w-5 h-5" />
                  Import Excel
                </button>
                <button
                  onClick={fetchData}
                  className="flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-all"
                >
                  <RefreshCw className="w-5 h-5" />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="p-6 border-b">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Users className="w-8 h-8 text-blue-600" />
                    <div>
                      <p className="text-sm text-blue-600">Total Peserta</p>
                      <p className="text-2xl font-bold text-blue-800">{stats.total}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-8 h-8 text-green-600" />
                    <div>
                      <p className="text-sm text-green-600">Registrasi 7 Hari</p>
                      <p className="text-2xl font-bold text-green-800">{stats.recentRegistrations}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-8 h-8 text-purple-600" />
                    <div>
                      <p className="text-sm text-purple-600">Total Divisi</p>
                      <p className="text-2xl font-bold text-purple-800">{stats.byDivisi?.length || 0}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-8 h-8 text-orange-600" />
                    <div>
                      <p className="text-sm text-orange-600">Import Logs</p>
                      <p className="text-2xl font-bold text-orange-800">{stats.importLogs?.length || 0}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Cari nama, NIM, atau fakultas..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <select
                value={selectedDivisi}
                onChange={(e) => {
                  setSelectedDivisi(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Semua Divisi</option>
                {DIVISI_OPTIONS.map(divisi => (
                  <option key={divisi} value={divisi}>{divisi}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-4 text-left text-sm font-semibold text-gray-700 border-b">Nama Lengkap</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700 border-b">NIM</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700 border-b">Fakultas</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700 border-b">Divisi</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700 border-b">Terdaftar</th>
                  <th className="p-4 text-center text-sm font-semibold text-gray-700 border-b">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                      <p className="text-gray-500 mt-2">Loading data...</p>
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      Tidak ada data ditemukan
                    </td>
                  </tr>
                ) : (
                  data.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="p-4">
                        <div>
                          <p className="font-medium text-gray-900">{item.nama_lengkap}</p>
                          {item.email && (
                            <p className="text-sm text-gray-500">{item.email}</p>
                          )}
                        </div>
                      </td>
                      <td className="p-4 font-mono text-sm">{item.nim}</td>
                      <td className="p-4 text-sm">{item.fakultas}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          DIVISI_COLORS[item.divisi as keyof typeof DIVISI_COLORS] || 'bg-gray-100 text-gray-800'
                        }`}>
                          {item.divisi}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-gray-500">
                        {new Date(item.created_at).toLocaleDateString('id-ID')}
                      </td>
                      <td className="p-4">
                        <div className="flex justify-center gap-2">
                          <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-green-600 hover:bg-green-50 rounded-lg">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-4 h-4" />
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
            <div className="p-4 border-t flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Halaman {currentPage} dari {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ImportModal />
    </div>
  );
}