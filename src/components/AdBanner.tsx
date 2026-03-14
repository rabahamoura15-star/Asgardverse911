import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export function AdBanner() {
  const location = useLocation();
  const adContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // This effect runs every time the route changes (Page Load / State Change)
    // Here you would call your ad network's refresh function.
    // Example: if (window.adsbygoogle) { window.adsbygoogle.push({}); }
    
    if (adContainerRef.current) {
      // Placeholder logic to show it's refreshing
      adContainerRef.current.innerHTML = `<div class="w-full h-full flex items-center justify-center text-white/30 text-xs font-mono">ADVERTISEMENT SPACE<br/>(Refreshed for ${location.pathname})</div>`;
      
      // TODO: Insert actual ad network script/call here
    }
  }, [location.pathname, location.search]);

  return (
    <div className="w-full flex justify-center py-4 mt-auto">
      <div 
        ref={adContainerRef}
        className="w-[320px] h-[50px] md:w-[728px] md:h-[90px] bg-white/5 border border-white/10 rounded-lg overflow-hidden flex items-center justify-center"
      >
        {/* Ad content will be injected here */}
      </div>
    </div>
  );
}
