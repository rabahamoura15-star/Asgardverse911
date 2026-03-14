import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { collection, query, orderBy, getDocs, doc, updateDoc, increment, deleteDoc, getDoc, arrayUnion, setDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useUserStore } from '../store/useUserStore';
import { ShoppingCart, Flame, Clock, Star, Tag, Sparkles } from 'lucide-react';
import { translations } from '../translations';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

const PREMIUM_ITEMS = [
  { id: 'name_change', name: 'Identity Forger', desc: 'Allows you to change your permanent nickname once.', cost: 50000, icon: '🎭', color: 'from-red-500 to-orange-500' },
  { id: 'double_xp', name: 'Abyssal Knowledge', desc: 'Double XP gain for 24 hours.', cost: 10000, icon: '🧠', color: 'from-purple-500 to-pink-500' },
  { id: 'double_coins', name: 'Midas Touch', desc: 'Double Gold gain for 24 hours.', cost: 10000, icon: '🪙', color: 'from-yellow-400 to-amber-600' },
  { id: 'energy_potion', name: 'Energy Potion', desc: 'Instantly restores 50 Energy.', cost: 5000, icon: '⚡', color: 'from-cyan-400 to-blue-600' },
  { id: 'protection_scroll', name: 'Protection Scroll', desc: 'Prevents XP and Gold loss from the next failed Gate.', cost: 15000, icon: '📜', color: 'from-blue-400 to-indigo-600' },
  { id: 'raid_shield', name: 'Raid Shield', desc: 'Protects your Gold from being raided for 24 hours.', cost: 20000, icon: '🛡️', color: 'from-slate-400 to-slate-600' },
  { id: 'arena_ticket', name: 'Arena Ticket', desc: 'Restores 20 Energy specifically for Arena battles.', cost: 2000, icon: '⚔️', color: 'from-red-400 to-red-600' },
  { id: 'guild_token', name: 'Guild Token', desc: 'Required to create a Guild.', cost: 50000, icon: '🏰', color: 'from-emerald-400 to-emerald-600' },
];

const BLACK_MARKET_ITEMS = [
  { id: 'smuggled_ssr', name: 'Smuggled SSR Ticket', desc: 'A guaranteed SSR pull. Highly illegal.', cost: 2500000, icon: '🎫', color: 'from-purple-900 to-black' },
  { id: 'cursed_energy', name: 'Cursed Energy', desc: 'Restores 100 Energy, but might drain 10% of your Gold.', cost: 10000, icon: '💀', color: 'from-red-900 to-black' },
  { id: 'mystery_box', name: 'Abyssal Mystery Box', desc: 'Could contain anything from 1 Gold to 200,000 Gold.', cost: 100000, icon: '📦', color: 'from-gray-800 to-black' },
  { id: 'stolen_stats', name: 'Stolen Stats', desc: 'Permanently increases your base power by 100. Very risky.', cost: 250000, icon: '💉', color: 'from-green-900 to-black' },
  { id: 'void_key', name: 'Void Key', desc: 'Grants access to the secret Void Gate.', cost: 2000000, icon: '🗝️', color: 'from-indigo-900 to-black' },
  { id: 'blood_contract', name: 'Blood Contract', desc: 'Sacrifice 90 Energy for a chance at massive wealth.', cost: 50000, icon: '🩸', color: 'from-red-950 to-black' },
  { id: 'forbidden_knowledge', name: 'Forbidden Knowledge', desc: 'Instantly grants 10,000 XP.', cost: 250000, icon: '👁️', color: 'from-fuchsia-900 to-black' },
];

