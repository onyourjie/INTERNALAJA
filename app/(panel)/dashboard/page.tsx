// File: app/(panel)/dashboard/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function DashboardDefault() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);

  useEffect(() => {
    const checkUserDivisiAndRedirect = async () => {
      console.log("🔍 Dashboard: Checking user divisi for redirect...");
      console.log("🔍 Session status:", status);
      console.log("🔍 Session data:", session);

      if (status === "loading") {
        console.log("⏳ Dashboard: Still loading session...");
        return;
      }

      if (status === "unauthenticated") {
        console.log("❌ Dashboard: Unauthenticated, redirecting to login");
        router.push("/login");
        return;
      }

      if (status === "authenticated" && session?.user?.email) {
        try {
          console.log("✅ Dashboard: Authenticated, checking divisi...");
          
          const response = await fetch("/api/user/session", {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          });

          console.log("🔍 Dashboard: API response status =", response.status);
          
          const data = await response.json();
          console.log("🔍 Dashboard: API response data =", data);

          if (response.ok && data.user) {
            const user = data.user;
            setUserInfo(user);
            
            console.log("📊 User Info:", {
              nama: user.nama_lengkap,
              email: user.email,
              divisi: user.divisi_nama,
              isPIT: user.isPIT
            });

            // Cek divisi dan redirect
            let shouldRedirect = false;
            let redirectPath = "/dashboard";

            switch (user.divisi_nama) {
              case "KESTARI":
                redirectPath = "/dashboardkestari";
                shouldRedirect = true;
                console.log("🎯 Dashboard: User is KESTARI, redirecting to", redirectPath);
                break;
              case "Konsumsi":
                redirectPath = "/dashboardkonsumsi";
                shouldRedirect = true;
                console.log("🎯 Dashboard: User is Konsumsi, redirecting to", redirectPath);
                break;
              case "PIT":
                shouldRedirect = false;
                console.log("🎯 Dashboard: User is PIT, staying on dashboard");
                break;
              default:
                shouldRedirect = false;
                console.log("🎯 Dashboard: User divisi:", user.divisi_nama, "- staying on dashboard");
                break;
            }

            if (shouldRedirect) {
              console.log("↪️ Dashboard: Performing redirect to:", redirectPath);
              // Delay sedikit untuk smooth transition
              setTimeout(() => {
                router.push(redirectPath);
              }, 1000);
            } else {
              setIsChecking(false);
            }
          } else {
            console.log("❌ Dashboard: Failed to get user data:", data.error);
            setError(data.error || "Failed to get user data");
            setIsChecking(false);
          }
        } catch (err) {
          console.error("❌ Dashboard: Error checking user divisi:", err);
          setError("Error checking user divisi");
          setIsChecking(false);
        }
      }
    };

    checkUserDivisiAndRedirect();
  }, [session, status, router]);

  // Loading state
  if (status === "loading" || isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-6"></div>
          
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            {status === "loading" ? "Memuat session..." : "Memeriksa divisi Anda..."}
          </h2>
          
          <p className="text-gray-600 mb-4">
            {status === "loading" 
              ? "Tunggu sebentar, sistem sedang memverifikasi login Anda."
              : "Sistem sedang menentukan dashboard yang sesuai dengan divisi Anda."
            }
          </p>

          {userInfo && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-left text-sm">
              <h3 className="font-bold mb-2 text-blue-800">Info User:</h3>
              <div className="space-y-1 text-blue-700">
                <p><strong>Nama:</strong> {userInfo.nama_lengkap}</p>
                <p><strong>Email:</strong> {userInfo.email}</p>
                <p><strong>Divisi:</strong> {userInfo.divisi_nama}</p>
                <p><strong>Jabatan:</strong> {userInfo.jabatan_nama}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.348 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          
          <h2 className="text-xl font-semibold text-red-800 mb-4">
            Terjadi Kesalahan
          </h2>
          
          <p className="text-red-600 mb-6">{error}</p>
          
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Coba Lagi
            </button>
            
            <button
              onClick={() => router.push("/login")}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Login Ulang
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default dashboard content untuk PIT dan divisi lainnya
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-blue-800">
                Dashboard Utama
              </h1>
              <p className="text-blue-600 mt-2">
                Panel Panitia RAJA Brawijaya 2025
              </p>
            </div>
            {userInfo && (
              <div className="text-right">
                <p className="text-sm text-gray-600">
                  Selamat datang, {userInfo.nama_lengkap}
                </p>
                <p className="text-xs text-gray-500">
                  {userInfo.jabatan_nama} - {userInfo.divisi_nama}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* User Info Card */}
        {userInfo && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Informasi Panitia
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Nama Lengkap:</span>
                  <span className="font-medium">{userInfo.nama_lengkap}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium">{userInfo.email}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Divisi:</span>
                  <span className="font-medium">{userInfo.divisi_nama}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Jabatan:</span>
                  <span className="font-medium">{userInfo.jabatan_nama}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Menu Utama
            </h2>
            <div className="space-y-3">
              <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-blue-50 transition-colors">
                <h3 className="font-medium text-gray-800">Kelola Kegiatan</h3>
                <p className="text-sm text-gray-600">Manajemen kegiatan dan acara</p>
              </button>
              <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-blue-50 transition-colors">
                <h3 className="font-medium text-gray-800">Laporan</h3>
                <p className="text-sm text-gray-600">Lihat dan buat laporan</p>
              </button>
              <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-blue-50 transition-colors">
                <h3 className="font-medium text-gray-800">Pengaturan</h3>
                <p className="text-sm text-gray-600">Kelola pengaturan sistem</p>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Pengumuman
            </h2>
            <div className="space-y-4">
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-medium text-gray-800">Rapat Koordinasi</h3>
                <p className="text-sm text-gray-600">Rapat mingguan setiap Senin pagi</p>
                <p className="text-xs text-gray-500">2 jam yang lalu</p>
              </div>
              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-medium text-gray-800">Update Sistem</h3>
                <p className="text-sm text-gray-600">Sistem dashboard telah diperbarui</p>
                <p className="text-xs text-gray-500">1 hari yang lalu</p>
              </div>
            </div>
          </div>
        </div>

        {/* Debug Info */}
        {process.env.NODE_ENV === 'development' && userInfo && (
          <div className="mt-8 bg-gray-100 rounded-lg p-4">
            <h3 className="font-bold text-gray-800 mb-2">Debug Info:</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>✅ User loaded successfully</p>
              <p>📊 Divisi: {userInfo.divisi_nama}</p>
              <p>🎯 No redirect needed (staying on main dashboard)</p>
              <p>🔧 If redirect not working, check console logs</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}