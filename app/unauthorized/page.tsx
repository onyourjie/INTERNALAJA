'use client'

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function UnauthorizedPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState('');

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Function to clear all cookies
  const clearAllCookies = useCallback(() => {
    // Get all cookies
    const cookies = document.cookie.split(";");
    
    // Clear each cookie
    cookies.forEach(cookie => {
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      
      if (name) {
        // Clear for current domain
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname};`;
        
        // Clear for parent domain (if subdomain)
        const domainParts = window.location.hostname.split('.');
        if (domainParts.length > 1) {
          const parentDomain = '.' + domainParts.slice(-2).join('.');
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${parentDomain};`;
        }
        
        // Clear for localhost variations
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=localhost;`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.localhost;`;
      }
    });
    
    console.log('🍪 All cookies cleared');
  }, []);

  // Function to clear all storage
  const clearAllStorage = useCallback(() => {
    try {
      // Clear localStorage
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
        console.log('💾 localStorage cleared');
      }
      
      // Clear sessionStorage
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.clear();
        console.log('💾 sessionStorage cleared');
      }
    } catch (error) {
      console.warn('⚠️ Could not clear storage:', error);
    }
  }, []);

  // Complete logout function
  const handleCompleteLogout = useCallback(async () => {
    if (isLoggingOut) return;
    
    try {
      setIsLoggingOut(true);
      setLogoutMessage('Memproses logout...');
      console.log('🚪 Starting normal logout...');
      
      // 1. Sign out from NextAuth first
      setLogoutMessage('Menghapus sesi...');
      await signOut({ 
        redirect: false,
        callbackUrl: '/' 
      });
      
      // 2. Clear cookies
      setLogoutMessage('Membersihkan cookies...');
      clearAllCookies();
      
      // 3. Clear storage (minimal)
      setLogoutMessage('Membersihkan cache...');
      try {
        window.sessionStorage.removeItem('pit-access-cache');
        window.localStorage.removeItem('last-login');
      } catch (e) {
        console.warn('Could not clear some cache items');
      }
      
      setLogoutMessage('Logout berhasil! Mengarahkan...');
      console.log('✅ Normal logout completed');
      
      // 4. Redirect after short delay
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
      
    } catch (error) {
      console.error('❌ Logout error:', error);
      setLogoutMessage('Error! Menggunakan force logout...');
      // Fallback to force logout
      setTimeout(() => handleForceLogout(), 1000);
    }
  }, [isLoggingOut, clearAllCookies]);

  // Force logout function - nuclear option
  const handleForceLogout = useCallback(() => {
    console.log('🔥 FORCE LOGOUT - Clearing everything...');
    setLogoutMessage('Force logout - Menghapus SEMUA data...');
    
    try {
      // 1. Clear ALL storage immediately
      clearAllStorage();
      
      // 2. Clear ALL cookies
      clearAllCookies();
      
      // 3. Clear browser cache items
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            caches.delete(name);
          });
        });
      }
      
      // 4. Clear any IndexedDB (if used)
      if ('indexedDB' in window) {
        try {
          const deleteReq = indexedDB.deleteDatabase('keyval-store');
          deleteReq.onsuccess = () => console.log('IndexedDB cleared');
        } catch (e) {
          console.warn('Could not clear IndexedDB');
        }
      }
      
      // 5. Clear service worker cache (if any)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(registration => {
            registration.unregister();
          });
        });
      }
      
      console.log('🧹 Everything cleared - redirecting...');
      setLogoutMessage('Semua data dihapus! Mengarahkan...');
      
      // 6. Nuclear redirect - replace current page
      setTimeout(() => {
        window.location.replace('/');
      }, 1000);
      
    } catch (error) {
      console.error('Error during force logout:', error);
      // Ultimate fallback
      window.location.href = '/';
    }
  }, [clearAllStorage, clearAllCookies]);

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

        {/* Session info */}
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
        {(!mounted || status === "loading") && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4 mx-auto"></div>
            </div>
          </div>
        )}

        {/* Logout loading state dengan progress message */}
        {isLoggingOut && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center space-x-3">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
              <div className="text-center">
                <p className="text-sm font-medium text-blue-600">Sedang Logout...</p>
                {logoutMessage && (
                  <p className="text-xs text-blue-500 mt-1">{logoutMessage}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Navigation Option */}
          <Link
            href="/dashboard"
            className="block w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Kembali ke Dashboard
          </Link>
          
          {/* Logout Options */}
          <div className="border-t pt-4">
            <p className="text-xs text-gray-500 mb-3 text-center">
              Pilih metode logout:
            </p>
            
            <div className="grid grid-cols-1 gap-3">
              {/* Quick Logout */}
              <button
                onClick={handleCompleteLogout}
                disabled={isLoggingOut}
                className="w-full bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium relative overflow-hidden"
              >
                <div className="flex items-center justify-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>
                    {isLoggingOut ? 'Logging out...' : 'Logout'}
                  </span>
                </div>
                <p className="text-xs mt-1 opacity-90">
                  Logout dan hapus cookies
                </p>
              </button>

              {/* Force Logout */}
              {/* <button
                onClick={handleForceLogout}
                disabled={isLoggingOut}
                className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium relative overflow-hidden"
              >
                <div className="flex items-center justify-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Force Logout</span>
                </div>
                <p className="text-xs mt-1 opacity-90">
                  Hapus SEMUA data + cookies + storage
                </p>
              </button> */}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-3">
            Jika Anda merasa ini adalah kesalahan, silakan hubungi administrator.
          </p>
        </div>
      </div>
    </div>
  );
}