const PRICE_FLOORS: Record<string, number> = {
  'SSR': 500000,
  'Epic': 100000,
  'Rare': 25000,
  'Normal': 5000
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
      const userRef = doc(db, 'users', profile.uid);
      const newInventory = [...(profile.inventory || [])];
      newInventory.splice(index, 1);

      await updateDoc(userRef, {
        inventory: newInventory
      });

      await setDoc(doc(collection(db, 'market_listings')), {
        sellerId: profile.uid,
        sellerName: profile.displayName,
        card,
        price,
        createdAt: new Date().toISOString()
      });

      setListingPrice(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      fetchListings();
      alert('Card listed successfully!');
    } catch (err) {
      console.error(err);
      setError('Failed to list card.');
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
      const userRef = doc(db, 'users', profile.uid);
      
      if (item.id === 'name_change') {
        await updateDoc(userRef, {
          coins: increment(-item.cost),
          nickname: '' // Reset nickname so modal appears
        });
        alert(`Successfully purchased ${item.name}! Please refresh to change your name.`);
      } else if (item.id === 'energy_potion') {
        await updateDoc(userRef, {
          coins: increment(-item.cost),
          energy: increment(50)
        });
        alert(`Successfully purchased ${item.name}! +50 Energy.`);
      } else if (item.id === 'smuggled_ssr') {
        // Give a random SSR card
        // In a real app, we'd pull from a database of SSRs. For now, we'll just give a placeholder or let them use it in Gacha.
        // Actually, let's just give them a pity counter boost or a direct card.
        // For simplicity, we'll just give them a "Smuggled SSR" item in inventory.
        await updateDoc(userRef, {
          coins: increment(-item.cost),
          inventory: arrayUnion({
            id: `smuggled_${Date.now()}`,
            characterName: "Unknown Abyssal Entity",
            mediaTitle: "The Black Market",
            imageUrl: "https://api.dicebear.com/7.x/shapes/svg?seed=abyss&backgroundColor=000000",
            rarity: "SSR",
            stats: { atk: 999, def: 999, spd: 999 },
            mergeLevel: 1
          })
        });
        alert(`Successfully purchased ${item.name}! Check your inventory.`);
      } else if (item.id === 'cursed_energy') {
        const drain = Math.floor(profile.coins * 0.1);
        await updateDoc(userRef, {
          coins: increment(-(item.cost + drain)),
          energy: increment(100)
        });
        alert(`Successfully purchased ${item.name}! +100 Energy, but you lost ${drain.toLocaleString()} Gold to the curse.`);
      } else if (item.id === 'mystery_box') {
        const reward = Math.floor(Math.random() * 200000) + 1;
        await updateDoc(userRef, {
          coins: increment(-item.cost + reward)
        });
        alert(`You opened the Mystery Box and found ${reward.toLocaleString()} Gold!`);
      } else if (item.id === 'stolen_stats') {
        await updateDoc(userRef, {
          coins: increment(-item.cost),
          basePower: increment(100)
        });
        alert(`Successfully purchased ${item.name}! Your base power increased by 100.`);
      } else if (item.id === 'void_key') {
        await updateDoc(userRef, {
          coins: increment(-item.cost),
          hasVoidKey: true
        });
        alert(`Successfully purchased ${item.name}! The Void Gate is now open to you.`);
      } else if (item.id === 'arena_ticket') {
        await updateDoc(userRef, {
          coins: increment(-item.cost),
          energy: increment(20)
        });
        alert(`Successfully purchased ${item.name}! +20 Energy for the Arena.`);
      } else if (item.id === 'blood_contract') {
        if (profile.energy < 90) {
          setError('You do not have enough Energy to sign the Blood Contract.');
          return;
        }
        const reward = Math.floor(Math.random() * 90000) + 10000;
        await updateDoc(userRef, {
          coins: increment(-item.cost + reward),
          energy: increment(-90)
        });
        alert(`You signed the Blood Contract. -90 Energy, +${reward.toLocaleString()} Gold!`);
      } else if (item.id === 'forbidden_knowledge') {
        await updateDoc(userRef, {
          coins: increment(-item.cost),
          xp: increment(10000)
        });
        alert(`You absorbed the Forbidden Knowledge. +10,000 XP!`);
      } else if (item.id === 'guild_token') {
        await updateDoc(userRef, {
          coins: increment(-item.cost),
          hasGuildToken: true
        });
        alert(`Successfully purchased ${item.name}! You can now create a Guild.`);
      } else {
        const expiry = new Date();
        expiry.setHours(expiry.getHours() + 24);
        await updateDoc(userRef, {
          coins: increment(-item.cost),
          [`activeBoosts.${item.id}`]: expiry.toISOString()
        });
        alert(`Successfully purchased ${item.name}!`);
      }
      
    } catch (err) {
      console.error(err);
      setError('Transaction failed. The Abyss reclaims its goods.');
    } finally {
      setBuying(null);
    }
  };

  const handleBuy = async (listing: any) => {
    if (!profile) return;
    if (profile.uid === listing.sellerId) {
      setError("You can't buy your own listing.");
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

      // Deduct from buyer and add card to inventory
      await updateDoc(doc(db, 'users', profile.uid), {
        coins: increment(-listing.price),
        inventory: arrayUnion(listing.card)
      });

      // Add to seller
      await updateDoc(doc(db, 'users', listing.sellerId), {
        coins: increment(sellerEarns)
      });

      // Delete listing
      await deleteDoc(doc(db, 'market_listings', listing.id));

      fetchListings();
      alert('Card purchased successfully!');
    } catch (err) {
      console.error(err);
      setError("Transaction failed.");
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
          <span>{isBlackMarketOpen ? `Closes in ${timeUntilClose}` : 'Black Market Closed'}</span>
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
            <Star className="text-yellow-400" /> Daily Shop
          </h2>
          <div className="text-sm font-mono text-white/50 bg-white/5 px-3 py-1 rounded-lg border border-white/10">
            Refreshes in 24h
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {dailyItems.map(item => (
            <div key={item.id} className="bg-black/40 border border-white/10 rounded-2xl p-6 relative overflow-hidden group">
              <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-5 group-hover:opacity-10 transition-opacity`} />
              <div className="text-4xl mb-4">{item.icon}</div>
              <h3 className="text-xl font-bold mb-2">{item.name}</h3>
              <p className="text-sm text-white/50 mb-6 h-10">{item.desc}</p>
              <div className="flex items-center justify-between">
                <span className="font-mono text-yellow-400 font-bold">{item.cost.toLocaleString()} G</span>
                {profile?.activeBoosts?.[item.id] && profile.activeBoosts[item.id] > new Date().toISOString() ? (
                  <span className="text-xs text-green-400 font-bold uppercase tracking-widest">Active</span>
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
            <Flame className="text-red-500" /> Contraband (Black Market)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
            {BLACK_MARKET_ITEMS.map(item => (
              <div key={item.id} className="bg-black/60 border border-red-500/20 rounded-2xl p-6 relative overflow-hidden group hover:border-red-500/50 transition-colors">
                <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-10 group-hover:opacity-20 transition-opacity`} />
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-bold mb-2 text-red-100">{item.name}</h3>
                <p className="text-sm text-red-200/50 mb-6 h-10">{item.desc}</p>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-red-400 font-bold">{item.cost.toLocaleString()} G</span>
                  <button
                    onClick={() => handleBuyPremium(item)}
                    disabled={buying === item.id || (profile?.coins || 0) < item.cost}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-200 disabled:opacity-50 rounded-lg font-bold text-sm transition-colors"
                  >
                    {buying === item.id ? '...' : 'Purchase'}
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
                <p className="text-[10px] text-white/50 uppercase mb-2">Seller: {listing.sellerName}</p>
                
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
              No listings available. The market is dead.
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
                  <span>Price Floor</span>
                  <span>{PRICE_FLOORS[card.rarity]?.toLocaleString()} G</span>
                </div>
                <input
                  type="number"
                  placeholder="Set Price..."
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
              Your inventory is empty. Go summon some souls.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
