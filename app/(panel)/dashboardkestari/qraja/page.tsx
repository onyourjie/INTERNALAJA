"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrowserMultiFormatReader } from "@zxing/browser";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

const beep = (on = true) => {
  if (!on) return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 2;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1); // ULTRA SHORT BEEP - 0.1s
  } catch {}
};

export default function QRScannerPage() {
  const router = useRouter();
  const q = useSearchParams();
  
  // ===== Enhanced Parameter Management =====
  const kid = q.get("kegiatanId") ? decodeURIComponent(q.get("kegiatanId")!) : null;
  const kNama = q.get("kegiatanNama") ? decodeURIComponent(q.get("kegiatanNama")!) : null;
  const rid = q.get("rangkaianId") ? decodeURIComponent(q.get("rangkaianId")!) : null;
  const tgl = q.get("tanggal") ? decodeURIComponent(q.get("tanggal")!) : null;
  
  // Return state parameters untuk restore dashboard state
  const returnKegiatanId = q.get("returnKegiatanId") ? decodeURIComponent(q.get("returnKegiatanId")!) : null;
  const returnKegiatanNama = q.get("returnKegiatanNama") ? decodeURIComponent(q.get("returnKegiatanNama")!) : null;
  const returnDayName = q.get("returnDayName") ? decodeURIComponent(q.get("returnDayName")!) : null;
  const returnRangkaianId = q.get("returnRangkaianId") ? decodeURIComponent(q.get("returnRangkaianId")!) : null;
  const returnDate = q.get("returnDate") ? decodeURIComponent(q.get("returnDate")!) : null;
  
  const valid = kid && kNama && tgl;

  // Debug logging
  useEffect(() => {
    console.log("🚀 ULTRA-FAST QR Scanner Absensi initialized:", {
      kegiatanId: kid,
      kegiatanNama: kNama,
      rangkaianId: rid,
      tanggal: tgl,
      valid,
      returnState: {
        kegiatanId: returnKegiatanId,
        kegiatanNama: returnKegiatanNama,
        dayName: returnDayName,
        rangkaianId: returnRangkaianId,
        date: returnDate
      }
    });
  }, [kid, kNama, rid, tgl, valid, returnKegiatanId, returnKegiatanNama, returnDayName, returnRangkaianId, returnDate]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const scanner = useRef<BrowserMultiFormatReader>(
    new BrowserMultiFormatReader(undefined, {
      delayBetweenScanAttempts: 10, // HYPER SPEED - 10ms only!!!
      delayBetweenScanSuccess: 50, // LIGHTNING SPEED - 50ms only!!!
    })
  );
  const streamRef = useRef<MediaStream | null>(null);
  const isProcessingRef = useRef(false);
  const scanControlsRef = useRef<any>(null);
  const lastScannedRef = useRef<string>(""); // Prevent duplicate scans
  const lastScanTimeRef = useRef<number>(0); // Ultra-fast time-based debouncing
  const isErrorStateRef = useRef(false); // Prevent error spam
  const processingCacheRef = useRef<Map<string, any>>(new Map()); // Cache API responses
  const autoRestartTimerRef = useRef<NodeJS.Timeout | null>(null); // Timer reference
  const userStoppedRef = useRef(false); // Track user intention to stop

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [error, setError] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const getCameraPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      setError("Tidak dapat mengakses kamera. Pastikan izin kamera diaktifkan.");
      return false;
    }
  }, []);

  const getAvailableCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((device) => device.kind === "videoinput");
      setCameras(videoDevices);
      // Prioritas kamera belakang untuk mobile
      const backCamera = videoDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment')
      );
      setSelectedCamera(backCamera?.deviceId || videoDevices[0]?.deviceId || "");
    } catch {
      setError("Gagal mendapatkan daftar kamera.");
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (!selectedCamera) return;
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: selectedCamera },
          width: { ideal: 4096, max: 4096 }, // ULTRA HIGH RESOLUTION
          height: { ideal: 2160, max: 2160 },
          frameRate: { ideal: 144, max: 144 }, // MAXIMUM SPEED - 144fps!!!
          facingMode: "environment",
          focusMode: "continuous",
          exposureMode: "continuous",
          whiteBalanceMode: "continuous", // ENHANCED CAMERA SETTINGS
        },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.playbackRate = 1.25; // SPEED UP VIDEO PLAYBACK
      }
      streamRef.current = stream;
      setError("");
    } catch {
      setError("Tidak dapat memulai kamera.");
    }
  }, [selectedCamera]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Clear all timers
  const clearAllTimers = useCallback(() => {
    if (autoRestartTimerRef.current) {
      clearTimeout(autoRestartTimerRef.current);
      autoRestartTimerRef.current = null;
    }
  }, []);

  // Enhanced Back to Dashboard with State Restoration
  const handleBackToDashboard = () => {
    console.log('🔙 Returning to absensi dashboard with state restoration...');
    
    const dashboardUrl = new URL('/dashboardkestari', window.location.origin);
    
    if (returnKegiatanId && returnKegiatanNama) {
      dashboardUrl.searchParams.set('kegiatanId', returnKegiatanId);
      dashboardUrl.searchParams.set('kegiatanNama', returnKegiatanNama);
      
      if (returnDayName) {
        dashboardUrl.searchParams.set('dayName', returnDayName);
      }
      
      if (returnRangkaianId && returnRangkaianId !== "null") {
        dashboardUrl.searchParams.set('rangkaianId', returnRangkaianId);
      }
      
      if (returnDate) {
        dashboardUrl.searchParams.set('date', returnDate);
      }
      
      console.log('✅ Absensi state restoration URL:', dashboardUrl.toString());
    } else {
      console.log('⚠️ No return state available, returning to dashboard without state');
    }
    
    window.location.href = dashboardUrl.toString();
  };

  const formatTanggalIndonesia = useCallback((tanggal: string): string => {
    try {
      const date = new Date(tanggal);
      if (isNaN(date.getTime())) return tanggal;

      return date.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return tanggal;
    }
  }, []);

  // Enhanced date validation dengan kadaluarsa detection
  const validateTanggalKegiatan = useCallback((): {
    isValid: boolean;
    isExpired: boolean;
    isFuture: boolean;
    message: string;
    todayFormatted: string;
    kegiatanFormatted: string;
  } => {
    try {
      const today = new Date();
      const todayLocal = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      const todayISO = todayLocal.toISOString().split("T")[0];

      const kegiatanDateStr = tgl || "";
      let kegiatanISO = "";

      if (kegiatanDateStr) {
        const kegiatanDate = new Date(kegiatanDateStr);
        const kegiatanLocal = new Date(
          kegiatanDate.getFullYear(),
          kegiatanDate.getMonth(),
          kegiatanDate.getDate()
        );
        kegiatanISO = kegiatanLocal.toISOString().split("T")[0];
      }

      const isValid = todayISO === kegiatanISO;
      const isExpired = kegiatanISO < todayISO;
      const isFuture = kegiatanISO > todayISO;

      console.log("📅 Date validation:", {
        today: todayISO,
        kegiatan: kegiatanISO,
        originalKegiatan: kegiatanDateStr,
        isValid,
        isExpired,
        isFuture,
      });

      return {
        isValid,
        isExpired,
        isFuture,
        message: isValid 
          ? "Tanggal kegiatan sesuai dengan hari ini" 
          : isExpired 
          ? "Kegiatan sudah kadaluarsa" 
          : "Kegiatan belum dimulai",
        todayFormatted: formatTanggalIndonesia(todayISO),
        kegiatanFormatted: formatTanggalIndonesia(
          kegiatanISO || kegiatanDateStr
        ),
      };
    } catch (error) {
      console.error("Error validating date:", error);
      return {
        isValid: false,
        isExpired: false,
        isFuture: false,
        message: "Error validating date",
        todayFormatted: "Error",
        kegiatanFormatted: "Error",
      };
    }
  }, [tgl, formatTanggalIndonesia]);

  const tanggalFormatted = tgl ? formatTanggalIndonesia(tgl) : "Tanggal tidak valid";
  const dateValidation = validateTanggalKegiatan();

  // ✅ COMPLETE ENHANCED handleScan with DETAILED DIVISI VALIDATION
  const handleScan = useCallback(
    async (result: string) => {
      // HYPER-FAST spam prevention - REDUCED to 500ms!!!
      const now = Date.now();
      if (
        isProcessingRef.current || 
        isErrorStateRef.current || 
        lastScannedRef.current === result || 
        (now - lastScanTimeRef.current < 500) // ULTRA FAST - 0.5 second cooldown!!!
      ) {
        return;
      }

      // Set processing state immediately
      isProcessingRef.current = true;
      lastScannedRef.current = result;
      lastScanTimeRef.current = now;
      
      // INSTANT scanner stop
      if (scanControlsRef.current) {
        try {
          scanControlsRef.current.stop();
          setIsScanning(false);
        } catch (e) {}
      }

      const currentDateValidation = validateTanggalKegiatan();
      const currentTanggalFormatted = tgl ? formatTanggalIndonesia(tgl) : "Tanggal tidak valid";

      // ULTRA-FAST Date validation
      if (!currentDateValidation.isValid) {
        let alertTitle = "❌ Absensi Tidak Diizinkan";
        let alertIcon: 'error' | 'warning' | 'info' = 'warning';
        
        if (currentDateValidation.isExpired) {
          alertTitle = "⏰ Kegiatan Sudah Kadaluarsa";
          alertIcon = 'error';
        } else if (currentDateValidation.isFuture) {
          alertTitle = "🚀 Kegiatan Belum Dimulai";
          alertIcon = 'info';
        }
        
        await Swal.fire({
          title: alertTitle,
          html: `
            <div class="text-left">
              <p><strong>${currentDateValidation.message}</strong></p>
              <hr class="my-2">
              <div class="bg-gray-50 p-2 rounded mb-2">
                <p><strong>Hari ini:</strong> <span class="text-blue-600">${currentDateValidation.todayFormatted}</span></p>
                <p><strong>Tanggal kegiatan:</strong> <span class="${currentDateValidation.isExpired ? 'text-red-600' : 'text-orange-600'}">${currentDateValidation.kegiatanFormatted}</span></p>
              </div>
            </div>
          `,
          icon: alertIcon,
          confirmButtonText: "OK",
          timer: 800, // ULTRA FAST - 0.8s
          timerProgressBar: true,
          showClass: { popup: 'animate__animated animate__fadeIn animate__faster' },
          hideClass: { popup: 'animate__animated animate__fadeOut animate__faster' }
        });
        
        // INSTANT reset
        isProcessingRef.current = false;
        lastScannedRef.current = "";
        return;
      }

      try {
        beep(soundEnabled);

        let parsed: any;
        try {
          parsed = JSON.parse(result);
        } catch {
          isErrorStateRef.current = true;
          
          await Swal.fire({
            title: "QR Code Tidak Valid",
            text: "Format QR Code tidak dapat dibaca.",
            icon: "error",
            timer: 600, // HYPER FAST - 0.6s
            showConfirmButton: false,
            timerProgressBar: true,
          });
          
          isProcessingRef.current = false;
          lastScannedRef.current = "";
          
          // FIXED: Only restart if user hasn't stopped manually
          setTimeout(() => {
            isErrorStateRef.current = false;
            if (!userStoppedRef.current && !isScanning && selectedCamera && videoRef.current && streamRef.current) {
              startScanner();
            }
          }, 1000);
          return;
        }

        // INSTANT validation
        if (!parsed || !parsed.nama || !parsed.nim || !parsed.divisi) {
          isErrorStateRef.current = true;
          
          await Swal.fire({
            title: "QR Code Tidak Lengkap",
            text: "Data pada QR Code tidak lengkap.",
            icon: "error",
            timer: 600, // HYPER FAST - 0.6s
            showConfirmButton: false,
            timerProgressBar: true,
          });
          
          isProcessingRef.current = false;
          lastScannedRef.current = "";
          
          // FIXED: Only restart if user hasn't stopped manually
          setTimeout(() => {
            isErrorStateRef.current = false;
            if (!userStoppedRef.current && !isScanning && selectedCamera && videoRef.current && streamRef.current) {
              startScanner();
            }
          }, 1000);
          return;
        }

        // Enhanced konfirmasi dengan auto-focus
        const confirm = await Swal.fire({
          title: "⚡ Konfirmasi Absensi",
          html: `
            <div class="text-left">
              <p><strong>Nama:</strong> ${parsed.nama}</p>
              <p><strong>NIM:</strong> ${parsed.nim}</p>
              <p><strong>Divisi:</strong> ${parsed.divisi}</p>
              <hr class="my-2">
              <p><strong>Kegiatan:</strong> ${kNama}</p>
              <p><strong>Tanggal:</strong> ${currentTanggalFormatted}</p>
              <p class="text-xs text-blue-500 mt-1">💡 Tekan Enter untuk konfirmasi</p>
            </div>
          `,
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "✅ Catat Absensi",
          cancelButtonText: "❌ Batal",
          allowOutsideClick: false,
          focusConfirm: true,
          timer: 5000, // REDUCED to 5s
          timerProgressBar: true,
          showClass: { popup: 'animate__animated animate__fadeIn animate__faster' },
          hideClass: { popup: 'animate__animated animate__fadeOut animate__faster' },
          didOpen: () => {
            const confirmButton = Swal.getConfirmButton();
            if (confirmButton) {
              confirmButton.focus();
            }
          }
        });

        if (!confirm.isConfirmed) {
          isProcessingRef.current = false;
          lastScannedRef.current = "";
          
          // FIXED: Only restart if user hasn't stopped manually
          setTimeout(() => {
            if (!userStoppedRef.current && !isScanning && selectedCamera && videoRef.current && streamRef.current) {
              startScanner();
            }
          }, 1000);
          return;
        }

        // INSTANT loading indicator
        Swal.fire({
          title: "⚡ Memproses Absensi...",
          html: `Lightning fast processing...`,
          allowOutsideClick: false,
          showConfirmButton: false,
          timer: 500, // AUTO-CLOSE after 0.5s if API is fast
          didOpen: () => {
            Swal.showLoading();
          },
        });

        // ENHANCED API call with detailed debugging
        const cacheKey = `absensi_${parsed.nim}_${kid}_${rid}`;
        
        const requestPayload = {
          qr_data: result,
          kegiatan_id: Number(kid),
          kegiatan_rangkaian_id: rid ? Number(rid) : null,
        };
        
        console.log('🚀 Sending API request:', {
          url: '/api/absensi/scan',
          method: 'POST',
          payload: requestPayload,
          headers: { "Content-Type": "application/json" }
        });
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // Increased to 10s timeout
        
        let response;
        try {
          response = await fetch("/api/absensi/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestPayload),
            signal: controller.signal
          });
        } catch (fetchError) {
          clearTimeout(timeoutId);
          console.error('❌ Fetch Error:', fetchError);
          
          let errorMessage = "Gagal terhubung ke server.";
          if (fetchError.name === 'AbortError') {
            errorMessage = "Request timeout. Server terlalu lama merespons.";
          } else if (fetchError.message.includes('NetworkError')) {
            errorMessage = "Tidak ada koneksi internet.";
          }
          
          await Swal.fire({
            title: "❌ Connection Error",
            html: `
              <div class="text-center">
                <p class="mb-2">${errorMessage}</p>
                <div class="bg-gray-50 p-2 rounded text-sm">
                  <p><strong>Error:</strong> ${fetchError.message}</p>
                </div>
              </div>
            `,
            icon: "error",
            confirmButtonText: "OK",
            timer: 1500,
            timerProgressBar: true,
          });
          
          isProcessingRef.current = false;
          lastScannedRef.current = "";
          return;
        }
        
        clearTimeout(timeoutId);
        
        console.log('📡 API Response received:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries())
        });

        let jsonData;
        let responseText = '';
        try {
          responseText = await response.text();
          console.log('📄 Raw response text:', responseText);
          
          if (!responseText.trim()) {
            throw new Error('Empty response from server');
          }
          
          jsonData = JSON.parse(responseText);
        } catch (parseError) {
          console.error('⚠️ Failed to parse response:', {
            error: parseError,
            responseStatus: response.status,
            responseText: responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''),
            contentType: response.headers.get('content-type')
          });
          
          let errorTitle = "❌ Server Response Error";
          let errorMessage = "Server mengembalikan response yang tidak valid.";
          
          if (response.status >= 500) {
            errorTitle = "❌ Server Error";
            errorMessage = "Terjadi kesalahan pada server. Silakan coba lagi.";
          } else if (response.status === 404) {
            errorTitle = "❌ API Not Found";
            errorMessage = "Endpoint API tidak ditemukan.";
          } else if (!responseText.trim()) {
            errorTitle = "❌ Empty Response";
            errorMessage = "Server tidak mengembalikan data.";
          }
          
          await Swal.fire({
            title: errorTitle,
            html: `
              <div class="text-center">
                <p class="mb-2">${errorMessage}</p>
                <div class="bg-gray-50 p-2 rounded text-xs text-left">
                  <p><strong>Status:</strong> ${response.status} ${response.statusText}</p>
                  <p><strong>Content-Type:</strong> ${response.headers.get('content-type') || 'Unknown'}</p>
                  ${responseText ? `<p><strong>Response:</strong> ${responseText.substring(0, 100)}${responseText.length > 100 ? '...' : ''}</p>` : ''}
                </div>
              </div>
            `,
            icon: "error",
            confirmButtonText: "OK",
            timer: 2000,
            timerProgressBar: true,
          });
          
          isProcessingRef.current = false;
          lastScannedRef.current = "";
          return;
        }

        console.log('✅ API Response parsed successfully:', {
          success: jsonData.success,
          message: jsonData.message,
          data: jsonData.data,
          fullResponse: jsonData
        });

        if (jsonData.success) {
          beep(true);
          
          // CACHE SUCCESS for avoiding duplicates
          processingCacheRef.current.set(cacheKey, jsonData);
          
          await Swal.fire({
            title: "🎉 Absensi Berhasil!",
            html: `
              <div class="text-center">
                <p class="text-green-600 font-bold text-lg mb-3">✅ Anda sudah melakukan absensi</p>
                <hr class="my-3">
                <div class="text-left bg-gray-50 p-3 rounded text-sm space-y-1">
                  <p><strong>Nama:</strong> ${parsed.nama}</p>
                  <p><strong>NIM:</strong> ${parsed.nim}</p>
                  <p><strong>Divisi:</strong> ${parsed.divisi}</p>
                  <p><strong>Status:</strong> <span class="text-green-600 font-bold">Hadir ✅</span></p>
                </div>
                <hr class="my-3">
                <div class="text-left bg-blue-50 p-3 rounded text-sm space-y-1">
                  <p><strong>Nama Kegiatan:</strong> ${kNama}</p>
                  <p><strong>Nama Rangkaian:</strong> ${rid ? (jsonData.data?.rangkaian_nama || 'Tersedia') : 'Tidak ada rangkaian'}</p>
                  <p><strong>Tanggal:</strong> ${currentTanggalFormatted}</p>
                </div>
                ${jsonData.message ? `<hr class="my-2"><p class="text-sm text-gray-600">${jsonData.message}</p>` : ''}
              </div>
            `,
            icon: "success",
            confirmButtonText: "OK",
            timer: 1000, // Diperpanjang sedikit untuk membaca info lengkap
            timerProgressBar: true,
            showClass: { popup: 'animate__animated animate__bounceIn animate__faster' },
            hideClass: { popup: 'animate__animated animate__fadeOut animate__faster' }
          });
        } else {
          // ✅ ENHANCED error handling untuk Absensi dengan DETAILED DIVISI VALIDATION
          console.log('❌ API returned error:', {
            status: response.status,
            success: jsonData.success,
            message: jsonData.message,
            data: jsonData.data
          });

          let errorTitle = "❌ Absensi Gagal";
          let errorMessage = jsonData.message || "Terjadi kesalahan saat melakukan absensi";
          let errorIcon: 'error' | 'warning' = 'error';
          let errorHtml = '';

          if (response.status === 403) {
            // ✅ ENHANCED: Divisi tidak diizinkan dengan info super detail
            errorTitle = "🚫 Divisi Tidak Diizinkan";
            errorIcon = 'warning';
            
            if (jsonData.data?.divisi_yang_diizinkan && jsonData.data?.panitia_divisi) {
              const allowedDivisi = jsonData.data.divisi_yang_diizinkan;
              const panitiaDiv = jsonData.data.panitia_divisi;
              
              errorHtml = `
                <div class="text-left">
                  <div class="text-center mb-3">
                    <p class="font-bold text-red-600 text-lg">🚫 AKSES DITOLAK</p>
                    <p class="text-sm text-gray-600">Divisi Anda tidak diizinkan untuk kegiatan ini</p>
                  </div>
                  
                  <hr class="my-3 border-gray-300">
                  
                  <!-- Info Panitia -->
                  <div class="bg-red-50 p-3 rounded-lg mb-3 border-l-4 border-red-400">
                    <p class="font-bold text-red-800 mb-2 flex items-center">
                      <span class="mr-2">👤</span> Data Panitia Saat Ini
                    </p>
                    <div class="space-y-1 text-sm">
                      <p><strong>Nama:</strong> ${parsed.nama}</p>
                      <p><strong>NIM:</strong> ${parsed.nim}</p>
                      <p><strong>Divisi:</strong> 
                        <span class="bg-red-200 text-red-800 px-2 py-1 rounded font-bold">
                          ${panitiaDiv}
                        </span>
                      </p>
                    </div>
                  </div>
                  
                  <!-- Info Kegiatan -->
                  <div class="bg-blue-50 p-3 rounded-lg mb-3 border-l-4 border-blue-400">
                    <p class="font-bold text-blue-800 mb-2 flex items-center">
                      <span class="mr-2">📋</span> Info Kegiatan
                    </p>
                    <div class="space-y-1 text-sm">
                      <p><strong>Nama:</strong> ${kNama}</p>
                      <p><strong>Tanggal:</strong> ${currentTanggalFormatted}</p>
                      ${rid ? `<p><strong>Rangkaian:</strong> ${jsonData.data?.rangkaian_nama || 'Multiple Event'}</p>` : ''}
                    </div>
                  </div>
                  
                  <!-- Divisi Yang Diizinkan -->
                  <div class="bg-green-50 p-3 rounded-lg border-l-4 border-green-400">
                    <p class="font-bold text-green-800 mb-2 flex items-center">
                      <span class="mr-2">✅</span> Divisi Yang Diizinkan
                    </p>
                    <div class="grid grid-cols-1 gap-2 text-sm">
                      ${allowedDivisi.slice(0, 6).map((d: any, index: number) => 
                        `<div class="flex items-center gap-2 p-2 bg-white rounded border">
                          <span class="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></span>
                          <span class="font-medium text-green-700">${d.nama}</span>
                        </div>`
                      ).join('')}
                      ${allowedDivisi.length > 6 ? 
                        `<div class="text-center text-gray-600 text-xs mt-2 p-2 bg-gray-100 rounded">
                          + ${allowedDivisi.length - 6} divisi lainnya
                        </div>` 
                        : ''}
                    </div>
                  </div>
                  
                  <hr class="my-3 border-gray-300">
                  
                  <!-- Call to Action -->
                  <div class="bg-yellow-50 p-3 rounded-lg border-l-4 border-yellow-400 text-center">
                    <p class="text-yellow-800 font-medium text-sm">
                      💡 <strong>Solusi:</strong> Hubungi koordinator untuk:
                    </p>
                    <ul class="text-xs text-yellow-700 mt-2 space-y-1">
                      <li>• Konfirmasi divisi yang benar</li>
                      <li>• Update data divisi di sistem</li>
                      <li>• Izin khusus untuk kegiatan ini</li>
                    </ul>
                  </div>
                </div>
              `;
            } else if (jsonData.data?.divisi_yang_diizinkan) {
              // Fallback jika panitia_divisi tidak ada
              const allowedDivisi = jsonData.data.divisi_yang_diizinkan;
              
              errorHtml = `
                <div class="text-left">
                  <p class="mb-3 text-center font-semibold text-red-600">${errorMessage}</p>
                  <hr class="my-3">
                  <div class="bg-gray-50 p-3 rounded mb-3 text-sm border-l-4 border-red-400">
                    <p><strong>Panitia:</strong> ${parsed.nama}</p>
                    <p><strong>Divisi:</strong> <span class="text-red-600 font-bold">${parsed.divisi}</span></p>
                  </div>
                  <div class="bg-blue-50 p-3 rounded text-sm border-l-4 border-green-400">
                    <p class="font-semibold text-green-800 mb-2">📋 Divisi Diizinkan:</p>
                    ${allowedDivisi.slice(0, 4).map((d: any) => `<p>• ${d.nama}</p>`).join('')}
                    ${allowedDivisi.length > 4 ? `<p class="text-gray-600">+ ${allowedDivisi.length - 4} lainnya</p>` : ''}
                  </div>
                </div>
              `;
            } else {
              // Fallback minimal
              errorHtml = `
                <div class="text-center">
                  <p class="mb-3 font-semibold text-red-600">${errorMessage}</p>
                  <div class="bg-red-50 p-3 rounded text-sm">
                    <p><strong>Panitia:</strong> ${parsed.nama}</p>
                    <p><strong>Divisi:</strong> <span class="text-red-600 font-bold">${parsed.divisi}</span></p>
                  </div>
                  <p class="text-xs text-gray-600 mt-2">💡 Hubungi koordinator untuk info divisi yang diizinkan</p>
                </div>
              `;
            }
          } else if (response.status === 409) {
            // Absensi sudah dilakukan
            errorTitle = "⚠️ Sudah Absen";
            errorIcon = 'warning';
            
            if (jsonData.message?.includes("Already attended") || jsonData.message?.includes("sudah melakukan absensi")) {
              errorMessage = "Anda sudah melakukan absensi sebelumnya.";
            }
            
            errorHtml = `
              <div class="text-center">
                <div class="mb-3">
                  <p class="text-2xl mb-2">✅</p>
                  <p class="font-bold text-orange-600 text-lg">Sudah Tercatat</p>
                  <p class="text-sm text-gray-600">${errorMessage}</p>
                </div>
                
                <hr class="my-3">
                
                <div class="bg-orange-50 p-3 rounded text-sm border-l-4 border-orange-400 text-left">
                  <p class="font-semibold text-orange-800 mb-2">👤 Data Panitia:</p>
                  <div class="space-y-1">
                    <p><strong>Nama:</strong> ${parsed.nama}</p>
                    <p><strong>NIM:</strong> ${parsed.nim}</p>
                    <p><strong>Divisi:</strong> ${parsed.divisi}</p>
                  </div>
                </div>
                
                <hr class="my-3">
                
                <div class="bg-blue-50 p-3 rounded text-sm border-l-4 border-blue-400 text-left">
                  <p class="font-semibold text-blue-800 mb-2">📋 Kegiatan:</p>
                  <div class="space-y-1">
                    <p><strong>Nama:</strong> ${kNama}</p>
                    <p><strong>Tanggal:</strong> ${currentTanggalFormatted}</p>
                  </div>
                </div>
                
                <div class="mt-3 p-2 bg-green-100 rounded">
                  <p class="text-sm">
                    <span class="text-green-600 font-bold">✅ Status: HADIR</span>
                  </p>
                </div>
              </div>
            `;
          } else if (response.status === 404) {
            // Panitia tidak ditemukan
            errorTitle = "❌ Data Tidak Ditemukan";
            
            let notFoundType = "Panitia tidak ditemukan di sistem";
            if (jsonData.message?.includes("Kegiatan")) {
              notFoundType = "Kegiatan tidak ditemukan atau tidak aktif";
            }
            
            errorHtml = `
              <div class="text-center">
                <div class="mb-3">
                  <p class="text-4xl mb-2">🔍</p>
                  <p class="font-bold text-red-600 text-lg">Data Tidak Ditemukan</p>
                  <p class="text-sm text-gray-600">${notFoundType}</p>
                </div>
                
                <hr class="my-3">
                
                <div class="bg-red-50 p-3 rounded text-sm border-l-4 border-red-400 text-left">
                  <p class="font-semibold text-red-800 mb-2">❌ Data QR Code:</p>
                  <div class="space-y-1">
                    <p><strong>NIM:</strong> ${parsed.nim}</p>
                    <p><strong>Nama:</strong> ${parsed.nama}</p>
                    <p><strong>Divisi:</strong> ${parsed.divisi}</p>
                  </div>
                </div>
                
                <div class="mt-3 bg-yellow-50 p-3 rounded border-l-4 border-yellow-400">
                  <p class="text-xs text-yellow-800">
                    💡 <strong>Kemungkinan penyebab:</strong><br>
                    • Data panitia belum terdaftar<br>
                    • QR Code sudah kadaluarsa<br>
                    • Data telah diubah di sistem
                  </p>
                </div>
              </div>
            `;
          } else if (response.status === 400) {
            // Bad request - QR tidak valid atau data tidak sesuai
            errorTitle = "❌ Data Tidak Valid";
            if (jsonData.message?.includes("tidak sesuai")) {
              errorMessage = "Data QR Code tidak sesuai dengan data panitia di sistem.";
              errorHtml = `
                <div class="text-center">
                  <div class="mb-3">
                    <p class="text-4xl mb-2">⚠️</p>
                    <p class="font-bold text-red-600 text-lg">Data Tidak Sesuai</p>
                    <p class="text-sm text-gray-600">${errorMessage}</p>
                  </div>
                  
                  <hr class="my-3">
                  
                  <div class="bg-red-50 p-3 rounded text-sm border-l-4 border-red-400 text-left">
                    <p class="font-semibold text-red-800 mb-2">❌ Data QR Code:</p>
                    <div class="space-y-1">
                      <p><strong>NIM:</strong> ${parsed.nim}</p>
                      <p><strong>Nama:</strong> ${parsed.nama}</p>
                      <p><strong>Divisi:</strong> ${parsed.divisi}</p>
                    </div>
                  </div>
                  
                  <div class="mt-3 bg-yellow-50 p-3 rounded border-l-4 border-yellow-400">
                    <p class="text-xs text-yellow-800">
                      💡 QR Code mungkin sudah kadaluarsa atau data telah berubah di sistem
                    </p>
                  </div>
                </div>
              `;
            } else {
              errorHtml = `
                <div class="text-center">
                  <p class="mb-2">${errorMessage}</p>
                  <div class="bg-gray-50 p-2 rounded text-sm">
                    <p><strong>Status:</strong> ${response.status}</p>
                  </div>
                </div>
              `;
            }
          } else {
            // Generic error
            errorHtml = `
              <div class="text-center">
                <p class="mb-2">${errorMessage}</p>
                <div class="bg-gray-50 p-2 rounded text-sm">
                  <p><strong>Status:</strong> ${response.status}</p>
                  <p><strong>Error Code:</strong> ${response.statusText}</p>
                </div>
              </div>
            `;
          }

          await Swal.fire({
            title: errorTitle,
            html: errorHtml,
            icon: errorIcon,
            confirmButtonText: "OK",
            timer: response.status === 403 ? 0 : 1200, // No timer untuk divisi error agar bisa dibaca
            width: response.status === 403 ? '600px' : '420px', // Lebih lebar untuk divisi error
            timerProgressBar: response.status !== 403,
            showClass: { popup: 'animate__animated animate__fadeIn animate__faster' },
            hideClass: { popup: 'animate__animated animate__fadeOut animate__faster' },
            customClass: {
              container: 'swal-divisi-error',
              popup: response.status === 403 ? 'swal-divisi-popup' : ''
            }
          });
        }

      } catch (error: any) {
        console.error("⚠️ Scan error:", error);
        await Swal.fire({
          title: "❌ Error Sistem",
          html: `
            <div class="text-center">
              <p>Terjadi kesalahan pada sistem.</p>
              <p class="text-sm text-blue-600 mt-2">Silakan coba scan ulang.</p>
            </div>
          `,
          icon: "error",
          confirmButtonText: "OK",
          timer: 800, // ULTRA FAST - 0.8s
          timerProgressBar: true,
        });
      } finally {
        // INSTANT reset
        isProcessingRef.current = false;
        lastScannedRef.current = "";
        isErrorStateRef.current = false;
        
        // FIXED: Only restart if user hasn't stopped manually and wants to continue
        if (!userStoppedRef.current) {
          autoRestartTimerRef.current = setTimeout(() => {
            if (!isScanning && selectedCamera && videoRef.current && streamRef.current) {
              startScanner();
            }
          }, 1000); // REDUCED from 300ms to 1000ms for better control
        }
      }
    },
    [
      soundEnabled,
      kid,
      rid,
      kNama,
      tgl,
      formatTanggalIndonesia,
      validateTanggalKegiatan,
      selectedCamera,
      isScanning
    ]
  );

  const startScanner = useCallback(async () => {
    if (videoRef.current && selectedCamera) {
      try {
        // FIXED: Clear user stopped state when manually starting
        userStoppedRef.current = false;
        clearAllTimers();
        
        setIsScanning(true);
        isProcessingRef.current = false;
        lastScannedRef.current = "";

        scanControlsRef.current = await scanner.current.decodeFromVideoDevice(
          selectedCamera,
          videoRef.current,
          (result, err) => {
            if (result && !isProcessingRef.current) {
              handleScan(result.getText());
            }
          }
        );
      } catch (err) {
        console.error("Scanner error:", err);
        setError("Gagal memulai scanner.");
        setIsScanning(false);
      }
    }
  }, [selectedCamera, handleScan, clearAllTimers]);

  const stopScanner = useCallback(() => {
    try {
      // FIXED: Set user stopped state
      userStoppedRef.current = true;
      clearAllTimers();
      
      if (scanControlsRef.current && scanControlsRef.current.stop) {
        scanControlsRef.current.stop();
      }
      scanControlsRef.current = null;
      setIsScanning(false);
      isProcessingRef.current = false;
      lastScannedRef.current = "";
      
      console.log("✅ Scanner stopped by user");
    } catch (err) {
      console.error("Error stopping scanner:", err);
    }
  }, [clearAllTimers]);

  useEffect(() => {
    (async () => {
      if (await getCameraPermission()) {
        await getAvailableCameras();
      }
    })();

    return () => {
      clearAllTimers();
      if (scanControlsRef.current && scanControlsRef.current.stop) {
        scanControlsRef.current.stop();
      }
      stopCamera();
    };
  }, [getCameraPermission, getAvailableCameras, stopCamera, clearAllTimers]);

  useEffect(() => {
    if (selectedCamera) {
      startCamera();
    }
  }, [selectedCamera, startCamera]);

  // FIXED: Better auto-restart logic
  useEffect(() => {
    clearAllTimers();
    
    // Only auto-start if user hasn't manually stopped and conditions are met
    if (selectedCamera && videoRef.current && !isScanning && streamRef.current && !userStoppedRef.current) {
      autoRestartTimerRef.current = setTimeout(() => {
        if (!userStoppedRef.current) {
          startScanner();
        }
      }, 1000); // INCREASED from 20ms to 1000ms for better control
    }
    
    return () => clearAllTimers();
  }, [selectedCamera, startScanner, isScanning, clearAllTimers]);

  const handleCameraChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newCamera = e.target.value;
      if (isScanning) {
        stopScanner();
      }
      setSelectedCamera(newCamera);
    },
    [isScanning, stopScanner]
  );

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col items-center">
      {!valid && (
        <div className="text-red-500 p-4 text-center">
          <p>Parameter tidak valid.</p>
          <button
            onClick={handleBackToDashboard}
            className="mt-2 px-4 py-2 bg-blue-500 rounded text-white"
          >
            Kembali ke Dashboard
          </button>
        </div>
      )}

      {error && (
        <div className="absolute top-4 bg-red-500 text-white p-4 rounded-lg z-50 max-w-md mx-4">
          <span>{error}</span>
          <button
            className="ml-4 px-2 bg-white text-black rounded"
            onClick={() => setError("")}
          >
            Tutup
          </button>
        </div>
      )}

      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        muted
        autoPlay
        playsInline
      />

      {/* Enhanced gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/40 pointer-events-none"></div>

      {/* ULTRA-ENHANCED Aim Scope with ABSENSI theme (Purple/Violet) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="relative flex items-center justify-center"
          style={{
            width: isMobile ? "75vw" : "55vw",
            height: isMobile ? "75vw" : "55vw",
            maxWidth: isMobile ? "350px" : "450px",
            maxHeight: isMobile ? "350px" : "450px",
          }}
        >
          {/* HYPER-animated crosshair with Purple theme */}
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Ultra-bright animated crosshair */}
            <div
              className="absolute left-1/2 top-0 h-full w-1 bg-gradient-to-b from-transparent via-purple-400 to-transparent opacity-90 shadow-lg animate-pulse"
              style={{ 
                transform: "translateX(-50%)",
                filter: "drop-shadow(0 0 8px #c084fc)",
                animation: "pulse 0.5s ease-in-out infinite alternate"
              }}
            />
            <div
              className="absolute top-1/2 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-90 shadow-lg animate-pulse"
              style={{ 
                transform: "translateY(-50%)",
                filter: "drop-shadow(0 0 8px #c084fc)",
                animation: "pulse 0.5s ease-in-out infinite alternate"
              }}
            />
            
            {/* HYPER-animated corner brackets with Purple theme */}
            <div className="absolute left-0 top-0 w-12 h-12 border-t-4 border-l-4 border-purple-400 rounded-tl-3xl shadow-lg animate-bounce" style={{ filter: "drop-shadow(0 0 8px #c084fc)" }} />
            <div className="absolute right-0 top-0 w-12 h-12 border-t-4 border-r-4 border-purple-400 rounded-tr-3xl shadow-lg animate-bounce" style={{ filter: "drop-shadow(0 0 8px #c084fc)" }} />
            <div className="absolute left-0 bottom-0 w-12 h-12 border-b-4 border-l-4 border-purple-400 rounded-bl-3xl shadow-lg animate-bounce" style={{ filter: "drop-shadow(0 0 8px #c084fc)" }} />
            <div className="absolute right-0 bottom-0 w-12 h-12 border-b-4 border-r-4 border-purple-400 rounded-br-3xl shadow-lg animate-bounce" style={{ filter: "drop-shadow(0 0 8px #c084fc)" }} />
            
            {/* HYPER center indicator with Purple theme */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-3 border-purple-400 bg-purple-400/40 shadow-lg animate-ping" style={{ filter: "drop-shadow(0 0 12px #c084fc)" }}></div>
              <div className="absolute w-4 h-4 rounded-full bg-purple-400 shadow-lg animate-pulse" style={{ filter: "drop-shadow(0 0 8px #c084fc)" }}></div>
            </div>
            
            {/* ULTRA outer frame with Purple theme */}
            <div className="absolute inset-0 border-3 border-purple-400/80 rounded-3xl shadow-2xl animate-pulse" style={{ filter: "drop-shadow(0 0 15px #c084fc)" }}></div>
            
            {/* HYPER scanning line animation with Purple theme */}
            {isScanning && (
              <div className="absolute inset-0 overflow-hidden rounded-3xl">
                <div className="w-full h-1 bg-gradient-to-r from-transparent via-purple-400 to-transparent animate-ultra-scan" style={{ filter: "drop-shadow(0 0 8px #c084fc)" }}></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ULTRA-FAST Status indicators */}
      {!dateValidation.isValid && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
          <div className={`px-6 py-3 rounded-xl backdrop-blur-sm border border-white/30 shadow-2xl ${
            dateValidation.isExpired 
              ? 'bg-red-500/90 text-white animate-pulse' 
              : 'bg-orange-500/90 text-white animate-pulse'
          }`}>
            <div className="text-center">
              <div className="text-3xl mb-2 animate-bounce">
                {dateValidation.isExpired ? '⏰' : '🚀'}
              </div>
              <div className="font-bold text-lg">
                {dateValidation.isExpired ? 'Kegiatan Kadaluarsa' : 'Belum Dimulai'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HYPER scanning indicator with Purple theme */}
      {isScanning && (
        <div className="absolute top-1/2 left-6 transform -translate-y-1/2 z-40">
          <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/90 rounded-full backdrop-blur-sm border border-white/30 shadow-lg animate-pulse">
            <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>
            <span className="text-white text-sm font-bold">⚡ ULTRA SCAN</span>
          </div>
        </div>
      )}

      {/* ULTRA-FAST Controls with Purple theme */}
      <div className="absolute bottom-4 flex flex-col items-center gap-4 z-40">
        <div className="flex gap-3">
          {isScanning ? (
            <button
              onClick={stopScanner}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 rounded-xl text-white font-bold shadow-lg transition-all duration-150 transform hover:scale-105"
            >
              ⏹️ Stop Scan
            </button>
          ) : (
            <button
              onClick={startScanner}
              disabled={!dateValidation.isValid}
              className={`px-6 py-3 rounded-xl text-white font-bold shadow-lg transition-all duration-150 transform hover:scale-105 ${
                dateValidation.isValid
                  ? "bg-purple-500 hover:bg-purple-600 animate-pulse"
                  : dateValidation.isExpired
                  ? "bg-red-500 cursor-not-allowed opacity-50"
                  : "bg-orange-500 cursor-not-allowed opacity-50"
              }`}
              title={
                !dateValidation.isValid
                  ? dateValidation.isExpired
                    ? "Scan tidak diizinkan - kegiatan sudah kadaluarsa"
                    : "Scan tidak diizinkan - kegiatan belum dimulai"
                  : "Mulai ULTRA-FAST scan QR untuk absensi"
              }
            >
              {dateValidation.isValid 
                ? "⚡ ULTRA-FAST SCAN ABSENSI" 
                : dateValidation.isExpired 
                ? "⏰ Kadaluarsa" 
                : "🚀 Belum Dimulai"}
            </button>
          )}
          <button
            onClick={handleBackToDashboard}
            className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded-xl text-white font-bold shadow-lg transition-all duration-150 transform hover:scale-105"
          >
            ← Kembali
          </button>
        </div>
        
        {cameras.length > 1 && (
          <select
            value={selectedCamera}
            onChange={handleCameraChange}
            className="px-4 py-2 bg-white text-black rounded-lg shadow-lg font-semibold"
          >
            {cameras.map((cam, i) => (
              <option key={i} value={cam.deviceId}>
                {cam.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        )}
        
        <label className="flex items-center gap-2 text-sm bg-black/60 px-4 py-2 rounded-lg backdrop-blur-sm">
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={(e) => setSoundEnabled(e.target.checked)}
          />
          <span>🔊 Aktifkan Suara</span>
        </label>

        {/* Return state info */}
        {returnKegiatanId && (
          <div className="text-xs bg-purple-600/60 px-3 py-1 rounded text-center backdrop-blur-sm">
            <p>Kegiatan: {returnKegiatanNama} - {returnDayName}</p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes ultra-scan {
          0% {
            transform: translateY(-100%);
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateY(${isMobile ? "350px" : "450px"});
            opacity: 0;
          }
        }
        
        .animate-ultra-scan {
          animation: ultra-scan 1s linear infinite;
        }
        
        @keyframes hyper-pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.8;
          }
        }
        
        .animate-hyper-pulse {
          animation: hyper-pulse 0.5s ease-in-out infinite;
        }
        
        @keyframes lightning-glow-purple {
          0%, 100% {
            box-shadow: 0 0 10px #c084fc, 0 0 20px #c084fc, 0 0 30px #c084fc;
          }
          50% {
            box-shadow: 0 0 20px #c084fc, 0 0 40px #c084fc, 0 0 60px #c084fc;
          }
        }
        
        .animate-lightning-glow-purple {
          animation: lightning-glow-purple 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}