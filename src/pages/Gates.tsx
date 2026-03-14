import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { useUserStore } from '../store/useUserStore';
import { Skull, ShieldAlert, Zap, Coins, Trophy, AlertTriangle, ArrowDownToLine, DoorOpen } from 'lucide-react';
import { translations } from '../translations';

export function Gates() {
  const { profile, language } = useUserStore();
  const t = translations[language] as any;
  const [combatStatus, setCombatStatus] = useState<{message: string, type: 'success' | 'error' | 'info'} | null>(null);
  const [isFighting, setIsFighting] = useState(false);

  if (!profile) return null;

  // Calculate total power from top 3 cards in inventory
  const calculatePower = () => {
    if (!profile.inventory || profile.inventory.length === 0) return 0;
    const sortedCards = [...profile.inventory].sort((a, b) => {
      const powerA = (a.atk || 0) + (a.def || 0) + (a.spd || 0);
      const powerB = (b.atk || 0) + (b.def || 0) + (b.spd || 0);
      return powerB - powerA;
    });
    
    const top3 = sortedCards.slice(0, 3);
    return top3.reduce((total, card) => total + (card.atk || 0) + (card.def || 0) + (card.spd || 0), 0);
  };

  const totalPower = calculatePower();
  const currentFloor = profile.abyssFloor || 0;
  const accumulatedRewards = profile.abyssRewards || { gold: 0, xp: 0, voidCrystals: 0, abyssalDust: 0 };

  const floorPowerReq = currentFloor === 0 ? 0 : Math.floor(100 * Math.pow(1.5, currentFloor - 1));
  const winProbability = currentFloor === 0 ? 1 : Math.max(0.01, Math.min(0.95, totalPower / (floorPowerReq * 1.2)));

  const handleEnterAbyss = async () => {
    if (profile.energy < 50) {
      setCombatStatus({ message: "Requires 50 Energy to open the Abyss Gate.", type: 'error' });
      return;
    }

    setIsFighting(true);
    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        energy: increment(-50),
        abyssFloor: 1,
        abyssRewards: { gold: 0, xp: 0, voidCrystals: 0, abyssalDust: 0 }
      });
      setCombatStatus({ message: "You have entered the Eternal Abyss.", type: 'info' });
    } catch (e) {
      console.error(e);
      setCombatStatus({ message: "Failed to enter the Abyss.", type: 'error' });
    } finally {
      setIsFighting(false);
    }
  };

  const handleDescend = async () => {
    setIsFighting(true);
    setCombatStatus({ message: `Descending to Floor ${currentFloor}...`, type: 'info' });

    setTimeout(async () => {
      try {
        const userRef = doc(db, 'users', profile.uid);
        const success = Math.random() < winProbability;

        if (success) {
          // Calculate rewards for this floor
          const floorGold = Math.floor(1000 * Math.pow(1.2, currentFloor));
          const floorXp = Math.floor(100 * Math.pow(1.1, currentFloor));
          const floorVC = currentFloor % 5 === 0 ? Math.floor(currentFloor / 5) : 0;
          const floorDust = currentFloor % 2 === 0 ? Math.floor(currentFloor / 2) : 0;

          const newRewards = {
            gold: accumulatedRewards.gold + floorGold,
            xp: accumulatedRewards.xp + floorXp,
            voidCrystals: (accumulatedRewards.voidCrystals || 0) + floorVC,
            abyssalDust: (accumulatedRewards.abyssalDust || 0) + floorDust
          };

          // Apply durability loss to top 3 cards
          let updatedInventory = [...(profile.inventory || [])];
          const sortedCards = [...updatedInventory].sort((a, b) => {
            const powerA = (a.atk || 0) + (a.def || 0) + (a.spd || 0);
            const powerB = (b.atk || 0) + (b.def || 0) + (b.spd || 0);
            return powerB - powerA;
          });
          
          const top3Indices = sortedCards.slice(0, 3).map(card => updatedInventory.findIndex(c => c.id === card.id));
          
          let cardsDestroyed = 0;
          top3Indices.forEach(idx => {
            if (idx !== -1) {
              const card = updatedInventory[idx];
              const currentDurability = card.durability !== undefined ? card.durability : 100;
              const durabilityLoss = Math.floor(Math.random() * 5) + 1; // Lose 1-5 durability per floor
              
              if (currentDurability - durabilityLoss <= 0) {
                // Permadeath
                updatedInventory[idx] = null as any; // Mark for deletion
                cardsDestroyed++;
              } else {
                updatedInventory[idx] = { ...card, durability: currentDurability - durabilityLoss };
              }
            }
          });
          
          updatedInventory = updatedInventory.filter(card => card !== null);

          await updateDoc(userRef, {
            abyssFloor: currentFloor + 1,
            abyssRewards: newRewards,
            inventory: updatedInventory
          });
          
          let message = `Floor ${currentFloor} Cleared! Rewards added to pool.`;
          if (cardsDestroyed > 0) {
            message += ` WARNING: ${cardsDestroyed} card(s) were destroyed permanently!`;
          }

          setCombatStatus({ 
            message: message, 
            type: cardsDestroyed > 0 ? 'error' : 'success' 
          });
        } else {
          // Failure: Lose all accumulated rewards, take a penalty
          const penaltyGold = Math.floor(profile.coins * 0.05); // Lose 5% of total gold
          
          // Apply massive durability loss on failure
          let updatedInventory = [...(profile.inventory || [])];
          const sortedCards = [...updatedInventory].sort((a, b) => {
            const powerA = (a.atk || 0) + (a.def || 0) + (a.spd || 0);
            const powerB = (b.atk || 0) + (b.def || 0) + (b.spd || 0);
            return powerB - powerA;
          });
          
          const top3Indices = sortedCards.slice(0, 3).map(card => updatedInventory.findIndex(c => c.id === card.id));
          
          let cardsDestroyed = 0;
          top3Indices.forEach(idx => {
            if (idx !== -1) {
              const card = updatedInventory[idx];
              const currentDurability = card.durability !== undefined ? card.durability : 100;
              const durabilityLoss = Math.floor(Math.random() * 20) + 10; // Lose 10-30 durability on failure
              
              if (currentDurability - durabilityLoss <= 0) {
                // Permadeath
                updatedInventory[idx] = null as any; // Mark for deletion
                cardsDestroyed++;
              } else {
                updatedInventory[idx] = { ...card, durability: currentDurability - durabilityLoss };
              }
            }
          });
          
          updatedInventory = updatedInventory.filter(card => card !== null);

          await updateDoc(userRef, {
            abyssFloor: 0,
            abyssRewards: { gold: 0, xp: 0, voidCrystals: 0, abyssalDust: 0 },
            coins: increment(-penaltyGold),
            inventory: updatedInventory
          });
          
          let message = `DEFEAT! You were consumed by the Abyss. Lost all accumulated rewards and ${penaltyGold.toLocaleString()} Gold.`;
          if (cardsDestroyed > 0) {
            message += ` ${cardsDestroyed} card(s) were destroyed permanently!`;
          }

          setCombatStatus({ 
            message: message, 
            type: 'error' 
          });
        }
      } catch (e) {
        console.error(e);
        setCombatStatus({ message: "An error occurred in the Abyss.", type: 'error' });
      } finally {
        setIsFighting(false);
      }
    }, 1500);
  };

  const handleExtract = async () => {
    setIsFighting(true);
    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        abyssFloor: 0,
        abyssRewards: { gold: 0, xp: 0, voidCrystals: 0, abyssalDust: 0 },
        coins: increment(accumulatedRewards.gold),
        xp: increment(accumulatedRewards.xp),
        voidCrystals: increment(accumulatedRewards.voidCrystals || 0),
        abyssalDust: increment(accumulatedRewards.abyssalDust || 0)
      });
      setCombatStatus({ 
        message: `Successfully extracted! Claimed ${accumulatedRewards.gold.toLocaleString()} Gold and ${accumulatedRewards.xp.toLocaleString()} XP.`, 
        type: 'success' 
      });
    } catch (e) {
      console.error(e);
      setCombatStatus({ message: "Failed to extract.", type: 'error' });
    } finally {
      setIsFighting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-black tracking-widest uppercase mb-4 text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-purple-600">
          The Eternal Abyss
        </h1>
        <p className="text-white/60 max-w-2xl mx-auto">
          Descend into the infinite depths. Risk everything for exponential rewards. If you fall, the Abyss claims your accumulated loot and a portion of your wealth.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Status Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
            <h2 className="text-xl font-bold uppercase tracking-widest mb-4 flex items-center gap-2 text-red-400">
              <Skull size={20} /> Abyss Status
            </h2>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-white/50 text-sm uppercase tracking-wider">Current Floor</span>
                <span className="font-mono text-2xl font-bold text-white">{currentFloor === 0 ? '-' : currentFloor}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-white/50 text-sm uppercase tracking-wider">Your Power</span>
                <span className="font-mono text-xl font-bold text-cyan-400">{totalPower.toLocaleString()}</span>
              </div>

              {currentFloor > 0 && (
                <>
                  <div className="flex justify-between items-center p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                    <span className="text-red-400/70 text-sm uppercase tracking-wider">Floor Power Req</span>
                    <span className="font-mono text-xl font-bold text-red-400">{floorPowerReq.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                    <span className="text-yellow-400/70 text-sm uppercase tracking-wider">Survival Chance</span>
                    <span className="font-mono text-xl font-bold text-yellow-400">{(winProbability * 100).toFixed(1)}%</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Accumulated Rewards */}
          {currentFloor > 0 && (
            <div className="bg-black/40 border border-yellow-500/30 rounded-2xl p-6 backdrop-blur-md shadow-[0_0_30px_rgba(234,179,8,0.1)]">
              <h2 className="text-xl font-bold uppercase tracking-widest mb-4 flex items-center gap-2 text-yellow-400">
                <Trophy size={20} /> Accumulated Loot
              </h2>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-white/50 text-sm">Gold</span>
                  <span className="font-mono text-yellow-400 font-bold">+{accumulatedRewards.gold.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/50 text-sm">XP</span>
                  <span className="font-mono text-blue-400 font-bold">+{accumulatedRewards.xp.toLocaleString()}</span>
                </div>
                {(accumulatedRewards.voidCrystals || 0) > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-white/50 text-sm">Void Crystals</span>
                    <span className="font-mono text-purple-400 font-bold">+{accumulatedRewards.voidCrystals}</span>
                  </div>
                )}
                {(accumulatedRewards.abyssalDust || 0) > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-white/50 text-sm">Abyssal Dust</span>
                    <span className="font-mono text-gray-400 font-bold">+{accumulatedRewards.abyssalDust}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Panel */}
        <div className="lg:col-span-2">
          <div className="bg-black/40 border border-white/10 rounded-2xl p-8 backdrop-blur-md h-full flex flex-col justify-center items-center text-center relative overflow-hidden">
            
            {/* Background Effect */}
            <div className="absolute inset-0 opacity-20 pointer-events-none flex items-center justify-center">
              <div className="w-96 h-96 bg-red-600/30 rounded-full blur-[100px] animate-pulse" />
            </div>

            <AnimatePresence mode="wait">
              {combatStatus && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`absolute top-8 left-8 right-8 p-4 rounded-xl border backdrop-blur-md z-20 ${
                    combatStatus.type === 'success' ? 'bg-green-500/20 border-green-500/50 text-green-400' :
                    combatStatus.type === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-400' :
                    'bg-blue-500/20 border-blue-500/50 text-blue-400'
                  }`}
                >
                  <p className="font-bold tracking-wider">{combatStatus.message}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative z-10 w-full max-w-md space-y-6">
              {currentFloor === 0 ? (
                <>
                  <Skull size={80} className="mx-auto text-red-500/50 mb-6" />
                  <button
                    onClick={handleEnterAbyss}
                    disabled={isFighting || profile.energy < 50}
                    className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_0_30px_rgba(220,38,38,0.3)] hover:shadow-[0_0_50px_rgba(220,38,38,0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  >
                    <DoorOpen size={24} /> Enter Abyss (50 Energy)
                  </button>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={handleDescend}
                      disabled={isFighting}
                      className="py-6 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 text-red-400 hover:text-red-300 font-black uppercase tracking-widest rounded-xl transition-all flex flex-col items-center justify-center gap-3 disabled:opacity-50"
                    >
                      <ArrowDownToLine size={32} />
                      Descend Deeper
                    </button>
                    
                    <button
                      onClick={handleExtract}
                      disabled={isFighting}
                      className="py-6 bg-green-600/20 hover:bg-green-600/40 border border-green-500/50 text-green-400 hover:text-green-300 font-black uppercase tracking-widest rounded-xl transition-all flex flex-col items-center justify-center gap-3 disabled:opacity-50"
                    >
                      <Zap size={32} />
                      Extract Loot
                    </button>
                  </div>
                  
                  <div className="p-4 bg-red-900/30 border border-red-500/30 rounded-xl flex items-start gap-3 text-left">
                    <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-200/70">
                      Warning: Defeat means losing all accumulated loot and 5% of your total Gold.
                    </p>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
