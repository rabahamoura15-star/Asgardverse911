import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';
import { translations } from '../translations';

export function StickyAd() {
  const adRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { language } = useUserStore();
  const t = (translations[language as keyof typeof translations] || translations.en) as any;
  const [refreshKey, setRefreshKey] = useState(0);

  const lastRefreshTime = useRef(0);

  // Function to refresh the ad
  const refreshAd = () => {
    const now = Date.now();
    // Prevent refreshing more than once every 2 seconds to avoid flickering and ad network issues
    if (now - lastRefreshTime.current > 2000) {
      setRefreshKey(prev => prev + 1);
      lastRefreshTime.current = now;
    }
  };

  useEffect(() => {
    // Global click listener to detect "major interactions" like button clicks
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // If user clicks a button, a link, or something that looks like an interactive element
      if (
        target.tagName === 'BUTTON' || 
        target.tagName === 'A' || 
        target.closest('button') || 
        target.closest('a') ||
        target.getAttribute('role') === 'button'
      ) {
        // Debounce or just refresh
        // To avoid too many refreshes, we could add a small delay or check
        refreshAd();
      }
    };

    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Refresh ad on route change
  useEffect(() => {
    refreshAd();
  }, [location.pathname]);

  useEffect(() => {
    if (!adRef.current) return;

    // Clear previous ad content
    adRef.current.innerHTML = '';

    // Set global atOptions
    (window as any).atOptions = {
      'key' : 'b9cfaec715e181f712dfe3d6b0fe0b4a',
      'format' : 'iframe',
      'height' : 50,
      'width' : 320,
      'params' : {}
    };

    // Create the script element for the invoke.js
    const invokeScript = document.createElement('script');
    invokeScript.type = 'text/javascript';
    invokeScript.src = 'https://www.highperformanceformat.com/b9cfaec715e181f712dfe3d6b0fe0b4a/invoke.js';
    invokeScript.async = true;

    // Append to the container
    adRef.current.appendChild(invokeScript);

    return () => {
      if (adRef.current) {
        adRef.current.innerHTML = '';
      }
    };
  }, [refreshKey]);

  return (
    <div 
      id="sticky-ad-container"
      className="fixed bottom-0 left-0 right-0 z-[9999] flex justify-center items-center bg-black/80 backdrop-blur-sm py-1 border-t border-white/10"
      style={{ height: '60px' }}
    >
      <div ref={adRef} style={{ width: '320px', height: '50px' }}>
        {/* Ad will be injected here */}
      </div>
      
      {/* Small close button or label if needed, but user asked for sticky bottom */}
      <div className="absolute -top-4 right-2 bg-black/60 text-[10px] text-white/40 px-2 rounded-t-md uppercase tracking-widest pointer-events-none">
        {t.advertisement}
      </div>
    </div>
  );
}
