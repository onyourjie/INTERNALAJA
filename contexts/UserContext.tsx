// File: contexts/UserContext.tsx (Fixed untuk Google Image)

"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

interface UserData {
  // Data dari session NextAuth
  session_id: number;
  session_name: string | null;
  session_image: string | null;
  // Data dari tabel panitia
  panitia_id: number;
  nama_lengkap: string;
  email: string;
  divisi_id: number;
  jabatan_id: number;
  divisi_nama: string;
  jabatan_nama: string;
  // Flag divisi
  isPIT: boolean;
  // Google Profile Image
  profile_image?: string | null;
}

interface UserContextType {
  userData: UserData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserData = async () => {
    if (status !== 'authenticated' || !session?.user?.email) {
      setUserData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 UserContext: Fetching user data for:', session.user.email);
      console.log('🖼️ UserContext: Current session image:', session.user.image);
      
      const response = await fetch('/api/user/session', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      console.log('🔍 UserContext: Raw API response:', data);

      if (!data.success) {
        throw new Error(data.error || data.message || 'API returned error');
      }

      // Check if panitia data exists
      if (!data.data?.panitia) {
        throw new Error('No panitia data found for this user');
      }

      // Map the nested API response to flat UserData structure
      const userData: UserData = {
        // Session data
        session_id: data.data.session.user.id,
        session_name: data.data.session.user.name,
        session_image: data.data.session.user.image,
        // Panitia data
        panitia_id: data.data.panitia.id,
        nama_lengkap: data.data.panitia.nama_lengkap,
        email: data.data.panitia.email,
        divisi_id: data.data.panitia.divisi_id,
        jabatan_id: data.data.panitia.jabatan_id,
        divisi_nama: data.data.panitia.divisi_nama,
        jabatan_nama: data.data.panitia.jabatan_nama,
        isPIT: data.data.panitia.isPIT,
        // Profile image (prioritize session image)
        profile_image: data.data.session.user.image
      };

      console.log('✅ UserContext: User data loaded:', {
        nama: userData.nama_lengkap,
        divisi: userData.divisi_nama,
        isPIT: userData.isPIT,
        profile_image: userData.profile_image,
        session_image: userData.session_image
      });

      setUserData(userData);
    } catch (err: any) {
      console.error('❌ UserContext: Error fetching user data:', err);
      setError(err.message || 'Failed to fetch user data');
      setUserData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [session, status]);

  // Debug log untuk session changes
  useEffect(() => {
    console.log('🔍 UserContext: Session changed:', {
      status,
      email: session?.user?.email,
      image: session?.user?.image,
      hasSession: !!session
    });
  }, [session, status]);

  const refetch = () => {
    fetchUserData();
  };

  return (
    <UserContext.Provider value={{ userData, loading, error, refetch }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}