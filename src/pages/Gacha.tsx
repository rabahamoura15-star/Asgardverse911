import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserStore } from '../store/useUserStore';
import { doc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { getRandomCharacter } from '../services/api';
import { Sparkles, Zap, Star } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { translations } from '../translations';
import { InterstitialAd } from '../components/InterstitialAd';

const BANNERS = [
  { id: 'standard', name: 'standardBanner', cost: 15000, energy: 25, color: 'from-blue-500 to-cyan-400', border: 'border-cyan-400' },
  { id: 'premium', name: 'premiumBanner', cost: 75000, energy: 50, color: 'from-purple-500 to-pink-500', border: 'border-purple-400' },
  { id: 'abyss', name: 'abyssBanner', cost: 350000, energy: 100, color: 'from-red-600 to-orange-500', border: 'border-red-500' },
  { id: 'void', name: 'voidBanner', cost: 1500000, energy: 200, color: 'from-indigo-900 to-black', border: 'border-indigo-500', requiresKey: true },
];

export function Gacha() {
  const { profile, language, trackAction, trackGoldSpent } = useUserStore();
  const t = translations[language];
  const [pulling, setPulling] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [activeBanner, setActiveBanner] = useState(BANNERS[0]);
  const [isAdOpen, setIsAdOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const handleAdClose = () => {
    setIsAdOpen(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const handlePullClick = () => {
    setPendingAction(() => handlePull);
    setIsAdOpen(true);
  };

  const handlePull = async () => {
    if (!profile) return;
    if (activeBanner.requiresKey && !profile.hasVoidKey) {
      setError(t.requiresVoidKey || 'Requires Void Key');
      return;
    }
    if (profile.coins < activeBanner.cost) {
      setError(t.notEnoughGold);
      return;
    }
    if (profile.energy < activeBanner.energy) {
      setError(t.notEnoughEnergy);
      return;
    }

    setError('');
    setPulling(true);
    setResult(null);
    trackAction('gacha');
    trackGoldSpent(activeBanner.cost);

    try {
      // Fetch character
      const char = await getRandomCharacter(activeBanner.id as any);
      
      // Determine Rarity based on banner and favourites
      const favs = char.favourites || 0;
      let rarity = 'Normal';
      let statMultiplier = 1;
      let color = 'text-gray-400 border-gray-400';
      
      const rand = Math.random() * 100;
      let ssrChance = activeBanner.id === 'void' ? 5 : activeBanner.id === 'abyss' ? 1 : activeBanner.id === 'premium' ? 0.2 : 0.05;
      let epicChance = activeBanner.id === 'void' ? 15 : activeBanner.id === 'abyss' ? 5 : activeBanner.id === 'premium' ? 1.5 : 0.5;
      let rareChance = activeBanner.id === 'void' ? 30 : activeBanner.id === 'abyss' ? 15 : activeBanner.id === 'premium' ? 5 : 2;
      
      const currentPity = profile.pityCounters?.[activeBanner.id] || 0;
      let newPity = currentPity + 1;
      
      // Soft Pity: Increase SSR chance significantly after 70 pulls
      if (currentPity >= 70) {
        ssrChance += (currentPity - 70) * 2; // +2% per pull after 70
      }

      if (currentPity >= 89 || rand <= ssrChance || favs > 80000) {
        rarity = 'SSR';
        statMultiplier = 5;
        color = 'text-purple-400 border-purple-400 shadow-[0_0_50px_rgba(168,85,247,0.8)]';
        newPity = 0; // Reset pity on SSR
      } else if (rand <= epicChance || favs > 40000) {
        rarity = 'Epic';
        statMultiplier = 3;
        color = 'text-yellow-400 border-yellow-400 shadow-[0_0_30px_rgba(234,179,8,0.6)]';
      } else if (rand <= rareChance || favs > 10000) {
        rarity = 'Rare';
        statMultiplier = 1.5;
        color = 'text-cyan-400 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.4)]';
      } else {
        rarity = 'Normal';
        statMultiplier = 1;
        color = 'text-gray-400 border-gray-400 shadow-[0_0_10px_rgba(156,163,175,0.2)]';
      }

      const mediaNode = char.media.nodes[0];
      let mediaType = 'Anime';
      if (mediaNode) {
        if (mediaNode.type === 'MANGA') {
          mediaType = mediaNode.countryOfOrigin === 'KR' ? 'Manhwa' : 'Manga';
        }
      }

      const existingCardIndex = profile.inventory?.findIndex(
        c => c.characterName === char.name.full && c.mediaTitle === (mediaNode?.title.romaji || 'Unknown') && c.rarity === rarity
      );

      let resultCard;
      const newInventory = [...(profile.inventory || [])];

      if (existingCardIndex !== undefined && existingCardIndex !== -1) {
        // Duplicate found, increment mergeLevel and stats
        const existingCard = newInventory[existingCardIndex];
        const currentMergeLevel = existingCard.mergeLevel || 0;
        
        resultCard = {
          ...existingCard,
          atk: Math.floor(existingCard.atk * 1.15),
          def: Math.floor(existingCard.def * 1.15),
          spd: Math.floor(existingCard.spd * 1.15),
          mergeLevel: currentMergeLevel + 1,
          durability: 100
        };
        newInventory[existingCardIndex] = resultCard;
      } else {
        // New card
        resultCard = {
          id: crypto.randomUUID(),
          characterName: char.name.full,
          mediaTitle: mediaNode?.title.romaji || 'Unknown',
          mediaType,
          imageUrl: char.image.large,
          rarity,
          atk: Math.floor(Math.random() * 100 * statMultiplier) + 10,
          def: Math.floor(Math.random() * 100 * statMultiplier) + 10,
          spd: Math.floor(Math.random() * 100 * statMultiplier) + 10,
          durability: 100,
          mergeLevel: 0,
        };
        newInventory.push(resultCard);
      }

      const now = new Date().toISOString();
      const hasDoubleXp = profile.activeBoosts?.double_xp && profile.activeBoosts.double_xp > now;
      const xpGained = hasDoubleXp ? 100 : 50;

      // Deduct costs and add to inventory
      const userRef = doc(db, 'users', profile.uid);
      const updates: any = {
        coins: increment(-activeBanner.cost),
        energy: increment(-activeBanner.energy),
        xp: increment(xpGained),
        inventory: newInventory,
        [`pityCounters.${activeBanner.id}`]: newPity
      };
      
      if (activeBanner.requiresKey) {
        updates.hasVoidKey = false;
      }

      await updateDoc(userRef, updates);

      setTimeout(() => {
        setResult({ ...resultCard, color });
        setPulling(false);
      }, 2000); // Fake animation delay
      
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'users');
      setError(t.failedPull);
      setPulling(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh]">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-black tracking-widest uppercase mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-cyan-400">
          {t.altarSummons}
        </h1>
        <p className="text-white/60 max-w-lg mx-auto mb-8">
          {t.offerGold}
        </p>

        {/* Banner Selection */}
        <div className="flex flex-wrap justify-center gap-4 mb-8">
          {BANNERS.map(banner => (
            <button
              key={banner.id}
              onClick={() => { setActiveBanner(banner); setResult(null); setError(''); }}
              className={`px-6 py-3 rounded-xl font-bold tracking-widest uppercase border-2 transition-all ${
                activeBanner.id === banner.id 
                  ? `bg-gradient-to-r ${banner.color} border-transparent text-white shadow-[0_0_20px_rgba(255,255,255,0.2)]` 
                  : 'bg-black/50 border-white/10 text-white/50 hover:bg-white/5 hover:text-white'
              }`}
            >
              {t[banner.name] || banner.name}
            </button>
          ))}
        </div>

        <div className="flex gap-4 justify-center font-mono text-sm">
          <span className="text-yellow-400 bg-yellow-400/10 px-4 py-2 rounded-full border border-yellow-400/20">
            {t.cost}: {activeBanner.cost.toLocaleString()} G
          </span>
          <span className="text-cyan-400 bg-cyan-400/10 px-4 py-2 rounded-full border border-cyan-400/20">
            {t.cost}: {activeBanner.energy} E
          </span>
          <span className="text-purple-400 bg-purple-400/10 px-4 py-2 rounded-full border border-purple-400/20">
            {t.pity || 'Pity'}: {profile?.pityCounters?.[activeBanner.id] || 0}/200
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-8 px-6 py-3 bg-red-500/20 border border-red-500 text-red-400 rounded-xl font-bold">
          {error}
        </div>
      )}

      <div className="relative w-[300px] h-[450px] perspective-1000">
        <AnimatePresence mode="wait">
          {!result && !pulling && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={`w-full h-full bg-black/50 border-2 border-dashed ${activeBanner.border} rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-[0_0_30px_rgba(0,0,0,0.5)]`}
            >
              <button
                onClick={handlePullClick}
                disabled={pulling}
                className="group relative px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl overflow-hidden transition-all disabled:opacity-50"
              >
                <div className={`absolute inset-0 bg-gradient-to-r ${activeBanner.color} opacity-0 group-hover:opacity-20 transition-opacity`} />
                <span className="relative font-black tracking-widest uppercase flex items-center gap-2">
                  <Sparkles size={20} /> {t.summon}
                </span>
              </button>
            </motion.div>
          )}

          {pulling && (
            <motion.div
              key="pulling"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ 
                scale: [0.8, 1.1, 1],
                rotate: [0, -5, 5, -5, 0],
                opacity: 1 
              }}
              transition={{ duration: 2, ease: "easeInOut" }}
              className={`w-full h-full bg-gradient-to-t ${activeBanner.color} rounded-2xl border-2 ${activeBanner.border} shadow-[0_0_100px_rgba(255,255,255,0.2)] flex items-center justify-center`}
            >
              <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin" />
            </motion.div>
          )}

          {result && (
            <motion.div
              key="result"
              initial={{ rotateY: 180, scale: 0.5, opacity: 0 }}
              animate={{ rotateY: 0, scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 15 }}
              className={`w-full h-full bg-black rounded-2xl border-2 overflow-hidden relative ${result.color}`}
            >
              {result.imageUrl ? (
                <img 
                  src={result.imageUrl} 
                  alt={result.characterName}
                  className="w-full h-full object-cover opacity-80"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-white/5 flex items-center justify-center">
                  <Sparkles className="text-white/20 w-24 h-24" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              
              <div className="absolute top-4 right-4 px-3 py-1 bg-black/80 backdrop-blur-md rounded-full font-black tracking-widest text-sm border border-current">
                {result.rarity}
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-6 bg-black/80 backdrop-blur-md border-t border-white/10">
                <h2 className="text-2xl font-black mb-1 truncate">{result.characterName}</h2>
                <p className="text-xs text-white/50 uppercase tracking-widest mb-4 truncate">{result.mediaTitle}</p>
                
                <div className="grid grid-cols-3 gap-2 text-center font-mono text-sm">
                  <div className="bg-red-500/20 text-red-400 py-1 rounded border border-red-500/30">
                    <div className="text-[10px] uppercase opacity-70">ATK</div>
                    {result.atk}
                  </div>
                  <div className="bg-blue-500/20 text-blue-400 py-1 rounded border border-blue-500/30">
                    <div className="text-[10px] uppercase opacity-70">DEF</div>
                    {result.def}
                  </div>
                  <div className="bg-green-500/20 text-green-400 py-1 rounded border border-green-500/30">
                    <div className="text-[10px] uppercase opacity-70">SPD</div>
                    {result.spd}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {result && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setResult(null)}
          className="mt-8 px-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold tracking-widest uppercase transition-colors"
        >
          {t.summonAgain}
        </motion.button>
      )}

      <InterstitialAd isOpen={isAdOpen} onClose={handleAdClose} />
    </div>
  );
}
