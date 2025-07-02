"use client";
import { useSession, signOut } from "next-auth/react";
import GoogleUbButton from "@/components/GoogleUbButton";
import LoginErrorHandler from "@/components/LoginErrorHandler";

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useUser } from "@/contexts/UserContext"

export default function HomePage() {
  const { data: session, status } = useSession()
  const { userData, loading: userLoading } = useUser()
  const router = useRouter()
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Handle URL error parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const errorParam = urlParams.get('error')
    
    if (errorParam) {
      switch (errorParam) {
        case 'EmailNotStudentUB':
          setError('Hanya email @student.ub.ac.id yang diizinkan')
          break
        case 'NotRegisteredPanitia':
          setError('Email Anda tidak terdaftar sebagai panitia')
          break
        case 'DatabaseError':
          setError('Terjadi kesalahan database. Silakan coba lagi.')
          break
        case 'UserDataError':
          setError('Gagal memuat data user. Silakan login ulang.')
          break
        default:
          setError('Terjadi kesalahan tidak dikenal')
      }
      
      // Clear error from URL
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  // Auto redirect for authenticated users
  useEffect(() => {
    const handleAutoRedirect = async () => {
      // Jika masih loading, tunggu
      if (status === 'loading' || userLoading) {
        return
      }

      // Jika tidak ada session, tidak perlu redirect
      if (status === 'unauthenticated' || !session) {
        return
      }

      // Jika ada session tapi belum ada userData, tunggu
      if (!userData) {
        return
      }

      // Redirect berdasarkan divisi
      setIsRedirecting(true)
      
      try {
        if (userData.isPIT) {
          // PIT user ke panel
          router.push('/panitia')
        } else if (['KESTARI', 'KONSUMSI'].includes(userData.divisi_nama)) {
          // Divisi tertentu ke dashboard panitia peserta
          const divisiPath = userData.divisi_nama.toLowerCase()
          router.push(`/dashboard${divisiPath}`)
        } else {
          // Divisi lain ke dashboard umum (jika ada)
          router.push('/dashboard')
        }
      } catch (error) {
        console.error('Redirect error:', error)
        setIsRedirecting(false)
      }
    }

    handleAutoRedirect()
  }, [session, status, userData, userLoading, router])

  const handleSignIn = () => {
    setError(null)
    signIn('google', { 
      callbackUrl: '/',
      redirect: true 
    })
  }

  return (
    <>
      {/* Error handling component */}
      <LoginErrorHandler />

      {/* Desktop Version */}
      <div className="hidden md:flex h-screen relative overflow-hidden justify-center items-center"
           style={{
             background: 'linear-gradient(145.79deg, rgba(133, 181, 192, 1) 0%, rgba(72, 145, 161, 1) 50%, rgba(60, 120, 134, 1) 100%)'
           }}>
        
        {/* Batik Background Pattern */}
        <img 
          src="/assets/batik-10.svg" 
          alt="Batik Pattern"
          className="absolute opacity-50 w-[1251px] h-[1115px] left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2"
        />

        {/* Background Rectangle di Blur */}
        <div className="absolute w-[533px] h-[375px] left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div 
            className="w-full h-full rounded-xl opacity-28 shadow-lg"
            style={{
              background: '#ffffff',
              filter: 'blur(2px)',
              boxShadow: '0px 4px 4px rgba(0, 0, 0, 0.25)'
            }}
          />
        </div>

        {/* Main Content */}
        <div className="relative z-10 w-[534px] rounded-xl py-6 flex flex-col gap-5 items-center text-center">
          {/* Header with Logo */}
          <div className="flex flex-row gap-3 items-start justify-center self-stretch">
            {/* Left Logo Group */}
            <div className="w-[98px] h-[37px] relative">
              <img src="/assets/group0.svg" alt="Group 1" className="absolute left-0 top-0 h-auto" />
              <img src="/assets/group1.svg" alt="Group 2" className="absolute left-[54px] top-[14.44px] h-auto" />
            </div>
            
            {/* Center Logo */}
            <img src="/assets/logo-sementara0.svg" alt="Logo" className="w-[184px] h-[92px]" />
            
            {/* Right Logo Group */}
            <div className="w-[97px] h-[37px] relative">
              <img src="/assets/group3.svg" alt="Group 3" className="absolute left-0 top-0 h-auto" />
              <img src="/assets/group4.svg" alt="Group 4" className="absolute left-[37.47px] top-[14.44px] h-auto" />
            </div>
          </div>

          {/* Login Form Section */}
          <div className="rounded-lg px-5 flex flex-col gap-7 items-center self-stretch">
            {/* Title and Description */}
            <div className="flex flex-col gap-2 items-start self-stretch">
              <div className="text-white text-center text-[38px] font-bold leading-[128%] tracking-[0.005em] self-stretch overflow-hidden whitespace-nowrap text-ellipsis"
                   style={{ fontFamily: 'Sora-Bold, sans-serif' }}>
                Login
              </div>
              <div className="text-white text-center text-base font-light leading-[128%] tracking-[0.005em] self-stretch"
                   style={{ fontFamily: 'Sora-Light, sans-serif' }}>
                Silakan login dengan akun email UB Anda
              </div>
            </div>

            {/* Login Content */}
            {session ? (
              <div className="space-y-4 w-full max-w-[300px]">
                <div className="bg-white/90 rounded-lg p-4">
                  <p className="text-[#4891a1] text-center mb-2 break-words">
                    🟢 Halo, <strong>{session.user?.name}</strong>
                  </p>
                  <p className="text-sm text-[#4891a1] text-center">{session.user?.email}</p>
                </div>
                <button
                  onClick={() => signOut()}
                  className="w-full bg-red-500 hover:bg-red-600 text-white rounded-lg py-4 px-8 transition-all duration-300 hover:transform hover:-translate-y-1 hover:shadow-lg font-medium"
                >
                  Logout
                </button>
              </div>
            ) : (
              /* Google Login Button */
              <div 
                className="bg-white rounded-lg py-4 px-8 flex flex-row gap-2 items-center justify-center w-[300px] h-12 cursor-pointer transition-all duration-300 hover:transform hover:-translate-y-1 hover:shadow-lg"
                onClick={() => {
                  
                }}
              >
                <img src="/assets/flat-color-icons-google0.svg" alt="Google Icon" className="w-6 h-6" />
                <div className="text-[#4891a1] text-sm font-medium leading-[21px]" style={{ fontFamily: 'DmSans-Medium, sans-serif' }}>
                  Masuk dengan Google
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Version */}
      <div className="md:hidden h-screen relative overflow-hidden block"
           style={{
             background: 'linear-gradient(168.17deg, rgba(133, 181, 192, 1) 0%, rgba(60, 120, 134, 1) 40%, rgba(72, 145, 161, 1) 100%)'
           }}>
        
        {/* Batik Background Patterns */}
        <div className="absolute opacity-[0.08] flex flex-col w-[405.72px] left-1/2 -translate-x-1/2 -top-[315px]">
          {[...Array(6)].map((_, rowIndex) => (
            <div key={`batik-row-${rowIndex}`} 
                 className={`self-stretch h-[548.78px] relative ${rowIndex > 0 ? '-mt-[283px]' : ''}`}>
              <img src="/assets/layer-70.svg" alt="" className="absolute h-auto left-[64.27px] top-[269.91px]" />
              <img src="/assets/layer-70.svg" alt="" className="absolute h-auto left-[193.94px] top-[134.96px]" />
              <img src="/assets/layer-70.svg" alt="" className="absolute h-auto left-[323.61px] top-0" />
              <img src="/assets/layer-70.svg" alt="" className="absolute h-auto left-0 top-[335.74px]" />
              <img src="/assets/layer-70.svg" alt="" className="absolute h-auto left-[129.67px] top-[200.79px]" />
              <img src="/assets/layer-70.svg" alt="" className="absolute h-auto left-[259.34px] top-[65.83px]" />
            </div>
          ))}
        </div>
        <div className="absolute opacity-[0.08] flex flex-col w-[405.72px] -left-[2512px] -top-[154px]">
          {[...Array(6)].map((_, rowIndex) => (
            <div key={`batik-row-2-${rowIndex}`} 
                 className={`self-stretch h-[548.78px] relative ${rowIndex > 0 ? '-mt-[283px]' : ''}`}>
              <img src="/assets/layer-70.svg" alt="" className="absolute h-auto left-[64.27px] top-[269.91px]" />
              <img src="/assets/layer-70.svg" alt="" className="absolute h-auto left-[193.94px] top-[134.96px]" />
              <img src="/assets/layer-70.svg" alt="" className="absolute h-auto left-[323.61px] top-0" />
              <img src="/assets/layer-70.svg" alt="" className="absolute h-auto left-0 top-[335.74px]" />
              <img src="/assets/layer-70.svg" alt="" className="absolute h-auto left-[129.67px] top-[200.79px]" />
              <img src="/assets/layer-70.svg" alt="" className="absolute h-auto left-[259.34px] top-[65.83px]" />
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className="absolute flex flex-col gap-6 items-center justify-center w-[355px] left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
          {/* Header dan Logo */}
          <div className="flex flex-row gap-3 items-center justify-center self-stretch">
            <div className="w-[98px] h-[37px] relative">
              <img src="/assets/group0.svg" alt="Group 1" className="absolute left-0 top-0 h-auto" />
              <img src="/assets/group1.svg" alt="Group 2" className="absolute left-[54px] top-[14.44px] h-auto" />
            </div>
            <img src="/assets/logo-sementara0.svg" alt="Logo" className="w-[136px] h-[68px]" />
            <div className="w-[97px] h-[37px] relative">
              <img src="/assets/group3.svg" alt="Group 3" className="absolute left-0 top-0 h-auto" />
              <img src="/assets/group4.svg" alt="Group 4" className="absolute left-[37.47px] top-[14.44px] h-auto" />
            </div>
          </div>

          {/* Login Card */}
          <div 
            className="bg-white rounded-lg p-5 flex flex-col gap-7 items-center justify-center w-[334px] relative"
            style={{
              boxShadow: '0px 16px 32px -12px rgba(88, 92, 95, 0.1)'
            }}
          >
            {/* Title dan Deskripsi*/}
            <div className="flex flex-col gap-2 items-center justify-center self-stretch">
              <div 
                className="text-center text-[32px] font-semibold leading-[128%] tracking-[0.005em] self-stretch overflow-hidden whitespace-nowrap text-ellipsis"
                style={{
                  background: 'linear-gradient(90deg, rgba(72, 145, 161, 1) 0%, rgba(60, 120, 134, 1) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  fontFamily: 'Sora-SemiBold, sans-serif'
                }}
              >
                Login
              </div>
              <div className="text-[#244850] text-center text-sm font-normal leading-[128%] tracking-[0.005em] self-stretch"
                   style={{ fontFamily: 'Sora-Regular, sans-serif' }}>
                Silakan login dengan akun email UB Anda
              </div>
            </div>

            {/* Login Content */}
            {session ? (
              <div className="space-y-4 w-full">
                <div className="border border-[#5eead4] bg-[#f0fdfa] rounded-lg p-4">
                  <p className="text-[#0f766e] text-center mb-2 break-words">
                    🟢 Halo, <strong>{session.user?.name}</strong>
                  </p>
                  <p className="text-sm text-[#0d9488] text-center">{session.user?.email}</p>
                </div>
                <button
                  onClick={() => signOut()}
                  className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg py-3 px-6 transition-all duration-300 hover:transform hover:-translate-y-0.5 hover:shadow-md font-medium"
                >
                  Logout
                </button>
              </div>
            ) : (
              /* Google Login Button */
              <div 
                className="bg-white rounded-lg border border-[#3c7886] py-4 px-8 flex flex-row gap-2 items-center justify-center self-stretch h-12 cursor-pointer transition-all duration-300 hover:transform hover:-translate-y-0.5 hover:shadow-lg"
                onClick={() => {
                  
                }}
              >
                <img src="/assets/flat-color-icons-google0.svg" alt="Google Icon" className="w-6 h-6" />
                <div className="text-[#3c7886] text-left text-sm font-semibold leading-[128%] tracking-[0.005em]"
                     style={{ fontFamily: 'Sora-SemiBold, sans-serif' }}>
                  Masuk dengan Google
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  );
}
