import { ReactNode, useEffect, useState, useRef } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ShadowCompanion } from './ShadowCompanion';
import { Chatbot } from './Chatbot';
import { NicknameModal } from './NicknameModal';
import { StickyAd } from './StickyAd';
import { useUserStore, calculateLevel, getRank } from '../store/useUserStore';
import { doc, onSnapshot, setDoc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export function Layout({ children }: { children: ReactNode }) {
  const { setAuthUser, setProfile, setIsLoading, profile, updateActiveMinutes } = useUserStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const xpTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Presence System
  useEffect(() => {
    if (!profile) return;
    
    const interval = setInterval(() => {
      if (document.hasFocus()) {
        updateActiveMinutes();
      }
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, [profile?.uid, updateActiveMinutes]);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const isGoogle = user.providerData.some(p => p.providerId === 'google.com');
        if (!user.emailVerified && !isGoogle) {
          // Allow unverified users to be signed out if they just registered
          auth.signOut();
          setAuthUser(null);
          setProfile(null);
          setIsLoading(false);
          return;
        }
      }

      setAuthUser(user);
      
      // Clean up previous profile listener if it exists
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (user) {
        const userRef = doc(db, 'users', user.uid);
        unsubscribeProfile = onSnapshot(userRef, async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const missingFields: any = {};
            if (data.xp === undefined || data.xp === null) missingFields.xp = 0;
            if (data.level === undefined || data.level === null) missingFields.level = 1;
            if (data.rank === undefined || data.rank === null) missingFields.rank = 'E';
            if (data.coins === undefined || data.coins === null) missingFields.coins = 100;
            if (data.voidCrystals === undefined || data.voidCrystals === null) missingFields.voidCrystals = 0;
            if (data.abyssalDust === undefined || data.abyssalDust === null) missingFields.abyssalDust = 0;
            if (data.energy === undefined || data.energy === null) missingFields.energy = 100;
            if (data.timeSpent === undefined || data.timeSpent === null) missingFields.timeSpent = 0;
            if (data.weeklyTimeSpent === undefined || data.weeklyTimeSpent === null) missingFields.weeklyTimeSpent = 0;
            if (data.lastLogin === undefined || data.lastLogin === null) missingFields.lastLogin = new Date().toISOString();
            if (data.nsfwEnabled === undefined || data.nsfwEnabled === null) missingFields.nsfwEnabled = false;
            if (data.role === undefined || data.role === null) missingFields.role = 'user';
            if (data.uid === undefined || data.uid === null) missingFields.uid = user.uid;
            if (data.pityCounters === undefined || data.pityCounters === null) missingFields.pityCounters = {};
            if (data.completedDailyQuests === undefined || data.completedDailyQuests === null) missingFields.completedDailyQuests = [];
            if (data.completedQuests === undefined || data.completedQuests === null) missingFields.completedQuests = [];
            
            if (data.displayName === null) missingFields.displayName = '';
            if (data.email === null) missingFields.email = '';
            if (data.photoURL === null) missingFields.photoURL = '';
            
            if (Object.keys(missingFields).length > 0) {
              try {
                await setDoc(userRef, missingFields, { merge: true });
              } catch (e) {
                handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
              }
            }

            // Sync Public Profile
            const syncPublicProfile = async () => {
              try {
                const publicRef = doc(db, 'public_profiles', user.uid);
                await setDoc(publicRef, {
                  uid: user.uid,
                  nickname: data.nickname || '',
                  displayName: data.displayName || '',
                  photoURL: data.photoURL || '',
                  xp: data.xp || 0,
                  level: data.level || 1,
                  rank: data.rank || 'E',
                  coins: data.coins || 0,
                  energy: data.energy || 0,
                  weeklyTimeSpent: data.weeklyTimeSpent || 0,
                  profileBanner: data.profileBanner || '',
                  championWeek: data.championWeek || ''
                }, { merge: true });
              } catch (e) {
                console.error("Failed to sync public profile", e);
              }
            };
            syncPublicProfile();

            // Hellish Leveling Check
            const currentXp = data.xp || 0;
            const newLevel = calculateLevel(currentXp);
            if (newLevel !== data.level) {
              try {
                await updateDoc(userRef, {
                  level: newLevel,
                  rank: getRank(newLevel)
                });
              } catch (e) {
                handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
              }
            }

            // Daily Reset Check (US Time - Midnight)
            const d = new Date();
            const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
            const parts = formatter.formatToParts(d);
            const year = parts.find(p => p.type === 'year')?.value;
            const month = parts.find(p => p.type === 'month')?.value;
            const day = parts.find(p => p.type === 'day')?.value;
            const todayUS = `${year}-${month}-${day}`;
            
            if (data.dailyQuestsReset !== todayUS) {
              // Weekly Streak Logic (Resets on Sunday)
              const usDateObj = new Date(new Date().toLocaleString("en-US", {timeZone: "America/New_York"}));
              const dayOfWeek = usDateObj.getDay(); // 0 = Sunday, 1 = Monday
              const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
              const mondayDate = new Date(usDateObj);
              mondayDate.setDate(usDateObj.getDate() - diffToMonday);
              const currentWeekStr = `${mondayDate.getFullYear()}-${mondayDate.getMonth() + 1}-${mondayDate.getDate()}`;

              let weeklyLogins = data.loginStreak || 0;
              if (data.lastStreakClaim !== currentWeekStr) {
                  // NEW WEEK DETECTED
                  // 1. Identify and Save Winner of the Previous Week
                  const handleWeeklyWinner = async () => {
                    try {
                      const prevWeekRef = doc(db, 'weekly_winners', data.lastStreakClaim || 'initial');
                      const prevWeekSnap = await getDoc(prevWeekRef);
                      
                      if (!prevWeekSnap.exists() && data.lastStreakClaim) {
                        // Fetch top user by weeklyTimeSpent
                        const { collection, query, orderBy, limit, getDocs } = await import('firebase/firestore');
                        const q = query(collection(db, 'users'), orderBy('weeklyTimeSpent', 'desc'), limit(1));
                        const topSnap = await getDocs(q);
                        if (!topSnap.empty) {
                          const winner = topSnap.docs[0].data();
                          await setDoc(prevWeekRef, {
                            winnerId: topSnap.docs[0].id,
                            winnerName: winner.nickname || winner.displayName,
                            score: winner.weeklyTimeSpent,
                            timestamp: new Date().toISOString()
                          });
                        }
                      }
                    } catch (e) {
                      console.error("Failed to process weekly winner", e);
                    }
                  };
                  handleWeeklyWinner();

                  weeklyLogins = 0; // Reset if it's a new week
              }
              weeklyLogins += 1;

              let gaveSSR = false;
              // If they reached 7 logins this week, and haven't claimed this week's SSR
              if (weeklyLogins >= 7 && data.lastWeeklyReward !== currentWeekStr) {
                  gaveSSR = true;
              }

              // Wealth Tax Logic (Progressive)
              let taxAmount = 0;
              const hasProtection = data.protectionWardUntil && new Date(data.protectionWardUntil) > new Date();
              if (!hasProtection) {
                if (data.coins > 10000000) {
                  taxAmount = Math.floor(data.coins * 0.05); // 5% tax for ultra-rich
                } else if (data.coins > 5000000) {
                  taxAmount = Math.floor(data.coins * 0.03); // 3% tax
                } else if (data.coins > 1000000) {
                  taxAmount = Math.floor(data.coins * 0.02); // 2% tax
                }
              }

              let coinsChange = 0;
              if (taxAmount > 0) coinsChange -= taxAmount;
              if (gaveSSR) coinsChange += 100000;

              try {
                await updateDoc(userRef, {
                  dailyQuestsReset: todayUS,
                  completedDailyQuests: [], // Correctly reset daily quests
                  trailersWatched: 0,
                  mediaViewedCount: 0,
                  manhwaViewedCount: 0,
                  mangaViewedCount: 0,
                  animeViewedCount: 0,
                  searchPerformed: false,
                  searchCount: 0,
                  marketVisited: false,
                  gachaPullsToday: 0,
                  todayArenaAttacks: 0,
                  todayGoldSpent: 0,
                  dailyActiveMinutes: 0,
                  energy: 100, // Refill energy daily
                  loginStreak: weeklyLogins,
                  lastStreakClaim: currentWeekStr,
                  weeklyTimeSpent: 0, // Reset weekly time
                  lastTaxTime: new Date().toISOString(),
                  ...(coinsChange !== 0 ? { coins: increment(coinsChange) } : {}),
                  ...(gaveSSR ? { 
                    lastWeeklyReward: currentWeekStr,
                    xp: increment(5000) 
                  } : {})
                });
              } catch (e) {
                handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
              }
            }

            setProfile({ ...data, ...missingFields } as any);
          } else {
            try {
              await setDoc(userRef, {
                uid: user.uid,
                displayName: user.displayName || '',
                email: user.email || '',
                photoURL: user.photoURL || '',
                xp: 0,
                level: 1,
                rank: 'E',
                coins: 100,
                voidCrystals: 0,
                abyssalDust: 0,
                energy: 100,
                timeSpent: 0,
                weeklyTimeSpent: 0,
                lastLogin: new Date().toISOString(),
                nsfwEnabled: false,
                role: 'user',
                inventory: [],
                activeBoosts: {},
                pityCounters: {},
                completedDailyQuests: [],
                completedQuests: [],
              });
            } catch (e) {
              handleFirestoreError(e, OperationType.CREATE, `users/${user.uid}`);
            }
          }
          setIsLoading(false);
        }, (error) => {
          setIsLoading(false);
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        });
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, [setAuthUser, setProfile, setIsLoading]);

  // Browsing XP Timer (1 XP every 60 seconds) & Energy Regen (1 Energy every 10 mins)
  useEffect(() => {
    if (profile?.uid) {
      // Clear any existing timer to avoid duplicates
      if (xpTimerRef.current) clearInterval(xpTimerRef.current);
      
      xpTimerRef.current = setInterval(async () => {
        try {
          const userRef = doc(db, 'users', profile.uid);
          const now = new Date().toISOString();
          // We use the latest energy from the store, but we don't want to restart the interval when it changes
          // So we check it inside the interval
          const currentEnergy = useUserStore.getState().profile?.energy || 0;
          const shouldRegenEnergy = Math.random() < 0.1 && currentEnergy < 100;
          
          await updateDoc(userRef, {
            xp: increment(1),
            lastPassiveReward: now,
            ...(shouldRegenEnergy ? { energy: increment(1) } : {})
          });
        } catch (e) {
          console.error("Failed to grant passive rewards", e);
        }
      }, 60000);
    }
    return () => {
      if (xpTimerRef.current) clearInterval(xpTimerRef.current);
    };
  }, [profile?.uid]); // Only depend on UID to prevent frequent restarts

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-purple-500/30 flex">
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className="flex-1 flex flex-col min-w-0 md:pl-64 transition-all duration-300">
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} />
        
        <main className="flex-1 p-4 md:p-8 pt-24 md:pt-28 pb-[80px] max-w-[1600px] mx-auto w-full flex flex-col">
          <div className="flex-1">
            {children}
          </div>
        </main>
      </div>

      <ShadowCompanion />
      <Chatbot />
      <NicknameModal />
      <StickyAd />
    </div>
  );
}

