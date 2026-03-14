import { useState } from 'react';
import { useUserStore } from '../store/useUserStore';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { containsProfanity } from '../utils/profanity';

export function NicknameModal() {
  const { profile } = useUserStore();
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Only show if logged in and NO nickname
  const showModal = profile && !profile.nickname;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    const trimmed = nickname.trim();
    if (trimmed.length < 3) {
      setError('Nickname must be at least 3 characters.');
      return;
    }
    if (trimmed.length > 15) {
      setError('Nickname must be less than 15 characters.');
      return;
    }
    if (containsProfanity(trimmed)) {
      setError('Inappropriate nickname detected. The Abyss rejects this name.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, { nickname: trimmed, displayName: trimmed });
    } catch (err) {
      console.error(err);
      setError('Failed to save nickname. Try again.');
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#0a0a0a] border border-red-500/30 rounded-2xl p-8 max-w-md w-full shadow-[0_0_50px_rgba(239,68,68,0.2)]"
          >
            <div className="flex items-center gap-3 mb-6 text-red-500">
              <AlertTriangle size={32} />
              <h2 className="text-2xl font-black tracking-widest uppercase">Identity Required</h2>
            </div>
            
            <p className="text-white/70 mb-6">
              Welcome to the Abyss. Before you proceed, you must choose your Hunter Nickname. 
              <br/><br/>
              <strong className="text-red-400">WARNING: This choice is PERMANENT. You cannot change it later unless you acquire a rare artifact.</strong>
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Enter Nickname..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 transition-colors"
                  maxLength={15}
                />
              </div>

              {error && <p className="text-red-400 text-sm font-bold">{error}</p>}

              <button
                type="submit"
                disabled={saving || !nickname.trim()}
                className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black tracking-widest uppercase rounded-xl transition-colors"
              >
                {saving ? 'Binding Soul...' : 'Confirm Identity'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
