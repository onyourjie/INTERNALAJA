// File: hooks/usePITAccess.ts (Stable version - no conditional hooks)

'use client'

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

interface PITAccessData {
  hasAccess: boolean;
  loading: boolean;
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
  retryCount: number;
}

interface UsePITAccessOptions {
  redirectOnDenied?: boolean;
  unauthorizedRedirectUrl?: string;
  maxRetries?: number;
  retryDelay?: number;
}

export function usePITAccess(options: UsePITAccessOptions = {}): PITAccessData & { retry: () => void } {
  // Always call hooks in the same order - no conditional hooks
  const { data: session, status } = useSession();
  const router = useRouter();
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Extract options with defaults - always the same
  const redirectOnDenied = options.redirectOnDenied ?? true;
  const unauthorizedRedirectUrl = options.unauthorizedRedirectUrl ?? '/unauthorized';
  const maxRetries = options.maxRetries ?? 3;
  const retryDelay = options.retryDelay ?? 2000;
  
  // Always initialize state the same way
  const [accessData, setAccessData] = useState<PITAccessData>({
    hasAccess: false,
    loading: true,
    panitiaData: null,
    retryCount: 0
  });

  // Always define callback - no conditional definition
  const checkPITAccess = useCallback(async (retryCount = 0) => {
    console.log(`🔍 Checking PIT access (attempt ${retryCount + 1})`);
    
    // Clear any existing timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Update loading state if retry
    if (retryCount > 0) {
      setAccessData(prev => ({ 
        ...prev, 
        loading: true, 
        error: undefined,
        retryCount 
      }));
    }

    // Handle session loading
    if (status === "loading") {
      console.log("⏳ Session still loading...");
      return;
    }
    
    // Handle no session
    if (!session?.user?.email) {
      console.log("❌ No session found");
      
      setAccessData({
        hasAccess: false,
        loading: false,
        panitiaData: null,
        error: 'Not authenticated',
        retryCount
      });
      
      if (redirectOnDenied) {
        router.push('/api/auth/signin');
      }
      return;
    }

    try {
      console.log('🔍 Making API request for:', session.user.email);
      
      const response = await fetch('/api/panitia/check-pit-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: session.user.email }),
      });

      console.log('📡 API Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: 'Unknown error', details: errorText };
        }
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('📊 API Result:', result);

      if (result.hasAccess) {
        setAccessData({
          hasAccess: true,
          loading: false,
          panitiaData: result.panitiaData,
          retryCount
        });
        console.log('✅ PIT access granted for:', result.panitiaData?.nama_lengkap);
      } else {
        console.log('❌ PIT access denied:', result.error);
        
        setAccessData({
          hasAccess: false,
          loading: false,
          panitiaData: null,
          error: result.error || 'Access denied',
          retryCount
        });
        
        if (redirectOnDenied) {
          router.push(unauthorizedRedirectUrl);
        }
      }
    } catch (error: any) {
      console.error('💥 Error checking PIT access:', error);
      
      // Retry logic
      if (retryCount < maxRetries) {
        console.log(`🔄 Retrying in ${retryDelay}ms... (${retryCount + 1}/${maxRetries})`);
        
        setAccessData(prev => ({
          ...prev,
          loading: true,
          error: `Retrying... (${retryCount + 1}/${maxRetries})`,
          retryCount: retryCount + 1
        }));
        
        retryTimeoutRef.current = setTimeout(() => {
          checkPITAccess(retryCount + 1);
        }, retryDelay);
        
        return;
      }
      
      // Max retries reached
      console.log('💀 Max retries reached');
      
      setAccessData({
        hasAccess: false,
        loading: false,
        panitiaData: null,
        error: `Network error after ${maxRetries} attempts: ${error.message}`,
        retryCount
      });
      
      if (redirectOnDenied && error.message !== 'Not authenticated') {
        router.push(unauthorizedRedirectUrl);
      }
    }
  }, [session, status, router, redirectOnDenied, unauthorizedRedirectUrl, maxRetries, retryDelay]);

  // Always define retry callback
  const retry = useCallback(() => {
    console.log('🔄 Manual retry triggered');
    setAccessData(prev => ({ ...prev, retryCount: 0 }));
    checkPITAccess(0);
  }, [checkPITAccess]);

  // Always call useEffect - no conditional effects
  useEffect(() => {
    checkPITAccess(0);
    
    // Cleanup timeout on unmount
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [checkPITAccess]);

  // Always return the same structure
  return { 
    hasAccess: accessData.hasAccess,
    loading: accessData.loading,
    panitiaData: accessData.panitiaData,
    error: accessData.error,
    retryCount: accessData.retryCount,
    retry 
  };
}

// Simple non-redirecting version
export function usePITAccessCheck(): Omit<PITAccessData, 'retryCount'> {
  const { hasAccess, loading, panitiaData, error } = usePITAccess({ 
    redirectOnDenied: false,
    maxRetries: 1
  });
  
  return { hasAccess, loading, panitiaData, error };
}