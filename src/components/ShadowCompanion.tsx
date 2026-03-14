import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '../store/useUserStore';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { Ghost } from 'lucide-react';

export function ShadowCompanion() {
  const { profile } = useUserStore();
  const [showCoin, setShowCoin] = useState(false);

  useEffect(() => {
    if (!profile) return;
    
    // Randomly drop a coin every 1-3 minutes for demo purposes (usually hours)
    const interval = setInterval(() => {
      setShowCoin(true);
      setTimeout(() => setShowCoin(false), 10000); // Disappears after 10s
    }, Math.random() * 120000 + 60000);

    return () => clearInterval(interval);
  }, [profile]);

  const collectCoin = async () => {
    if (!profile) return;
    setShowCoin(false);
    const userRef = doc(db, 'users', profile.uid);
    await updateDoc(userRef, {
      coins: increment(1)
    });
  };

  if (!profile) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 pointer-events-none">
      <AnimatePresence>
        {showCoin && (
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.5 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            onClick={collectCoin}
            className="absolute -top-12 -left-4 pointer-events-auto bg-yellow-500/20 border border-yellow-400/50 text-yellow-400 rounded-full w-10 h-10 flex items-center justify-center shadow-[0_0_15px_rgba(234,179,8,0.5)] hover:scale-110 transition-transform"
          >
            +1G
          </motion.button>
        )}
      </AnimatePresence>
      
      <motion.div
        animate={{
          y: [0, -10, 0],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="w-16 h-16 rounded-full bg-black/80 border border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.2)] flex items-center justify-center overflow-hidden backdrop-blur-md"
      >
        <div className="w-8 h-8 rounded-full bg-purple-500/20 blur-md absolute" />
        <Ghost className="w-8 h-8 text-purple-400 relative z-10" />
      </motion.div>
    </div>
  );
}
