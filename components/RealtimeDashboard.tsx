// components/RealtimeDashboard.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  useRealtimeAbsensi,
  useRealtimeScanMonitor,
} from "@/hooks/useRealtimeAbsensi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  Users,
  UserCheck,
  UserX,
  Clock,
  QrCode,
  Edit3,
  Trash2,
  MapPin,
  Activity,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle,
  Timer,
  Zap,
} from "lucide-react";
import { toast } from "react-hot-toast";

interface RealtimeDashboardProps {
  kegiatan_id: string;
  kegiatan_nama: string;
  kegiatan_rangkaian_id?: string | null;
  tanggal: string;
  onScanQR?: () => void;
}

// Real-time Status Indicator Component
const RealtimeStatusIndicator: React.FC<{
  isConnected: boolean;
  lastUpdate: Date | null;
  connectionStatus: string;
}> = ({ isConnected, lastUpdate, connectionStatus }) => {
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    if (isConnected) {
      setBlinking(true);
      const timer = setTimeout(() => setBlinking(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [lastUpdate]);

  const getStatusInfo = () => {
    switch (connectionStatus) {
      case "connected":
        return { icon: Wifi, color: "text-green-500", text: "Real-time Aktif" };
      case "connecting":
        return {
          icon: Timer,
          color: "text-yellow-500",
          text: "Menghubungkan...",
        };
      case "disconnected":
        return { icon: WifiOff, color: "text-gray-500", text: "Terputus" };
      case "error":
        return {
          icon: AlertCircle,
          color: "text-red-500",
          text: "Error Koneksi",
        };
      default:
        return { icon: WifiOff, color: "text-gray-500", text: "Tidak Aktif" };
    }
  };

  const { icon: StatusIcon, color, text } = getStatusInfo();

  return (
    <div className="flex items-center gap-2 text-sm">
      <StatusIcon
        size={16}
        className={`${color} ${blinking ? "animate-pulse" : ""}`}
      />
      <span className={color}>{text}</span>
      {lastUpdate && (
        <span className="text-gray-500 text-xs">
          {lastUpdate.toLocaleTimeString("id-ID")}
        </span>
      )}
    </div>
  );
};

// Real-time Info Cards Component
const RealtimeInfoCards: React.FC<{
  statistics: any;
  loading: boolean;
  recentScans: any[];
  lastScanTime: Date | null;
}> = ({ statistics, loading, recentScans, lastScanTime }) => {
  const [animatingCards, setAnimatingCards] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (lastScanTime) {
      setAnimatingCards(new Set(["hadir", "total"]));
      const timer = setTimeout(() => setAnimatingCards(new Set()), 2000);
      return () => clearTimeout(timer);
    }
  }, [lastScanTime]);

  const formatPercentage = (percentage: number) => {
    return isNaN(percentage) ? "0" : percentage.toFixed(1);
  };

  const cardData = [
    {
      id: "total",
      title: "Total Panitia",
      value: statistics?.total_panitia || 0,
      icon: Users,
      color: "bg-blue-500",
      textColor: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      id: "hadir",
      title: "Hadir",
      value: statistics?.hadir || 0,
      percentage: statistics?.percentage_hadir || 0,
      icon: UserCheck,
      color: "bg-green-500",
      textColor: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      id: "tidak_hadir",
      title: "Tidak Hadir",
      value: statistics?.tidak_hadir || 0,
      icon: UserX,
      color: "bg-red-500",
      textColor: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      id: "qr_scans",
      title: "QR Scans",
      value: statistics?.qr_scans || 0,
      icon: QrCode,
      color: "bg-purple-500",
      textColor: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cardData.map((card) => {
        const isAnimating = animatingCards.has(card.id);

        return (
          <Card
            key={card.id}
            className={`${card.bgColor} border-l-4 ${
              card.color
            } transition-all duration-300 ${
              isAnimating ? "scale-105 shadow-lg ring-2 ring-green-200" : ""
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {card.title}
                  </p>
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-2xl font-bold ${card.textColor} ${
                        isAnimating ? "animate-pulse" : ""
                      }`}
                    >
                      {loading ? "..." : card.value.toLocaleString()}
                    </p>
                    {card.percentage !== undefined && (
                      <Badge variant="secondary" className="text-xs">
                        {formatPercentage(card.percentage)}%
                      </Badge>
                    )}
                  </div>
                  {card.id === "hadir" && lastScanTime && (
                    <p className="text-xs text-gray-500 mt-1">
                      Update: {lastScanTime.toLocaleTimeString("id-ID")}
                    </p>
                  )}
                </div>
                <div className={`p-3 rounded-full ${card.color}`}>
                  <card.icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

// Real-time Activity Feed Component
const RealtimeActivityFeed: React.FC<{
  events: any[];
  recentScans: any[];
  className?: string;
}> = ({ events, recentScans, className }) => {
  const [showAll, setShowAll] = useState(false);

  const recentEvents = useMemo(() => {
    const combined = [
      ...events.slice(-5).map((e) => ({ ...e, source: "event" })),
      ...recentScans.slice(-5).map((s) => ({ ...s, source: "scan" })),
    ].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return showAll ? combined : combined.slice(0, 5);
  }, [events, recentScans, showAll]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case "absensi_created":
      case "scan_success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "absensi_updated":
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      case "scan_failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getEventMessage = (event: any) => {
    if (event.source === "scan") {
      return `${event.data?.panitia_nama || "Unknown"} melakukan scan QR`;
    }

    switch (event.type) {
      case "absensi_created":
        return `${event.data?.panitia_nama || "Panitia"} hadir (${
          event.data?.metode_absensi || "Unknown"
        })`;
      case "absensi_updated":
        return `${event.data?.panitia_nama || "Panitia"} status diubah ke ${
          event.data?.status || "Unknown"
        }`;
      case "scan_failed":
        return `Scan gagal: ${event.data?.reason || "Unknown error"}`;
      case "scan_duplicate":
        return `${
          event.data?.panitia?.nama_lengkap || "Panitia"
        } sudah absen sebelumnya`;
      default:
        return `Event: ${event.type}`;
    }
  };

  if (recentEvents.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Aktivitas Real-time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 text-center py-4">
            Belum ada aktivitas terbaru
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Aktivitas Real-time
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {recentEvents.length} events
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {recentEvents.map((event, index) => (
          <div
            key={`${event.id || index}-${event.timestamp}`}
            className="flex items-start gap-3 p-2 rounded-lg bg-gray-50"
          >
            {getEventIcon(event.type)}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {getEventMessage(event)}
              </p>
              <p className="text-xs text-gray-500">
                {new Date(event.timestamp).toLocaleTimeString("id-ID")}
              </p>
            </div>
          </div>
        ))}

        {recentEvents.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="w-full text-xs"
          >
            {showAll ? "Tampilkan Lebih Sedikit" : "Tampilkan Semua"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

// Real-time Data Table Component
const RealtimeDataTable: React.FC<{
  data: any[];
  loading: boolean;
  onUpdateStatus: (id: number, status: string) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
}> = ({ data, loading, onUpdateStatus, onDelete }) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());
  const [flashingIds, setFlashingIds] = useState<Set<number>>(new Set());

  // Flash animation untuk new updates
  useEffect(() => {
    const newlyUpdated = data.filter((item) => {
      if (!item.last_updated) return false;
      const updateTime = new Date(item.last_updated).getTime();
      const now = Date.now();
      return now - updateTime < 5000; // Updated in last 5 seconds
    });

    if (newlyUpdated.length > 0) {
      setFlashingIds(new Set(newlyUpdated.map((item) => item.id)));
      const timer = setTimeout(() => setFlashingIds(new Set()), 3000);
      return () => clearTimeout(timer);
    }
  }, [data]);

  const handleUpdateStatus = async (id: number, status: string) => {
    setProcessingIds((prev) => new Set(prev).add(id));

    try {
      const success = await onUpdateStatus(id, status);
      if (success) {
        toast.success(`Status berhasil diubah ke ${status}`);
        setEditingId(null);
      } else {
        toast.error("Gagal mengubah status");
      }
    } catch (error) {
      toast.error("Error mengubah status");
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Yakin ingin menghapus data absensi ini?")) return;

    setProcessingIds((prev) => new Set(prev).add(id));

    try {
      const success = await onDelete(id);
      if (success) {
        toast.success("Data absensi berhasil dihapus");
      } else {
        toast.error("Gagal menghapus data absensi");
      }
    } catch (error) {
      toast.error("Error menghapus data");
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      Hadir: "bg-green-100 text-green-800",
      "Tidak Hadir": "bg-red-100 text-red-800",
      Izin: "bg-yellow-100 text-yellow-800",
      Sakit: "bg-blue-100 text-blue-800",
    };

    return (
      <Badge
        className={
          variants[status as keyof typeof variants] ||
          "bg-gray-100 text-gray-800"
        }
      >
        {status}
      </Badge>
    );
  };

  const getMethodBadge = (method: string) => {
    return method === "QR Code" ? (
      <Badge variant="outline" className="flex items-center gap-1">
        <QrCode className="h-3 w-3" />
        QR
      </Badge>
    ) : (
      <Badge variant="secondary">Manual</Badge>
    );
  };

  if (loading && data.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>Memuat data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Data Absensi Real-time</span>
          <Badge variant="outline">{data.length} records</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 font-medium">Nama</th>
                <th className="text-left p-2 font-medium">NIM</th>
                <th className="text-left p-2 font-medium">Divisi</th>
                <th className="text-left p-2 font-medium">Status</th>
                <th className="text-left p-2 font-medium">Waktu</th>
                <th className="text-left p-2 font-medium">Metode</th>
                <th className="text-left p-2 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => {
                const isFlashing = flashingIds.has(item.id);
                const isProcessing = processingIds.has(item.id);
                const isEditing = editingId === item.id;

                return (
                  <tr
                    key={item.id}
                    className={`border-b hover:bg-gray-50 transition-all duration-300 ${
                      isFlashing ? "bg-green-50 ring-2 ring-green-200" : ""
                    } ${isProcessing ? "opacity-50" : ""}`}
                  >
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.nama_lengkap}</span>
                        {item.has_location && (
                          <MapPin
                            className="h-3 w-3 text-gray-400"
                            title="Dengan lokasi GPS"
                          />
                        )}
                        {isFlashing && (
                          <Zap
                            className="h-3 w-3 text-green-500 animate-pulse"
                            title="Baru diperbarui"
                          />
                        )}
                      </div>
                    </td>
                    <td className="p-2 text-sm text-gray-600">{item.nim}</td>
                    <td className="p-2">
                      <Badge variant="outline" className="text-xs">
                        {item.divisi}
                      </Badge>
                    </td>
                    <td className="p-2">
                      {isEditing ? (
                        <Select value={newStatus} onValueChange={setNewStatus}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Hadir">Hadir</SelectItem>
                            <SelectItem value="Tidak Hadir">
                              Tidak Hadir
                            </SelectItem>
                            <SelectItem value="Izin">Izin</SelectItem>
                            <SelectItem value="Sakit">Sakit</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        getStatusBadge(item.status)
                      )}
                    </td>
                    <td className="p-2 text-sm">
                      {item.waktu_hadir === "-" ? (
                        <span className="text-gray-400">-</span>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-gray-400" />
                          {item.waktu_hadir}
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      {getMethodBadge(item.metode_absensi)}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() =>
                                handleUpdateStatus(item.id, newStatus)
                              }
                              disabled={!newStatus || isProcessing}
                              className="h-7 px-2"
                            >
                              {isProcessing ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle className="h-3 w-3" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingId(null)}
                              className="h-7 px-2"
                            >
                              ✕
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingId(item.id);
                                setNewStatus(item.status);
                              }}
                              disabled={isProcessing}
                              className="h-7 px-2"
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(item.id)}
                              disabled={isProcessing}
                              className="h-7 px-2 text-red-600 hover:text-red-700"
                            >
                              {isProcessing ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {data.length === 0 && !loading && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Belum ada data absensi</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Main Dashboard Component
const RealtimeDashboard: React.FC<RealtimeDashboardProps> = ({
  kegiatan_id,
  kegiatan_nama,
  kegiatan_rangkaian_id,
  tanggal,
  onScanQR,
}) => {
  // Search and filter states
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [divisiFilter, setDivisiFilter] = useState("");
  const [page, setPage] = useState(1);
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);

  // Main real-time hook
  const {
    data,
    statistics,
    loading,
    error,
    lastUpdate,
    isRealtime,
    connectionStatus,
    refresh,
    forceRefresh,
    updateStatus,
    deleteAbsensi,
    startRealtime,
    stopRealtime,
    events,
    clearEvents,
  } = useRealtimeAbsensi({
    kegiatan_id,
    kegiatan_rangkaian_id,
    tanggal,
    search,
    status: statusFilter,
    divisi: divisiFilter,
    page,
    limit: 50,
    enableRealtime: realtimeEnabled,
    pollingInterval: 3000,
    onNewScan: (data) => {
      toast.success(`🎉 ${data.nama_lengkap} berhasil absen!`, {
        duration: 4000,
        position: "top-right",
      });
    },
    onStatusUpdate: (data) => {
      toast.info(`📝 ${data.nama_lengkap} status diubah ke ${data.status}`, {
        duration: 3000,
      });
    },
    onError: (error) => {
      toast.error(`❌ Error: ${error}`, {
        duration: 5000,
      });
    },
  });

  // Scan monitoring hook
  const { recentScans, scanCount, lastScanTime, clearScanHistory } =
    useRealtimeScanMonitor(kegiatan_id);

  // Handle real-time toggle
  const handleRealtimeToggle = useCallback(() => {
    if (realtimeEnabled) {
      stopRealtime();
      setRealtimeEnabled(false);
      toast.info("Real-time dimatikan");
    } else {
      setRealtimeEnabled(true);
      startRealtime();
      toast.success("Real-time diaktifkan");
    }
  }, [realtimeEnabled, startRealtime, stopRealtime]);

  // Handle search with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1); // Reset to first page when searching
    }, 300);

    return () => clearTimeout(timer);
  }, [search, statusFilter, divisiFilter]);

  // Get unique divisi for filter
  const availableDivisi = useMemo(() => {
    const divisiSet = new Set(data.map((item) => item.divisi));
    return Array.from(divisiSet).sort();
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Header dengan Real-time Status */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{kegiatan_nama}</h1>
          <p className="text-sm text-gray-600">
            Dashboard Absensi Real-time -{" "}
            {new Date(tanggal).toLocaleDateString("id-ID")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <RealtimeStatusIndicator
            isConnected={isRealtime}
            lastUpdate={lastUpdate}
            connectionStatus={connectionStatus}
          />

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRealtimeToggle}
              className="flex items-center gap-2"
            >
              {realtimeEnabled ? (
                <>
                  <Wifi className="h-4 w-4" />
                  Real-time ON
                </>
              ) : (
                <>
                  <WifiOff className="h-4 w-4" />
                  Real-time OFF
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => forceRefresh()}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>

            {onScanQR && (
              <Button onClick={onScanQR} className="flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                Scan QR
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Error:</span>
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Real-time Info Cards */}
      <RealtimeInfoCards
        statistics={statistics}
        loading={loading}
        recentScans={recentScans}
        lastScanTime={lastScanTime}
      />

      {/* Controls and Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Search and Filter Controls */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Filter & Pencarian</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
                  placeholder="Cari nama, NIM..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full"
                />

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Semua Status</SelectItem>
                    <SelectItem value="Hadir">Hadir</SelectItem>
                    <SelectItem value="Tidak Hadir">Tidak Hadir</SelectItem>
                    <SelectItem value="Izin">Izin</SelectItem>
                    <SelectItem value="Sakit">Sakit</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={divisiFilter} onValueChange={setDivisiFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter Divisi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Semua Divisi</SelectItem>
                    {availableDivisi.map((divisi) => (
                      <SelectItem key={divisi} value={divisi}>
                        {divisi}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(search || statusFilter || divisiFilter) && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Filter aktif:</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("");
                      setDivisiFilter("");
                    }}
                    className="h-6 px-2 text-xs"
                  >
                    Clear All
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Real-time Activity Feed */}
        <RealtimeActivityFeed events={events} recentScans={recentScans} />
      </div>

      {/* Real-time Data Table */}
      <RealtimeDataTable
        data={data}
        loading={loading}
        onUpdateStatus={updateStatus}
        onDelete={deleteAbsensi}
      />

      {/* Real-time Stats Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-4">
              <span>📊 Total Records: {data.length}</span>
              <span>🔄 Scan Count: {scanCount}</span>
              <span>⚡ Events: {events.length}</span>
            </div>

            <div className="flex items-center gap-2">
              {lastUpdate && (
                <span>
                  🕒 Last Update: {lastUpdate.toLocaleTimeString("id-ID")}
                </span>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  clearEvents();
                  clearScanHistory();
                }}
                className="h-6 px-2 text-xs"
              >
                Clear History
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RealtimeDashboard;
