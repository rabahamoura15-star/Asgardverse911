import { useState, useEffect } from 'react';
import { Shield, Plus, Users, Search, Swords, X, LogOut } from 'lucide-react';
import { useUserStore } from '../store/useUserStore';
import { translations } from '../translations';
import { collection, query, getDocs, doc, setDoc, updateDoc, getDoc, arrayUnion, arrayRemove, deleteDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export function Guilds() {
  const { profile, language } = useUserStore();
  const t = translations[language] as any;
  const [guilds, setGuilds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newGuildName, setNewGuildName] = useState('');
  const [error, setError] = useState('');
  const [myGuild, setMyGuild] = useState<any>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [donateAmount, setDonateAmount] = useState(10000);
  const [showTerritoryWars, setShowTerritoryWars] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [biddingOn, setBiddingOn] = useState<any>(null);
  const [bidAmount, setBidAmount] = useState(100000);
  const [controlledTerritories, setControlledTerritories] = useState<any[]>([]);
  const [guildMembers, setGuildMembers] = useState<any[]>([]);

  const fetchControlledTerritories = async (guildId: string) => {
    try {
      const q = query(collection(db, 'territories'));
      const querySnapshot = await getDocs(q);
      const territories: any[] = [];
      querySnapshot.forEach((doc) => {
        if (doc.data().controllingGuildId === guildId) {
          territories.push({ id: doc.id, ...doc.data() });
        }
      });
      setControlledTerritories(territories);
    } catch (e) {
      console.error("Failed to fetch territories", e);
    }
  };

  const handleSearchAnime = async () => {
    if (!searchQuery) return;
    setSearching(true);
    try {
      // We'll just fetch from AniList directly here for simplicity
      const query = `
        query ($search: String) {
          Page(page: 1, perPage: 10) {
            media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
              id
              title { romaji english }
              coverImage { large }
            }
          }
        }
      `;
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables: { search: searchQuery } })
      });
      const data = await response.json();
      setSearchResults(data.data.Page.media);
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  const handlePlaceBid = async () => {
    if (!profile || !myGuild || !biddingOn) return;
    
    if (myGuild.leaderId !== profile.uid) {
      alert(t.onlyLeaderCanBid || "Only the Corporation Leader can place bids on territories.");
      return;
    }

    if ((myGuild.goldPool || 0) < bidAmount) {
      alert(t.notEnoughGoldInPool || "Corporation does not have enough Gold in the pool.");
      return;
    }

    setIsProcessing(true);
    try {
      const territoryRef = doc(db, 'territories', biddingOn.id.toString());
      const territorySnap = await getDoc(territoryRef);
      
      let currentHighestBid = 0;
      let amountToDeduct = bidAmount;

      if (territorySnap.exists()) {
        const data = territorySnap.data();
        currentHighestBid = data.highestBid || 0;
        if (bidAmount <= currentHighestBid) {
          alert(`${t.bidMustBeHigher || 'Bid must be higher than current highest bid'} (${currentHighestBid.toLocaleString()} G).`);
          setIsProcessing(false);
          return;
        }
        
        if (data.controllingGuildId === myGuild.id) {
          // If we already control it, just deduct the difference
          amountToDeduct = bidAmount - currentHighestBid;
        } else if (data.controllingGuildId) {
          // Refund previous highest bidder
          const prevGuildRef = doc(db, 'guilds', data.controllingGuildId);
          await updateDoc(prevGuildRef, {
            goldPool: increment(currentHighestBid)
          });
        }
      }

      // Deduct from current guild
      const guildRef = doc(db, 'guilds', myGuild.id);
      await updateDoc(guildRef, {
        goldPool: increment(-amountToDeduct)
      });

      // Update territory
      await setDoc(territoryRef, {
        mediaId: biddingOn.id,
        mediaTitle: biddingOn.title.english || biddingOn.title.romaji,
        mediaCover: biddingOn.coverImage.large,
        controllingGuildId: myGuild.id,
        controllingGuildName: myGuild.name,
        highestBid: bidAmount,
        lastBidAt: new Date().toISOString()
      }, { merge: true });

      alert(`${t.successfullyPlacedBid || 'Successfully placed a bid of'} ${bidAmount.toLocaleString()} G ${t.on || 'on'} ${biddingOn.title.english || biddingOn.title.romaji}!`);
      setBiddingOn(null);
      fetchGuilds(); // Refresh guild data
    } catch (e) {
      console.error(e);
      alert(t.failedToPlaceBid || "Failed to place bid.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDonate = async () => {
    if (!profile || !myGuild) return;
    if (profile.coins < donateAmount) {
      setError(t.notEnoughGoldToDonate || 'Not enough Gold to donate.');
      return;
    }
    if (donateAmount <= 0) return;

    setIsProcessing(true);
    try {
      const userRef = doc(db, 'users', profile.uid);
      const guildRef = doc(db, 'guilds', myGuild.id);

      await updateDoc(userRef, {
        coins: increment(-donateAmount)
      });

      await updateDoc(guildRef, {
        goldPool: increment(donateAmount)
      });

      alert(`${t.donated || 'Donated'} ${donateAmount.toLocaleString()} ${t.goldToCorporation || 'Gold to the Corporation!'}`);
      fetchGuilds();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'guilds');
      setError(t.failedToDonate || 'Failed to donate.');
    } finally {
      setIsProcessing(false);
    }
  };

  const fetchGuilds = async () => {
    try {
      const q = query(collection(db, 'guilds'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGuilds(data);

      if (profile?.guildId) {
        const myGuildData = data.find(g => g.id === profile.guildId);
        setMyGuild(myGuildData || null);
        if (myGuildData) {
          fetchControlledTerritories(myGuildData.id);
        }
      } else {
        setMyGuild(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'guilds');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuilds();
  }, [profile?.guildId]);

  const handleCreateGuild = async () => {
    if (!profile) return;
    if (!profile.hasGuildToken) {
      setError(t.needGuildToken || 'You need a Guild Token from the Market to create a guild.');
      return;
    }
    if (profile.coins < 1000000) {
      setError(t.needGoldForGuild || 'You need 1,000,000 Gold to establish a guild.');
      return;
    }
    if (newGuildName.length < 3 || newGuildName.length > 20) {
      setError(t.guildNameLength || 'Guild name must be between 3 and 20 characters.');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const guildId = newGuildName.toLowerCase().replace(/\s+/g, '-');
      const guildRef = doc(db, 'guilds', guildId);
      
      const guildSnap = await getDoc(guildRef);
      if (guildSnap.exists()) {
        setError(t.guildNameExists || 'A guild with this name already exists.');
        setCreating(false);
        return;
      }

      // Create Guild
      await setDoc(guildRef, {
        name: newGuildName,
        leaderId: profile.uid,
        members: [profile.uid],
        level: 1,
        xp: 0,
        createdAt: new Date().toISOString()
      });

      // Update User
      await updateDoc(doc(db, 'users', profile.uid), {
        hasGuildToken: false,
        guildId: guildId,
        coins: increment(-1000000)
      });

      setNewGuildName('');
      fetchGuilds();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'guilds');
      setError(t.failedToCreateGuild || 'Failed to create guild.');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinGuild = async (guildId: string) => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'guilds', guildId), {
        members: arrayUnion(profile.uid)
      });
      await updateDoc(doc(db, 'users', profile.uid), {
        guildId: guildId
      });
      fetchGuilds();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `guilds/${guildId}`);
      setError(t.failedToJoinGuild || 'Failed to join guild.');
    }
  };

  const handleLeaveGuild = async () => {
    if (!profile || !myGuild) return;

    try {
      if (myGuild.leaderId === profile.uid) {
        if (myGuild.members.length === 1) {
          // Disband
          await deleteDoc(doc(db, 'guilds', myGuild.id));
        } else {
          // Assign new leader
          const newLeaderId = myGuild.members.find((uid: string) => uid !== profile.uid);
          await updateDoc(doc(db, 'guilds', myGuild.id), {
            leaderId: newLeaderId,
            members: arrayRemove(profile.uid)
          });
        }
      } else {
        // Just leave
        await updateDoc(doc(db, 'guilds', myGuild.id), {
          members: arrayRemove(profile.uid)
        });
      }

      await updateDoc(doc(db, 'users', profile.uid), {
        guildId: null
      });
      
      setMyGuild(null);
      fetchGuilds();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `guilds/${myGuild.id}`);
    }
  };

  const fetchMembers = async () => {
    if (!myGuild) return;
    setLoadingMembers(true);
    try {
      // Fetch users whose uid is in the guild's members array
      // Note: 'in' queries are limited to 10 items. For larger guilds, you'd need a different approach or multiple queries.
      // For this prototype, we'll fetch all users and filter, which is okay for small datasets but bad for prod.
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      const members = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as any))
        .filter(user => myGuild.members.includes(user.uid));
      
      setGuildMembers(members);
      setShowMembers(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'users');
    } finally {
      setLoadingMembers(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-[60vh]"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto relative">
      <div className="flex items-center gap-4 mb-10">
        <div className="p-4 bg-blue-500/20 rounded-2xl border border-blue-500/30">
          <Shield className="w-8 h-8 text-blue-400" />
        </div>
        <div>
          <h1 className="text-4xl font-black tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-500">
            {t.guildsTitle}
          </h1>
          <p className="text-white/50 font-mono text-sm mt-1">{t.joinGuild}</p>
        </div>
      </div>

      {error && (
        <div className="mb-8 px-6 py-3 bg-red-500/20 border border-red-500 text-red-400 rounded-xl font-bold">
          {error}
        </div>
      )}

      {myGuild ? (
        <div className="bg-black/40 border border-blue-500/30 rounded-2xl p-8 mb-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-center justify-between mb-8 relative z-10">
            <div>
              <h2 className="text-3xl font-black uppercase tracking-widest text-blue-400 mb-2">{myGuild.name}</h2>
              <div className="flex gap-4 font-mono text-sm text-white/60">
                <span className="flex items-center gap-1"><Shield size={14} /> {t.level || 'Level'} {myGuild.level}</span>
                <span className="flex items-center gap-1"><Users size={14} /> {myGuild.members.length} {t.members || 'Members'}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="text-right">
                <div className="text-sm text-white/50 mb-1">{t.guildXp || 'Guild XP'}</div>
                <div className="text-xl font-bold font-mono text-cyan-400">{myGuild.xp} / {myGuild.level * 1000}</div>
              </div>
              <div className="text-right mt-2">
                <div className="text-sm text-yellow-500/70 mb-1">{t.goldPool || 'Gold Pool'}</div>
                <div className="text-xl font-bold font-mono text-yellow-400">{(myGuild.goldPool || 0).toLocaleString()} G</div>
              </div>
              <button 
                onClick={handleLeaveGuild}
                className="flex items-center gap-1 px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded border border-red-500/30 text-xs font-bold uppercase tracking-widest transition-colors mt-2"
              >
                <LogOut size={12} /> {myGuild.leaderId === profile.uid ? (t.disband || 'Disband') : (t.leave || 'Leave')}
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
              <Swords className="w-8 h-8 mx-auto mb-4 text-red-400" />
              <h3 className="font-bold mb-2">{t.territoryWars || 'Territory Wars'}</h3>
              <p className="text-sm text-white/50 mb-4">{t.territoryWarsDesc || 'Bid for control over popular anime pages.'}</p>
              <button 
                onClick={() => setShowTerritoryWars(true)}
                className="w-full py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold rounded-lg transition-colors border border-red-500/30"
              >
                {t.enterWarRoom || 'Enter War Room'}
              </button>
            </div>
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-6 text-center flex flex-col">
              <Shield className="w-8 h-8 mx-auto mb-4 text-yellow-400" />
              <h3 className="font-bold mb-2 text-yellow-500">{t.fundCorporation || 'Fund Corporation'}</h3>
              <p className="text-sm text-white/50 mb-4">{t.fundCorporationDesc || 'Donate Gold to expand your corporation\'s influence.'}</p>
              <div className="mt-auto flex flex-col gap-2">
                <input
                  type="number"
                  value={donateAmount}
                  onChange={(e) => setDonateAmount(Number(e.target.value))}
                  min="1"
                  className="w-full px-3 py-2 bg-black/50 border border-yellow-500/30 rounded-lg focus:outline-none focus:border-yellow-400 transition-colors font-mono text-yellow-400 text-center"
                />
                <button
                  onClick={handleDonate}
                  disabled={isProcessing}
                  className="w-full py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 font-bold uppercase tracking-widest rounded-lg transition-colors border border-yellow-500/50 disabled:opacity-50"
                >
                  {isProcessing ? (t.processing || 'Processing...') : (t.donate || 'Donate')}
                </button>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
              <Users className="w-8 h-8 mx-auto mb-4 text-green-400" />
              <h3 className="font-bold mb-2">{t.memberList || 'Member List'}</h3>
              <p className="text-sm text-white/50 mb-4">{t.memberListDesc || 'View and manage guild members.'}</p>
              <button 
                onClick={fetchMembers}
                disabled={loadingMembers}
                className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-colors"
              >
                {loadingMembers ? (t.loading || 'Loading...') : (t.viewMembers || 'View Members')}
              </button>
            </div>
          </div>

          {controlledTerritories.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xl font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                <Shield className="text-blue-400" /> {t.controlledTerritories || 'Controlled Territories'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {controlledTerritories.map(territory => (
                  <div key={territory.id} className="bg-black/40 border border-white/10 rounded-xl overflow-hidden flex items-center">
                    <img src={territory.mediaCover} alt={territory.mediaTitle} className="w-20 h-28 object-cover" />
                    <div className="p-4 flex-1">
                      <h4 className="font-bold text-sm line-clamp-2 mb-2">{territory.mediaTitle}</h4>
                      <div className="text-xs font-mono text-yellow-400">
                        {t.bid || 'Bid'}: {territory.highestBid.toLocaleString()} G
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black tracking-widest uppercase">{t.activeGuilds || 'Active Guilds'}</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder={t.searchGuilds || "Search guilds..."}
                  className="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-blue-500/50 transition-colors w-64"
                />
              </div>
            </div>

            <div className="grid gap-4">
              {guilds.map(guild => (
                <div key={guild.id} className="flex items-center justify-between p-4 bg-black/40 border border-white/10 rounded-xl hover:border-blue-500/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/30">
                      <Shield className="text-blue-400 w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{guild.name}</h3>
                      <div className="flex gap-3 text-xs font-mono text-white/50">
                        <span>{t.lvl || 'Lvl'} {guild.level}</span>
                        <span>{guild.members.length} {t.members || 'Members'}</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleJoinGuild(guild.id)}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-colors"
                  >
                    {t.join || 'Join'}
                  </button>
                </div>
              ))}
              {guilds.length === 0 && (
                <div className="text-center py-12 text-white/30 font-mono">
                  {t.noGuilds || 'No guilds exist yet. Be the first to create one.'}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="bg-black/40 border border-blue-500/30 rounded-2xl p-6 sticky top-24">
              <h2 className="text-xl font-black tracking-widest uppercase mb-6 flex items-center gap-2">
                <Plus className="text-blue-400" /> {t.createGuild || 'Create Guild'}
              </h2>
              <p className="text-sm text-white/60 mb-6">
                {t.createGuildDesc || 'Found your own guild and lead your members to glory. Requires a Guild Token from the Market and 1,000,000 Gold.'}
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">{t.guildName || 'Guild Name'}</label>
                  <input 
                    type="text" 
                    value={newGuildName}
                    onChange={(e) => setNewGuildName(e.target.value)}
                    placeholder={t.enterGuildName || "Enter guild name..."}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                </div>
                <button 
                  onClick={handleCreateGuild}
                  disabled={creating || !newGuildName || !profile?.hasGuildToken}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-black tracking-widest uppercase rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (t.creating || 'Creating...') : (t.foundGuild || 'Found Guild (1 Token)')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Territory Wars Modal */}
      <AnimatePresence>
        {showTerritoryWars && myGuild && (
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
              className="bg-[#0a0a0a] border border-red-500/30 rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[80vh] flex flex-col"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black uppercase tracking-widest flex items-center gap-2 text-red-400">
                  <Swords className="text-red-500" /> {t.warRoom || 'War Room'}
                </h2>
                <button onClick={() => setShowTerritoryWars(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 w-5 h-5" />
                  <input 
                    type="text" 
                    placeholder={t.searchAnimeToConquer || "Search anime to conquer..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchAnime()}
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-red-500/50 transition-colors"
                  />
                </div>
                <button 
                  onClick={handleSearchAnime}
                  disabled={searching || !searchQuery}
                  className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  {searching ? (t.scanning || 'Scanning...') : (t.search || 'Search')}
                </button>
              </div>

              <div className="overflow-y-auto pr-2 space-y-4 flex-1">
                {searchResults.map(anime => (
                  <div key={anime.id} className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl hover:border-red-500/30 transition-colors">
                    <img src={anime.coverImage.large} alt={anime.title.english || anime.title.romaji} className="w-16 h-24 object-cover rounded-lg" referrerPolicy="no-referrer" />
                    <div className="flex-1">
                      <h3 className="font-bold text-lg line-clamp-1">{anime.title.english || anime.title.romaji}</h3>
                      <p className="text-sm text-white/50 line-clamp-1">{anime.title.romaji}</p>
                    </div>
                    <button 
                      onClick={() => {
                        setBiddingOn(anime);
                        setBidAmount(100000);
                      }}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold rounded-lg border border-red-500/30 transition-colors"
                    >
                      {t.target || 'Target'}
                    </button>
                  </div>
                ))}
                {searchResults.length === 0 && !searching && searchQuery && (
                  <div className="text-center py-8 text-white/50">{t.noTargetsFound || 'No targets found.'}</div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bid Modal */}
      <AnimatePresence>
        {biddingOn && myGuild && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#0a0a0a] border border-red-500 rounded-2xl p-8 max-w-md w-full shadow-[0_0_50px_rgba(239,68,68,0.2)] text-center"
            >
              <h2 className="text-3xl font-black uppercase tracking-widest text-red-500 mb-2">{t.declareWar || 'Declare War'}</h2>
              <p className="text-white/60 mb-6">{t.bidForControl || 'Bid for control of'} <span className="text-white font-bold">{biddingOn.title.english || biddingOn.title.romaji}</span></p>
              
              <img src={biddingOn.coverImage.large} alt="" className="w-32 h-48 object-cover rounded-xl mx-auto mb-6 border-2 border-red-500/50 shadow-2xl" referrerPolicy="no-referrer" />

              <div className="mb-6">
                <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">{t.bidAmountGold || 'Bid Amount (Gold)'}</label>
                <input
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(Number(e.target.value))}
                  min="100000"
                  className="w-full px-4 py-3 bg-black/50 border border-red-500/50 rounded-xl focus:outline-none focus:border-red-400 transition-colors font-mono text-yellow-400 text-center text-xl"
                />
                <p className="text-xs text-yellow-500/50 mt-2">{t.availablePool || 'Available Pool'}: {(myGuild.goldPool || 0).toLocaleString()} G</p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setBiddingOn(null)}
                  disabled={isProcessing}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  {t.retreat || 'Retreat'}
                </button>
                <button
                  onClick={handlePlaceBid}
                  disabled={isProcessing || bidAmount > (myGuild.goldPool || 0)}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest rounded-xl transition-colors disabled:opacity-50"
                >
                  {isProcessing ? (t.deploying || 'Deploying...') : (t.attack || 'Attack')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Members Modal */}
      <AnimatePresence>
        {showMembers && myGuild && (
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
              className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[80vh] flex flex-col"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black uppercase tracking-widest flex items-center gap-2">
                  <Users className="text-green-400" /> {t.members || 'Members'}
                </h2>
                <button onClick={() => setShowMembers(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="overflow-y-auto pr-2 space-y-3 flex-1">
                {guildMembers.map(member => (
                  <div key={member.uid} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-black text-lg border border-white/20 shrink-0">
                        {(member.nickname || member.displayName || '?').charAt(0).toUpperCase()}
                        {member.profileBanner === 'abyssal_conqueror' && (
                          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[6px] font-black px-1 py-0.5 rounded uppercase tracking-widest border border-red-900 shadow-lg transform rotate-12">
                            SS
                          </div>
                        )}
                        {member.profileBanner === 'tournament_champion' && (
                          <div className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[6px] font-black px-1 py-0.5 rounded uppercase tracking-widest border border-yellow-900 shadow-lg transform rotate-12">
                            CHAMP
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-bold flex items-center gap-2">
                          {member.nickname || member.displayName}
                          {member.uid === myGuild.leaderId && <Shield size={12} className="text-yellow-400" />}
                          {member.profileBanner === 'abyssal_conqueror' && <span className="text-[8px] bg-red-500/20 text-red-400 px-1 py-0.5 rounded font-black tracking-widest uppercase border border-red-500/30">Conqueror</span>}
                          {member.profileBanner === 'tournament_champion' && <span className="text-[8px] bg-yellow-500/20 text-yellow-400 px-1 py-0.5 rounded font-black tracking-widest uppercase border border-yellow-500/30">Champion</span>}
                        </div>
                        <div className="text-xs text-white/50 font-mono">{t.level || 'Level'} {member.level || 1}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
