import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTrendingAnime, getTrendingManga, getTrendingManhwa } from '../services/api';
import { motion } from 'framer-motion';
import { Search, Play, BookOpen, Flame, ChevronRight, RefreshCw, Sparkles, Filter, Target, Skull } from 'lucide-react';
import { useUserStore } from '../store/useUserStore';
import { useNavigate } from 'react-router-dom';
import { translations } from '../translations';
import { AuthModal } from '../components/AuthModal';

export function Home() {
  const { profile, isLoading: authLoading, language, trackAction } = useUserStore();
  const t = translations[language] as any;
  const nsfwEnabled = profile?.nsfwEnabled || false;
  const navigate = useNavigate();

  const [animePage, setAnimePage] = useState(1);
  const [mangaPage, setMangaPage] = useState(1);
  const [manhwaPage, setManhwaPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const { data: anime, isLoading: animeLoading, isFetching: animeFetching } = useQuery({
    queryKey: ['trendingAnime', animePage, nsfwEnabled],
    queryFn: () => getTrendingAnime(animePage, nsfwEnabled),
  });

  const { data: manga, isLoading: mangaLoading, isFetching: mangaFetching } = useQuery({
    queryKey: ['trendingManga', mangaPage, nsfwEnabled],
    queryFn: () => getTrendingManga(mangaPage, nsfwEnabled),
  });

  const { data: manhwa, isLoading: manhwaLoading, isFetching: manhwaFetching } = useQuery({
    queryKey: ['trendingManhwa', manhwaPage, nsfwEnabled],
    queryFn: () => getTrendingManhwa(manhwaPage, nsfwEnabled),
  });

  // Improved randomness for "Shuffle" feel
  const shuffledAnime = useMemo(() => {
    if (!anime) return [];
    return [...anime].sort(() => Math.random() - 0.5);
  }, [anime]);

  const shuffledManga = useMemo(() => {
    if (!manga) return [];
    return [...manga].sort(() => Math.random() - 0.5);
  }, [manga]);

  const shuffledManhwa = useMemo(() => {
    if (!manhwa) return [];
    return [...manhwa].sort(() => Math.random() - 0.5);
  }, [manhwa]);

  const handleSurpriseMe = () => {
    const all = [...(anime || []), ...(manga || []), ...(manhwa || [])];
    if (all.length > 0) {
      const random = all[Math.floor(Math.random() * all.length)];
      const type = (anime?.includes(random)) ? 'anime' : 'manga';
      navigate(`/media/${type}/${random.id}`);
    }
  };

  const handleLogin = () => {
    setIsAuthModalOpen(true);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (e.target.value.length > 2) {
      trackAction('search');
    }
  };

  if (authLoading) {
    return <div className="flex justify-center items-center h-[60vh]"><div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-6xl md:text-8xl font-black tracking-tighter mb-6 text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-cyan-400 to-yellow-500"
        >
          {t.enterAbyss}
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-xl text-white/60 mb-10 max-w-2xl"
        >
          {t.heroDescription || 'The ultimate hardcore tracker for Anime, Manga, and Manhwa. Level up, pull SSR characters, and dominate the global rankings.'}
        </motion.p>
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleLogin}
          className="px-10 py-5 bg-purple-600 hover:bg-purple-500 text-white font-black tracking-widest uppercase rounded-2xl shadow-[0_0_40px_rgba(147,51,234,0.5)] transition-all border border-purple-400/50"
        >
          {t.awakenSystem}
        </motion.button>
        <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Dashboard Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-orange-500/20 rounded-xl text-orange-400">
              <Flame size={24} />
            </div>
            <div>
              <h3 className="font-bold text-white uppercase tracking-widest">{t.weeklyProgress || 'Weekly Progress'}</h3>
              <p className="text-sm text-white/50 font-mono">{profile.loginStreak || 0}/7 {t.days || 'Days'}</p>
            </div>
          </div>
          <div className="w-full bg-white/5 rounded-full h-2 mb-2">
            <div 
              className="bg-orange-500 h-2 rounded-full transition-all duration-1000" 
              style={{ width: `${Math.min(((profile.loginStreak || 0) / 7) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-white/30 text-right">{t.sevenDayReward || '7-Day Reward: 100k G + 5k XP'}</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 relative overflow-hidden group cursor-pointer" onClick={() => navigate('/quests')}>
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-cyan-500/20 rounded-xl text-cyan-400">
              <Target size={24} />
            </div>
            <div>
              <h3 className="font-bold text-white uppercase tracking-widest">{t.dailyQuests || 'Daily Quests'}</h3>
              <p className="text-sm text-white/50 font-mono">{t.resetAtMidnight || 'Reset at Midnight'}</p>
            </div>
          </div>
          <div className="flex items-center justify-between mt-6">
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">{t.viewQuests || 'View Quests'}</span>
            <ChevronRight size={16} className="text-cyan-400 group-hover:translate-x-2 transition-transform" />
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 relative overflow-hidden group cursor-pointer" onClick={() => navigate('/gates')}>
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-red-500/20 rounded-xl text-red-500">
              <Skull size={24} />
            </div>
            <div>
              <h3 className="font-bold text-white uppercase tracking-widest">{t.abyssalGates || 'Abyssal Gates'}</h3>
              <p className="text-sm text-white/50 font-mono">{t.riskItAll || 'Risk it all'}</p>
            </div>
          </div>
          <div className="flex items-center justify-between mt-6">
            <span className="text-xs font-bold text-red-500 uppercase tracking-widest">{t.enterGates || 'Enter Gates'}</span>
            <ChevronRight size={16} className="text-red-500 group-hover:translate-x-2 transition-transform" />
          </div>
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-xl">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={20} />
          <input 
            type="text"
            placeholder={t.search}
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-cyan-500/50 transition-all font-medium"
          />
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={handleSurpriseMe}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-600 text-black font-black uppercase tracking-widest rounded-2xl hover:scale-105 transition-all shadow-lg"
          >
            <Sparkles size={18} /> {t.surpriseMe}
          </button>
          <button 
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold uppercase tracking-widest rounded-2xl transition-all border border-white/5"
          >
            <Filter size={18} /> {t.advancedSearch}
          </button>
        </div>
      </div>

      {/* Anime Section */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-cyan-500/20 rounded-xl border border-cyan-500/30">
              <Play className="text-cyan-400 w-6 h-6" />
            </div>
            <h2 className="text-3xl font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              {t.trendingAnime}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setAnimePage(p => Math.max(1, p - 1))}
              disabled={animePage === 1 || animeFetching}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-xl disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={20} className="rotate-180" />
            </button>
            <span className="text-sm font-mono font-bold text-white/50 px-2">
              {animePage}
            </span>
            <button 
              onClick={() => setAnimePage(p => p + 1)}
              disabled={animeFetching}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-xl disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        
        {animeLoading ? (
          <div className="flex gap-6 overflow-x-auto pb-6 no-scrollbar">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="min-w-[220px] h-[330px] bg-white/5 animate-pulse rounded-2xl border border-white/10" />
            ))}
          </div>
        ) : (
          <div className="flex gap-6 overflow-x-auto pb-8 snap-x no-scrollbar">
            {shuffledAnime.map((item: any) => (
              <MediaCard key={item.id} item={item} type="anime" t={t} />
            ))}
          </div>
        )}
      </section>

      {/* Manga Section */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/20 rounded-xl border border-purple-500/30">
              <BookOpen className="text-purple-400 w-6 h-6" />
            </div>
            <h2 className="text-3xl font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500">
              {t.trendingManga}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setMangaPage(p => Math.max(1, p - 1))}
              disabled={mangaPage === 1 || mangaFetching}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-xl disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={20} className="rotate-180" />
            </button>
            <span className="text-sm font-mono font-bold text-white/50 px-2">
              {mangaPage}
            </span>
            <button 
              onClick={() => setMangaPage(p => p + 1)}
              disabled={mangaFetching}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-xl disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        
        {mangaLoading ? (
          <div className="flex gap-6 overflow-x-auto pb-6 no-scrollbar">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="min-w-[220px] h-[330px] bg-white/5 animate-pulse rounded-2xl border border-white/10" />
            ))}
          </div>
        ) : (
          <div className="flex gap-6 overflow-x-auto pb-8 snap-x no-scrollbar">
            {shuffledManga.map((item: any) => (
              <MediaCard key={item.id} item={item} type="manga" t={t} />
            ))}
          </div>
        )}
      </section>

      {/* Manhwa Section */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-500/20 rounded-xl border border-orange-500/30">
              <Flame className="text-orange-400 w-6 h-6" />
            </div>
            <h2 className="text-3xl font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">
              {t.trendingManhwa}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setManhwaPage(p => Math.max(1, p - 1))}
              disabled={manhwaPage === 1 || manhwaFetching}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-xl disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={20} className="rotate-180" />
            </button>
            <span className="text-sm font-mono font-bold text-white/50 px-2">
              {manhwaPage}
            </span>
            <button 
              onClick={() => setManhwaPage(p => p + 1)}
              disabled={manhwaFetching}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-xl disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
        
        {manhwaLoading ? (
          <div className="flex gap-6 overflow-x-auto pb-6 no-scrollbar">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="min-w-[220px] h-[330px] bg-white/5 animate-pulse rounded-2xl border border-white/10" />
            ))}
          </div>
        ) : (
          <div className="flex gap-6 overflow-x-auto pb-8 snap-x no-scrollbar">
            {shuffledManhwa.map((item: any) => (
              <MediaCard key={item.id} item={item} type="manga" t={t} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MediaCard({ item, type, t }: { item: any, type: 'anime' | 'manga', t: any, key?: React.Key }) {
  const navigate = useNavigate();
  const title = item.title.english || item.title.romaji;
  
  return (
    <motion.div 
      whileHover={{ y: -10 }}
      onClick={() => navigate(`/media/${type}/${item.id}`)}
      className="min-w-[220px] w-[220px] snap-start group relative rounded-2xl overflow-hidden bg-[#0a0a0a] border border-white/10 cursor-pointer shadow-xl"
    >
      <div className="aspect-[2/3] w-full relative">
        {item.coverImage.large ? (
          <img 
            src={item.coverImage.large} 
            alt={title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full bg-white/5 flex items-center justify-center">
            <Sparkles className="text-white/20 w-12 h-12" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/50 to-transparent opacity-90" />
        
        <div className="absolute top-3 right-3 px-2.5 py-1 bg-black/80 backdrop-blur-md rounded-lg text-xs font-mono font-bold border border-white/10 text-yellow-400 shadow-lg">
          ★ {item.averageScore ? item.averageScore / 10 : 'N/A'}
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 p-5 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
        <h3 className="font-bold text-base line-clamp-2 mb-3 text-white/90 group-hover:text-white">{title}</h3>
        <div className="w-full py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors border border-white/5">
          {t.viewDetails} <ChevronRight size={14} />
        </div>
      </div>
    </motion.div>
  );
}
