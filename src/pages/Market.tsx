import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { collection, query, orderBy, getDocs, doc, updateDoc, increment, deleteDoc, getDoc, arrayUnion, setDoc, addDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useUserStore } from '../store/useUserStore';
import { ShoppingCart, Flame, Clock, Star, Tag, Sparkles } from 'lucide-react';
import { translations } from '../translations';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

const PREMIUM_ITEMS = [
  { id: 'name_change', name: 'identityForger', desc: 'identityForgerDesc', cost: 75000, icon: '🎭', color: 'from-red-500 to-orange-500' },
  { id: 'double_xp', name: 'abyssalKnowledge', desc: 'abyssalKnowledgeDesc', cost: 15000, icon: '🧠', color: 'from-purple-500 to-pink-500' },
  { id: 'double_coins', name: 'midasTouch', desc: 'midasTouchDesc', cost: 15000, icon: '🪙', color: 'from-yellow-400 to-amber-600' },
  { id: 'energy_potion', name: 'energyPotion', desc: 'energyPotionDesc', cost: 7500, icon: '⚡', color: 'from-cyan-400 to-blue-600' },
  { id: 'protection_scroll', name: 'protectionScroll', desc: 'protectionScrollDesc', cost: 25000, icon: '📜', color: 'from-blue-400 to-indigo-600' },
  { id: 'raid_shield', name: 'raidShield', desc: 'raidShieldDesc', cost: 30000, icon: '🛡️', color: 'from-slate-400 to-slate-600' },
  { id: 'arena_ticket', name: 'arenaTicket', desc: 'arenaTicketDesc', cost: 3000, icon: '⚔️', color: 'from-red-400 to-red-600' },
  { id: 'guild_token', name: 'guildToken', desc: 'guildTokenDesc', cost: 75000, icon: '🏰', color: 'from-emerald-400 to-emerald-600' },
];

const BLACK_MARKET_ITEMS = [
  { id: 'smuggled_ssr', name: 'smuggledSSR', desc: 'smuggledSSRDesc', cost: 3500000, icon: '🎫', color: 'from-purple-900 to-black' },
  { id: 'cursed_energy', name: 'cursedEnergy', desc: 'cursedEnergyDesc', cost: 15000, icon: '💀', color: 'from-red-900 to-black' },
  { id: 'mystery_box', name: 'mysteryBox', desc: 'mysteryBoxDesc', cost: 150000, icon: '📦', color: 'from-gray-800 to-black' },
  { id: 'stolen_stats', name: 'stolenStats', desc: 'stolenStatsDesc', cost: 400000, icon: '💉', color: 'from-green-900 to-black' },
  { id: 'void_key', name: 'voidKey', desc: 'voidKeyDesc', cost: 3000000, icon: '🗝️', color: 'from-indigo-900 to-black' },
  { id: 'blood_contract', name: 'bloodContract', desc: 'bloodContractDesc', cost: 75000, icon: '🩸', color: 'from-red-950 to-black' },
  { id: 'forbidden_knowledge', name: 'forbiddenKnowledge', desc: 'forbiddenKnowledgeDesc', cost: 400000, icon: '👁️', color: 'from-fuchsia-900 to-black' },
];

const PRICE_FLOORS: Record<string, number> = {
  'SSR': 750000,
  'Epic': 150000,
  'Rare': 40000,
  'Normal': 7500
};

