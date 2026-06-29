import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

interface LogoProps {
  size?: number;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 32, className = "" }) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'store'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.logos && data.logos.main) {
          setLogoUrl(data.logos.main);
        } else {
          setLogoUrl(null);
        }
      }
    });
    return () => unsub();
  }, []);

  if (logoUrl) {
    return (
      <div className={`flex items-center justify-center overflow-hidden ${className}`} style={{ width: size, height: size }}>
        <img 
          src={logoUrl} 
          alt="Logo" 
          className="w-full h-full object-contain"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 32 32" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="16" cy="16" r="16" fill="#0052D9"/>
        <path 
          d="M16 16L30 8C31.3 10.4 32 13.1 32 16C32 18.9 31.3 21.6 30 24L16 16Z" 
          fill="#FF6B00"
        />
        <circle cx="14" cy="18" r="4.5" stroke="white" strokeWidth="2.5"/>
        <path 
          d="M11 15L7 11" 
          stroke="white" 
          strokeWidth="2.5" 
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};
