// File: hooks/useDivisiRedirect.ts

'use client'

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface DivisiRedirectData {
  hasAccess: boolean;
  loading: boolean;
  redirectPath: string;
  dashboardType: 'kestari' | 'konsumsi' | 'default';
  panitiaData: {
    id: number;
    nama_lengkap: string;
    email: string;
    divisi_id: number;
    jabatan_id: number;
    divisi_nama: string;
    jabatan_nama: string;
  } | null;
  error?: string;
}

interface UseDivisiRedirectOptions {
  autoRedirect?: boolean;
  redirectDelay?: number;
}

export function useDivisiRedirect(options: UseDivisiRedirectOptions = {}) {
  const { autoRedirect = true, redirectDelay = 1500 } = options;
  
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [redirectData, setRedirectData] = useState<DivisiRedirectData>({
    hasAccess: false,
    loading: true,
    redirectPath: '/dashboard',
    dashboardType: 'default',
    panitiaData: null
  });

  const checkDivisiAccess = useCallback(async () => {
    console.log('🔍 Checking divisi access...');
    
    // Wait for session to load
    if (status === "loading") {
      console.log("⏳ Session still loading...");
      return;
    }
    
    // Handle unauthenticated
    if (status === "unauthenticated" || !session?.user?.email) {
      console.log("❌ Not authenticated");
      setRedirectData({
        hasAccess: false,
        loading: false,
        redirectPath: '/',
        dashboardType: 'default',
        panitiaData: null,
        error: 'Not authenticated'
      });
      
      if (autoRedirect) {
        router.push('/');
      }
      return;
    }

    try {
      console.log('🔍 Making divisi access request for:', session.user.email);
      
      const response = await fetch('/api/panitiapeserta/divisi-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: session.user.email }),
      });

      const result = await response.json();
      console.log('📊 Divisi access result:', result);

      if (response.ok && result.hasAccess) {
        setRedirectData({
          hasAccess: true,
          loading: false,
          redirectPath: result.redirectPath,
          dashboardType: result.dashboardType,
          panitiaData: result.panitiaData
        });
        
        console.log(`✅ Access granted - Dashboard: ${result.dashboardType}, Path: ${result.redirectPath}`);
        
        // Auto redirect if enabled
        if (autoRedirect) {
          console.log(`🚀 Auto-redirecting to ${result.redirectPath} in ${redirectDelay}ms`);
          setTimeout(() => {
            router.push(result.redirectPath);
          }, redirectDelay);
        }
        
      } else {
        console.log('❌ Access denied:', result.error);
        
        setRedirectData({
          hasAccess: false,
          loading: false,
          redirectPath: result.redirectPath || '/dashboard',
          dashboardType: 'default',
          panitiaData: null,
          error: result.error || 'Access denied'
        });
        
        if (autoRedirect) {
          router.push(result.redirectPath || '/dashboard');
        }
      }
    } catch (error: any) {
      console.error('💥 Error checking divisi access:', error);
      
      setRedirectData({
        hasAccess: false,
        loading: false,
        redirectPath: '/dashboard',
        dashboardType: 'default',
        panitiaData: null,
        error: `Network error: ${error.message}`
      });
      
      if (autoRedirect) {
        router.push('/dashboard');
      }
    }
  }, [session, status, router, autoRedirect, redirectDelay]);

  // Manual redirect function
  const performRedirect = useCallback(() => {
    if (redirectData.redirectPath) {
      console.log(`🚀 Manual redirect to: ${redirectData.redirectPath}`);
      router.push(redirectData.redirectPath);
    }
  }, [redirectData.redirectPath, router]);

  useEffect(() => {
    checkDivisiAccess();
  }, [checkDivisiAccess]);

  return {
    ...redirectData,
    performRedirect,
    refresh: checkDivisiAccess
  };
}

// Hook tanpa auto-redirect untuk conditional checks
export function useDivisiCheck() {
  return useDivisiRedirect({ autoRedirect: false });
}