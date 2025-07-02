// File: components/ProfileAvatar.tsx (Optimized untuk Google Image)

'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useSession } from 'next-auth/react'

interface ProfileAvatarProps {
  imageUrl?: string | null
  name?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showBorder?: boolean
  borderColor?: string
  fallbackBg?: string
}

export default function ProfileAvatar({
  imageUrl,
  name = 'User',
  size = 'md',
  showBorder = false,
  borderColor = 'border-gray-300',
  fallbackBg = 'bg-gradient-to-br from-blue-500 to-blue-600'
}: ProfileAvatarProps) {
  const { data: session } = useSession()
  const [imageError, setImageError] = useState(false)

  // Prioritas image: 
  // 1. Props imageUrl (dari UserContext/API)
  // 2. Session image (Google image langsung dari NextAuth)
  // 3. Fallback ke initials
  const finalImageUrl = imageUrl || session?.user?.image || null
  
  // Size configurations
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm', 
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg'
  }

  const sizeConfig = sizeClasses[size]
  
  // Get initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const handleImageError = () => {
    console.log('🖼️ ProfileAvatar: Image load failed for:', finalImageUrl)
    setImageError(true)
  }

  console.log('🖼️ ProfileAvatar Debug:', {
    propImageUrl: imageUrl,
    sessionImage: session?.user?.image,
    finalImageUrl,
    imageError,
    name,
    source: imageUrl ? 'props' : session?.user?.image ? 'session' : 'none'
  })

  return (
    <div className={`relative ${sizeConfig} rounded-full ${showBorder ? `border-2 ${borderColor}` : ''} overflow-hidden flex-shrink-0`}>
      {finalImageUrl && !imageError ? (
        <Image
          src={finalImageUrl}
          alt={name}
          fill
          className="object-cover"
          onError={handleImageError}
          referrerPolicy="no-referrer" // Critical untuk Google images
          sizes={size === 'xl' ? '64px' : size === 'lg' ? '48px' : size === 'md' ? '40px' : '32px'}
          priority={size === 'lg' || size === 'xl'} // Priority untuk avatar yang lebih besar
          unoptimized={true} // Untuk Google images yang sudah optimized
        />
      ) : (
        // Fallback dengan initials
        <div className={`${fallbackBg} ${sizeConfig} rounded-full flex items-center justify-center text-white font-medium`}>
          {getInitials(name)}
        </div>
      )}
      
      {/* Online indicator (tampil jika ada image dan bukan size sm) */}
      {finalImageUrl && !imageError && size !== 'sm' && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-white rounded-full"></div>
      )}
    </div>
  )
}