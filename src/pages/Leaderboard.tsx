import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { collection, query, orderBy, limit, getDocs, doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Trophy, Swords, Crown, AlertTriangle, Clock } from 'lucide-react';
import { useUserStore } from '../store/useUserStore';
import { translations } from '../translations';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export function Leaderboard() {
  const { language, profile } = useUserStore();
  const t = translations[language] as any;
  const [leaders, setLeaders] = useState<any[]>([]);
  const [timeLeaders, setTimeLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [raidStatus, setRaidStatus] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [activeTab, setActiveTab] = useState<'xp' | 'time'>('xp');
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const d = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
      const dayOfWeek = d.getDay();
      const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      
      const nextSunday = new Date(d);
      nextSunday.setDate(d.getDate() + daysUntilSunday);
      nextSunday.setHours(23, 59, 59, 999);
      
      const diff = nextSunday.getTime() - d.getTime();
      if (diff <= 0) {
        setTimeLeft('00:00:00:00');
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const mins = Math.floor((diff / 1000 / 60) % 60);
      const secs = Math.floor((diff / 1000) % 60);
      
      setTimeLeft(`${days}d ${hours.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`);
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchLeaders = async () => {
    try {
      const qXp = query(collection(db, 'users'), orderBy('xp', 'desc'), limit(50));
      const snapshotXp = await getDocs(qXp);
      const dataXp = snapshotXp.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLeaders(dataXp);

      const qTime = query(collection(db, 'users'), orderBy('timeSpent', 'desc'), limit(50));
      const snapshotTime = await getDocs(qTime);
      const dataTime = snapshotTime.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTimeLeaders(dataTime);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaders();
  }, []);

  const handleRaid = async (target: any) => {
    if (!profile) return;
    if (profile.uid === target.uid) {
      setRaidStatus({ message: "You cannot raid yourself, Hunter.", type: 'error' });
      return;
    }
    if (profile.energy < 30) {
      setRaidStatus({ message: t.notEnoughEnergy, type: 'error' });
      return;
    }

    try {
      const success = Math.random() > 0.6; // 40% success rate
      const userRef = doc(db, 'users', profile.uid);
      const targetRef = doc(db, 'users', target.uid);

      if (success) {
        const stolenAmount = Math.floor((target.coins || 0) * 0.01); // Steal 1% (Hellish)
        if (stolenAmount > 0) {
          await updateDoc(userRef, {
            coins: increment(stolenAmount),
            energy: increment(-30),
            xp: increment(10)
          });
          await updateDoc(targetRef, {
            coins: increment(-stolenAmount)
          });
          setRaidStatus({ message: `Raid Successful! You stole ${stolenAmount} Gold from ${target.nickname || target.displayName}`, type: 'success' });
        } else {
          setRaidStatus({ message: "Raid Successful, but the target is broke.", type: 'info' });
          await updateDoc(userRef, { energy: increment(-30) });
        }
      } else {
        const penalty = 5000; // Hellish penalty
        await updateDoc(userRef, {
          coins: increment(-penalty),
          energy: increment(-30)
        });
        setRaidStatus({ message: `Raid Failed! You were caught and fined ${penalty} Gold.`, type: 'error' });
      }
      fetchLeaders();
    } catch (error) {
      console.error("Raid failed", error);
    }
  };

  const currentWeek = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7)).toString();

  const handleClaimReward = async () => {
    if (!profile || (activeTab === 'xp' ? leaders[0]?.id : timeLeaders[0]?.id) !== profile.uid) return;
    
    if (profile.lastChampionReward === currentWeek) {
      setRaidStatus({ message: "You have already claimed your reward for this week.", type: 'error' });
      return;
    }
    
    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        coins: increment(5000), // Reduced reward
        xp: increment(500),
        lastChampionReward: currentWeek,
        championWeek: currentWeek,
        profileBanner: 'tournament_champion'
      });
      setRaidStatus({ message: "Weekly Champion Reward Claimed! +5,000 Gold, +500 XP", type: 'success' });
      fetchLeaders();
    } catch (error) {
      console.error("Claim failed", error);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-[60vh]"><div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const displayList = activeTab === 'xp' ? leaders : timeLeaders;

  return (
    <div className="max-w-4xl mx-auto">
      {raidStatus && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-2xl border shadow-2xl flex items-center gap-3 ${
            raidStatus.type === 'success' ? 'bg-green-500/20 border-green-500/50 text-green-400' :
            raidStatus.type === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-400' :
            'bg-blue-500/20 border-blue-500/50 text-blue-400'
          }`}
        >
          {raidStatus.type === 'error' ? <AlertTriangle size={20} /> : <Swords size={20} />}
          <span className="font-bold tracking-wide">{raidStatus.message}</span>
          <button onClick={() => setRaidStatus(null)} className="ml-4 opacity-50 hover:opacity-100">×</button>
        </motion.div>
      )}

      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-purple-500/20 rounded-2xl border border-purple-500/30">
            <Trophy className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-cyan-400">
              {t.rankingsTitle}
            </h1>
            <p className="text-white/50 font-mono text-sm mt-1">{t.topHunters}</p>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-xs text-white/50 uppercase tracking-widest mb-1">Week Ends In</div>
          <div className="font-mono text-xl text-yellow-400 font-bold bg-black/50 px-4 py-2 rounded-lg border border-yellow-500/30">
            {timeLeft}
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-8">
        <button
          onClick={() => setActiveTab('xp')}
          className={`flex-1 py-4 font-black uppercase tracking-widest rounded-xl transition-all border ${
            activeTab === 'xp' 
              ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' 
              : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
          }`}
        >
          Top Hunters (XP)
        </button>
        <button
          onClick={() => setActiveTab('time')}
          className={`flex-1 py-4 font-black uppercase tracking-widest rounded-xl transition-all border ${
            activeTab === 'time' 
              ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' 
              : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
          }`}
        >
          Most Dedicated (Time)
        </button>
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-6 mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Crown className="text-yellow-400 w-10 h-10 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-yellow-400 text-lg uppercase tracking-widest">{t.weeklyRewardTitle}</h3>
            <p className="text-sm text-white/70">Top player in either category receives a special reward at the end of the week.</p>
          </div>
        </div>
        {profile && displayList[0]?.id === profile.uid && (
          <button
            onClick={handleClaimReward}
            disabled={profile.lastChampionReward === currentWeek}
            className={`px-6 py-3 font-black uppercase tracking-widest rounded-xl transition-all ${
              profile.lastChampionReward === currentWeek 
                ? 'bg-yellow-500/20 text-yellow-500/50 cursor-not-allowed' 
                : 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-[0_0_20px_rgba(234,179,8,0.3)]'
            }`}
          >
            {profile.lastChampionReward === currentWeek ? 'Claimed' : 'Claim'}
          </button>
        )}
      </div>

      <div className="space-y-4">
        {displayList.map((user, index) => (
          <motion.div
            key={user.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`flex items-center gap-6 p-4 rounded-xl border ${
              index === 0 ? 'bg-yellow-500/10 border-yellow-500/30 shadow-[0_0_30px_rgba(234,179,8,0.1)]' :
              index === 1 ? 'bg-gray-300/10 border-gray-300/30' :
              index === 2 ? 'bg-orange-700/10 border-orange-700/30' :
              'bg-white/5 border-white/10'
            }`}
          >
            <div className={`text-2xl font-black w-8 text-center ${
              index === 0 ? 'text-yellow-400' :
              index === 1 ? 'text-gray-300' :
              index === 2 ? 'text-orange-400' :
              'text-white/30'
            }`}>
              #{index + 1}
            </div>

            <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-black text-xl border-2 border-white/20 shrink-0">
              {(user.nickname || user.displayName || '?').charAt(0).toUpperCase()}
              {user.profileBanner === 'abyssal_conqueror' && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest border border-red-900 shadow-lg transform rotate-12">
                  SS
                </div>
              )}
              {user.championWeek === currentWeek && (
                <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest border border-yellow-900 shadow-lg transform rotate-12">
                  CHAMP
                </div>
              )}
            </div>

            <div className="flex-1">
              <h3 className="font-bold text-lg flex items-center gap-2">
                {user.nickname || user.displayName}
                {index === 0 && <Crown size={16} className="text-yellow-400" />}
                {user.profileBanner === 'abyssal_conqueror' && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-black tracking-widest uppercase border border-red-500/30">Conqueror</span>}
                {user.championWeek === currentWeek && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded font-black tracking-widest uppercase border border-yellow-500/30">Champion</span>}
              </h3>
              <div className="flex items-center gap-4 text-xs font-mono text-white/50">
                <span className="text-purple-400">{t.rank} {user.rank || 'F'}</span>
                {activeTab === 'xp' ? (
                  <>
                    <span>{t.level}.{user.level || 1}</span>
                    <span>{(user.xp || 0).toLocaleString()} XP</span>
                  </>
                ) : (
                  <span className="flex items-center gap-1 text-cyan-400">
                    <Clock size={12} />
                    {Math.floor((user.timeSpent || 0) / 60)}h {(user.timeSpent || 0) % 60}m
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right hidden sm:block">
                <div className="text-yellow-400 font-mono text-sm">{(user.coins || 0).toLocaleString()} G</div>
                <div className="text-cyan-400 font-mono text-xs">{user.energy || 0}/100 E</div>
              </div>
              
              <button 
                onClick={() => handleRaid(user)}
                className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/30 transition-colors group"
                title="Raid (Steal Coins)"
              >
                <Swords className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
