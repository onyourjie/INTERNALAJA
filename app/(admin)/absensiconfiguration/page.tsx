/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, Users, Settings, CheckCircle, XCircle, RefreshCw, Activity } from 'lucide-react';

interface DivisionConfig {
  divisi: string;
  is_active: boolean;
  total_members: number;
}

interface ApiResponse {
  success: boolean;
  data?: DivisionConfig[];
  message?: string;
}

export default function AbsensiConfigurationPage() {
  const [divisions, setDivisions] = useState<DivisionConfig[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch divisions data
  const fetchDivisions = async (showRefreshLoader = false) => {
    try {
      if (showRefreshLoader) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const response = await fetch('/api/absensiconfig', {
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result: ApiResponse = await response.json();
      
      if (result.success && result.data) {
        setDivisions(result.data);
        setError(null);
        
        if (showRefreshLoader) {
          setSuccess('Data berhasil diperbarui');
          setTimeout(() => setSuccess(null), 2000);
        }
      } else {
        setError(result.message || 'Gagal mengambil data divisi');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan saat mengambil data';
      setError(errorMessage);
      console.error('Error fetching divisions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Toggle division status
  const toggleDivisionStatus = async (divisi: string, currentStatus: boolean) => {
    try {
      setUpdating(divisi);
      setError(null);
      
      const response = await fetch('/api/absensiconfig', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          divisi,
          is_active: !currentStatus,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse = await response.json();
      
      if (result.success) {
        // Update local state
        setDivisions(prev => 
          prev.map(div => 
            div.divisi === divisi 
              ? { ...div, is_active: !currentStatus }
              : div
          )
        );
        
        const statusText = !currentStatus ? 'diaktifkan' : 'dinonaktifkan';
        setSuccess(`Absensi divisi "${divisi}" berhasil ${statusText}`);
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.message || 'Gagal mengupdate status divisi');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan saat mengupdate status';
      setError(errorMessage);
      console.error('Error updating division status:', err);
    } finally {
      setUpdating(null);
    }
  };

  // Calculate statistics
  const totalDivisions = divisions.length;
  const activeDivisions = divisions.filter(div => div.is_active).length;
  const inactiveDivisions = totalDivisions - activeDivisions;
  const totalMembers = divisions.reduce((sum, div) => sum + div.total_members, 0);

  useEffect(() => {
    fetchDivisions();
  }, []);

  // Clear alerts
  const clearError = () => setError(null);
  const clearSuccess = () => setSuccess(null);

  if (loading && !refreshing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Memuat Konfigurasi</h2>
          <p className="text-gray-600">Sedang mengambil data divisi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100 rounded-full">
                <Settings className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Konfigurasi Absensi</h1>
                <p className="text-gray-600 mt-1">Kelola pengaturan absensi untuk setiap divisi panitia</p>
              </div>
            </div>
            
            <Button
              onClick={() => fetchDivisions(true)}
              disabled={refreshing}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Memperbarui...' : 'Perbarui Data'}</span>
            </Button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <XCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 flex items-center justify-between">
              <span>{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearError}
                className="text-red-600 hover:text-red-800 p-1 h-auto"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 flex items-center justify-between">
              <span>{success}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSuccess}
                className="text-green-600 hover:text-green-800 p-1 h-auto"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-800">Total Divisi</p>
                  <p className="text-3xl font-bold text-blue-900">{totalDivisions}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-600 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-800">Divisi Aktif</p>
                  <p className="text-3xl font-bold text-green-900">{activeDivisions}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-red-600 rounded-lg">
                  <XCircle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-red-800">Divisi Nonaktif</p>
                  <p className="text-3xl font-bold text-red-900">{inactiveDivisions}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-600 rounded-lg">
                  <Activity className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-purple-800">Total Anggota</p>
                  <p className="text-3xl font-bold text-purple-900">{totalMembers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Division Configuration */}
        <Card className="bg-white shadow-sm">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="flex items-center space-x-3 text-xl">
              <Users className="h-6 w-6 text-gray-700" />
              <span>Konfigurasi Divisi</span>
              <span className="text-sm font-normal text-gray-500">
                ({totalDivisions} divisi)
              </span>
            </CardTitle>
          </CardHeader>
          
          <CardContent className="p-0">
            {divisions.length === 0 ? (
              <div className="text-center py-16">
                <div className="p-4 bg-gray-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                  <Users className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Tidak Ada Data Divisi</h3>
                <p className="text-gray-500 mb-4">Belum ada divisi yang terdaftar dalam sistem</p>
                <Button onClick={() => fetchDivisions(true)} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Muat Ulang Data
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {divisions.map((division, index) => (
                  <div
                    key={division.divisi}
                    className={`p-6 hover:bg-gray-50 transition-all duration-200 ${
                      updating === division.divisi ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${
                            division.is_active ? 'bg-green-500' : 'bg-red-500'
                          }`}></div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {division.divisi}
                            </h3>
                            <div className="flex items-center space-x-4 mt-1">
                              <p className="text-sm text-gray-600">
                                <Users className="h-4 w-4 inline mr-1" />
                                {division.total_members} anggota
                              </p>
                              <p className={`text-sm font-medium ${
                                division.is_active ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {division.is_active ? 'Absensi Aktif' : 'Absensi Nonaktif'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        {updating === division.divisi && (
                          <div className="flex items-center space-x-2 text-blue-600">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">Mengupdate...</span>
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-3">
                          <div className="text-right">
                            <p className="text-xs text-gray-500 uppercase tracking-wider">
                              Status Absensi
                            </p>
                            <p className={`text-sm font-semibold ${
                              division.is_active ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {division.is_active ? 'AKTIF' : 'NONAKTIF'}
                            </p>
                          </div>
                          
                          <Switch
                            checked={division.is_active}
                            onCheckedChange={() => toggleDivisionStatus(division.divisi, division.is_active)}
                            disabled={updating === division.divisi}
                            className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-red-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Information Card */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-2">Informasi Penggunaan</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                      <span>Status <strong>Aktif</strong>: Divisi dapat melakukan absensi</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                      <span>Status <strong>Nonaktif</strong>: Absensi ditutup untuk divisi</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>Perubahan status berlaku secara real-time</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="h-4 w-4 text-blue-600" />
                      <span>Data diperbarui otomatis dari database</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}