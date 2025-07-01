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
  // Google Profile Image - FIELD YANG DITAMBAHKAN
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
      
      if (data.error) {
        throw new Error(data.error);
      }

      console.log('✅ UserContext: User data loaded:', {
        nama: data.user.nama_lengkap,
        divisi: data.user.divisi_nama,
        isPIT: data.user.isPIT,
        profile_image: data.user.profile_image,
        session_image: data.user.session_image
      });

      setUserData(data.user);
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