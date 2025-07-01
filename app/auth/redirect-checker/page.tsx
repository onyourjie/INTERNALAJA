// File: app/auth/redirect-checker/page.tsx (Debug Version)

"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function RedirectChecker() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    const checkRedirect = async () => {
      console.log("🔍 RedirectChecker: Status =", status);
      console.log("🔍 RedirectChecker: Session =", session);
      
      if (status === "loading") {
        console.log("⏳ RedirectChecker: Still loading session...");
        return;
      }
      
      if (status === "unauthenticated") {
        console.log("❌ RedirectChecker: Unauthenticated, redirecting to login");
        router.push("/login");
        return;
      }

      if (status === "authenticated" && session?.user?.email) {
        console.log("✅ RedirectChecker: Authenticated, checking redirect...");
        setIsChecking(true);
        
        try {
          console.log("🔍 RedirectChecker: Calling /api/auth/redirect");
          
          const response = await fetch("/api/auth/redirect", {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          });

          console.log("🔍 RedirectChecker: Response status =", response.status);
          
          const data = await response.json();
          console.log("🔍 RedirectChecker: Response data =", data);
          
          setDebugInfo(data);

          if (response.ok && data.success) {
            console.log("✅ RedirectChecker: Success! Redirecting to:", data.redirectTo);
            
            // Delay sedikit untuk debugging
            setTimeout(() => {
              router.push(data.redirectTo);
            }, 2000);
          } else {
            console.log("❌ RedirectChecker: API error:", data.error);
            setError(data.error || "Failed to determine redirect");
            
            setTimeout(() => {
              router.push("/dashboard");
            }, 3000);
          }
        } catch (err) {
          console.error("❌ RedirectChecker: Fetch error:", err);
          setError("An error occurred while checking your division");
          
          setTimeout(() => {
            router.push("/dashboard");
          }, 3000);
        } finally {
          setIsChecking(false);
        }
      }
    };

    checkRedirect();
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Memeriksa session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center max-w-lg mx-auto p-6">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-6"></div>
        
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Mengarahkan ke Dashboard
        </h2>
        
        <p className="text-gray-600 mb-4">
          Sistem sedang menentukan dashboard yang sesuai dengan divisi Anda...
        </p>

        {/* Debug Info */}
        {process.env.NODE_ENV === 'development' && debugInfo && (
          <div className="mt-4 p-4 bg-gray-100 border border-gray-300 rounded-lg text-left text-sm">
            <h3 className="font-bold mb-2">Debug Info:</h3>
            <div className="space-y-1">
              <p><strong>User:</strong> {debugInfo.user?.nama}</p>
              <p><strong>Email:</strong> {debugInfo.user?.email}</p>
              <p><strong>Divisi:</strong> {debugInfo.user?.divisi}</p>
              <p><strong>Redirect To:</strong> {debugInfo.redirectTo}</p>
              <p><strong>Status:</strong> {isChecking ? 'Checking...' : 'Done'}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
            <p className="text-xs text-red-500 mt-1">
              Akan dialihkan ke dashboard default dalam beberapa detik...
            </p>
          </div>
        )}

        <div className="mt-6 text-sm text-gray-500">
          <p>Jika halaman tidak berpindah otomatis:</p>
          <div className="mt-2 space-x-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Dashboard Umum
            </button>
            <span>|</span>
            <button
              onClick={() => router.push("/login")}
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Login Ulang
            </button>
          </div>
        </div>

        {/* Force redirect button for testing */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 pt-4 border-t border-gray-300">
            <p className="text-xs text-gray-500 mb-2">Development Tools:</p>
            <div className="space-x-2">
              <button
                onClick={() => router.push("/dashboardkestari")}
                className="px-2 py-1 bg-blue-500 text-white text-xs rounded"
              >
                → KESTARI
              </button>
              <button
                onClick={() => router.push("/dashboardkonsumsi")}
                className="px-2 py-1 bg-green-500 text-white text-xs rounded"
              >
                → Konsumsi
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="px-2 py-1 bg-gray-500 text-white text-xs rounded"
              >
                → Default
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}