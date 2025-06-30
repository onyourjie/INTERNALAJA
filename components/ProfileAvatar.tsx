// File: components/ProfileAvatar.tsx

"use client";

import { useState } from 'react';

interface ProfileAvatarProps {
  imageUrl?: string | null;
  name?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showBorder?: boolean;
  borderColor?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-sm',
  xl: 'w-12 h-12 text-base'
};

export default function ProfileAvatar({ 
  imageUrl, 
  name = 'User', 
  size = 'md',
  className = '',
  showBorder = false,
  borderColor = 'border-white'
}: ProfileAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(!!imageUrl);

  const handleImageError = () => {
    setImageError(true);
    setIsLoading(false);
  };

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const getInitials = (fullName: string) => {
    return fullName
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const baseClasses = `${sizeClasses[size]} rounded-full flex items-center justify-center overflow-hidden ${className}`;
  const borderClasses = showBorder ? `border-2 ${borderColor}` : '';
  const containerClasses = `${baseClasses} ${borderClasses}`;

  // Jika ada image URL dan belum error, tampilkan image
  if (imageUrl && !imageError) {
    return (
      <div className={containerClasses}>
        {isLoading && (
          <div className="absolute inset-0 bg-gray-300 animate-pulse rounded-full"></div>
        )}
        <img 
          src={imageUrl}
          alt={name || 'Profile'}
          className={`${sizeClasses[size]} rounded-full object-cover ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
          onError={handleImageError}
          onLoad={handleImageLoad}
        />
      </div>
    );
  }

  // Fallback ke initials
  return (
    <div className={`${containerClasses} bg-gradient-to-br from-blue-500 to-blue-600`}>
      <span className={`text-white font-semibold ${sizeClasses[size].split(' ')[2]}`}>
        {getInitials(name || 'U')}
      </span>
    </div>
  );
}