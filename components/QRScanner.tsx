'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Camera, Scan, CheckCircle, XCircle, AlertCircle, QrCode } from 'lucide-react'

interface QRScannerProps {
  isOpen: boolean
  onClose: () => void
  kegiatan: {
    id: number
    nama: string
  } | null
  rangkaian: {
    id: number | null
    nama: string
    tanggal: string
  } | null
  onScanSuccess?: (data: any) => void
}

export default function QRScanner({ isOpen, onClose, kegiatan, rangkaian, onScanSuccess }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)
  
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    data?: any
  } | null>(null)
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [cameraAspect, setCameraAspect] = useState<'16:9' | '9:16'>('16:9')

  // Detect orientation
  useEffect(() => {
    const checkOrientation = () => {
      const isPortrait = window.innerHeight > window.innerWidth
      setCameraAspect(isPortrait ? '9:16' : '16:9')
    }

    checkOrientation()
    window.addEventListener('resize', checkOrientation)
    window.addEventListener('orientationchange', checkOrientation)

    return () => {
      window.removeEventListener('resize', checkOrientation)
      window.removeEventListener('orientationchange', checkOrientation)
    }
  }, [])

  // Start camera
  const startCamera = async () => {
    try {
      setError('')
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: cameraAspect === '16:9' ? 1920 : 1080 },
          height: { ideal: cameraAspect === '16:9' ? 1080 : 1920 }
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setScanning(true)
        scanQRCode()
      }
    } catch (err) {
      console.error('Camera error:', err)
      setError('Tidak dapat mengakses kamera. Pastikan browser memiliki izin kamera.')
    }
  }

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    setScanning(false)
  }, [])

  // QR Code scanner logic using Canvas API
  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current || !scanning) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const scan = () => {
      if (!scanning || isProcessing) {
        return
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)

      // Try to decode QR code from image
      // Note: In production, you'd use a proper QR library like qr-scanner or jsQR
      // For this implementation, we'll simulate QR detection
      detectQRCode(imageData).then(qrData => {
        if (qrData && !isProcessing) {
          handleQRDetected(qrData)
        }
      })

      animationRef.current = requestAnimationFrame(scan)
    }

    scan()
  }

  // Simulate QR detection (replace with actual QR library)
  const detectQRCode = async (imageData: ImageData): Promise<string | null> => {
    // In production, use a library like jsQR:
    // const code = jsQR(imageData.data, imageData.width, imageData.height)
    // return code ? code.data : null

    // For demo purposes, detect if user shows a specific pattern
    // This is where you'd integrate with an actual QR scanning library
    return null
  }

  // Handle detected QR code
  const handleQRDetected = async (qrData: string) => {
    if (isProcessing) return

    setIsProcessing(true)
    stopCamera()

    try {
      // Validate QR data format
      let parsedData
      try {
        parsedData = JSON.parse(qrData)
      } catch {
        throw new Error('Format QR Code tidak valid')
      }

      if (!kegiatan?.id) {
        throw new Error('Silakan pilih kegiatan terlebih dahulu')
      }

      // Call API
      const response = await fetch('/api/absensi/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          qr_data: qrData,
          kegiatan_id: kegiatan.id,
          kegiatan_rangkaian_id: rangkaian?.id || null,
          koordinat_lat: null, // Could get from geolocation
          koordinat_lng: null
        })
      })

      const result = await response.json()

      if (result.success) {
        setResult({
          success: true,
          message: result.message,
          data: result.data
        })
        
        if (onScanSuccess) {
          onScanSuccess(result.data)
        }

        // Auto close after 3 seconds
        setTimeout(() => {
          onClose()
        }, 3000)
      } else {
        setResult({
          success: false,
          message: result.message
        })
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || 'Terjadi kesalahan saat memproses QR Code'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Initialize camera when opened
  useEffect(() => {
    if (isOpen && kegiatan && rangkaian) {
      startCamera()
    }

    return () => {
      stopCamera()
    }
  }, [isOpen, kegiatan, rangkaian, stopCamera])

  if (!isOpen) return null

  // Validation check
  if (!kegiatan || !rangkaian) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 max-w-md mx-4">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <AlertCircle size={24} />
            <h3 className="text-lg font-semibold">Perhatian</h3>
          </div>
          <p className="text-gray-700 mb-6">
            Silakan pilih kegiatan dan hari terlebih dahulu sebelum melakukan scan QR Code.
          </p>
          <button
            onClick={onClose}
            className="w-full bg-teal-600 text-white py-3 rounded-lg font-medium hover:bg-teal-700"
          >
            Tutup
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4">
        <div className="flex items-center justify-between text-white">
          <div>
            <h2 className="text-xl font-bold">{kegiatan.nama}</h2>
            <p className="text-sm opacity-90">{rangkaian.nama}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Camera View */}
      <div className="relative w-full h-full flex items-center justify-center">
        {error ? (
          <div className="text-center p-8">
            <div className="bg-red-100 text-red-800 rounded-lg p-6 max-w-md">
              <XCircle size={48} className="mx-auto mb-4" />
              <p className="font-medium">{error}</p>
              <button
                onClick={() => {
                  setError('')
                  startCamera()
                }}
                className="mt-4 bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700"
              >
                Coba Lagi
              </button>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            <canvas
              ref={canvasRef}
              className="hidden"
            />

            {/* Scan overlay */}
            {scanning && !result && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Darkened corners */}
                <div className="absolute inset-0 bg-black/50" />
                
                {/* Scan area */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72">
                  <div className="relative w-full h-full">
                    {/* Clear center */}
                    <div className="absolute inset-0 bg-black" style={{ mixBlendMode: 'destination-out' }} />
                    
                    {/* Corner markers */}
                    <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-white rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-white rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-white rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-white rounded-br-lg" />
                    
                    {/* Scanning line animation */}
                    <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-green-400 to-transparent animate-scan" />
                  </div>
                </div>

                {/* Instructions */}
                <div className="absolute bottom-20 left-0 right-0 text-center">
                  <div className="bg-black/70 text-white px-6 py-3 rounded-full inline-flex items-center gap-2">
                    <Scan size={20} />
                    <span>Arahkan QR Code ke area scan</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Result Modal */}
      {result && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4">
          <div className={`bg-white rounded-lg p-8 max-w-md w-full ${result.success ? 'border-t-4 border-green-500' : 'border-t-4 border-red-500'}`}>
            <div className="text-center">
              {result.success ? (
                <CheckCircle size={64} className="mx-auto mb-4 text-green-500" />
              ) : (
                <XCircle size={64} className="mx-auto mb-4 text-red-500" />
              )}
              
              <h3 className={`text-xl font-bold mb-2 ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                {result.success ? 'Absensi Berhasil!' : 'Absensi Gagal'}
              </h3>
              
              <p className="text-gray-700 mb-4">{result.message}</p>
              
              {result.data && (
                <div className="bg-gray-50 rounded-lg p-4 text-left space-y-2 text-sm">
                  <div><span className="font-medium">Nama:</span> {result.data.panitia_nama}</div>
                  <div><span className="font-medium">NIM:</span> {result.data.nim}</div>
                  <div><span className="font-medium">Divisi:</span> {result.data.divisi}</div>
                  <div><span className="font-medium">Waktu:</span> {new Date(result.data.waktu_absensi).toLocaleTimeString('id-ID')}</div>
                </div>
              )}
              
              <button
                onClick={() => {
                  setResult(null)
                  if (result.success) {
                    onClose()
                  } else {
                    startCamera()
                  }
                }}
                className={`mt-6 px-6 py-3 rounded-lg font-medium w-full ${
                  result.success 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {result.success ? 'Tutup' : 'Scan Ulang'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isProcessing && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
            <p className="text-gray-700">Memproses absensi...</p>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(300px); }
        }
        
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}