export function Market() {
  const { profile, language, trackAction } = useUserStore();
  const t = translations[language] as any;
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [buying, setBuying] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [listingPrice, setListingPrice] = useState<Record<number, number>>({});
  const [isBlackMarketOpen, setIsBlackMarketOpen] = useState(false);
  const [timeUntilClose, setTimeUntilClose] = useState('');

  const [dailyItems, setDailyItems] = useState<typeof PREMIUM_ITEMS>([]);

  useEffect(() => {
    const getDailyItems = () => {
      const today = new Date().toISOString().split('T')[0];
      let hash = 0;
      for (let i = 0; i < today.length; i++) {
        hash = ((hash << 5) - hash) + today.charCodeAt(i);
        hash |= 0;
      }
      
      const numItems = 3;
      const selected = [];
      const available = [...PREMIUM_ITEMS];
      
      for (let i = 0; i < numItems; i++) {
        const index = Math.abs(hash + i * 17) % available.length;
        selected.push(available[index]);
        available.splice(index, 1);
      }
      return selected;
    };
    setDailyItems(getDailyItems());

    const checkBlackMarket = () => {
      const usDate = new Date(new Date().toLocaleString("en-US", {timeZone: "America/New_York"}));
      const hour = usDate.getHours();
      // Black market opens every 4 hours (0, 4, 8, 12, 16, 20) for 1 hour
      const isOpen = hour % 4 === 0;
      setIsBlackMarketOpen(isOpen);

      if (isOpen) {
        const nextClose = new Date(usDate);
        nextClose.setHours(hour + 1, 0, 0, 0);
        const diff = nextClose.getTime() - usDate.getTime();
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeUntilClose(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    };

    checkBlackMarket();
    const interval = setInterval(checkBlackMarket, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchListings = async () => {
    try {
      const q = query(collection(db, 'market_listings'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setListings(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'market_listings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
    trackAction('market');
  }, []);

  const handleListCard = async (card: any, index: number) => {
    if (!profile) return;
    const price = listingPrice[index];
    const floor = PRICE_FLOORS[card.rarity] || 0;

    if (!price || price < floor) {
      setError(`${t.invalidPrice} (${t.priceFloor}: ${floor.toLocaleString()} G)`);
      return;
    }

    setBuying('listing');
    try {
      const batch = writeBatch(db);
      const userRef = doc(db, 'users', profile.uid);
      const newInventory = [...(profile.inventory || [])];
      newInventory.splice(index, 1);

      batch.update(userRef, {
        inventory: newInventory
      });

      const listingRef = doc(collection(db, 'market_listings'));
      batch.set(listingRef, {
        sellerId: profile.uid,
        sellerName: profile.displayName,
        card,
        price,
        createdAt: new Date().toISOString()
      });

      await batch.commit();

      setListingPrice(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      fetchListings();
      alert(t.cardListed || 'Card listed successfully!');
    } catch (err) {
      console.error(err);
      setError(t.failedListCard || 'Failed to list card.');
    } finally {
      setBuying(null);
    }
  };

  const handleBuyPremium = async (item: typeof PREMIUM_ITEMS[0]) => {
    if (!profile) return;
    if (profile.coins < item.cost) {
      setError(`${t.notEnoughGold} (${item.cost.toLocaleString()} G)`);
      return;
    }

    setBuying(item.id);
    setError('');

    try {
      const batch = writeBatch(db);
      const userRef = doc(db, 'users', profile.uid);
      
      if (item.id === 'name_change') {
        batch.update(userRef, {
          coins: increment(-item.cost),
          nickname: '' // Reset nickname so modal appears
        });
        await batch.commit();
        alert(`${t.successfullyPurchased || 'Successfully purchased'} ${t[item.name] || item.name}! ${t.refreshToChangeName || 'Please refresh to change your name.'}`);
      } else if (item.id === 'energy_potion') {
        batch.update(userRef, {
          coins: increment(-item.cost),
          energy: increment(50)
        });
        await batch.commit();
        alert(`${t.successfullyPurchased || 'Successfully purchased'} ${t[item.name] || item.name}! +50 ${t.energy || 'Energy'}.`);
      } else if (item.id === 'smuggled_ssr') {
        batch.update(userRef, {
          coins: increment(-item.cost),
          inventory: arrayUnion({
            id: `smuggled_${Date.now()}`,
            characterName: "Unknown Abyssal Entity",
            mediaTitle: "The Black Market",
            imageUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=abyss&backgroundColor=000000",
            rarity: "SSR",
            atk: 999,
            def: 999,
            spd: 999,
            durability: 100,
            mergeLevel: 1
          })
        });
        await batch.commit();
        alert(`${t.successfullyPurchased || 'Successfully purchased'} ${t[item.name] || item.name}! ${t.checkInventory || 'Check your inventory.'}`);
      } else if (item.id === 'cursed_energy') {
        const drain = Math.floor(profile.coins * 0.1);
        batch.update(userRef, {
          coins: increment(-(item.cost + drain)),
          energy: increment(100)
        });
        await batch.commit();
        alert(`${t.successfullyPurchased || 'Successfully purchased'} ${t[item.name] || item.name}! +100 ${t.energy || 'Energy'}, ${t.lostGoldToCurse || 'but you lost'} ${drain.toLocaleString()} ${t.gold || 'Gold to the curse.'}`);
      } else if (item.id === 'mystery_box') {
        const reward = Math.floor(Math.random() * 200000) + 1;
        batch.update(userRef, {
          coins: increment(-item.cost + reward)
        });
        await batch.commit();
        alert(`${t.openedMysteryBox || 'You opened the Mystery Box and found'} ${reward.toLocaleString()} ${t.gold || 'Gold!'}`);
      } else if (item.id === 'stolen_stats') {
        batch.update(userRef, {
          coins: increment(-item.cost),
          basePower: increment(100)
        });
        await batch.commit();
        alert(`${t.successfullyPurchased || 'Successfully purchased'} ${t[item.name] || item.name}! ${t.basePowerIncreased || 'Your base power increased by 100.'}`);
      } else if (item.id === 'void_key') {
        batch.update(userRef, {
          coins: increment(-item.cost),
          hasVoidKey: true
        });
        await batch.commit();
        alert(`${t.successfullyPurchased || 'Successfully purchased'} ${t[item.name] || item.name}! ${t.voidGateOpen || 'The Void Gate is now open to you.'}`);
      } else if (item.id === 'arena_ticket') {
        batch.update(userRef, {
          coins: increment(-item.cost),
          energy: increment(20)
        });
        await batch.commit();
        alert(`${t.successfullyPurchased || 'Successfully purchased'} ${t[item.name] || item.name}! +20 ${t.energy || 'Energy'} ${t.forArena || 'for the Arena.'}`);
      } else if (item.id === 'blood_contract') {
        if (profile.energy < 90) {
          setError(t.notEnoughEnergyForContract || 'You do not have enough Energy to sign the Blood Contract.');
          return;
        }
        const reward = Math.floor(Math.random() * 90000) + 10000;
        batch.update(userRef, {
          coins: increment(-item.cost + reward),
          energy: increment(-90)
        });
        await batch.commit();
        alert(`${t.signedBloodContract || 'You signed the Blood Contract.'} -90 ${t.energy || 'Energy'}, +${reward.toLocaleString()} ${t.gold || 'Gold!'}`);
      } else if (item.id === 'forbidden_knowledge') {
        batch.update(userRef, {
          coins: increment(-item.cost),
          xp: increment(10000)
        });
        await batch.commit();
        alert(`${t.absorbedForbiddenKnowledge || 'You absorbed the Forbidden Knowledge.'} +10,000 XP!`);
      } else if (item.id === 'guild_token') {
        batch.update(userRef, {
          coins: increment(-item.cost),
          hasGuildToken: true
        });
        await batch.commit();
        alert(`${t.successfullyPurchased || 'Successfully purchased'} ${t[item.name] || item.name}! ${t.canCreateGuild || 'You can now create a Guild.'}`);
      } else {
        const expiry = new Date();
        expiry.setHours(expiry.getHours() + 24);
        batch.update(userRef, {
          coins: increment(-item.cost),
          [`activeBoosts.${item.id}`]: expiry.toISOString()
        });
        await batch.commit();
        alert(`${t.successfullyPurchased || 'Successfully purchased'} ${t[item.name] || item.name}!`);
      }
      
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'users');
      setError(t.transactionFailed || 'Transaction failed. The Abyss reclaims its goods.');
    } finally {
      setBuying(null);
    }
  };

  const handleBuy = async (listing: any) => {
    if (!profile) return;
    if (profile.uid === listing.sellerId) {
      setError(t.cantBuyOwnListing || "You can't buy your own listing.");
      return;
    }
    if (profile.coins < listing.price) {
      setError(t.notEnoughGold);
      return;
    }

    setBuying(listing.id);

    try {
      const tax = Math.floor(listing.price * 0.3);
      const sellerEarns = listing.price - tax;

      const batch = writeBatch(db);

      // Deduct from buyer and add card to inventory
      const buyerRef = doc(db, 'users', profile.uid);
      batch.update(buyerRef, {
        coins: increment(-listing.price),
        inventory: arrayUnion(listing.card)
      });

      // Add to seller
      const sellerRef = doc(db, 'users', listing.sellerId);
      batch.update(sellerRef, {
        coins: increment(sellerEarns)
      });

      // Delete listing
      const listingRef = doc(db, 'market_listings', listing.id);
      batch.delete(listingRef);

      await batch.commit();

      fetchListings();
      alert(t.cardPurchased || 'Card purchased successfully!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'market_listings');
      setError(t.transactionFailed || "Transaction failed.");
    } finally {
      setBuying(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-[60vh]"><div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-yellow-500/20 rounded-2xl border border-yellow-500/30">
            <ShoppingCart className="w-8 h-8 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-orange-400">
              {t.blackMarket}
            </h1>
            <p className="text-white/50 font-mono text-sm mt-1">{t.illegalGoods}</p>
          </div>
        </div>
        
        <div className={`flex items-center gap-2 px-4 py-2 ${isBlackMarketOpen ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-white/5 border-white/10 text-white/50'} border rounded-xl font-mono text-sm`}>
          <Clock size={16} /> 
          <span>{isBlackMarketOpen ? `${t.closesIn || 'Closes in'} ${timeUntilClose}` : (t.blackMarketClosed || 'Black Market Closed')}</span>
        </div>
      </div>

      {error && (
        <div className="mb-8 px-6 py-3 bg-red-500/20 border border-red-500 text-red-400 rounded-xl font-bold">
          {error}
        </div>
      )}

      {/* Premium Items Section (Daily Shop) */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black tracking-widest uppercase flex items-center gap-2">
            <Star className="text-yellow-400" /> {t.dailyShop || 'Daily Shop'}
          </h2>
          <div className="text-sm font-mono text-white/50 bg-white/5 px-3 py-1 rounded-lg border border-white/10">
            {t.refreshesIn24h || 'Refreshes in 24h'}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {dailyItems.map(item => (
            <div key={item.id} className="bg-black/40 border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
              <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-5 group-hover:opacity-10 transition-opacity`} />
              <div className="text-4xl mb-4">{item.icon}</div>
              <h3 className="text-xl font-bold mb-2">{t[item.name] || item.name}</h3>
              <p className="text-sm text-white/50 mb-6 h-10">{t[item.desc] || item.desc}</p>
              <div className="flex items-center justify-between">
                <span className="font-mono text-yellow-400 font-bold">{item.cost.toLocaleString()} G</span>
                {profile?.activeBoosts?.[item.id] && profile.activeBoosts[item.id] > new Date().toISOString() ? (
                  <span className="text-xs text-green-400 font-bold uppercase tracking-widest">{t.active || 'Active'}</span>
                ) : (
                  <button
                    onClick={() => handleBuyPremium(item)}
                    disabled={buying === item.id || (profile?.coins || 0) < item.cost}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-lg font-bold text-sm transition-colors"
                  >
                    {buying === item.id ? '...' : t.buy}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Black Market Items Section */}
      {isBlackMarketOpen && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 p-6 bg-red-900/10 border border-red-500/30 rounded-3xl relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-scales.png')] opacity-20" />
          <h2 className="text-2xl font-black tracking-widest uppercase mb-6 flex items-center gap-2 text-red-500 relative z-10">
            <Flame className="text-red-500" /> {t.contraband || 'Contraband (Black Market)'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
            {BLACK_MARKET_ITEMS.map(item => (
              <div key={item.id} className="bg-black/60 border border-red-500/20 rounded-2xl p-6 relative overflow-hidden group hover:border-red-500/50 transition-colors">
                <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-10 group-hover:opacity-20 transition-opacity`} />
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-bold mb-2 text-red-100">{t[item.name] || item.name}</h3>
                <p className="text-sm text-red-200/50 mb-6 h-10">{t[item.desc] || item.desc}</p>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-red-400 font-bold">{item.cost.toLocaleString()} G</span>
                  <button
                    onClick={() => handleBuyPremium(item)}
                    disabled={buying === item.id || (profile?.coins || 0) < item.cost}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-200 disabled:opacity-50 rounded-lg font-bold text-sm transition-colors"
                  >
                    {buying === item.id ? '...' : (t.purchase || 'Purchase')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="flex gap-4 mb-8 border-b border-white/5 pb-4">
        <button
          onClick={() => setActiveTab('buy')}
          className={`px-6 py-2 rounded-xl font-black uppercase tracking-widest transition-all ${
            activeTab === 'buy' ? 'bg-purple-500 text-white' : 'text-white/50 hover:text-white'
          }`}
        >
          {t.buyCard}
        </button>
        <button
          onClick={() => setActiveTab('sell')}
          className={`px-6 py-2 rounded-xl font-black uppercase tracking-widest transition-all ${
            activeTab === 'sell' ? 'bg-purple-500 text-white' : 'text-white/50 hover:text-white'
          }`}
        >
          {t.sellCard}
        </button>
      </div>

      {activeTab === 'buy' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {listings.map((listing) => (
            <motion.div
              key={listing.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`bg-black rounded-2xl border-2 overflow-hidden relative ${
                listing.card.rarity === 'SSR' ? 'border-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.3)]' :
                listing.card.rarity === 'Epic' ? 'border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.2)]' :
                listing.card.rarity === 'Rare' ? 'border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.1)]' :
                'border-gray-400'
              }`}
            >
              <div className="aspect-[3/4] relative">
                <img 
                  src={listing.card.imageUrl} 
                  alt={listing.card.characterName}
                  className="w-full h-full object-cover opacity-80"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                
                <div className="absolute top-2 right-2 px-2 py-1 bg-black/80 backdrop-blur-md rounded font-black tracking-widest text-xs border border-current">
                  {listing.card.rarity}
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-4 bg-black/90 backdrop-blur-md border-t border-white/10">
                <h2 className="text-lg font-black mb-1 truncate">{listing.card.characterName}</h2>
                <p className="text-[10px] text-white/50 uppercase mb-2">{t.seller || 'Seller'}: {listing.sellerName}</p>
                
                <div className="flex justify-between items-center mt-2">
                  <div className="text-yellow-400 font-mono font-bold flex items-center gap-1">
                    <Flame size={14} className="text-orange-500" />
                    {listing.price.toLocaleString()} G
                  </div>
                  <button 
                    onClick={() => handleBuy(listing)}
                    disabled={!!buying}
                    className="px-4 py-1.5 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded font-bold text-xs uppercase tracking-wider transition-colors"
                  >
                    {buying === listing.id ? '...' : t.buy}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
          {listings.length === 0 && (
            <div className="col-span-full py-20 text-center text-white/30 font-mono">
              {t.noListings || 'No listings available. The market is dead.'}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {profile?.inventory?.map((card, index) => (
            <div key={index} className="bg-black/40 border border-white/10 rounded-2xl p-4 flex flex-col gap-4">
              <div className="flex gap-4 items-center">
                {card.imageUrl ? (
                  <img src={card.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                    <Sparkles className="text-white/20 w-8 h-8" />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-bold truncate">{card.characterName}</h3>
                  <span className="text-[10px] uppercase font-black text-purple-400">{card.rarity}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] text-white/50 uppercase">
                  <span>{t.priceFloor || 'Price Floor'}</span>
                  <span>{PRICE_FLOORS[card.rarity]?.toLocaleString()} G</span>
                </div>
                <input
                  type="number"
                  placeholder={t.setPrice || "Set Price..."}
                  value={listingPrice[index] || ''}
                  onChange={(e) => setListingPrice(prev => ({ ...prev, [index]: parseInt(e.target.value) }))}
                  className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-purple-500 outline-none transition-colors"
                />
                <button
                  onClick={() => handleListCard(card, index)}
                  disabled={!!buying}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg font-bold text-xs uppercase tracking-widest transition-colors"
                >
                  {t.sellCard}
                </button>
              </div>
            </div>
          ))}
          {(!profile?.inventory || profile.inventory.length === 0) && (
            <div className="col-span-full py-20 text-center text-white/30 font-mono">
              {t.inventoryEmpty || 'Your inventory is empty. Go summon some souls.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
