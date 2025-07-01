// File: app/unauthorized/page.tsx (Fixed version - no metadata export)

'use client'

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export default function UnauthorizedPage() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch - always render consistently
  useEffect(() => {
    setMounted(true);
  }, []);

  // Always render the same structure, just change content
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Akses Ditolak
          </h1>
          <p className="text-gray-600 mb-4">
            Maaf, Anda tidak memiliki akses ke halaman ini.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Panel Panitia hanya dapat diakses oleh anggota divisi PIT.
          </p>
        </div>

        {/* Render session info only when mounted and session exists */}
        {mounted && status !== "loading" && session?.user && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600">
              Anda login sebagai: <br />
              <span className="font-semibold">{session.user.email}</span>
            </p>
            {session.user.name && (
              <p className="text-xs text-gray-500 mt-1">
                {session.user.name}
              </p>
            )}
          </div>
        )}

        {/* Loading state */}
        {!mounted || status === "loading" ? (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4 mx-auto"></div>
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          <Link
            href="/dashboard"
            className="block w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Kembali ke Dashboard
          </Link>
          
          <Link
            href="/"
            className="block w-full bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Logout
          </Link>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Jika Anda merasa ini adalah kesalahan, silakan hubungi administrator.
          </p>
        </div>
      </div>
    </div>
  );
}