import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { collection, query, orderBy, limit, getDocs, doc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { useUserStore } from '../store/useUserStore';
import { Swords, Shield, Trophy, Target, AlertTriangle, Crosshair, Crown } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export function Arena() {
  const { profile, trackArenaAttack } = useUserStore();
  const [opponents, setOpponents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [battleStatus, setBattleStatus] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [isFighting, setIsFighting] = useState(false);
  const [activeTab, setActiveTab] = useState<'pvp' | 'tournament' | 'worldboss'>('pvp');
  const [worldBoss, setWorldBoss] = useState<any>(null);

  const fetchOpponents = async () => {
    try {
      // In a real app, we'd filter by similar level/power. For now, just get top players.
      const q = query(collection(db, 'users'), orderBy('xp', 'desc'), limit(20));
      const snapshot = await getDocs(q);
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(user => user.id !== profile?.uid); // Exclude self
      
      // Shuffle and pick 3 random opponents
      const shuffled = data.sort(() => 0.5 - Math.random());
      setOpponents(shuffled.slice(0, 3));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorldBoss = async () => {
    try {
      const q = query(collection(db, 'worldBosses'), limit(1));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setWorldBoss({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      } else {
        // Create a mock boss for demo purposes if none exists
        setWorldBoss({
          id: 'mock-boss',
          name: 'The Abyssal Leviathan',
          maxHp: 10000000,
          currentHp: 8500000,
          status: 'active',
          endTime: new Date(Date.now() + 86400000).toISOString()
        });
      }
    } catch (error) {
      console.error("Failed to fetch world boss", error);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchOpponents();
      fetchWorldBoss();
    }
  }, [profile]);

  const calculatePower = (user: any) => {
    let base = user?.basePower || 0;
    if (!user?.inventory || user.inventory.length === 0) return base;
    const sortedCards = [...user.inventory].sort((a, b) => {
      const powerA = (a.atk || 0) + (a.def || 0) + (a.spd || 0);
      const powerB = (b.atk || 0) + (b.def || 0) + (b.spd || 0);
      return powerB - powerA;
    });
    const top3 = sortedCards.slice(0, 3);
    const cardsPower = top3.reduce((total, card) => total + (card.atk || 0) + (card.def || 0) + (card.spd || 0), 0);
    return base + cardsPower;
  };

  const myPower = calculatePower(profile);

  const handleAttack = async (opponent: any) => {
    if (!profile) return;
    if (profile.energy < 30) {
      setBattleStatus({ message: "Not enough energy. Requires 30 E.", type: 'error' });
      return;
    }

    setIsFighting(true);
    setBattleStatus({ message: `Engaging ${opponent.nickname || opponent.displayName}...`, type: 'info' });

    setTimeout(async () => {
      try {
        const opponentPower = calculatePower(opponent);
        
        // Win chance based on power difference
        let winChance = 0.5;
        if (myPower > opponentPower) {
          winChance = Math.min(0.9, 0.5 + ((myPower - opponentPower) / myPower) * 0.5);
        } else if (opponentPower > myPower) {
          winChance = Math.max(0.1, 0.5 - ((opponentPower - myPower) / opponentPower) * 0.5);
        }

        const success = Math.random() < winChance;
        const userRef = doc(db, 'users', profile.uid);
        
        // Track attack for daily quest
        await trackArenaAttack();

        if (success) {
          const rewardGold = Math.floor(Math.random() * 1500) + 500;
          const rewardXp = 250;
          await updateDoc(userRef, {
            coins: increment(rewardGold),
            xp: increment(rewardXp),
            energy: increment(-30)
          });
          setBattleStatus({ 
            message: `VICTORY! You defeated ${opponent.nickname || opponent.displayName}. Gained ${rewardGold} G and ${rewardXp} XP.`, 
            type: 'success' 
          });
        } else {
          const penaltyGold = Math.floor(Math.random() * 3000) + 2000;
          await updateDoc(userRef, {
            coins: increment(-penaltyGold),
            energy: increment(-30)
          });
          setBattleStatus({ 
            message: `DEFEAT! You were crushed by ${opponent.nickname || opponent.displayName}. Lost ${penaltyGold} G.`, 
            type: 'error' 
          });
        }
        fetchOpponents(); // Refresh opponents
      } catch (error) {
        console.error("Battle failed", error);
        setBattleStatus({ message: "A system error occurred during combat.", type: 'error' });
      } finally {
        setIsFighting(false);
      }
    }, 2000);
  };

  const handleTournamentJoin = async () => {
    if (!profile) return;
    if (profile.coins < 250000) {
      setBattleStatus({ message: "Not enough Gold to enter the Tournament. Requires 250,000 G.", type: 'error' });
      return;
    }
    
    setIsFighting(true);
    setBattleStatus({ message: "Entering the Grand Tournament...", type: 'info' });

    setTimeout(async () => {
      try {
        const userRef = doc(db, 'users', profile.uid);
        
        // Tournament simulation
        const winChance = Math.min(0.3, myPower / 500000); // Max 30% chance if power is 150k+
        const success = Math.random() < winChance;

        if (success) {
          const rewardGold = 1000000;
          const rewardXp = 50000;
          await updateDoc(userRef, {
            coins: increment(rewardGold - 250000), // Deduct entry fee, add reward
            xp: increment(rewardXp),
            profileBanner: 'tournament_champion', // New banner
            unlockedBanners: arrayUnion('tournament_champion')
          });
          setBattleStatus({ 
            message: `CHAMPION! You won the Grand Tournament! Gained ${rewardGold.toLocaleString()} G, ${rewardXp.toLocaleString()} XP, and a new Banner!`, 
            type: 'success' 
          });
        } else {
          await updateDoc(userRef, {
            coins: increment(-250000)
          });
          setBattleStatus({ 
            message: `ELIMINATED! You were knocked out of the Tournament. Lost 250,000 G entry fee.`, 
            type: 'error' 
          });
        }
      } catch (error) {
        console.error("Tournament failed", error);
        setBattleStatus({ message: "A system error occurred during the tournament.", type: 'error' });
      } finally {
        setIsFighting(false);
      }
    }, 3000);
  };

  const handleWorldBossAttack = async () => {
    if (!profile || !worldBoss) return;
    if (profile.energy < 50) {
      setBattleStatus({ message: "Not enough energy. Requires 50 E.", type: 'error' });
      return;
    }

    setIsFighting(true);
    setBattleStatus({ message: `Attacking ${worldBoss.name}...`, type: 'info' });

    setTimeout(async () => {
      try {
        const damage = Math.floor(myPower * (0.8 + Math.random() * 0.4)); // 80% to 120% of power
        const userRef = doc(db, 'users', profile.uid);
        
        // In a real app, we'd update the worldBoss document atomically with a transaction
        // For this prototype, we'll just update the user's damage and give a small immediate reward
        const rewardGold = Math.floor(damage / 100);
        
        await updateDoc(userRef, {
          worldBossDamage: increment(damage),
          coins: increment(rewardGold),
          energy: increment(-50)
        });

        setBattleStatus({ 
          message: `You dealt ${damage.toLocaleString()} damage to ${worldBoss.name}! Gained ${rewardGold.toLocaleString()} G.`, 
          type: 'success' 
        });
        
        // Update local state for immediate feedback
        setWorldBoss(prev => ({
          ...prev,
          currentHp: Math.max(0, prev.currentHp - damage)
        }));
      } catch (error) {
        console.error("World Boss attack failed", error);
        setBattleStatus({ message: "A system error occurred during combat.", type: 'error' });
      } finally {
        setIsFighting(false);
      }
    }, 2000);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-[60vh]"><div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto">
      {battleStatus && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-2xl border shadow-2xl flex items-center gap-3 ${
            battleStatus.type === 'success' ? 'bg-green-500/20 border-green-500/50 text-green-400' :
            battleStatus.type === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-400' :
            'bg-blue-500/20 border-blue-500/50 text-blue-400'
          }`}
        >
          {battleStatus.type === 'error' ? <AlertTriangle size={20} /> : battleStatus.type === 'success' ? <Trophy size={20} /> : <Swords size={20} className="animate-pulse" />}
          <span className="font-bold tracking-wide">{battleStatus.message}</span>
          <button onClick={() => setBattleStatus(null)} className="ml-4 opacity-50 hover:opacity-100">×</button>
        </motion.div>
      )}

      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-red-500/20 rounded-2xl border border-red-500/30">
            <Crosshair className="w-8 h-8 text-red-500" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">
              The Arena
            </h1>
            <p className="text-white/50 font-mono text-sm mt-1">Hunt other players. Steal their glory.</p>
          </div>
        </div>
        
        <div className="text-right bg-white/5 p-4 rounded-2xl border border-white/10">
          <p className="text-xs text-white/50 font-bold uppercase tracking-widest mb-1">Your Combat Power</p>
          <p className="text-3xl font-black text-red-400 font-mono">{myPower.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex gap-4 mb-8">
        <button
          onClick={() => setActiveTab('pvp')}
          className={`px-6 py-3 rounded-xl font-bold tracking-widest uppercase transition-all ${
            activeTab === 'pvp'
              ? 'bg-red-500/20 text-red-400 border border-red-500/50'
              : 'bg-white/5 text-white/50 hover:bg-white/10 border border-transparent'
          }`}
        >
          PvP Battles
        </button>
        <button
          onClick={() => setActiveTab('tournament')}
          className={`px-6 py-3 rounded-xl font-bold tracking-widest uppercase transition-all flex items-center gap-2 ${
            activeTab === 'tournament'
              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
              : 'bg-white/5 text-white/50 hover:bg-white/10 border border-transparent'
          }`}
        >
          <Crown size={18} /> Grand Tournament
        </button>
        <button
          onClick={() => setActiveTab('worldboss')}
          className={`px-6 py-3 rounded-xl font-bold tracking-widest uppercase transition-all flex items-center gap-2 ${
            activeTab === 'worldboss'
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
              : 'bg-white/5 text-white/50 hover:bg-white/10 border border-transparent'
          }`}
        >
          <AlertTriangle size={18} /> World Boss
        </button>
      </div>

      {activeTab === 'pvp' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {opponents.map((opponent, index) => {
              const opponentPower = calculatePower(opponent);
              const powerDiff = myPower - opponentPower;
              let difficultyColor = 'text-yellow-400';
              let difficultyText = 'Even Match';
              
              if (powerDiff > 5000) {
                difficultyColor = 'text-green-400';
                difficultyText = 'Easy Target';
              } else if (powerDiff < -5000) {
                difficultyColor = 'text-red-500';
                difficultyText = 'Deadly';
              }

              return (
                <motion.div
                  key={opponent.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-black/40 border border-white/10 rounded-3xl p-6 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex justify-between items-start mb-6">
                    <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-white font-black text-2xl border-2 border-white/10">
                      {(opponent.nickname || opponent.displayName || '?').charAt(0).toUpperCase()}
                      {opponent.profileBanner === 'abyssal_conqueror' && (
                        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest border border-red-900 shadow-lg transform rotate-12">
                          SS
                        </div>
                      )}
                      {opponent.profileBanner === 'tournament_champion' && (
                        <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest border border-yellow-900 shadow-lg transform rotate-12">
                          CHAMP
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white/50 font-bold uppercase tracking-widest mb-1">Est. Power</p>
                      <p className="text-xl font-black text-white font-mono">{opponentPower.toLocaleString()}</p>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-1 truncate">{opponent.nickname || opponent.displayName}</h3>
                  <p className="text-sm text-white/50 font-mono mb-6">Level {opponent.level || 1} • {opponent.rank || 'F'} Rank</p>

                  <div className="flex justify-between items-center mb-6 px-4 py-2 bg-white/5 rounded-xl border border-white/5">
                    <span className="text-xs text-white/50 uppercase font-bold tracking-widest">Threat Level</span>
                    <span className={`text-sm font-black uppercase tracking-widest ${difficultyColor}`}>{difficultyText}</span>
                  </div>

                  <button
                    onClick={() => handleAttack(opponent)}
                    disabled={isFighting || (profile?.energy || 0) < 30}
                    className={`w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                      isFighting ? 'bg-gray-600 text-gray-400 cursor-not-allowed' :
                      (profile?.energy || 0) < 30 ? 'bg-white/5 text-white/30 cursor-not-allowed' :
                      'bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 hover:border-red-500/50 hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]'
                    }`}
                  >
                    <Swords size={18} />
                    {isFighting ? 'Battling...' : 'Attack (30 E)'}
                  </button>
                </motion.div>
              );
            })}
          </div>
          
          <div className="mt-8 text-center">
            <button 
              onClick={fetchOpponents}
              disabled={loading || isFighting}
              className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl font-bold uppercase tracking-widest transition-colors text-sm"
            >
              Find New Opponents
            </button>
          </div>
        </>
      ) : activeTab === 'tournament' ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-black/40 border border-yellow-500/20 rounded-3xl p-8 text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-yellow-500/5 to-transparent pointer-events-none" />
          
          <Crown className="w-24 h-24 text-yellow-500 mx-auto mb-6 opacity-80" />
          <h2 className="text-3xl font-black uppercase tracking-widest text-yellow-400 mb-4">The Grand Tournament</h2>
          <p className="text-white/60 max-w-2xl mx-auto mb-8 leading-relaxed">
            Enter the weekly Grand Tournament to prove your worth. The entry fee is steep, and the competition is fierce. Only the strongest will survive to claim the grand prize and the exclusive Champion's Banner.
          </p>

          <div className="flex justify-center gap-8 mb-12">
            <div className="bg-white/5 p-6 rounded-2xl border border-white/10 min-w-[200px]">
              <p className="text-xs text-white/50 font-bold uppercase tracking-widest mb-2">Entry Fee</p>
              <p className="text-2xl font-black text-red-400 font-mono">250,000 G</p>
            </div>
            <div className="bg-white/5 p-6 rounded-2xl border border-white/10 min-w-[200px]">
              <p className="text-xs text-white/50 font-bold uppercase tracking-widest mb-2">Grand Prize</p>
              <p className="text-2xl font-black text-yellow-400 font-mono">1,000,000 G</p>
              <p className="text-sm text-purple-400 font-bold mt-1">+ Exclusive Banner</p>
            </div>
          </div>

          <button
            onClick={handleTournamentJoin}
            disabled={isFighting || (profile?.coins || 0) < 250000}
            className={`px-12 py-5 rounded-2xl font-black text-xl uppercase tracking-widest transition-all ${
              isFighting ? 'bg-gray-600 text-gray-400 cursor-not-allowed' :
              (profile?.coins || 0) < 250000 ? 'bg-white/5 text-white/30 cursor-not-allowed' :
              'bg-gradient-to-r from-yellow-600 to-orange-500 hover:from-yellow-500 hover:to-orange-400 text-white shadow-[0_0_30px_rgba(234,179,8,0.3)] hover:shadow-[0_0_50px_rgba(234,179,8,0.5)]'
            }`}
          >
            {isFighting ? 'In Tournament...' : 'Enter Tournament'}
          </button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-black/40 border border-purple-500/20 rounded-3xl p-8 text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-purple-500/5 to-transparent pointer-events-none" />
          
          <AlertTriangle className="w-24 h-24 text-purple-500 mx-auto mb-6 opacity-80" />
          <h2 className="text-3xl font-black uppercase tracking-widest text-purple-400 mb-4">{worldBoss?.name || 'Unknown Calamity'}</h2>
          <p className="text-white/60 max-w-2xl mx-auto mb-8 leading-relaxed">
            A Global Calamity has appeared. All players must unite to defeat it before the timer expires. Failure will result in a server-wide penalty.
          </p>

          {worldBoss && (
            <div className="max-w-3xl mx-auto mb-12">
              <div className="flex justify-between text-sm font-bold uppercase tracking-widest text-white/70 mb-2">
                <span>Boss HP</span>
                <span className="font-mono text-purple-400">{worldBoss.currentHp.toLocaleString()} / {worldBoss.maxHp.toLocaleString()}</span>
              </div>
              <div className="h-6 bg-black/50 rounded-full border border-white/10 overflow-hidden relative">
                <div 
                  className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-purple-600 to-red-500 transition-all duration-1000"
                  style={{ width: `${(worldBoss.currentHp / worldBoss.maxHp) * 100}%` }}
                />
              </div>
              <div className="mt-4 text-sm text-white/50 font-mono">
                Time Remaining: {Math.max(0, Math.floor((new Date(worldBoss.endTime).getTime() - Date.now()) / (1000 * 60 * 60)))} hours
              </div>
            </div>
          )}

          <div className="flex justify-center gap-8 mb-12">
            <div className="bg-white/5 p-6 rounded-2xl border border-white/10 min-w-[200px]">
              <p className="text-xs text-white/50 font-bold uppercase tracking-widest mb-2">Your Damage</p>
              <p className="text-2xl font-black text-cyan-400 font-mono">{(profile?.worldBossDamage || 0).toLocaleString()}</p>
            </div>
            <div className="bg-white/5 p-6 rounded-2xl border border-white/10 min-w-[200px]">
              <p className="text-xs text-white/50 font-bold uppercase tracking-widest mb-2">Participation Reward</p>
              <p className="text-2xl font-black text-purple-400 font-mono">Void Crystals</p>
            </div>
          </div>

          <button
            onClick={handleWorldBossAttack}
            disabled={isFighting || (profile?.energy || 0) < 50}
            className={`px-12 py-5 rounded-2xl font-black text-xl uppercase tracking-widest transition-all ${
              isFighting ? 'bg-gray-600 text-gray-400 cursor-not-allowed' :
              (profile?.energy || 0) < 50 ? 'bg-white/5 text-white/30 cursor-not-allowed' :
              'bg-gradient-to-r from-purple-600 to-red-600 hover:from-purple-500 hover:to-red-500 text-white shadow-[0_0_30px_rgba(168,85,247,0.3)] hover:shadow-[0_0_50px_rgba(168,85,247,0.5)]'
            }`}
          >
            {isFighting ? 'Attacking...' : 'Attack Boss (50 E)'}
          </button>
        </motion.div>
      )}
    </div>
  );
}
