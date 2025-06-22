'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  ArrowLeft,
  UserCheck,
  UserX,
  QrCode
} from 'lucide-react';

interface PesertaData {
  id: number;
  unique_id: string;
  nama_lengkap: string;
  nim: string;
  divisi: string;
  is_active: boolean;
  qr_code: string | null;
}

interface DivisionStatus {
  divisi: string;
  is_active: boolean;
  total_members: number;
}

interface ApiResponse {
  success: boolean;
  data?: {
    division_status: DivisionStatus;
    peserta: PesertaData[];
  };
  message?: string;
}

export default function AbsensiDivisiPage() {
  const params = useParams();
  const router = useRouter();
  const namaDivisi = decodeURIComponent(params.namadivisi as string);

  const [divisionData, setDivisionData] = useState<DivisionStatus | null>(null);
  const [pesertaList, setPesertaList] = useState<PesertaData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch division data and peserta
  const fetchDivisionData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/absensi/divisi/${encodeURIComponent(namaDivisi)}`, {
        cache: 'no-store'
      });

      if (!response.ok) {
        if (response.status === 404) {
          setError('Divisi tidak ditemukan');
          return;
        }
        if (response.status === 403) {
          setError('Absensi untuk divisi ini sedang tidak aktif');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse = await response.json();

      if (result.success && result.data) {
        setDivisionData(result.data.division_status);
        setPesertaList(result.data.peserta);
      } else {
        setError(result.message || 'Gagal mengambil data divisi');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan saat mengambil data';
      setError(errorMessage);
      console.error('Error fetching division data:', err);
    } finally {
      setLoading(false);
    }
  }, [namaDivisi]);

  useEffect(() => {
    if (namaDivisi) {
      fetchDivisionData();
    }
  }, [namaDivisi, fetchDivisionData]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Memuat Data Divisi</h2>
          <p className="text-gray-600">Sedang mengambil data untuk divisi {namaDivisi}...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-8 text-center">
              <div className="p-3 bg-red-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-red-900 mb-2">Akses Ditolak</h2>
              <p className="text-red-700 mb-6">{error}</p>
              
              <div className="space-y-3">
                <Button
                  onClick={() => router.back()}
                  variant="outline"
                  className="w-full border-red-300 text-red-700 hover:bg-red-100"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Kembali
                </Button>
                
                <Button
                  onClick={() => router.push('/admin/absensiconfiguration')}
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  Lihat Konfigurasi Absensi
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Division not active
  if (divisionData && !divisionData.is_active) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full">
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-8 text-center">
              <div className="p-3 bg-orange-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <UserX className="h-8 w-8 text-orange-600" />
              </div>
              <h2 className="text-xl font-semibold text-orange-900 mb-2">Absensi Nonaktif</h2>
              <p className="text-orange-700 mb-2">
                Absensi untuk divisi <strong>{namaDivisi}</strong> sedang tidak aktif.
              </p>
              <p className="text-sm text-orange-600 mb-6">
                Silakan hubungi admin untuk mengaktifkan absensi divisi ini.
              </p>
              
              <div className="space-y-3">
                <Button
                  onClick={() => router.back()}
                  variant="outline"
                  className="w-full border-orange-300 text-orange-700 hover:bg-orange-100"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Kembali
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const activePeserta = pesertaList.filter(p => p.is_active);
  const currentTime = new Date().toLocaleString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => router.back()}
                variant="outline"
                size="sm"
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Kembali</span>
              </Button>
              
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-green-100 rounded-full">
                  <UserCheck className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Absensi Divisi {namaDivisi}
                  </h1>
                  <div className="flex items-center space-x-4 mt-1">
                    <p className="text-gray-600 flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {currentTime}
                    </p>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Aktif
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-2xl font-bold text-green-600">{activePeserta.length}</p>
              <p className="text-sm text-gray-600">Anggota Aktif</p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <Alert className="border-blue-200 bg-blue-50">
          <QrCode className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Cara Absensi:</strong> Scan QR Code yang ada pada kartu identitas peserta atau masukkan Unique ID secara manual.
          </AlertDescription>
        </Alert>

        {/* Absensi Form Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <QrCode className="h-5 w-5" />
              <span>Scan Absensi</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
              <QrCode className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">QR Code Scanner</h3>
              <p className="text-gray-600 mb-4">
                Fitur scanner QR Code akan diimplementasikan di sini
              </p>
              <Button disabled className="bg-gray-300">
                <QrCode className="h-4 w-4 mr-2" />
                Aktifkan Scanner (Coming Soon)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Peserta List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Daftar Anggota Divisi</span>
                <Badge variant="secondary">{activePeserta.length} anggota</Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activePeserta.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Tidak ada anggota aktif di divisi ini</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activePeserta.map((peserta) => (
                  <div
                    key={peserta.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-sm">
                          {peserta.nama_lengkap.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{peserta.nama_lengkap}</h4>
                        <p className="text-sm text-gray-600">NIM: {peserta.nim}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Unique ID</p>
                        <p className="text-sm font-mono text-gray-700">{peserta.unique_id}</p>
                      </div>
                      
                      {peserta.qr_code && (
                        <Badge variant="outline" className="text-green-600 border-green-300">
                          <QrCode className="h-3 w-3 mr-1" />
                          QR Ready
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer Info */}
        <Card className="bg-gray-100 border-gray-200">
          <CardContent className="p-4">
            <div className="text-sm text-gray-700">
              <p className="font-medium mb-1">Informasi Divisi:</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="font-medium">Nama Divisi:</span> {namaDivisi}
                </div>
                <div>
                  <span className="font-medium">Total Anggota:</span> {divisionData?.total_members || 0}
                </div>
                <div>
                  <span className="font-medium">Status:</span> 
                  <Badge className="ml-2 bg-green-100 text-green-800">Aktif</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}