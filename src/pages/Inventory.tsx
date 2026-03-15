import { useState, useMemo } from 'react';
import { useUserStore, getRank } from '../store/useUserStore';
import { translations } from '../translations';
import { Backpack, Star, Shield, Zap, DollarSign, Trophy, Target, TrendingUp, Layers } from 'lucide-react';
import { doc, updateDoc, arrayRemove, collection, addDoc, arrayUnion, increment, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export function Inventory() {
  const { profile, language } = useUserStore();
  const t = translations[language] as any;
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [sellingCard, setSellingCard] = useState<any>(null);
  const [sellPrice, setSellPrice] = useState<number>(1000);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!profile) return null;

  const cards = profile.inventory || [];
  const rank = getRank(profile.level);

  // Group cards by a unique key (characterName + mediaTitle + rarity)
  const groupedCards = useMemo(() => {
    const groups: Record<string, any[]> = {};
    cards.forEach(card => {
      const key = `${card.characterName}-${card.mediaTitle}-${card.rarity}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(card);
    });
    return Object.values(groups).sort((a, b) => {
      const rarityOrder: Record<string, number> = { 'SSR': 4, 'Epic': 3, 'Rare': 2, 'Common': 1 };
      return (rarityOrder[b[0].rarity] || 0) - (rarityOrder[a[0].rarity] || 0);
    });
  }, [cards]);

  const handleSellClick = (card: any) => {
    setSellingCard(card);
    // Enforce price floors
    const floor = card.rarity === 'SSR' ? 500000 : card.rarity === 'Epic' ? 100000 : card.rarity === 'Rare' ? 25000 : 5000;
    setSellPrice(floor);
  };

  const confirmSell = async () => {
    if (!profile || !sellingCard || sellPrice <= 0) return;
    
    const floor = sellingCard.rarity === 'SSR' ? 500000 : sellingCard.rarity === 'Epic' ? 100000 : sellingCard.rarity === 'Rare' ? 25000 : 5000;
    if (sellPrice < floor) {
      alert(`${t.minPriceFor || 'Minimum price for'} ${sellingCard.rarity} ${t.is || 'is'} ${floor} ${t.gold || 'Gold'}!`);
      return;
    }

    setIsProcessing(true);

    try {
      const batch = writeBatch(db);
      const userRef = doc(db, 'users', profile.uid);
      
      batch.update(userRef, {
        inventory: arrayRemove(sellingCard)
      });

      const listingRef = doc(collection(db, 'market_listings'));
      batch.set(listingRef, {
        sellerId: profile.uid,
        sellerName: profile.nickname || profile.displayName,
        card: sellingCard,
        price: sellPrice,
        createdAt: new Date().toISOString()
      });

      await batch.commit();

      setSellingCard(null);
      setSelectedGroup(null);
      alert(t.cardListed || 'Card listed on the Black Market!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'market_listings');
      alert(t.failedListCard || 'Failed to list card.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMerge = async (group: any[]) => {
    if (group.length < 2 || !profile) return;
    
    // Find two cards with the same merge level to merge
    // Sort by mergeLevel to easily find pairs
    const sortedGroup = [...group].sort((a, b) => (a.mergeLevel || 0) - (b.mergeLevel || 0));
    
    let card1 = null;
    let card2 = null;
    
    for (let i = 0; i < sortedGroup.length - 1; i++) {
        if ((sortedGroup[i].mergeLevel || 0) === (sortedGroup[i+1].mergeLevel || 0)) {
            card1 = sortedGroup[i];
            card2 = sortedGroup[i+1];
            break;
        }
    }

    if (!card1 || !card2) {
        alert(t.needTwoIdenticalCards || "You need two identical cards of the same merge level to evolve.");
        return;
    }
    
    const baseCost = card1.rarity === 'SSR' ? 1000000 : card1.rarity === 'Epic' ? 250000 : card1.rarity === 'Rare' ? 50000 : 10000;
    const currentMergeLevel = card1.mergeLevel || 0;
    const mergeCost = Math.floor(baseCost * Math.pow(2.5, currentMergeLevel)); // Exponential scaling
    
    if (profile.coins < mergeCost) {
      alert(`${t.need || 'You need'} ${mergeCost.toLocaleString()} ${t.goldToMerge || 'Gold to merge these level'} ${currentMergeLevel} ${t.cards || 'cards.'}`);
      return;
    }
    
    setIsProcessing(true);

    try {
      // Create merged card with boosted stats (+15% base stats)
      const mergedCard = {
        ...card1,
        id: crypto.randomUUID(), // New ID
        atk: Math.floor(card1.atk * 1.15),
        def: Math.floor(card1.def * 1.15),
        spd: Math.floor(card1.spd * 1.15),
        mergeLevel: currentMergeLevel + 1,
        durability: 100 // Reset durability on merge
      };

      const batch = writeBatch(db);
      const userRef = doc(db, 'users', profile.uid);
      
      // Atomic update: modify the array in memory and write it back
      const newInventory = [...(profile.inventory || [])];
      const idx1 = newInventory.findIndex(c => c.id === card1.id);
      if (idx1 !== -1) newInventory.splice(idx1, 1);
      const idx2 = newInventory.findIndex(c => c.id === card2.id);
      if (idx2 !== -1) newInventory.splice(idx2, 1);
      
      newInventory.push(mergedCard);

      batch.update(userRef, {
        inventory: newInventory,
        coins: increment(-mergeCost)
      });

      await batch.commit();

      setSelectedGroup(null);
      alert(`${t.cardsEvolved || 'Cards evolved to Level'} ${currentMergeLevel + 1}! ${t.statsIncreased || 'Stats increased by 15%. Cost:'} ${mergeCost.toLocaleString()} ${t.gold || 'Gold.'}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
      alert(t.failedMerge || 'Failed to merge cards.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRepair = async (group: any[]) => {
    if (!profile) return;
    
    let totalCost = 0;
    let cardsToRepair = 0;
    
    group.forEach(card => {
      const currentDurability = card.durability !== undefined ? card.durability : 100;
      if (currentDurability < 100) {
        totalCost += (100 - currentDurability) * 1000; // 1000 Gold per 1% durability
        cardsToRepair++;
      }
    });

    if (cardsToRepair === 0) {
      alert(t.allCardsRepaired || "All cards in this group are already at 100% durability.");
      return;
    }

    if (profile.coins < totalCost) {
      alert(`${t.need || 'You need'} ${totalCost.toLocaleString()} ${t.goldToRepair || 'Gold to fully repair these cards.'}`);
      return;
    }

    setIsProcessing(true);

    try {
      const batch = writeBatch(db);
      const userRef = doc(db, 'users', profile.uid);
      
      let updatedInventory = [...(profile.inventory || [])];
      
      group.forEach(card => {
        const currentDurability = card.durability !== undefined ? card.durability : 100;
        if (currentDurability < 100) {
          const idx = updatedInventory.findIndex(c => c.id === card.id);
          if (idx !== -1) {
            updatedInventory[idx] = { ...updatedInventory[idx], durability: 100 };
          }
        }
      });

      batch.update(userRef, {
        inventory: updatedInventory,
        coins: increment(-totalCost)
      });

      await batch.commit();

      setSelectedGroup(null);
      alert(`${t.successfullyRepaired || 'Successfully repaired'} ${cardsToRepair} ${t.cardsFor || 'card(s) for'} ${totalCost.toLocaleString()} ${t.gold || 'Gold.'}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
      alert(t.failedRepair || 'Failed to repair cards.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto relative space-y-8">
      {/* User Stats Header */}
      <div className="bg-gradient-to-br from-purple-900/40 to-black p-8 rounded-[2rem] border border-purple-500/20 shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
          <Backpack size={200} className="text-purple-500 rotate-12" />
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className="relative">
            <div className="w-32 h-32 rounded-3xl overflow-hidden border-4 border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.3)] bg-purple-900/20 flex items-center justify-center">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="text-4xl font-black text-purple-500">
                  {(profile.nickname || profile.displayName || '?').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="absolute -bottom-4 -right-4 bg-purple-600 px-4 py-1 rounded-full border-2 border-black font-black text-sm shadow-lg">
              LVL {profile.level}
            </div>
          </div>

          <div className="flex-1 text-center md:text-left">
            <h1 className="text-4xl font-black tracking-widest uppercase text-white mb-2">
              {profile.nickname || profile.displayName}
            </h1>
            <div className="flex flex-wrap justify-center md:justify-start gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                <Trophy size={16} className="text-yellow-400" />
                <span className="text-sm font-black text-yellow-400 uppercase tracking-widest">{rank}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                <TrendingUp size={16} className="text-cyan-400" />
                <span className="text-sm font-mono font-bold text-cyan-400">{profile.xp.toLocaleString()} XP</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                <Target size={16} className="text-green-400" />
                <span className="text-sm font-mono font-bold text-green-400">{profile.completedQuests?.length || 0} {t.quests || 'Quests'}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
            <div className="p-4 bg-black/40 rounded-2xl border border-white/5 text-center">
              <div className="text-xs text-white/40 uppercase font-black mb-1">{t.gold || 'Gold'}</div>
              <div className="text-xl font-mono font-black text-yellow-500">{profile.coins.toLocaleString()}</div>
            </div>
            <div className="p-4 bg-black/40 rounded-2xl border border-white/5 text-center">
              <div className="text-xs text-white/40 uppercase font-black mb-1">{t.energy || 'Energy'}</div>
              <div className="text-xl font-mono font-black text-cyan-500">{profile.energy}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-500/20 rounded-xl border border-purple-500/30">
            <Backpack className="w-6 h-6 text-purple-400" />
          </div>
          <h2 className="text-2xl font-black tracking-widest uppercase text-white">
            {t.inventoryTitle} ({cards.length})
          </h2>
        </div>
      </div>

      {groupedCards.length === 0 ? (
        <div className="text-center py-20 text-white/50 border border-dashed border-white/10 rounded-2xl bg-white/5">
          {t.noCards || 'No cards collected yet. Go to the Altar of Summons!'}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {groupedCards.map((group, i) => {
            const card = group[0];
            const count = group.length;
            let color = 'text-gray-400 border-gray-400';
            if (card.rarity === 'SSR') color = 'text-purple-400 border-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.3)]';
            if (card.rarity === 'Epic') color = 'text-yellow-400 border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.2)]';
            if (card.rarity === 'Rare') color = 'text-cyan-400 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]';

            return (
              <motion.div 
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedGroup(group)}
                className={`relative aspect-[2/3] rounded-xl overflow-hidden border-2 bg-black group cursor-pointer ${color}`}
              >
                <img 
                  src={card.imageUrl} 
                  alt={card.characterName}
                  className="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                
                <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/80 backdrop-blur-md rounded-full font-black tracking-widest text-[10px] border border-current">
                  {card.rarity}
                </div>

                {count > 1 && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-blue-500/80 backdrop-blur-md rounded-full font-black tracking-widest text-[10px] border border-blue-400 text-white">
                    x{count}
                  </div>
                )}

                {card.mergeLevel > 0 && (
                  <div className="absolute top-8 left-2 px-2 py-0.5 bg-yellow-500/80 backdrop-blur-md rounded-full font-black tracking-widest text-[10px] border border-yellow-400 text-black flex items-center gap-1">
                    <Star size={8} /> +{card.mergeLevel}
                  </div>
                )}

                {card.durability !== undefined && (
                  <div className="absolute top-2 right-12 px-2 py-0.5 bg-red-500/80 backdrop-blur-md rounded-full font-black tracking-widest text-[10px] border border-red-400 text-white flex items-center gap-1">
                    {card.durability}%
                  </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-3 bg-black/80 backdrop-blur-md border-t border-white/10">
                  <h2 className="text-sm font-black mb-0.5 truncate">{card.characterName}</h2>
                  <p className="text-[10px] text-white/50 uppercase tracking-widest mb-2 truncate">{card.mediaTitle}</p>
                  
                  <div className="grid grid-cols-3 gap-1 text-center font-mono text-[10px]">
                    <div className="bg-red-500/20 text-red-400 py-0.5 rounded border border-red-500/30">
                      <div className="text-[8px] uppercase opacity-70">ATK</div>
                      {card.atk}
                    </div>
                    <div className="bg-blue-500/20 text-blue-400 py-0.5 rounded border border-blue-500/30">
                      <div className="text-[8px] uppercase opacity-70">DEF</div>
                      {card.def}
                    </div>
                    <div className="bg-green-500/20 text-green-400 py-0.5 rounded border border-green-500/30">
                      <div className="text-[8px] uppercase opacity-70">SPD</div>
                      {card.spd}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Group Modal */}
      <AnimatePresence>
        {selectedGroup && !sellingCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedGroup(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            >
              <h2 className="text-2xl font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                {t.cardActions || 'Card Actions'}
              </h2>
              
              <div className="flex gap-4 mb-6">
                <img src={selectedGroup[0].imageUrl} alt="" className="w-20 h-28 object-cover rounded-lg border border-white/10" referrerPolicy="no-referrer" />
                <div>
                  <h3 className="font-bold text-lg">{selectedGroup[0].characterName}</h3>
                  <p className="text-sm text-white/50">{selectedGroup[0].rarity}</p>
                  <p className="text-sm text-cyan-400 font-mono mt-1">{t.owned || 'Owned'}: {selectedGroup.length}</p>
                  {selectedGroup[0].mergeLevel > 0 && (
                    <p className="text-xs text-yellow-400 font-bold mt-1">{t.mergeLevel || 'Merge Level'}: +{selectedGroup[0].mergeLevel}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handleSellClick(selectedGroup[0])}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                >
                  <DollarSign size={16} /> {t.sellOneCopy || 'Sell One Copy'}
                </button>
                
                {selectedGroup.length > 1 && (
                  <button
                    onClick={() => handleMerge(selectedGroup)}
                    disabled={isProcessing}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Layers size={16} /> {t.merge || 'Merge'} ({Math.floor((selectedGroup[0].rarity === 'SSR' ? 1000000 : selectedGroup[0].rarity === 'Epic' ? 250000 : selectedGroup[0].rarity === 'Rare' ? 50000 : 10000) * Math.pow(2.5, selectedGroup[0].mergeLevel || 0)).toLocaleString()} G)
                  </button>
                )}

                {selectedGroup.some((c: any) => (c.durability !== undefined ? c.durability : 100) < 100) && (
                  <button
                    onClick={() => handleRepair(selectedGroup)}
                    disabled={isProcessing}
                    className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Shield size={16} /> {t.repairAll || 'Repair All'}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sell Modal */}
      <AnimatePresence>
        {sellingCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            >
              <h2 className="text-2xl font-black uppercase tracking-widest mb-4">{t.sellCard || 'Sell Card'}</h2>
              
              <div className="flex gap-4 mb-6">
                <img src={sellingCard.imageUrl} alt="" className="w-20 h-28 object-cover rounded-lg border border-white/10" referrerPolicy="no-referrer" />
                <div>
                  <h3 className="font-bold text-lg">{sellingCard.characterName}</h3>
                  <p className="text-sm text-white/50">{sellingCard.rarity}</p>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">{t.priceGold || 'Price (Gold)'}</label>
                <input
                  type="number"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(Number(e.target.value))}
                  min="1"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-yellow-500/50 transition-colors font-mono text-yellow-400"
                />
                <p className="text-xs text-white/40 mt-2">{t.taxDeducted || '30% tax will be deducted upon sale.'}</p>
                <p className="text-[10px] text-red-400 mt-1 font-bold">
                  {t.priceFloor || 'Price Floor'}: {(sellingCard.rarity === 'SSR' ? 500000 : sellingCard.rarity === 'Epic' ? 100000 : sellingCard.rarity === 'Rare' ? 25000 : 5000).toLocaleString()} {t.gold || 'Gold'}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setSellingCard(null)}
                  disabled={isProcessing}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  {t.cancel || 'Cancel'}
                </button>
                <button
                  onClick={confirmSell}
                  disabled={isProcessing || sellPrice <= 0}
                  className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase tracking-widest rounded-xl transition-colors disabled:opacity-50"
                >
                  {isProcessing ? (t.listing || 'Listing...') : (t.listItem || 'List Item')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
