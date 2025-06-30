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

export default function QRScannerKonsumsiPage() {
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
    console.log("🚀 ULTRA-FAST QR Scanner initialized:", {
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
  const autoRestartTimerRef = useRef<NodeJS.Timeout | null>(null); // FIXED: Timer reference
  const userStoppedRef = useRef(false); // FIXED: Track user intention to stop

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

  // FIXED: Clear all timers
  const clearAllTimers = useCallback(() => {
    if (autoRestartTimerRef.current) {
      clearTimeout(autoRestartTimerRef.current);
      autoRestartTimerRef.current = null;
    }
  }, []);

  // Enhanced Back to Dashboard with State Restoration
  const handleBackToDashboard = () => {
    console.log('🔙 Returning to konsumsi dashboard with state restoration...');
    
    const dashboardUrl = new URL('/dashboardkonsumsi', window.location.origin);
    
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
      
      console.log('✅ Konsumsi state restoration URL:', dashboardUrl.toString());
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
      return tanggal;
    }
  }, []);

  const validateTanggalKegiatan = useCallback(() => {
    try {
      const today = new Date();
      const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayISO = todayLocal.toISOString().split("T")[0];
      const kegiatanDateStr = tgl || "";
      let kegiatanISO = "";
      if (kegiatanDateStr) {
        const kegiatanDate = new Date(kegiatanDateStr);
        const kegiatanLocal = new Date(kegiatanDate.getFullYear(), kegiatanDate.getMonth(), kegiatanDate.getDate());
        kegiatanISO = kegiatanLocal.toISOString().split("T")[0];
      }
      
      const isValid = todayISO === kegiatanISO;
      const isExpired = kegiatanISO < todayISO;
      const isFuture = kegiatanISO > todayISO;
      
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
        kegiatanFormatted: formatTanggalIndonesia(kegiatanISO || kegiatanDateStr),
      };
    } catch {
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

  // ULTRA-FAST API with caching
  const getPanitiaIdByNim = useCallback(async (nim: string) => {
    const cacheKey = `panitia_${nim}`;
    if (processingCacheRef.current.has(cacheKey)) {
      return processingCacheRef.current.get(cacheKey);
    }
    
    try {
      const res = await fetch(`/api/panitia/by-nim?nim=${encodeURIComponent(nim)}`);
      if (!res.ok) {
        console.log(`Panitia API error: ${res.status} ${res.statusText}`);
        return null;
      }
      const data = await res.json();
      console.log(`Panitia API response for ${nim}:`, data);
      
      const panitiaId = data?.data?.panitia_id || data?.panitia_id || null;
      processingCacheRef.current.set(cacheKey, panitiaId); // CACHE RESULT
      return panitiaId;
    } catch (error) {
      console.error('Error getting panitia by NIM:', error);
      return null;
    }
  }, []);

  // ULTRA-FAST konsumsi status with caching
  const getKonsumsiStatus = useCallback(async (nim: string) => {
    const cacheKey = `konsumsi_${nim}_${kid}_${tgl}_${rid}`;
    if (processingCacheRef.current.has(cacheKey)) {
      return processingCacheRef.current.get(cacheKey);
    }
    
    try {
      const panitiaId = await getPanitiaIdByNim(nim);
      if (!panitiaId) {
        console.log(`Panitia ID not found for NIM: ${nim}`);
        return 0;
      }
      
      const params = new URLSearchParams({
        panitia_id: String(panitiaId),
        kegiatan_id: String(kid ?? ''),
        tanggal: String(tgl ?? ''),
      });
      if (rid) params.append('kegiatan_rangkaian_id', String(rid));
      
      const res = await fetch(`/api/konsumsi/status?${params.toString()}`);
      if (!res.ok) {
        console.log(`Konsumsi status API error: ${res.status} ${res.statusText}`);
        return 0;
      }
      
      const data = await res.json();
      console.log(`Konsumsi status for NIM ${nim}:`, data);
      
      const status = typeof data.status === 'number' ? data.status : 0;
      processingCacheRef.current.set(cacheKey, status); // CACHE RESULT
      return status;
    } catch (error) {
      console.error('Error getting konsumsi status:', error);
      return 0;
    }
  }, [kid, tgl, rid, getPanitiaIdByNim]);

  // HYPER-FAST handleScan with EXTREME optimizations
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
        let alertTitle = "❌ Konsumsi Tidak Diizinkan";
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
        
        // ULTRA-FAST QR parsing
        let parsed: { nama: string; nim: string; divisi: string };
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

        // HYPER-FAST KONSUMSI LOGIC
        const nim = parsed.nim;
        
        const currentKonsumsiStatus = await getKonsumsiStatus(nim);
        console.log(`⚡ ULTRA-FAST konsumsi status for ${nim}: ${currentKonsumsiStatus}`);
        
        if (currentKonsumsiStatus >= 2) {
          await Swal.fire({
            title: "❌ Maksimum Konsumsi Tercapai",
            html: `<div class='text-center'>
              <p class='text-lg font-bold text-red-500'>Konsumsi sudah diambil 2 kali!</p>
              <hr class='my-2'>
              <p><strong>Nama:</strong> ${parsed.nama}</p>
              <p><strong>NIM:</strong> ${nim}</p>
              <p><strong>Divisi:</strong> ${parsed.divisi}</p>
            </div>`,
            icon: "error",
            confirmButtonText: "OK",
            timer: 2000, // ULTRA FAST - 0.8s
            timerProgressBar: true,
          });
          
          isProcessingRef.current = false;
          lastScannedRef.current = "";
          return;
        }

        const nextKonsumsiNumber = currentKonsumsiStatus + 1;
        const konsumsiLabel = nextKonsumsiNumber === 1 ? "Konsumsi 1" : "Konsumsi 2";
        const jenis_konsumsi = nextKonsumsiNumber === 1 ? "konsumsi_1" : "konsumsi_2";
        
        const statusDisplay = nextKonsumsiNumber === 1 
          ? "Belum ada konsumsi" 
          : "Konsumsi 1 ✅";

        const confirm = await Swal.fire({
          title: `⚡ Konfirmasi ${konsumsiLabel}`,
          html: `
            <div class="text-left">
              <p><strong>Nama:</strong> ${parsed.nama}</p>
              <p><strong>NIM:</strong> ${parsed.nim}</p>
              <p><strong>Divisi:</strong> ${parsed.divisi}</p>
              <hr class="my-2">
              <p><strong>Status:</strong> ${statusDisplay}</p>
              <p><strong>Akan dicatat:</strong> <span class="font-bold text-green-600">${konsumsiLabel}</span></p>
              <p class="text-xs text-blue-500 mt-1">💡 Tekan Enter untuk konfirmasi</p>
            </div>
          `,
          icon: "question",
          showCancelButton: true,
          confirmButtonText: `✅ ${konsumsiLabel}`,
          cancelButtonText: "❌ Batal",
          allowOutsideClick: false,
          confirmButtonColor: nextKonsumsiNumber === 1 ? "#22c55e" : "#f59e0b",
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
          isErrorStateRef.current = false;
          
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
          title: `⚡ Memproses ${konsumsiLabel}...`,
          html: `Lightning fast processing...`,
          allowOutsideClick: false,
          showConfirmButton: false,
          timer: 500, // AUTO-CLOSE after 0.5s if API is fast
          didOpen: () => {
            Swal.showLoading();
          },
        });

        const requestBody = {
          qr_data: result,
          kegiatan_id: Number(kid),
          kegiatan_rangkaian_id: rid ? Number(rid) : null,
          jenis_konsumsi: jenis_konsumsi,
          tanggal: tgl,
        };
        
        console.log('⚡ ULTRA-FAST API request:', requestBody);
        console.log(`🚀 Lightning konsumsi: ${konsumsiLabel} for NIM: ${nim}`);
        
        // PARALLEL API call with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
        
        const response = await fetch("/api/konsumsi/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        let jsonData;
        try {
          jsonData = await response.json();
        } catch (parseError) {
          console.error('⚠️ Failed to parse response JSON:', parseError);
          
          await Swal.fire({
            title: "❌ Response Error",
            text: "Server error. Silakan coba lagi.",
            icon: "error",
            confirmButtonText: "OK",
            timer: 800, // ULTRA FAST - 0.8s
            timerProgressBar: true,
          });
          
          isProcessingRef.current = false;
          lastScannedRef.current = "";
          return;
        }

        console.log('✅ LIGHTNING API Response:', jsonData);

        if (jsonData.success) {
          beep(true);
          
          const responseData = jsonData.data;
          const konsumsi = responseData?.konsumsi || {};
          
          // INVALIDATE CACHE after successful scan
          processingCacheRef.current.delete(`konsumsi_${nim}_${kid}_${tgl}_${rid}`);
          
          await Swal.fire({
            title: `🎉 ${konsumsiLabel} Berhasil!`,
            html: `
              <div class="text-center">
                <p class="text-green-600 font-bold text-lg mb-2">⚡ ${konsumsiLabel} berhasil dicatat!</p>
                <hr class="my-2">
                <div class="text-left bg-gray-50 p-2 rounded text-sm">
                  <p><strong>Nama:</strong> ${responseData?.panitia?.nama || parsed.nama}</p>
                  <p><strong>NIM:</strong> ${responseData?.panitia?.nim || nim}</p>
                  <p><strong>Divisi:</strong> ${responseData?.panitia?.divisi || parsed.divisi}</p>
                </div>
                <hr class="my-2">
                <div class="text-sm">
                  <p class="text-green-600">
                    ${konsumsi.konsumsi_lengkap ? 'Konsumsi 1 ✅ | Konsumsi 2 ✅' : (nextKonsumsiNumber === 1 ? 'Konsumsi 1 ✅' : 'Konsumsi 1 ✅ | Konsumsi 2 ✅')}
                  </p>
                  ${konsumsi.konsumsi_lengkap ? '<p class="text-orange-600 font-bold mt-1">🎉 Konsumsi Lengkap!</p>' : '<p class="text-blue-600 mt-1">💡 Bisa scan lagi</p>'}
                </div>
              </div>
            `,
            icon: "success",
            confirmButtonText: "OK",
            timer: konsumsi.konsumsi_lengkap ? 900 : 700, // ULTRA FAST - 0.9s/0.7s
            timerProgressBar: true,
            showClass: { popup: 'animate__animated animate__bounceIn animate__faster' },
            hideClass: { popup: 'animate__animated animate__fadeOut animate__faster' }
          });
        } else {
          // ULTRA-FAST error handling
          console.log('❌ API returned error:', {
            status: response.status,
            success: jsonData.success,
            message: jsonData.message,
            data: jsonData.data
          });
          
          let errorTitle = "❌ Gagal Menyimpan Konsumsi";
          let errorMessage = jsonData.message || "Terjadi kesalahan saat menyimpan data konsumsi.";
          let errorIcon: 'error' | 'warning' = 'error';
          let errorHtml = '';
          
          if (response.status === 403) {
            errorTitle = "🚫 Divisi Tidak Diizinkan";
            errorIcon = 'warning';
            
            if (jsonData.data?.divisi_yang_diizinkan) {
              const allowedDivisi = jsonData.data.divisi_yang_diizinkan;
              
              errorHtml = `
                <div class="text-left">
                  <p class="mb-2 text-center font-semibold">${errorMessage}</p>
                  <hr class="my-2">
                  <div class="bg-gray-50 p-2 rounded mb-2 text-sm">
                    <p><strong>Panitia:</strong> ${parsed.nama}</p>
                    <p><strong>Divisi:</strong> <span class="text-red-600 font-bold">${parsed.divisi}</span></p>
                  </div>
                  <div class="bg-blue-50 p-2 rounded text-sm">
                    <p class="font-semibold text-blue-800 mb-1">📋 Divisi Diizinkan:</p>
                    ${allowedDivisi.slice(0, 3).map((d: any) => `<p>• ${d.nama}</p>`).join('')}
                    ${allowedDivisi.length > 3 ? `<p class="text-gray-600">+ ${allowedDivisi.length - 3} lainnya</p>` : ''}
                  </div>
                </div>
              `;
            }
          } else if (response.status === 409) {
            errorTitle = "🚫 Konsumsi Ditolak";
            errorIcon = 'warning';
            
            if (jsonData.message?.includes("MAKSIMUM")) {
              errorTitle = "❌ Maksimum Tercapai";
            } else if (jsonData.message?.includes("SUDAH")) {
              errorTitle = "❌ Sudah Diambil";
            }
            
            errorHtml = `
              <div class="text-center">
                <p class="mb-2 font-semibold">${errorMessage}</p>
                <div class="bg-gray-50 p-2 rounded text-sm">
                  <p><strong>Nama:</strong> ${parsed.nama}</p>
                  <p><strong>NIM:</strong> ${nim}</p>
                </div>
              </div>
            `;
          } else if (response.status === 404) {
            errorTitle = "❌ Panitia Tidak Ditemukan";
            errorHtml = `
              <div class="text-center">
                <p class="mb-2">${errorMessage}</p>
                <div class="bg-gray-50 p-2 rounded text-sm">
                  <p><strong>NIM:</strong> ${nim}</p>
                  <p><strong>Nama:</strong> ${parsed.nama}</p>
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

          await Swal.fire({
            title: errorTitle,
            html: errorHtml || `<div class="text-center"><p>${errorMessage}</p></div>`,
            icon: errorIcon,
            confirmButtonText: "OK",
            timer: 900, // ULTRA FAST - 0.9s
            width: '420px',
            timerProgressBar: true,
            showClass: { popup: 'animate__animated animate__fadeIn animate__faster' },
            hideClass: { popup: 'animate__animated animate__fadeOut animate__faster' }
          });
        }

      } catch (error) {
        console.error('⚠️ Scan error:', error);
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
    [soundEnabled, kid, rid, kNama, tgl, formatTanggalIndonesia, validateTanggalKegiatan, getKonsumsiStatus, selectedCamera, isScanning]
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
          (result) => {
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

      {/* ULTRA-ENHANCED Aim Scope with HYPER animations */}
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
          {/* HYPER-animated crosshair */}
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Ultra-bright animated crosshair */}
            <div
              className="absolute left-1/2 top-0 h-full w-1 bg-gradient-to-b from-transparent via-cyan-400 to-transparent opacity-90 shadow-lg animate-pulse"
              style={{ 
                transform: "translateX(-50%)",
                filter: "drop-shadow(0 0 8px #22d3ee)",
                animation: "pulse 0.5s ease-in-out infinite alternate"
              }}
            />
            <div
              className="absolute top-1/2 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-90 shadow-lg animate-pulse"
              style={{ 
                transform: "translateY(-50%)",
                filter: "drop-shadow(0 0 8px #22d3ee)",
                animation: "pulse 0.5s ease-in-out infinite alternate"
              }}
            />
            
            {/* HYPER-animated corner brackets */}
            <div className="absolute left-0 top-0 w-12 h-12 border-t-4 border-l-4 border-cyan-400 rounded-tl-3xl shadow-lg animate-bounce" style={{ filter: "drop-shadow(0 0 8px #22d3ee)" }} />
            <div className="absolute right-0 top-0 w-12 h-12 border-t-4 border-r-4 border-cyan-400 rounded-tr-3xl shadow-lg animate-bounce" style={{ filter: "drop-shadow(0 0 8px #22d3ee)" }} />
            <div className="absolute left-0 bottom-0 w-12 h-12 border-b-4 border-l-4 border-cyan-400 rounded-bl-3xl shadow-lg animate-bounce" style={{ filter: "drop-shadow(0 0 8px #22d3ee)" }} />
            <div className="absolute right-0 bottom-0 w-12 h-12 border-b-4 border-r-4 border-cyan-400 rounded-br-3xl shadow-lg animate-bounce" style={{ filter: "drop-shadow(0 0 8px #22d3ee)" }} />
            
            {/* HYPER center indicator */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-3 border-cyan-400 bg-cyan-400/40 shadow-lg animate-ping" style={{ filter: "drop-shadow(0 0 12px #22d3ee)" }}></div>
              <div className="absolute w-4 h-4 rounded-full bg-cyan-400 shadow-lg animate-pulse" style={{ filter: "drop-shadow(0 0 8px #22d3ee)" }}></div>
            </div>
            
            {/* ULTRA outer frame */}
            <div className="absolute inset-0 border-3 border-cyan-400/80 rounded-3xl shadow-2xl animate-pulse" style={{ filter: "drop-shadow(0 0 15px #22d3ee)" }}></div>
            
            {/* HYPER scanning line animation */}
            {isScanning && (
              <div className="absolute inset-0 overflow-hidden rounded-3xl">
                <div className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-ultra-scan" style={{ filter: "drop-shadow(0 0 8px #22d3ee)" }}></div>
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

      {/* HYPER scanning indicator */}
      {isScanning && (
        <div className="absolute top-1/2 left-6 transform -translate-y-1/2 z-40">
          <div className="flex items-center gap-2 px-4 py-2 bg-cyan-500/90 rounded-full backdrop-blur-sm border border-white/30 shadow-lg animate-pulse">
            <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>
            <span className="text-white text-sm font-bold">⚡ ULTRA SCAN</span>
          </div>
        </div>
      )}

      {/* ULTRA-FAST Controls */}
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
                  ? "bg-cyan-500 hover:bg-cyan-600 animate-pulse"
                  : dateValidation.isExpired
                  ? "bg-red-500 cursor-not-allowed opacity-50"
                  : "bg-orange-500 cursor-not-allowed opacity-50"
              }`}
              title={
                !dateValidation.isValid
                  ? dateValidation.isExpired
                    ? "Scan tidak diizinkan - kegiatan sudah kadaluarsa"
                    : "Scan tidak diizinkan - kegiatan belum dimulai"
                  : "Mulai ULTRA-FAST scan QR untuk konsumsi"
              }
            >
              {dateValidation.isValid 
                ? "⚡ ULTRA-FAST SCAN" 
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
          <div className="text-xs bg-cyan-600/60 px-3 py-1 rounded text-center backdrop-blur-sm">
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
        
        @keyframes lightning-glow {
          0%, 100% {
            box-shadow: 0 0 10px #22d3ee, 0 0 20px #22d3ee, 0 0 30px #22d3ee;
          }
          50% {
            box-shadow: 0 0 20px #22d3ee, 0 0 40px #22d3ee, 0 0 60px #22d3ee;
          }
        }
        
        .animate-lightning-glow {
          animation: lightning-glow 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}