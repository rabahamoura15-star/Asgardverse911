import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface InterstitialAdProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InterstitialAd({ isOpen, onClose }: InterstitialAdProps) {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && adRef.current) {
      // Clear previous ad content
      adRef.current.innerHTML = '';

      // Inject the ad script or iframe here
      // Since the exact ad code for the interstitial is unknown, we use a placeholder or the provided link
      const iframe = document.createElement('iframe');
      iframe.src = 'https://www.effectivegatecpm.com/tm0npkypt?key=92b04276217a6f830d9348efbc49568c';
      iframe.width = '100%';
      iframe.height = '100%';
      iframe.style.border = 'none';
      iframe.sandbox = 'allow-scripts allow-forms allow-popups'; // Added sandbox
      adRef.current.appendChild(iframe);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 backdrop-blur-md">
      <div className="relative w-full max-w-3xl h-[80vh] bg-[#1a1a1a] rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex flex-col">
        <div className="flex justify-between items-center p-4 bg-black/50 border-b border-white/10">
          <span className="text-white/50 text-sm uppercase tracking-widest font-bold">Advertisement</span>
          <button 
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white"
          >
            <X size={24} />
          </button>
        </div>
        <div className="flex-1 w-full h-full bg-black flex items-center justify-center" ref={adRef}>
          {/* Ad content will be injected here */}
          <div className="text-white/30 animate-pulse">Loading Ad...</div>
        </div>
      </div>
    </div>
  );
}
