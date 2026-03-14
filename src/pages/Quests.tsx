import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useUserStore } from '../store/useUserStore';
import { doc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { Target, CheckCircle2, Circle, Zap, Coins, Clock, Trophy, Star, ShoppingCart, Sparkles, Play } from 'lucide-react';
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
      title: 'Abyssal Endurance', 
      desc: 'Maintain active presence for 3 hours today (180 mins)', 
      reward: 10000, 
      type: 'coins', 
      difficulty: 'hard', 
      category: 'daily',
      icon: <Clock size={16} />,
      check: (p) => (p.dailyActiveMinutes || 0) >= 180 
    },
    { 
      id: 'd2', 
      title: 'Bloodlust', 
      desc: 'Engage in 5 Arena battles today', 
      reward: 5000, 
      type: 'coins', 
      difficulty: 'medium', 
      category: 'daily',
      icon: <Zap size={16} />,
      check: (p) => (p.todayArenaAttacks || 0) >= 5 
    },
    { 
      id: 'd3', 
      title: 'Gacha Addict', 
      desc: 'Burn 500,000 Gold in Summons today', 
      reward: 50, 
      type: 'energy', 
      difficulty: 'hard', 
      category: 'daily',
      icon: <Sparkles size={16} />,
      check: (p) => (p.todayGoldSpent || 0) >= 500000 
    },
    // Achievements
    { 
      id: 'a1', 
      title: 'Awakened', 
      desc: 'Reach Level 5', 
      reward: 10000, 
      type: 'coins', 
      difficulty: 'easy', 
      category: 'achievement',
      icon: <Star size={16} />,
      check: (p) => p.level >= 5 
    },
    { 
      id: 'a2', 
      title: 'C-Rank Hunter', 
      desc: 'Reach Level 25', 
      reward: 50000, 
      type: 'coins', 
      difficulty: 'medium', 
      category: 'achievement',
      icon: <Trophy size={16} />,
      check: (p) => p.level >= 25 
    },
    { 
      id: 'a3', 
      title: 'Collector', 
      desc: 'Have 10 characters in inventory', 
      reward: 25000, 
      type: 'coins', 
      difficulty: 'medium', 
      category: 'achievement',
      icon: <Star size={16} />,
      check: (p) => (p.inventory?.length || 0) >= 10 
    },
    { 
      id: 'a4', 
      title: 'Shadow Monarch', 
      desc: 'Reach Level 250', 
      reward: 1000000, 
      type: 'coins', 
      difficulty: 'hard', 
      category: 'achievement',
      icon: <Trophy size={16} />,
      check: (p) => p.level >= 250 
    },
    { 
      id: 'a5', 
      title: 'Absolute Being', 
      desc: 'Reach Level 1000', 
      reward: 10000000, 
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
      title: `Quest #${i + 5}`,
      desc: `Achievement milestone #${i}`,
      reward: 10000 * i,
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
      alert("Quest requirements not met yet!");
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
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
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
        dailyQuestIds.forEach(id => {
          updates.completedDailyQuests = arrayUnion(id);
        });
      }
      if (achievementIds.length > 0) {
        achievementIds.forEach(id => {
          updates.completedQuests = arrayUnion(id);
        });
      }

      await updateDoc(userRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
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
            <span className="text-sm font-bold text-white/70 uppercase tracking-widest">Resets In:</span>
            <span className="text-cyan-400 font-mono font-bold">{timeLeft}</span>
          </div>
          <div className="w-full md:w-64 bg-black/40 border border-white/10 rounded-2xl p-4">
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs font-bold text-white/50 uppercase tracking-widest">Progress</span>
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
            Daily Quests
          </button>
          <button
            onClick={() => setActiveTab('achievement')}
            className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest transition-all border ${
              activeTab === 'achievement' 
                ? 'bg-purple-500/20 border-purple-500/50 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.2)]' 
                : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10'
            }`}
          >
            Achievements
          </button>
        </div>
        
        {claimableQuests.length > 0 && (
          <button
            onClick={handleClaimAll}
            className="py-4 px-8 rounded-2xl font-black uppercase tracking-widest bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all"
          >
            Claim All ({claimableQuests.length})
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
                  {isCompleted ? t.claimed : t.claim}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
