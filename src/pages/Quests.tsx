import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useUserStore } from '../store/useUserStore';
import { doc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { BookOpen, Clock, Zap, Sparkles, Play, Target, ShoppingCart, Star, Trophy, CheckCircle2, Circle } from 'lucide-react';
import { translations } from '../translations';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

interface Quest {
  id: string;
  title: string;
  desc: string;
  reward: number;
  type: 'coins' | 'energy';
  difficulty: 'easy' | 'medium' | 'hard';
  category: 'daily' | 'achievement';
  icon: React.ReactNode;
  check: (profile: any) => boolean;
}

export function Quests() {
  const { profile, language } = useUserStore();
  const t = translations[language] as any;
  const [activeTab, setActiveTab] = useState<'daily' | 'achievement'>('daily');
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setHours(24, 0, 0, 0);
      const diff = tomorrow.getTime() - now.getTime();
      
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  const quests: Quest[] = [
    // Daily Quests
    { 
      id: 'd1', 
      title: t.abyssalEndurance || 'Abyssal Endurance', 
      desc: t.abyssalEnduranceDesc || 'Maintain active presence for 3 hours today (180 mins)', 
      reward: 7500, 
      type: 'coins', 
      difficulty: 'hard', 
      category: 'daily',
      icon: <Clock size={16} />,
      check: (p) => (p.dailyActiveMinutes || 0) >= 180 
    },
    { 
      id: 'd2', 
      title: t.bloodlust || 'Bloodlust', 
      desc: t.bloodlustDesc || 'Engage in 5 Arena battles today', 
      reward: 3000, 
      type: 'coins', 
      difficulty: 'medium', 
      category: 'daily',
      icon: <Zap size={16} />,
      check: (p) => (p.todayArenaAttacks || 0) >= 5 
    },
    { 
      id: 'd3', 
      title: t.gachaAddict || 'Gacha Addict', 
      desc: t.gachaAddictDesc || 'Burn 500,000 Gold in Summons today', 
      reward: 30, 
      type: 'energy', 
      difficulty: 'hard', 
      category: 'daily',
      icon: <Sparkles size={16} />,
      check: (p) => (p.todayGoldSpent || 0) >= 500000 
    },
    { 
      id: 'd4', 
      title: t.manhwaReader || 'Manhwa Reader', 
      desc: t.manhwaReaderDesc || 'Browse 5 different Manhwa works', 
      reward: 1500, 
      type: 'coins', 
      difficulty: 'medium', 
      category: 'daily',
      icon: <BookOpen size={16} />,
      check: (p) => (p.manhwaViewedCount || 0) >= 5 
    },
    { 
      id: 'd5', 
      title: t.cinephile || 'Cinephile', 
      desc: t.cinephileDesc || 'Watch 2 trailers', 
      reward: 750, 
      type: 'coins', 
      difficulty: 'easy', 
      category: 'daily',
      icon: <Play size={16} />,
      check: (p) => (p.trailersWatched || 0) >= 2 
    },
    { 
      id: 'd6', 
      title: t.animeBinge || 'Anime Binge', 
      desc: t.animeBingeDesc || 'Browse 10 Anime/Manga works', 
      reward: 2000, 
      type: 'coins', 
      difficulty: 'medium', 
      category: 'daily',
      icon: <Sparkles size={16} />,
      check: (p) => (p.mediaViewedCount || 0) >= 10 
    },
    { 
      id: 'd7', 
      title: t.curiousMind || 'Curious Mind', 
      desc: t.curiousMindDesc || 'Perform a search', 
      reward: 300, 
      type: 'coins', 
      difficulty: 'easy', 
      category: 'daily',
      icon: <Target size={16} />,
      check: (p) => p.searchPerformed === true 
    },
    { 
      id: 'd8', 
      title: t.blackMarketShopper || 'Black Market Shopper', 
      desc: t.blackMarketShopperDesc || 'Visit the Black Market', 
      reward: 300, 
      type: 'coins', 
      difficulty: 'easy', 
      category: 'daily',
      icon: <ShoppingCart size={16} />,
      check: (p) => p.marketVisited === true 
    },
    { 
      id: 'd9', 
      title: t.gachaAddictII || 'Gacha Addict II', 
      desc: t.gachaAddictIIDesc || 'Pull 10 times in Gacha today', 
      reward: 3500, 
      type: 'coins', 
      difficulty: 'medium', 
      category: 'daily',
      icon: <Sparkles size={16} />,
      check: (p) => (p.gachaPullsToday || 0) >= 10 
    },
    { 
      id: 'd10', 
      title: t.arenaGladiator || 'Arena Gladiator', 
      desc: t.arenaGladiatorDesc || 'Engage in 10 Arena battles today', 
      reward: 7500, 
      type: 'coins', 
      difficulty: 'hard', 
      category: 'daily',
      icon: <Zap size={16} />,
      check: (p) => (p.todayArenaAttacks || 0) >= 10 
    },
    { 
      id: 'd11', 
      title: t.abyssalScholar || 'Abyssal Scholar', 
      desc: t.abyssalScholarDesc || 'Browse 25 Anime/Manga works', 
      reward: 7500, 
      type: 'coins', 
      difficulty: 'hard', 
      category: 'daily',
      icon: <BookOpen size={16} />,
      check: (p) => (p.mediaViewedCount || 0) >= 25 
    },
    { 
      id: 'd12', 
      title: t.trailerJunkie || 'Trailer Junkie', 
      desc: t.trailerJunkieDesc || 'Watch 5 trailers', 
      reward: 3500, 
      type: 'coins', 
      difficulty: 'medium', 
      category: 'daily',
      icon: <Play size={16} />,
      check: (p) => (p.trailersWatched || 0) >= 5 
    },
    { 
      id: 'd13', 
      title: t.manhwaConnoisseur || 'Manhwa Connoisseur', 
      desc: t.manhwaConnoisseurDesc || 'Browse 15 Manhwa works', 
      reward: 7500, 
      type: 'coins', 
      difficulty: 'hard', 
      category: 'daily',
      icon: <BookOpen size={16} />,
      check: (p) => (p.manhwaViewedCount || 0) >= 15 
    },
    { 
      id: 'd14', 
      title: t.gachaWhale || 'Gacha Whale', 
      desc: t.gachaWhaleDesc || 'Pull 50 times in Gacha today', 
      reward: 15, 
      type: 'energy', 
      difficulty: 'hard', 
      category: 'daily',
      icon: <Sparkles size={16} />,
      check: (p) => (p.gachaPullsToday || 0) >= 50 
    },
    { 
      id: 'd15', 
      title: t.dedicatedHunter || 'Dedicated Hunter', 
      desc: t.dedicatedHunterDesc || 'Maintain active presence for 1 hour (60 mins)', 
      reward: 3500, 
      type: 'coins', 
      difficulty: 'medium', 
      category: 'daily',
      icon: <Clock size={16} />,
      check: (p) => (p.dailyActiveMinutes || 0) >= 60 
    },
    { 
      id: 'd16', 
      title: t.mangaEnthusiast || 'Manga Enthusiast', 
      desc: t.mangaEnthusiastDesc || 'Browse 5 Manga works', 
      reward: 1500, 
      type: 'coins', 
      difficulty: 'medium', 
      category: 'daily',
      icon: <BookOpen size={16} />,
      check: (p) => (p.mangaViewedCount || 0) >= 5 
    },
    { 
      id: 'd17', 
      title: t.animeWatcher || 'Anime Watcher', 
      desc: t.animeWatcherDesc || 'Browse 5 Anime works', 
      reward: 1500, 
      type: 'coins', 
      difficulty: 'medium', 
      category: 'daily',
      icon: <Play size={16} />,
      check: (p) => (p.animeViewedCount || 0) >= 5 
    },
    { 
      id: 'd18', 
      title: t.deepDiver || 'Deep Diver', 
      desc: t.deepDiverDesc || 'Browse 20 works of any type', 
      reward: 6000, 
      type: 'coins', 
      difficulty: 'hard', 
      category: 'daily',
      icon: <Sparkles size={16} />,
      check: (p) => (p.mediaViewedCount || 0) >= 20 
    },
    { 
      id: 'd19', 
      title: t.trailerCritic || 'Trailer Critic', 
      desc: t.trailerCriticDesc || 'Watch 10 trailers', 
      reward: 7500, 
      type: 'coins', 
      difficulty: 'hard', 
      category: 'daily',
      icon: <Play size={16} />,
      check: (p) => (p.trailersWatched || 0) >= 10 
    },
    { 
      id: 'd20', 
      title: t.manhwaAddict || 'Manhwa Addict', 
      desc: t.manhwaAddictDesc || 'Browse 10 Manhwa works', 
      reward: 3500, 
      type: 'coins', 
      difficulty: 'hard', 
      category: 'daily',
      icon: <BookOpen size={16} />,
      check: (p) => (p.manhwaViewedCount || 0) >= 10 
    },
    { 
      id: 'd21', 
      title: t.quickGlance || 'Quick Glance', 
      desc: t.quickGlanceDesc || 'Browse 3 works', 
      reward: 750, 
      type: 'coins', 
      difficulty: 'easy', 
      category: 'daily',
      icon: <Sparkles size={16} />,
      check: (p) => (p.mediaViewedCount || 0) >= 3 
    },
    { 
      id: 'd22', 
      title: t.trailerFan || 'Trailer Fan', 
      desc: t.trailerFanDesc || 'Watch 1 trailer', 
      reward: 350, 
      type: 'coins', 
      difficulty: 'easy', 
      category: 'daily',
      icon: <Play size={16} />,
      check: (p) => (p.trailersWatched || 0) >= 1 
    },
    { 
      id: 'd23', 
      title: t.mangaReader || 'Manga Reader', 
      desc: t.mangaReaderDesc || 'Browse 10 Manga works', 
      reward: 3500, 
      type: 'coins', 
      difficulty: 'hard', 
      category: 'daily',
      icon: <BookOpen size={16} />,
      check: (p) => (p.mangaViewedCount || 0) >= 10 
    },
    { 
      id: 'd24', 
      title: t.animeFanatic || 'Anime Fanatic', 
      desc: t.animeFanaticDesc || 'Browse 10 Anime works', 
      reward: 3500, 
      type: 'coins', 
      difficulty: 'hard', 
      category: 'daily',
      icon: <Play size={16} />,
      check: (p) => (p.animeViewedCount || 0) >= 10 
    },
    { 
      id: 'd25', 
      title: t.explorer || 'Explorer', 
      desc: t.explorerDesc || 'Perform 5 searches', 
      reward: 1500, 
      type: 'coins', 
      difficulty: 'medium', 
      category: 'daily',
      icon: <Target size={16} />,
      check: (p) => (p.searchCount || 0) >= 5 
    },
    { 
      id: 'd26', 
      title: t.researcher || 'Researcher', 
      desc: t.researcherDesc || 'Perform 10 searches', 
      reward: 4000, 
      type: 'coins', 
      difficulty: 'hard', 
      category: 'daily',
      icon: <Target size={16} />,
      check: (p) => (p.searchCount || 0) >= 10 
    },
    { 
      id: 'd27', 
      title: t.abyssalObserver || 'Abyssal Observer', 
      desc: t.abyssalObserverDesc || 'Watch 3 trailers', 
      reward: 1500, 
      type: 'coins', 
      difficulty: 'medium', 
      category: 'daily',
      icon: <Play size={16} />,
      check: (p) => (p.trailersWatched || 0) >= 3 
    },
    // Achievements
    { 
      id: 'a1', 
      title: t.awakened || 'Awakened', 
      desc: t.awakenedDesc || 'Reach Level 5', 
      reward: 5000, 
      type: 'coins', 
      difficulty: 'easy', 
      category: 'achievement',
      icon: <Star size={16} />,
      check: (p) => p.level >= 5 
    },
    { 
      id: 'a2', 
      title: t.cRankHunter || 'C-Rank Hunter', 
      desc: t.cRankHunterDesc || 'Reach Level 25', 
      reward: 25000, 
      type: 'coins', 
      difficulty: 'medium', 
      category: 'achievement',
      icon: <Trophy size={16} />,
      check: (p) => p.level >= 25 
    },
    { 
      id: 'a3', 
      title: t.collector || 'Collector', 
      desc: t.collectorDesc || 'Have 10 characters in inventory', 
      reward: 15000, 
      type: 'coins', 
      difficulty: 'medium', 
      category: 'achievement',
      icon: <Star size={16} />,
      check: (p) => (p.inventory?.length || 0) >= 10 
    },
    { 
      id: 'a4', 
      title: t.shadowMonarch || 'Shadow Monarch', 
      desc: t.shadowMonarchDesc || 'Reach Level 250', 
      reward: 500000, 
      type: 'coins', 
      difficulty: 'hard', 
      category: 'achievement',
      icon: <Trophy size={16} />,
      check: (p) => p.level >= 250 
    },
    { 
      id: 'a5', 
      title: t.absoluteBeing || 'Absolute Being', 
      desc: t.absoluteBeingDesc || 'Reach Level 1000', 
      reward: 5000000, 
      type: 'coins', 
      difficulty: 'hard', 
      category: 'achievement',
      icon: <Trophy size={16} />,
      check: (p) => p.level >= 1000 
    },
  ];

  for (let i = 1; i <= 20; i++) {
    quests.push({
      id: `extra_${i}`,
      title: `${t.quest || 'Quest'} #${i + 5}`,
      desc: `${t.achievementMilestone || 'Achievement milestone'} #${i}`,
      reward: 5000 * i,
      type: 'coins',
      difficulty: i < 7 ? 'easy' : i < 14 ? 'medium' : 'hard',
      category: 'achievement',
      icon: <Star size={16} />,
      check: (p) => p.level >= i * 10
    });
  }

  const isQuestCompleted = (questId: string, category: string) => {
    if (!profile) return false;
    if (category === 'daily') {
      return profile.completedDailyQuests?.includes(questId) || false;
    }
    return profile.completedQuests?.includes(questId) || false;
  };

  const handleClaim = async (quest: Quest) => {
    if (!profile || isQuestCompleted(quest.id, quest.category)) return;
    if (!quest.check(profile)) {
      alert(t.questRequirementsNotMet || "Quest requirements not met yet!");
      return;
    }

    try {
      const userRef = doc(db, 'users', profile.uid);
      
      let finalAmount = quest.reward;
      let finalXp = quest.difficulty === 'easy' ? 2 : quest.difficulty === 'medium' ? 10 : 50;
      
      const now = new Date().toISOString();
      const hasDoubleCoins = profile.activeBoosts?.double_coins && profile.activeBoosts.double_coins > now;
      const hasDoubleXp = profile.activeBoosts?.double_xp && profile.activeBoosts.double_xp > now;

      if (hasDoubleCoins && quest.type === 'coins') {
        finalAmount *= 2;
      }
      if (hasDoubleXp) {
        finalXp *= 2;
      }

      const updates: any = {
        [quest.type]: increment(finalAmount),
        xp: increment(finalXp),
      };

      if (quest.category === 'daily') {
        updates.completedDailyQuests = arrayUnion(quest.id);
      } else {
        updates.completedQuests = arrayUnion(quest.id);
      }

      await updateDoc(userRef, updates);
      alert(`${t.claimed || 'Claimed'} ${finalAmount} ${quest.type}!`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
      alert(t.failedToClaimReward || 'Failed to claim reward.');
    }
  };

  if (!profile) return null;

  const filteredQuests = quests.filter(q => q.category === activeTab);
  
  const completedCount = filteredQuests.filter(q => isQuestCompleted(q.id, q.category)).length;
  const totalCount = filteredQuests.length;
  const progressPercentage = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  const claimableQuests = filteredQuests.filter(q => !isQuestCompleted(q.id, q.category) && q.check(profile));

  const handleClaimAll = async () => {
    if (!profile || claimableQuests.length === 0) return;
    
    try {
      const userRef = doc(db, 'users', profile.uid);
      let totalCoins = 0;
      let totalEnergy = 0;
      let totalXp = 0;
      const dailyQuestIds: string[] = [];
      const achievementIds: string[] = [];

      const now = new Date().toISOString();
      const hasDoubleCoins = profile.activeBoosts?.double_coins && profile.activeBoosts.double_coins > now;
      const hasDoubleXp = profile.activeBoosts?.double_xp && profile.activeBoosts.double_xp > now;

      claimableQuests.forEach(quest => {
        let finalAmount = quest.reward;
        let finalXp = quest.difficulty === 'easy' ? 2 : quest.difficulty === 'medium' ? 10 : 50;
        
        if (hasDoubleCoins && quest.type === 'coins') {
          finalAmount *= 2;
        }
        if (hasDoubleXp) {
          finalXp *= 2;
        }

        if (quest.type === 'coins') totalCoins += finalAmount;
        if (quest.type === 'energy') totalEnergy += finalAmount;
        totalXp += finalXp;
        
        if (quest.category === 'daily') {
          dailyQuestIds.push(quest.id);
        } else {
          achievementIds.push(quest.id);
        }
      });

      const updates: any = {
        xp: increment(totalXp),
      };
      if (totalCoins > 0) updates.coins = increment(totalCoins);
      if (totalEnergy > 0) updates.energy = increment(totalEnergy);
      
      if (dailyQuestIds.length > 0) {
        updates.completedDailyQuests = arrayUnion(...dailyQuestIds);
      }
      if (achievementIds.length > 0) {
        updates.completedQuests = arrayUnion(...achievementIds);
      }

      await updateDoc(userRef, updates);
      alert(t.claimedAllRewards || 'Claimed all rewards!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
      alert(t.failedToClaimReward || 'Failed to claim reward.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-cyan-500/20 rounded-2xl border border-cyan-500/30">
            <Target className="w-8 h-8 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              {t.questsTitle}
            </h1>
            <p className="text-white/50 font-mono text-sm mt-1">{t.completeTasks}</p>
          </div>
        </div>
        
        <div className="flex flex-col gap-2 w-full md:w-auto">
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 flex items-center gap-2">
            <Clock className="text-cyan-400" size={16} />
            <span className="text-sm font-bold text-white/70 uppercase tracking-widest">{t.resetsIn || 'Resets In'}:</span>
            <span className="text-cyan-400 font-mono font-bold">{timeLeft}</span>
          </div>
          <div className="w-full md:w-64 bg-black/40 border border-white/10 rounded-2xl p-4">
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs font-bold text-white/50 uppercase tracking-widest">{t.progress || 'Progress'}</span>
              <span className="text-lg font-black text-cyan-400 font-mono">{completedCount}/{totalCount}</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex flex-1 gap-4">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest transition-all border ${
              activeTab === 'daily' 
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]' 
                : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10'
            }`}
          >
            {t.dailyQuests || 'Daily Quests'}
          </button>
          <button
            onClick={() => setActiveTab('achievement')}
            className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest transition-all border ${
              activeTab === 'achievement' 
                ? 'bg-purple-500/20 border-purple-500/50 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.2)]' 
                : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10'
            }`}
          >
            {t.achievements || 'Achievements'}
          </button>
        </div>
        
        {claimableQuests.length > 0 && (
          <button
            onClick={handleClaimAll}
            className="py-4 px-8 rounded-2xl font-black uppercase tracking-widest bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all"
          >
            {t.claimAll || 'Claim All'} ({claimableQuests.length})
          </button>
        )}
      </div>

      <div className="grid gap-4">
        {filteredQuests.map((quest, i) => {
          const isCompleted = isQuestCompleted(quest.id, quest.category);
          const canClaim = quest.check(profile);
          
          return (
            <motion.div
              key={quest.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`p-6 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
                isCompleted 
                  ? 'bg-green-500/10 border-green-500/30 opacity-50' 
                  : canClaim
                    ? 'bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.1)]'
                    : 'bg-black/50 border-white/10'
              }`}
            >
              <div className="flex items-center gap-4">
                {isCompleted ? (
                  <CheckCircle2 className="w-8 h-8 text-green-400 shrink-0" />
                ) : canClaim ? (
                  <div className="w-8 h-8 rounded-full border-2 border-cyan-400 flex items-center justify-center shrink-0 animate-pulse">
                    <div className="w-4 h-4 rounded-full bg-cyan-400" />
                  </div>
                ) : (
                  <Circle className="w-8 h-8 text-white/20 shrink-0" />
                )}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-white">{quest.title}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest border ${
                      quest.difficulty === 'easy' ? 'bg-green-500/10 text-green-400 border-green-400/30' :
                      quest.difficulty === 'medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-400/30' :
                      'bg-red-500/10 text-red-400 border-red-400/30'
                    }`}>
                      {t[quest.difficulty]}
                    </span>
                  </div>
                  <p className="text-sm text-white/50">{quest.desc}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 w-full sm:w-auto mt-4 sm:mt-0">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-sm font-bold border ${
                  quest.type === 'coins' 
                    ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' 
                    : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                }`}>
                  {quest.icon} +{quest.reward}
                </div>
                
                <button
                  onClick={() => handleClaim(quest)}
                  disabled={isCompleted || !canClaim}
                  className={`flex-1 sm:flex-none px-6 py-2 rounded-xl font-bold tracking-widest uppercase transition-all ${
                    isCompleted
                      ? 'bg-green-500/20 text-green-400 cursor-not-allowed'
                      : canClaim
                        ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                        : 'bg-white/5 text-white/20 cursor-not-allowed'
                  }`}
                >
                  {isCompleted ? (t.claimed || 'Claimed') : (t.claim || 'Claim')}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
