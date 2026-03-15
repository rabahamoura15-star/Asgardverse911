import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Swords, ShoppingCart, Trophy, Target, X, Backpack, Shield, Globe, Eye, EyeOff, Skull } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '../store/useUserStore';
import { translations, Language } from '../translations';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';

export function Sidebar({ isOpen, setIsOpen }: { isOpen: boolean, setIsOpen: (v: boolean) => void }) {
  const location = useLocation();
  const { language, setLanguage, profile } = useUserStore();
  const t = translations[language] as any;

  const toggleNsfw = async () => {
    if (!profile) return;
    const userRef = doc(db, 'users', profile.uid);
    await updateDoc(userRef, {
      nsfwEnabled: !profile.nsfwEnabled
    });
  };

  const navItems = [
    { path: '/', icon: <Home size={20} />, label: t.dashboard },
    { path: '/gacha', icon: <Swords size={20} />, label: t.summons },
    { path: '/inventory', icon: <Backpack size={20} />, label: t.inventory },
    { path: '/market', icon: <ShoppingCart size={20} />, label: t.market },
    { path: '/leaderboard', icon: <Trophy size={20} />, label: t.rankings },
    { path: '/quests', icon: <Target size={20} />, label: t.quests },
    { path: '/gates', icon: <Skull size={20} />, label: 'Abyss' },
    { path: '/arena', icon: <Swords size={20} />, label: 'Arena' },
    { path: '/guilds', icon: <Shield size={20} />, label: t.guilds },
    { path: '/community', icon: <Globe size={20} />, label: 'Community' },
  ];

  const languages: { code: Language; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'ar', label: 'العربية' },
    { code: 'fr', label: 'Français' },
    { code: 'es', label: 'Español' },
    { code: 'pt', label: 'Português' },
    { code: 'hi', label: 'हिन्दी' },
    { code: 'zh', label: '中文' },
    { code: 'ko', label: '한국어' },
    { code: 'ja', label: '日本語' },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <div className={`fixed top-0 left-0 bottom-0 w-64 bg-[#0a0a0a] border-r border-white/5 z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} flex flex-col`}>
        <div className="h-20 flex items-center justify-between px-6 border-b border-white/5 shrink-0">
          <Link to="/" className="text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-cyan-400">
            ASGARD
          </Link>
          <button onClick={() => setIsOpen(false)} className="md:hidden text-white/50 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 space-y-2 flex-1 overflow-y-auto no-scrollbar">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
                  isActive 
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                    : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                {item.icon}
                <span className="font-bold tracking-wider text-sm">{item.label}</span>
              </Link>
            );
          })}

          {/* NSFW Toggle */}
          <div className="mt-8 pt-8 border-t border-white/5">
            <div className="flex items-center gap-2 px-4 mb-4 text-white/50 text-xs font-bold uppercase tracking-widest">
              {profile?.nsfwEnabled ? <Eye size={14} /> : <EyeOff size={14} />} NSFW Filter
            </div>
            <div className="px-2">
              <button
                onClick={toggleNsfw}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 ${
                  profile?.nsfwEnabled 
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                    : 'bg-white/5 text-zinc-400 border border-white/10'
                }`}
              >
                <div className="flex flex-col items-start">
                  <span className="text-sm font-bold tracking-wider">{t.nsfwToggle}</span>
                  <span className="text-[10px] opacity-50 font-medium">{t.nsfwWarning}</span>
                </div>
                <div className={`w-8 h-4 rounded-full relative transition-colors ${profile?.nsfwEnabled ? 'bg-red-500' : 'bg-zinc-700'}`}>
                  <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all ${profile?.nsfwEnabled ? 'right-1' : 'left-1'}`} />
                </div>
              </button>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-white/5">
            <div className="flex items-center gap-2 px-4 mb-4 text-white/50 text-xs font-bold uppercase tracking-widest">
              <Globe size={14} /> Language
            </div>
            <div className="grid grid-cols-2 gap-2 px-2">
              {languages.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={`text-xs py-2 rounded-lg border transition-colors ${
                    language === lang.code 
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' 
                      : 'bg-white/5 border-transparent text-white/50 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="p-6 border-t border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
            <span className="text-xs font-mono text-white/50 uppercase tracking-widest">{t.systemOnline}</span>
          </div>
        </div>
      </div>
    </>
  );
}
